import test from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryParser } from '../src/shared/telemetry-parser.js';
import { MockTelemetryGenerator } from '../src/server/mock-telemetry-feed.js';

test('TelemetryParser: Validates packet size requirements', () => {
  assert.equal(TelemetryParser.validate(null).valid, false);
  assert.equal(TelemetryParser.validate(Buffer.alloc(100)).valid, false);
  assert.equal(TelemetryParser.validate(Buffer.alloc(311)).valid, true);
  assert.equal(TelemetryParser.validate(Buffer.alloc(331)).valid, true);
});

test('TelemetryParser: Accurately decodes 331-byte binary packet', () => {
  const packet = MockTelemetryGenerator.buildPacket({
    timestampMs: 1234567,
    isRaceOn: true,
    engineMaxRpm: 9000,
    engineIdleRpm: 1000,
    currentEngineRpm: 7500,
    speedMps: 40.0, // 40 m/s = 89.477 mph
    accelByte: 204, // ~80%
    brakeByte: 128, // ~50.2%
    steerByte: 64,  // ~0.504 right
    gear: 3,
    lapNumber: 2,
    racePosition: 4,
    carClass: 5,
    carPI: 850
  });

  const parsed = TelemetryParser.parse(packet);

  assert.equal(parsed.timestampMs, 1234567);
  assert.equal(parsed.isRaceOn, true);
  assert.equal(Math.round(parsed.engine.maxRpm), 9000);
  assert.equal(Math.round(parsed.engine.idleRpm), 1000);
  assert.equal(Math.round(parsed.engine.currentRpm), 7500);

  // Speed checks
  assert.ok(Math.abs(parsed.motion.speedMph - 89.48) < 0.1);
  assert.ok(Math.abs(parsed.motion.speedKmh - 144.0) < 0.1);

  // Inputs
  assert.ok(Math.abs(parsed.inputs.throttle - 0.8) < 0.01);
  assert.ok(Math.abs(parsed.inputs.brake - 0.5) < 0.01);
  assert.ok(Math.abs(parsed.inputs.steering - 0.504) < 0.01);
  assert.equal(parsed.inputs.gear, 3);

  // Timing
  assert.equal(parsed.timing.lapNumber, 2);
  assert.equal(parsed.timing.racePosition, 4);

  // Vehicle
  assert.equal(parsed.vehicle.carClass, 'S');
  assert.equal(parsed.vehicle.carPerformanceIndex, 850);
});

test('TelemetryParser: Throws for corrupt or truncated buffers', () => {
  assert.throws(() => {
    TelemetryParser.parse(Buffer.alloc(50));
  }, /Packet length/);
});
