import test from 'node:test';
import assert from 'node:assert/strict';
import { CornerExtractor } from '../src/analysis/corner-extractor.js';
import { RulesEngine } from '../src/analysis/rules-engine.js';

// Helper to create synthetic corner telemetry
function createCornerSamples({
  turnInIndex = 20,
  apexIndex = 50,
  exitIndex = 80,
  brakePattern = 'smooth', // 'smooth', 'snap-off', 'none'
  steerPattern = 'standard', // 'standard', 'early-apex', 'late-apex'
  entrySpeedMps = 45.0,
  apexSpeedMps = 25.0,
  exitSpeedMps = 40.0
}) {
  const sampleCount = 100;
  const samples = [];

  for (let i = 0; i < sampleCount; i++) {
    let speedMps = 50.0;
    let brake = 0.0;
    let steer = 0.0;
    let throttle = 0.0;

    if (i < turnInIndex) {
      // Straight approaching turn
      speedMps = entrySpeedMps;
      throttle = 0.0;
      if (brakePattern === 'snap-off' && i >= 10 && i < 16) {
        brake = 1.0;
      } else if (brakePattern === 'snap-off' && i >= 16) {
        brake = 0.0; // Abrupt dump right before turn-in
      } else if (brakePattern === 'smooth' && i >= 10) {
        brake = 0.9;
      }
    } else if (i >= turnInIndex && i <= apexIndex) {
      // Turn-in to Apex
      const progress = (i - turnInIndex) / (apexIndex - turnInIndex);
      speedMps = entrySpeedMps - progress * (entrySpeedMps - apexSpeedMps);
      steer = 0.30 * Math.sin(progress * (Math.PI / 2));

      if (brakePattern === 'smooth') {
        // Continuous progressive trail-braking past turn-in
        brake = 0.7 * (1 - progress);
      } else if (brakePattern === 'none' || brakePattern === 'snap-off') {
        // No braking during steering
        brake = 0.0;
      }
    } else if (i > apexIndex && i <= exitIndex) {
      // Apex to Track-Out
      const progress = (i - apexIndex) / (exitIndex - apexIndex);
      speedMps = apexSpeedMps + progress * (exitSpeedMps - apexSpeedMps);
      throttle = progress > 0.2 ? 0.9 : 0.0;

      if (steerPattern === 'early-apex') {
        // Drifting wide post-apex: steering angle increases significantly
        steer = 0.30 + (progress < 0.5 ? progress * 0.35 : 0.35 * (1 - progress)); // Spikes up to 0.47 (+7.6 deg)
      } else if (steerPattern === 'late-apex') {
        // Prematurely unwinding
        steer = 0.02;
      } else {
        // Standard progressive unwinding
        steer = 0.30 * (1 - progress);
      }
    } else {
      // Straightaway
      speedMps = exitSpeedMps + (i - exitIndex) * 0.5;
      throttle = 1.0;
      steer = 0.0;
      brake = 0.0;
    }

    samples.push({
      timestampMs: 100000 + i * 16,
      motion: {
        position: { x: i * 2, y: 0, z: i * 2 },
        speedMps,
        speedMph: speedMps * 2.236936,
        acceleration: { lateralG: steer * 3.0, longitudinalG: brake > 0 ? -1.0 : 0.5 },
        orientation: { yaw: 0, pitch: 0, roll: 0 }
      },
      inputs: {
        throttle,
        brake,
        steering: steer,
        gear: 3
      },
      engine: { currentRpm: 6000, maxRpm: 8000 }
    });
  }

  return samples;
}

test('Sprint 6: Trail-Braking Overlap calculation & R-005 rule', () => {
  const extractor = new CornerExtractor();
  const rules = new RulesEngine();

  // 1. Smooth trail-braking corner
  const goodSamples = createCornerSamples({ brakePattern: 'smooth' });
  const goodCorner = extractor.extractCorner(goodSamples, { apexIndex: 50, cornerNumber: 1, type: 'Right 90°' });
  
  assert.ok(goodCorner.dynamics.trailBrakingOverlapPercent >= 40, `Overlap should be high (${goodCorner.dynamics.trailBrakingOverlapPercent}%)`);
  const goodFindings = rules.evaluateCorner(goodCorner);
  assert.ok(!goodFindings.some(f => f.id === 'R-005'), 'Good trail-braking should not trigger R-005');

  // 2. Abrupt braking / Zero trail-braking corner
  const noTrailSamples = createCornerSamples({ brakePattern: 'none' });
  // Add initial brake before turn-in so peakBrakePressure > 0.30
  for (let i = 5; i < 20; i++) noTrailSamples[i].inputs.brake = 0.85;

  const noTrailCorner = extractor.extractCorner(noTrailSamples, { apexIndex: 50, cornerNumber: 2, type: 'Right 90°' });
  assert.ok(noTrailCorner.dynamics.trailBrakingOverlapPercent < 20, `Overlap should be low (${noTrailCorner.dynamics.trailBrakingOverlapPercent}%)`);
  const noTrailFindings = rules.evaluateCorner(noTrailCorner);
  assert.ok(noTrailFindings.some(f => f.id === 'R-005'), 'No trail-braking with high peak brake should trigger R-005');
});

test('Sprint 6: Brake Snap-Off detection & R-006 rule', () => {
  const extractor = new CornerExtractor();
  const rules = new RulesEngine();

  const snapOffSamples = createCornerSamples({ brakePattern: 'snap-off' });
  const snapOffCorner = extractor.extractCorner(snapOffSamples, { apexIndex: 50, cornerNumber: 1, type: 'Right 90°' });

  assert.ok(snapOffCorner.dynamics.maxBrakeReleaseRate > 0.80, `Release rate (${snapOffCorner.dynamics.maxBrakeReleaseRate}) should exceed 0.80`);
  const findings = rules.evaluateCorner(snapOffCorner);
  assert.ok(findings.some(f => f.id === 'R-006'), 'Brake snap-off should trigger R-006');
});

test('Sprint 6: Early Apex detection & R-003 rule', () => {
  const extractor = new CornerExtractor();
  const rules = new RulesEngine();

  const earlyApexSamples = createCornerSamples({ steerPattern: 'early-apex' });
  const earlyCorner = extractor.extractCorner(earlyApexSamples, { apexIndex: 50, cornerNumber: 1, type: 'Right 90°' });

  assert.ok(earlyCorner.dynamics.postApexSteerCorrectionDeg > 5.0, `Correction (${earlyCorner.dynamics.postApexSteerCorrectionDeg} deg) should exceed 5 deg`);
  assert.equal(earlyCorner.dynamics.isEarlyApex, true);
  
  const findings = rules.evaluateCorner(earlyCorner);
  assert.ok(findings.some(f => f.id === 'R-003'), 'Early apex steering tightening should trigger R-003');
});
