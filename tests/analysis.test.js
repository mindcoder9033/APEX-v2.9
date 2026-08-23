import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalysisEngine, LapSegmenter, CornerDetector, CornerExtractor, RulesEngine } from '../src/analysis/index.js';

// Helper to generate synthetic lap telemetry samples
function generateSyntheticLap(lapNumber = 1, sampleCount = 300) {
  const samples = [];
  const dt = 1 / 60; // 60Hz

  for (let i = 0; i < sampleCount; i++) {
    const t = i * dt;
    const progress = i / sampleCount;

    let speedMps = 45.0;
    let throttle = 1.0;
    let brake = 0.0;
    let steer = 0.0;
    let latG = 0.0;
    let currentRpm = 6500;
    let posX = i * 2.0;
    let posY = 0;
    let posZ = 0;
    let yaw = 0;

    // Corner from index 100 to 200 (apex at 150)
    if (i >= 80 && i < 120) {
      // Braking zone into Turn 1
      const brakeProgress = (i - 80) / 40;
      brake = 0.8 - (brakeProgress * 0.4); // 80% down to 40% trail
      throttle = 0.0;
      speedMps = 55.0 - (brakeProgress * 30.0); // 55 -> 25 m/s
      steer = brakeProgress * 0.3; // turn-in
      latG = brakeProgress * 0.8;
      yaw = brakeProgress * 0.3;
    } else if (i >= 120 && i <= 150) {
      // Mid-corner to Apex (150 is min speed)
      const apexProgress = (i - 120) / 30;
      speedMps = 25.0 - (apexProgress * 5.0); // 25 -> 20 m/s at apex
      brake = (1 - apexProgress) * 0.2; // trail off
      throttle = 0.0;
      steer = 0.35;
      latG = 1.2;
      yaw = 0.3 + apexProgress * 0.4;
    } else if (i > 150 && i <= 200) {
      // Exit drive
      const exitProgress = (i - 150) / 50;
      speedMps = 20.0 + (exitProgress * 25.0);
      brake = 0.0;
      throttle = exitProgress > 0.3 ? 0.9 : 0.2; // TAP at 165
      steer = 0.35 * (1 - exitProgress);
      latG = 1.2 * (1 - exitProgress);
      yaw = 0.7;
    }

    samples.push({
      timestampMs: 100000 + Math.floor(t * 1000),
      engine: {
        currentRpm,
        idleRpm: 1000,
        maxRpm: 8000,
        powerWatts: 300000,
        torqueNm: 450
      },
      motion: {
        position: { x: posX, y: posY, z: posZ },
        speedMps,
        speedMph: speedMps * 2.236936,
        speedKmh: speedMps * 3.6,
        acceleration: {
          x: latG * 9.80665,
          y: 0,
          z: 0,
          lateralG: latG,
          longitudinalG: -0.5
        },
        orientation: { yaw, pitch: 0, roll: 0 }
      },
      inputs: {
        throttle,
        brake,
        steering: steer,
        gear: 3,
        clutch: 0
      },
      tires: {
        slipRatio: { frontLeft: 0.02, frontRight: 0.02, rearLeft: 0.03, rearRight: 0.03 }
      },
      timing: {
        lapNumber,
        currentLapTime: t,
        lastLapTime: 72.5
      }
    });
  }

  return samples;
}

test('LapSegmenter: Segments stint samples into valid laps', () => {
  const segmenter = new LapSegmenter({ minLapSamples: 100, minLapDurationSec: 2.0 });
  const lap1 = generateSyntheticLap(1, 200);
  const lap2 = generateSyntheticLap(2, 200);
  const stint = [...lap1, ...lap2];

  const laps = segmenter.segmentStint(stint);
  assert.equal(laps.length, 2);
  assert.equal(laps[0].lapNumber, 1);
  assert.equal(laps[1].lapNumber, 2);
  assert.equal(laps[0].isValid, true);
  assert.ok(laps[0].maxSpeedMph > 100);
});

test('LapSegmenter: Correctly segments 0-indexed Forza laps (Lap 0 and Lap 1 -> Lap 1 and Lap 2)', () => {
  const segmenter = new LapSegmenter({ minLapSamples: 100, minLapDurationSec: 2.0 });
  const rawLap0 = generateSyntheticLap(0, 200);
  const rawLap1 = generateSyntheticLap(1, 200);
  const stint = [...rawLap0, ...rawLap1];

  const laps = segmenter.segmentStint(stint);
  assert.equal(laps.length, 2, 'Should segment exactly 2 laps');
  assert.equal(laps[0].lapNumber, 1, 'First lap should be normalized to Lap 1');
  assert.equal(laps[1].lapNumber, 2, 'Second lap should be normalized to Lap 2');
  assert.equal(laps[0].isValid, true, 'Lap 1 must be valid');
  assert.equal(laps[1].isValid, true, 'Lap 2 must be valid');
});


test('CornerDetector: Detects speed minima and classifies corners', () => {
  const detector = new CornerDetector();
  const lapSamples = generateSyntheticLap(1, 300);

  const apexes = detector.detectApexes(lapSamples);
  assert.ok(apexes.length >= 1, 'Should detect at least 1 corner');
  const c1 = apexes[0];
  assert.ok(Math.abs(c1.apexIndex - 150) <= 5, `Apex index ${c1.apexIndex} should be close to 150`);
  assert.equal(c1.type, 'Right');
});

test('CornerExtractor: Extracts racecraft landmarks & TAP distance delta', () => {
  const detector = new CornerDetector();
  const extractor = new CornerExtractor();
  const lapSamples = generateSyntheticLap(1, 300);

  const apexes = detector.detectApexes(lapSamples);
  const corners = extractor.extractAll(lapSamples, apexes);

  assert.equal(corners.length, apexes.length);
  const c1 = corners[0];

  assert.ok(c1.indexes.brake <= c1.indexes.apex, 'Brake point should be at or before apex');
  assert.ok(c1.indexes.tap >= c1.indexes.apex, 'TAP should be at or after apex');
  assert.ok(c1.dynamics.tapDeltaFeet > 0, 'Late TAP should have positive delta feet');
  assert.ok(c1.dynamics.trailBrakingOverlapPercent > 0, 'Should detect trail-braking overlap');
});

test('RulesEngine: Evaluates Skip Barber rules and diagnoses faults', () => {
  const rules = new RulesEngine();

  // Test R-001: Late Throttle
  const lateCorner = {
    cornerNumber: 1,
    dynamics: {
      tapDeltaFeet: 35.0, // > 15ft
      trailBrakingOverlapPercent: 45,
      maxBrakeReleaseRate: 0.2,
      maxTireSlipRatio: 0.1,
      peakDecelG: 1.2
    },
    inputs: { maxRpm: 8000, exitRpm: 5500, peakBrakePressure: 0.8, entryBrakePressure: 0.8, gear: 3 },
    speed: { entryMph: 90, apexMph: 45, exitMph: 75 }
  };

  const findings1 = rules.evaluateCorner(lateCorner);
  const r001 = findings1.find(f => f.id === 'R-001');
  assert.ok(r001, 'Should trigger R-001');
  assert.equal(r001.severity, 'High');
  assert.ok(r001.quote.includes('corner exit speed'));

  // Test R-007: Gear Selected Too High
  const bogCorner = {
    cornerNumber: 2,
    dynamics: { tapDeltaFeet: 5.0, trailBrakingOverlapPercent: 50, maxBrakeReleaseRate: 0.1, maxTireSlipRatio: 0.1 },
    inputs: { maxRpm: 8000, exitRpm: 3200, peakBrakePressure: 0.5, entryBrakePressure: 0.5, gear: 4 }, // 3200 < 4800 (60%)
    speed: { entryMph: 80, apexMph: 40, exitMph: 50 }
  };

  const findings2 = rules.evaluateCorner(bogCorner);
  const r007 = findings2.find(f => f.id === 'R-007');
  assert.ok(r007, 'Should trigger R-007');
  assert.equal(r007.severity, 'Medium');
});

test('AnalysisEngine: End-to-end stint analysis pipeline', () => {
  const engine = new AnalysisEngine({
    segmenter: { minLapSamples: 100, minLapDurationSec: 2.0 }
  });

  const lap1 = generateSyntheticLap(1, 300);
  const lap2 = generateSyntheticLap(2, 300);
  const report = engine.analyzeStint([...lap1, ...lap2]);

  assert.equal(report.validLapsCount, 2);
  assert.ok(report.bestLap !== null);
  assert.ok(report.laps[0].corners.length >= 1);
  assert.ok(report.findings.length >= 1);
});
