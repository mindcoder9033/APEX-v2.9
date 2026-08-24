import test from 'node:test';
import assert from 'node:assert/strict';
import { ChassisAdvisoryEngine } from '../src/analysis/chassis-advisory.js';

test('ChassisAdvisoryEngine: Returns default 100 for empty samples', () => {
  const engine = new ChassisAdvisoryEngine();
  const res = engine.analyze([]);
  assert.equal(res.chassisHealthScore, 100);
  assert.equal(res.bottomingStrikes.total, 0);
});

test('ChassisAdvisoryEngine: Detects suspension bottoming strikes and prescribes spring fixes', () => {
  const engine = new ChassisAdvisoryEngine();
  const samples = [];

  for (let i = 0; i < 30; i++) {
    samples.push({
      timestampMs: i * 16,
      speed: 40,
      roll: 0.02,
      pitch: 0.05,
      normSuspensionTravel: {
        frontLeft: i >= 10 && i <= 18 ? 0.99 : 0.60, // Bottoming out on front
        frontRight: i >= 10 && i <= 18 ? 0.98 : 0.60,
        rearLeft: 0.35,
        rearRight: 0.35
      }
    });
  }

  const res = engine.analyze(samples);
  assert.ok(res.bottomingStrikes.total > 0, 'Should detect bottoming strikes');
  assert.ok(res.chassisHealthScore < 90, 'Score should be penalized for bottoming');
  assert.ok(res.setupAdjustments.some(a => a.component.includes('Front Springs') || a.component.includes('Ride Height')));
});

test('ChassisAdvisoryEngine: Diagnoses understeer balance and suggests front ARB softening', () => {
  const engine = new ChassisAdvisoryEngine();
  const samples = [
    {
      timestampMs: 16,
      speed: 30,
      roll: 0.08, // ~4.6 deg roll
      pitch: 0.02,
      normSuspensionTravel: { frontLeft: 0.7, frontRight: 0.7, rearLeft: 0.5, rearRight: 0.5 }
    }
  ];

  const carControlData = {
    balancePercentages: { neutralPct: 40, understeerPct: 55, oversteerPct: 5 }
  };

  const res = engine.analyze(samples, carControlData);
  assert.ok(res.setupAdjustments.some(a => a.action.includes('front ARB')), 'Should suggest softening front ARB');
  assert.ok(res.setupAdjustments.some(a => a.component.includes('Anti-Roll Bars')), 'Should suggest stiffening ARBs for high roll');
});
