import test from 'node:test';
import assert from 'node:assert/strict';
import { DeltaComparisonEngine, CORNER_TYPE } from '../src/analysis/delta-comparison.js';
import { AnalysisEngine } from '../src/analysis/index.js';
import { ApexPdfBuilder } from '../src/pdf/index.js';

// Helper to generate a multi-corner lap with straights of varying lengths
function createMockLap(lapNumber = 1, lapTime = 70.0, speedMultiplier = 1.0) {
  const samples = [];
  const totalSamples = 300;
  const dt = lapTime / totalSamples;

  for (let i = 0; i < totalSamples; i++) {
    const t = i * dt;
    const prog = i / totalSamples;

    let speedMps = 40.0 * speedMultiplier;
    let throttle = 1.0;
    let brake = 0.0;
    let steer = 0.0;
    
    // Continuous parametric track coordinates
    const angle = (i / totalSamples) * 2 * Math.PI;
    const posX = 150.0 * Math.cos(angle);
    const posZ = 300.0 * Math.sin(angle);
    const posY = 0;

    // Corner 1: index 30 to 80 (Apex at 60) -> Leads to long straight (Type I)
    if (i >= 30 && i < 60) {
      brake = 0.8;
      throttle = 0.0;
      steer = 0.3;
      speedMps = (50 - (i - 30) * 0.8) * speedMultiplier;
    } else if (i >= 60 && i <= 80) {
      brake = 0.0;
      throttle = 0.9;
      steer = 0.15;
      speedMps = (26 + (i - 60) * 0.8) * speedMultiplier;
    } 
    // Corner 2: index 160 to 220 (Apex at 200) -> Follows long straight (Type II)
    else if (i >= 160 && i < 200) {
      brake = 0.9;
      throttle = 0.0;
      steer = 0.35;
      speedMps = (55 - (i - 160) * 0.8) * speedMultiplier;
    } else if (i >= 200 && i <= 220) {
      brake = 0.0;
      throttle = 0.7;
      steer = 0.1;
      speedMps = (23 + (i - 200) * 0.6) * speedMultiplier;
    }
    // Corner 3: index 230 to 260 (Apex at 250) -> Short connecting link (Type III)
    else if (i >= 230 && i < 250) {
      brake = 0.4;
      throttle = 0.1;
      steer = 0.25;
      speedMps = 24.0 * speedMultiplier;
    } else if (i >= 250 && i <= 260) {
      brake = 0.0;
      throttle = 0.6;
      steer = 0.15;
      speedMps = 26.0 * speedMultiplier;
    }

    samples.push({
      timing: { lapNumber, currentLapTime: t },
      motion: {
        position: { x: posX, y: posY, z: posZ },
        speedMps,
        speedMph: speedMps * 2.236936,
        acceleration: { lateralG: steer * 3.0, longitudinalG: throttle > 0 ? 0.4 : -0.8 },
        orientation: { yaw: steer * 0.5, pitch: 0, roll: 0 }
      },
      inputs: { throttle, brake, steering: steer, gear: 3 },
      engine: { currentRpm: 6000, maxRpm: 8000 }
    });
  }

  const corners = [
    {
      cornerNumber: 1,
      type: 'Right',
      indexes: { entry: 30, turnIn: 40, apex: 50, tap: 55, exit: 60 },
      speed: { entryMph: 100 * speedMultiplier, apexMph: 45 * speedMultiplier, exitMph: 85 * speedMultiplier }
    },
    {
      cornerNumber: 2,
      type: 'Left',
      indexes: { entry: 170, turnIn: 175, apex: 180, tap: 185, exit: 190 },
      speed: { entryMph: 120 * speedMultiplier, apexMph: 42 * speedMultiplier, exitMph: 75 * speedMultiplier }
    },
    {
      cornerNumber: 3,
      type: 'Right',
      indexes: { entry: 200, turnIn: 205, apex: 210, tap: 212, exit: 215 },
      speed: { entryMph: 60 * speedMultiplier, apexMph: 50 * speedMultiplier, exitMph: 58 * speedMultiplier }
    },
    {
      cornerNumber: 4,
      type: 'Right',
      indexes: { entry: 225, turnIn: 230, apex: 235, tap: 240, exit: 245 },
      speed: { entryMph: 70 * speedMultiplier, apexMph: 48 * speedMultiplier, exitMph: 82 * speedMultiplier }
    }
  ];

  return {
    lapNumber,
    lapTime,
    isValid: true,
    samples,
    corners
  };
}

test('DeltaComparisonEngine: Skip Barber corner classification (Type I, II, III)', () => {
  const engine = new DeltaComparisonEngine({ straightDistanceThresholdMeters: 100 });
  const mockLap = createMockLap(1, 70.0, 1.0);

  const classified = engine.classifyCorners(mockLap.corners, mockLap.samples);

  assert.equal(classified.length, 4);
  assert.ok(classified[0].cornerType, 'Each corner should have a Skip Barber cornerType');
  assert.ok(classified[0].cornerTypeInfo, 'CornerTypeInfo should exist');

  // Turn 1 leads into long back straight (~400m) -> Type I
  assert.equal(classified[0].cornerType, CORNER_TYPE.TYPE_I);
  // Turn 2 follows long back straight (~400m) and precedes 50m link -> Type II
  assert.equal(classified[1].cornerType, CORNER_TYPE.TYPE_II);
  // Turn 3 is a connecting chicane/link (50m in, 50m out) -> Type III
  assert.equal(classified[2].cornerType, CORNER_TYPE.TYPE_III);
  // Turn 4 leads onto the long front straight (~450m) -> Type I
  assert.equal(classified[3].cornerType, CORNER_TYPE.TYPE_I);
});

test('DeltaComparisonEngine: Aligns normalized telemetry traces', () => {
  const engine = new DeltaComparisonEngine({ numInterpolationPoints: 50 });
  const lap1 = createMockLap(1, 68.0, 1.05); // Faster baseline
  const lap2 = createMockLap(2, 71.0, 0.95); // Slower comparison

  const traces = engine.alignLapTraces(lap1.samples, lap2.samples, 50);

  assert.equal(traces.length, 51); // 0% to 100% inclusive
  assert.equal(traces[0].progressPercent, 0);
  assert.equal(traces[50].progressPercent, 100);

  // Speed delta should reflect slower target lap (negative delta speed)
  const midPoint = traces[25];
  assert.ok(midPoint.baseline.speedMph > midPoint.target.speedMph);
  assert.ok(midPoint.delta.speedMph < 0);
});

test('DeltaComparisonEngine: Segment-by-segment time loss attribution', () => {
  const engine = new DeltaComparisonEngine();
  const baselineLap = createMockLap(1, 68.0, 1.05);
  const targetLap = createMockLap(2, 71.5, 0.95);

  const classifiedCorners = engine.classifyCorners(baselineLap.corners, baselineLap.samples);
  const attribution = engine.attributeSegmentTimeLoss(baselineLap, targetLap, classifiedCorners);

  assert.ok(attribution.cornerLosses.length === 4);
  assert.ok(attribution.straightLosses.length === 4);
  assert.ok(attribution.totalCornerTimeLossSec > 0, 'Target lap should have positive corner time loss');

  const t1Loss = attribution.cornerLosses[0];
  assert.ok(t1Loss.phases.braking.deltaSec !== undefined);
  assert.ok(t1Loss.phases.midCorner.deltaSec !== undefined);
  assert.ok(t1Loss.phases.exit.deltaSec !== undefined);
  assert.ok(t1Loss.totalDeltaSec > 0);
});

test('DeltaComparisonEngine: Ranks corner coaching opportunities by projected gain', () => {
  const engine = new DeltaComparisonEngine();
  const baselineLap = createMockLap(1, 68.0, 1.05);
  const targetLap = createMockLap(2, 72.0, 0.92);

  const result = engine.compareLaps(baselineLap, targetLap);

  assert.ok(result.summary);
  assert.equal(result.summary.baselineLapNumber, 1);
  assert.equal(result.summary.targetLapNumber, 2);
  assert.ok(result.summary.totalDeltaTimeSec > 0);
  assert.ok(result.summary.totalPotentialGainSec > 0);

  assert.ok(result.rankedOpportunities.length === 4);
  assert.equal(result.rankedOpportunities[0].rank, 1);
  assert.equal(result.rankedOpportunities[1].rank, 2);
  assert.equal(result.rankedOpportunities[2].rank, 3);
  assert.equal(result.rankedOpportunities[3].rank, 4);

  // Highest projected gain should be Rank #1 (Type I corner with downstream straight multiplier)
  assert.ok(result.rankedOpportunities[0].projectedGainSec >= result.rankedOpportunities[1].projectedGainSec);
  assert.ok(result.rankedOpportunities[0].tacticalAdvice.length > 10);
});

test('AnalysisEngine & ApexPdfBuilder: End-to-end integration with Delta Comparison Matrix', async () => {
  const engine = new AnalysisEngine();
  const lap1 = createMockLap(1, 68.5, 1.05);
  const lap2 = createMockLap(2, 71.0, 0.95);
  const stintSamples = [...lap1.samples, ...lap2.samples];

  const report = engine.analyzeStint(stintSamples);

  assert.ok(report.deltaComparison, 'Delta comparison payload should be present');
  assert.ok(report.deltaComparison.summary);
  assert.ok(report.deltaComparison.cornerLosses.length > 0);
  assert.ok(report.deltaComparison.rankedOpportunities.length > 0);

  // Test PDF builder with Delta Comparison Matrix
  const builder = new ApexPdfBuilder();
  const pdfBytes = await builder.build(report, {
    driverName: 'Skip Barber Pro',
    sessionName: 'Sprint 8 Validation',
    trackName: 'Road Atlanta'
  });

  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.length > 5000);
});
