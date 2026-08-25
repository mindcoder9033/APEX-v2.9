/**
 * Tests for TrackCalibrator multi-lap consensus calibration engine
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TrackCalibrator } from '../src/analysis/track-calibrator.js';

describe('TrackCalibrator', () => {
  const calibrator = new TrackCalibrator();

  /**
   * Helper to build synthetic lap telemetry samples with known corners
   */
  function generateSyntheticLap(lapIndex, lengthMeters = 3000, baseSpeedKmh = 140, timeVarianceFactor = 1.0) {
    const samples = [];
    const sampleIntervalM = 15;
    const numSamples = Math.floor(lengthMeters / sampleIntervalM);
    const baseTimestamp = 1700000000000 + (lapIndex * 90000);

    for (let i = 0; i < numSamples; i++) {
      const dist = i * sampleIntervalM;
      let spd = baseSpeedKmh;
      let latG = 0.05;
      let steer = 0.01;
      let gear = 4;

      // Turn 1 at ~600m (Hairpin, Left)
      if (dist >= 500 && dist <= 700) {
        const delta = Math.abs(dist - 600);
        spd = 70 + (delta / 100) * 40;
        latG = -1.35 * (1 - delta / 150);
        steer = -0.35;
        gear = 2;
      }
      // Turn 2 at ~1500m (90° Corner, Right)
      else if (dist >= 1400 && dist <= 1600) {
        const delta = Math.abs(dist - 1500);
        spd = 110 + (delta / 100) * 35;
        latG = 1.5 * (1 - delta / 150);
        steer = 0.22;
        gear = 3;
      }
      // Turn 3 at ~2400m (Fast Sweeper, Right)
      else if (dist >= 2300 && dist <= 2500) {
        const delta = Math.abs(dist - 2400);
        spd = 185 + (delta / 100) * 20;
        latG = 1.9 * (1 - delta / 150);
        steer = 0.15;
        gear = 5;
      }

      const angle = (dist / lengthMeters) * Math.PI * 2;
      const x = 500 + Math.cos(angle) * 300;
      const z = 450 + Math.sin(angle) * 300;
      const y = 140 + Math.sin(angle * 2) * 15;

      samples.push({
        timestamp: baseTimestamp + (i * 200 * timeVarianceFactor),
        lapDistance: dist,
        motion: {
          speedMps: spd / 3.6,
          acceleration: { lateralG: latG, longitudinalG: 0.1, verticalG: 1.0 },
          position: { x, y, z }
        },
        inputs: { steering: steer, throttle: 0.8, brake: spd < 100 ? 0.6 : 0 },
        engine: { gear, rpm: 6000 }
      });
    }

    return samples;
  }

  it('rejects calibration when less than 2 laps provided', () => {
    const res = calibrator.calibrate([generateSyntheticLap(1)]);
    assert.equal(res.success, false);
    assert.ok(res.error.includes('At least 2'));
  });

  it('synthesizes high-fidelity track profile from 3 consistent laps', () => {
    const lap1 = generateSyntheticLap(1, 3000, 140, 1.0);
    const lap2 = generateSyntheticLap(2, 3000, 140, 1.01);
    const lap3 = generateSyntheticLap(3, 3000, 140, 0.99);

    const result = calibrator.calibrate([lap1, lap2, lap3], {
      name: 'Test Raceway',
      layout: 'Grand Prix'
    });

    assert.equal(result.success, true);
    const track = result.trackProfile;
    assert.ok(track);
    assert.equal(track.name, 'Test Raceway');
    assert.equal(track.layout, 'Grand Prix');
    assert.equal(track.id, 'test-raceway-grand-prix');
    assert.ok(track.lengthMeters >= 2900 && track.lengthMeters <= 3100);

    // Verify 3 turns detected matching synthetic corners
    assert.equal(track.turns.length, 3);

    // Turn 1 (Hairpin, Left)
    const t1 = track.turns[0];
    assert.equal(t1.type, 'Hairpin');
    assert.equal(t1.direction, 'Left');
    assert.ok(t1.apexDist >= 550 && t1.apexDist <= 650);
    assert.ok(t1.refSpeed <= 85);
    assert.equal(t1.refGear, 2);

    // Turn 2 (90° Corner, Right)
    const t2 = track.turns[1];
    assert.equal(t2.type, '90° Corner');
    assert.equal(t2.direction, 'Right');
    assert.ok(t2.apexDist >= 1450 && t2.apexDist <= 1550);

    // Turn 3 (Fast Sweeper, Right)
    const t3 = track.turns[2];
    assert.equal(t3.type, 'Fast Sweeper');
    assert.equal(t3.direction, 'Right');
    assert.ok(t3.apexDist >= 2350 && t3.apexDist <= 2450);

    // Check sectors
    assert.ok(track.sectors.s1End > 0);
    assert.ok(track.sectors.s2End > track.sectors.s1End);
    assert.equal(track.sectors.s3End, track.lengthMeters);

    // Check elevation
    assert.ok(track.elevation.elevationDelta > 0);
    assert.ok(track.path2D.length > 20);
  });

  it('rejects calibration when pace variance is excessively erratic (>15%)', () => {
    const lap1 = generateSyntheticLap(1, 3000, 140, 1.0);
    const lap2 = generateSyntheticLap(2, 3000, 140, 1.45); // 45% variance

    const result = calibrator.calibrate([lap1, lap2]);
    assert.equal(result.success, false);
    assert.ok(result.error.includes('variance'));
  });

  it('successfully calibrates when Lap 1 is a slow warm-up out-lap followed by consistent flying laps', () => {
    const lap1OutLap = generateSyntheticLap(1, 3000, 100, 1.40); // 40% slower out-lap
    const lap2Flying = generateSyntheticLap(2, 3000, 140, 1.0);
    const lap3Flying = generateSyntheticLap(3, 3000, 140, 1.01);

    const result = calibrator.calibrate([lap1OutLap, lap2Flying, lap3Flying], {
      name: 'Silverstone National',
      layout: 'National'
    });

    assert.equal(result.success, true);
    assert.equal(result.trackProfile.name, 'Silverstone National');
    assert.ok(result.trackProfile.turns.length >= 3);
  });
});
