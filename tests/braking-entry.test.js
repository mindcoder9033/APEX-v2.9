import test from 'node:test';
import assert from 'node:assert/strict';
import { BrakingEntryEngine } from '../src/analysis/braking-entry.js';

test('BrakingEntryEngine: Returns default 100 score for empty input', () => {
  const engine = new BrakingEntryEngine();
  const res = engine.analyze([], []);
  assert.equal(res.brakingEntryScore, 100);
  assert.equal(res.totalOverslowTimeLossSec, 0);
  assert.equal(res.cornerEntries.length, 0);
});

test('BrakingEntryEngine: Decomposes 4-Blocks and detects hammer slam vs squeeze', () => {
  const engine = new BrakingEntryEngine();
  const samples = [];

  // Construct corner entry samples
  for (let i = 0; i < 20; i++) {
    samples.push({
      timestampMs: i * 16,
      distanceTraveled: i * 5,
      speed: 35 - i * 0.5,
      accel: i < 3 ? 1.0 : 0.0,
      brake: i >= 4 && i <= 12 ? 0.85 : 0.0, // Abrupt brake onset in 16ms
      steer: i >= 8 ? 0.25 : 0.0,
      accelerationZ: -9.8, // 1G decel
      gear: 3,
      clutch: 0
    });
  }

  const corners = [
    { cornerNumber: 1, type: 'Right', startIndex: 0, apexIndex: 18, speed: { apexMph: 45 }, followingStraightFeet: 500 }
  ];

  const res = engine.analyze(samples, corners);
  assert.equal(res.cornerEntries.length, 1);
  const entry = res.cornerEntries[0];
  assert.ok(entry.block1.squeezeRate > 0, 'Should measure squeeze rate');
  assert.ok(entry.block2.thresholdBrakingUtilized, 'Threshold braking should be recognized');
  assert.ok(entry.block3.utilized, 'Trail-braking should be recognized');
});

test('BrakingEntryEngine: Detects downshift brake dip and overslowing time loss', () => {
  const engine = new BrakingEntryEngine();
  const samples = [];

  for (let i = 0; i < 25; i++) {
    const isDownshift = i === 8;
    samples.push({
      timestampMs: i * 16,
      distanceTraveled: i * 4,
      speed: 30 - i * 0.4,
      accel: 0.0,
      brake: isDownshift ? 0.25 : (i >= 4 && i <= 14 ? 0.8 : 0.0), // Dip from 0.8 to 0.25 at downshift
      steer: i >= 10 ? 0.2 : 0.0,
      accelerationZ: -8.0,
      gear: i < 8 ? 4 : 3,
      clutch: isDownshift ? 1.0 : 0.0
    });
  }

  const corners = [
    { cornerNumber: 2, type: 'Right', startIndex: 0, apexIndex: 20, speed: { apexMph: 40 }, followingStraightFeet: 600 }
  ];

  const optimalLap = {
    corners: [
      { cornerNumber: 2, speed: { apexMph: 46 } } // 6 mph faster at apex
    ]
  };

  const res = engine.analyze(samples, corners, optimalLap);
  assert.ok(res.totalDownshiftDips > 0, 'Should detect downshift brake dip');
  assert.ok(res.totalOverslowTimeLossSec > 0.05, 'Should calculate straightaway time loss from overslowing');
  assert.ok(res.coachingNotes.some(n => n.title.includes('Overslowing')));
});
