import test from 'node:test';
import assert from 'node:assert/strict';
import { ShiftingPowerbandEngine, SHIFT_QUALITY_GRADES } from '../src/analysis/shifting-powerband.js';
import { AnalysisEngine } from '../src/analysis/index.js';

test('ShiftingPowerbandEngine: Computes usable powerband and sweet spot targets', () => {
  const engine = new ShiftingPowerbandEngine();
  const report = engine.analyzeShifting([], [], [], { idleRpm: 1200, maxRpm: 8400 });

  assert.equal(report.usablePowerband.idleRpm, 1200);
  assert.equal(report.usablePowerband.maxRpm, 8400);
  assert.equal(report.usablePowerband.usableRangeRpm, 7200);
  // 65% of 7200 is 4680 + 1200 = 5880
  assert.equal(report.usablePowerband.optimalPowerbandMin, 5880);
  // 92% of 7200 is 6624 + 1200 = 7824
  assert.equal(report.usablePowerband.optimalPowerbandMax, 7824);
});

test('ShiftingPowerbandEngine: Diagnoses bogging corners (R-007) and suggests downshifts', () => {
  const engine = new ShiftingPowerbandEngine();

  const corners = [
    {
      cornerNumber: 1,
      type: 'Hairpin',
      speed: { entryMph: 90, apexMph: 35, exitMph: 45 },
      inputs: { gear: 3, minRpm: 2500, exitRpm: 3200, maxRpm: 8000 } // 3200 / 8000 = 40% (Bogging!)
    },
    {
      cornerNumber: 2,
      type: 'Fast Sweeper',
      speed: { entryMph: 120, apexMph: 85, exitMph: 105 },
      inputs: { gear: 4, minRpm: 5800, exitRpm: 6800, maxRpm: 8000 } // 6800 / 8000 = 85% (Optimal)
    }
  ];

  const report = engine.analyzeShifting([], [], corners, { idleRpm: 1000, maxRpm: 8000 });

  assert.equal(report.cornerShifting.length, 2);
  
  const c1 = report.cornerShifting[0];
  assert.equal(c1.cornerNumber, 1);
  assert.equal(c1.isBogging, true);
  assert.equal(c1.isOverrev, false);
  assert.equal(c1.suggestedGear, 2); // Suggested downshift to Gear 2
  assert.match(c1.status, /BOGGING/);

  const c2 = report.cornerShifting[1];
  assert.equal(c2.cornerNumber, 2);
  assert.equal(c2.isBogging, false);
  assert.equal(c2.isOverrev, false);
  assert.equal(c2.suggestedGear, 4);
  assert.equal(c2.status, 'OPTIMAL');

  assert.equal(report.summary.boggingCornersCount, 1);
  assert.ok(report.recommendations.some(r => r.title.includes('Bogging')));
});

test('ShiftingPowerbandEngine: Diagnoses over-rev limiter strikes (R-008) and suggests upshift', () => {
  const engine = new ShiftingPowerbandEngine();

  const corners = [
    {
      cornerNumber: 1,
      type: 'Chicane',
      speed: { entryMph: 70, apexMph: 45, exitMph: 60 },
      inputs: { gear: 2, minRpm: 6000, exitRpm: 7850, maxRpm: 8000 } // 7850 / 8000 = 98% (Redline / Overrev!)
    }
  ];

  const report = engine.analyzeShifting([], [], corners, { idleRpm: 1000, maxRpm: 8000 });
  const c1 = report.cornerShifting[0];

  assert.equal(c1.isOverrev, true);
  assert.equal(c1.suggestedGear, 3); // Suggested upshift to Gear 3
  assert.match(c1.status, /OVER-REV/);
  assert.equal(report.summary.overrevCornersCount, 1);
});

test('ShiftingPowerbandEngine: Detects downshifts, throttle blips, and evaluates brake stability', () => {
  const engine = new ShiftingPowerbandEngine({ shiftWindowSamples: 10 });
  const samples = [];

  // Generate 60 samples representing a braking zone with a downshift from Gear 4 to Gear 3
  for (let i = 0; i < 60; i++) {
    const isDownshiftPoint = (i === 30);
    const gear = i < 30 ? 4 : 3;
    const isBraking = i >= 10 && i <= 50;
    const brake = isBraking ? 0.70 : 0.0; // Steady 70% brake pedal
    
    // Blip throttle around shift point (samples 28 to 32)
    const isBlip = (i >= 28 && i <= 32);
    const throttle = isBlip ? 0.50 : 0.0;

    samples.push({
      timestamp: i * 16.6667,
      inputs: { gear, brake, throttle },
      engine: { currentRpm: i < 30 ? 4000 : 5800, maxRpm: 8000, idleRpm: 1000 },
      lap: { currentLap: 1 }
    });
  }

  const events = engine.extractDownshiftEvents(samples, 1000, 8000);
  assert.equal(events.length, 1);

  const e = events[0];
  assert.equal(e.fromGear, 4);
  assert.equal(e.toGear, 3);
  assert.equal(e.blipDetected, true);
  assert.ok(e.peakBlipThrottlePercent >= 50);
  assert.equal(e.isBrakingShift, true);
  assert.ok(e.brakeStabilityScore >= 90, `Brake stability score ${e.brakeStabilityScore} should be high`);
  assert.equal(e.qualityGrade, 'OPTIMAL');

  const stats = engine.computeDownshiftStats(events);
  assert.equal(stats.totalDownshifts, 1);
  assert.equal(stats.blipComplianceRate, 100);
  assert.ok(stats.avgBrakeStability >= 90);
});

test('ShiftingPowerbandEngine: Penalizes brake pedal flutter during heel-and-toe downshifts', () => {
  const engine = new ShiftingPowerbandEngine({ shiftWindowSamples: 10 });
  const samples = [];

  for (let i = 0; i < 60; i++) {
    const gear = i < 30 ? 3 : 2;
    // Driver wobbles brake pedal violently from 20% to 90% while attempting blip
    const brake = (i >= 10 && i <= 50) ? (0.50 + 0.35 * Math.sin(i)) : 0.0;
    const throttle = (i >= 28 && i <= 32) ? 0.40 : 0.0;

    samples.push({
      timestamp: i * 16.6667,
      inputs: { gear, brake, throttle },
      engine: { currentRpm: 5000, maxRpm: 8000, idleRpm: 1000 },
      lap: { currentLap: 1 }
    });
  }

  const events = engine.extractDownshiftEvents(samples, 1000, 8000);
  assert.equal(events.length, 1);
  assert.ok(events[0].brakeStabilityScore < 70, `Brake wobble should penalize score (<70), got ${events[0].brakeStabilityScore}`);
});

test('AnalysisEngine: End-to-end integration provides shiftingAnalysis in stint report', () => {
  const analysisEngine = new AnalysisEngine();
  const samples = [];

  for (let i = 0; i < 120; i++) {
    const angle = (i / 120) * 2 * Math.PI;
    const gear = i < 40 ? 4 : (i < 80 ? 3 : 4);
    const throttle = i >= 60 ? 0.90 : 0.0;
    const brake = i >= 20 && i < 60 ? 0.65 : 0.0;

    samples.push({
      timestamp: i * 16.6667,
      motion: {
        position: { x: 100 * Math.cos(angle), y: 0, z: 100 * Math.sin(angle) },
        speedMps: 30 - 10 * Math.sin(angle),
        acceleration: { longitudinalG: brake > 0 ? -1.1 : 0.4, lateralG: 1.2, verticalG: 0 }
      },
      inputs: { throttle, brake, steering: 0.2 * Math.sin(angle), gear },
      engine: { currentRpm: 6200, maxRpm: 8000, idleRpm: 1000 },
      lap: { currentLap: 1 }
    });
  }

  const report = analysisEngine.analyzeStint(samples, { vehicle: { idleRpm: 1000, maxRpm: 8000 } });
  
  assert.ok(report.shiftingAnalysis, 'Report should contain shiftingAnalysis');
  assert.ok(report.shiftingAnalysis.summary, 'Should contain summary');
  assert.ok(['A', 'B', 'C', 'D'].includes(report.shiftingAnalysis.summary.grade));
  assert.ok(typeof report.shiftingAnalysis.summary.powerbandEfficiency === 'number');
  assert.ok(Array.isArray(report.shiftingAnalysis.recommendations));
});
