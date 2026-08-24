import test from 'node:test';
import assert from 'node:assert/strict';
import { CarControlEngine } from '../src/analysis/car-control.js';

test('CarControlEngine: Returns neutral default metrics for empty samples', () => {
  const engine = new CarControlEngine();
  const res = engine.analyze([]);
  assert.equal(res.carControlScore, 100);
  assert.equal(res.balancePercentages.neutralPct, 100);
  assert.equal(res.skidEventsCount, 0);
});

test('CarControlEngine: Correctly identifies Understeer from Front vs Rear slip differential', () => {
  const engine = new CarControlEngine();
  const samples = [];
  for (let i = 0; i < 50; i++) {
    samples.push({
      timestampMs: i * 16,
      distanceTraveled: i * 5,
      speed: 30,
      velocityX: 5,
      velocityZ: 30,
      yaw: 0.16,
      accelerationX: 9.8, // ~1G Lateral
      tireSlipAngle: {
        frontLeft: 0.15,  // ~8.6 deg
        frontRight: 0.15,
        rearLeft: 0.05,   // ~2.8 deg
        rearRight: 0.05
      },
      steer: 0.3,
      accel: 0.5
    });
  }

  const res = engine.analyze(samples);
  assert.ok(res.balancePercentages.understeerPct > 90, 'Should detect majority understeer');
  assert.ok(res.coachingNotes.some(n => n.title.includes('Understeer')));
});

test('CarControlEngine: Accurately classifies TTO (Trailing Throttle Oversteer) and CPR state machine', () => {
  const engine = new CarControlEngine();
  const samples = [];

  // 1. Initial entry
  for (let i = 0; i < 10; i++) {
    samples.push({
      timestampMs: i * 16,
      distanceTraveled: i * 10,
      speed: 35,
      velocityX: 0,
      velocityZ: 35,
      yaw: 0,
      accelerationX: 7.0, // Lateral G
      tireSlipAngle: { frontLeft: 0.05, frontRight: 0.05, rearLeft: 0.05, rearRight: 0.05 },
      steer: 0.2,
      accel: 0.8
    });
  }

  // 2. Sudden Throttle Lift inducing TTO oversteer
  for (let i = 10; i < 25; i++) {
    const isMidPause = i >= 18 && i <= 20;
    samples.push({
      timestampMs: i * 16,
      distanceTraveled: i * 10,
      speed: 30,
      velocityX: 8,
      velocityZ: 25,
      yaw: 0.45, // High yaw angle (>15 deg)
      angularVelocityY: isMidPause ? 0.02 : 0.8, // At pause, yawRate drops to near zero
      accelerationX: 8.5,
      tireSlipAngle: { frontLeft: 0.05, frontRight: 0.05, rearLeft: 0.22, rearRight: 0.22 }, // Rear slip > Front slip
      steer: i < 18 ? -0.3 : 0.0, // Countersteer then unwind
      accel: 0.0 // Abrupt throttle lift
    });
  }

  // 3. Recovery straight
  for (let i = 25; i < 40; i++) {
    samples.push({
      timestampMs: i * 16,
      distanceTraveled: i * 10,
      speed: 30,
      velocityX: 0,
      velocityZ: 30,
      yaw: 0,
      angularVelocityY: 0,
      accelerationX: 0,
      tireSlipAngle: { frontLeft: 0.02, frontRight: 0.02, rearLeft: 0.02, rearRight: 0.02 },
      steer: 0,
      accel: 0.6
    });
  }

  const res = engine.analyze(samples);
  assert.ok(res.ttoEventsCount > 0, 'Should detect TTO event');
  assert.ok(res.skidEvents.length > 0, 'Should register skid event');
  const skid = res.skidEvents[0];
  assert.ok(skid.phases.correction.detected, 'Correction phase should be detected');
  assert.ok(skid.phases.pause.detected, 'Pause phase should be detected');
  assert.ok(skid.phases.recovery.detected, 'Recovery phase should be detected');
});
