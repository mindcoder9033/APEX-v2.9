import test from 'node:test';
import assert from 'node:assert/strict';
import { FrictionCircleAnalyzer, FRICTION_PHASE } from '../src/analysis/friction-circle.js';

function generateFrictionCircleSamples() {
  const samples = [];
  // 1. Straight line accelerating
  for (let i = 0; i < 20; i++) {
    samples.push({
      timestamp: i * 16,
      inputs: { throttle: 0.8, brake: 0 },
      motion: {
        speedMps: 20 + i,
        acceleration: { lateralG: 0.02, longitudinalG: 0.5 }
      }
    });
  }
  // 2. Straight line braking
  for (let i = 0; i < 20; i++) {
    samples.push({
      timestamp: 320 + i * 16,
      inputs: { throttle: 0, brake: 0.8 },
      motion: {
        speedMps: 40 - i,
        acceleration: { lateralG: 0.01, longitudinalG: -0.9 }
      }
    });
  }
  // 3. Brake-turning (trail-braking)
  for (let i = 0; i < 20; i++) {
    samples.push({
      timestamp: 640 + i * 16,
      inputs: { throttle: 0, brake: 0.3 },
      motion: {
        speedMps: 20,
        acceleration: { lateralG: 0.8, longitudinalG: -0.4 }
      }
    });
  }
  // 4. Cornering (coasting/partial lateral)
  for (let i = 0; i < 20; i++) {
    samples.push({
      timestamp: 960 + i * 16,
      inputs: { throttle: 0.05, brake: 0 },
      motion: {
        speedMps: 20,
        acceleration: { lateralG: 0.9, longitudinalG: 0 }
      }
    });
  }
  return samples;
}

test('FrictionCircleAnalyzer: Classifies phases and calculates utilization correctly', () => {
  const samples = generateFrictionCircleSamples();
  const analyzer = new FrictionCircleAnalyzer(samples);
  const result = analyzer.generateFrictionCircle();

  assert.ok(result.totalSamples > 0);
  assert.ok(result.maxG >= 0.9);

  // Check phase counts
  const acceleratingPct = result.phaseBreakdown[FRICTION_PHASE.ACCELERATING].percent;
  const brakingPct = result.phaseBreakdown[FRICTION_PHASE.BRAKING].percent;
  const brakeTurnPct = result.phaseBreakdown[FRICTION_PHASE.BRAKE_TURN].percent;
  const corneringPct = result.phaseBreakdown[FRICTION_PHASE.CORNERING].percent;

  assert.ok(acceleratingPct > 0);
  assert.ok(brakingPct > 0);
  assert.ok(brakeTurnPct > 0);
  assert.ok(corneringPct > 0);

  // Check utilization structure
  assert.ok(result.utilization.highUtilization >= 0);
  assert.ok(result.utilization.averageRadius > 0 && result.utilization.averageRadius <= 1);
});
