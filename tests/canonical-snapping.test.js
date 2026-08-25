/**
 * Tests for Canonical Turn Snapping with Track Library Profiles
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CornerDetector } from '../src/analysis/corner-detector.js';
import { AnalysisEngine } from '../src/analysis/index.js';
import { TrackRepository } from '../src/server/track-repository.js';

describe('Canonical Turn Snapping', () => {
  const detector = new CornerDetector();
  const repo = new TrackRepository();
  const silverstone = repo.getTrackById('silverstone-gp');

  /**
   * Helper to build a lap matching Silverstone's length
   */
  function generateSilverstoneLap() {
    const samples = [];
    const lengthMeters = 5891;
    const sampleIntervalM = 15;
    const numSamples = Math.floor(lengthMeters / sampleIntervalM);

    for (let i = 0; i < numSamples; i++) {
      const dist = i * sampleIntervalM;
      let spd = 200;
      let latG = 0.1;
      let steer = 0.02;
      let gear = 5;

      // Check if near any Silverstone turn apex
      for (const turn of silverstone.turns) {
        if (Math.abs(dist - turn.apexDist) <= 50) {
          spd = turn.refSpeed;
          latG = turn.direction === 'Right' ? turn.apexLatG : -turn.apexLatG;
          steer = turn.direction === 'Right' ? 0.3 : -0.3;
          gear = turn.refGear;
          break;
        }
      }

      samples.push({
        timestamp: 1700000000000 + (i * 200),
        lapDistance: dist,
        motion: {
          speedMps: spd / 3.6,
          acceleration: { lateralG: latG, longitudinalG: 0.0, verticalG: 1.0 },
          position: { x: 500 + Math.cos(dist / 100) * 100, y: 150, z: 450 + Math.sin(dist / 100) * 100 }
        },
        inputs: { steering: steer, throttle: 0.8, brake: 0 },
        engine: { gear, rpm: 6500 }
      });
    }

    return samples;
  }

  it('snaps lap telemetry samples directly to all 15 canonical Silverstone turns', () => {
    const samples = generateSilverstoneLap();
    const turns = detector.detectWithTrackProfile(samples, silverstone);

    assert.equal(turns.length, 15, 'Should snap to all 15 canonical turns');
    assert.equal(turns[0].name, 'Abbey');
    assert.equal(turns[0].turnNumber, 1);
    assert.equal(turns[0].canonical, true);

    assert.equal(turns[9].name, 'Maggotts');
    assert.equal(turns[9].turnNumber, 10);

    assert.equal(turns[12].name, 'Stowe');
    assert.equal(turns[12].turnNumber, 13);
  });

  it('falls back to dynamic corner detection when trackProfile is not provided', () => {
    const samples = generateSilverstoneLap();
    const dynamicTurns = detector.detectWithTrackProfile(samples, null);
    assert.ok(Array.isArray(dynamicTurns));
    assert.ok(dynamicTurns.length > 0);
    assert.equal(dynamicTurns[0].canonical, false);
  });

  it('AnalysisEngine seamlessly passes trackProfile and sets canonical report data', () => {
    const engine = new AnalysisEngine();
    const samples = generateSilverstoneLap();
    const report = engine.analyzeStint(samples, { trackProfile: silverstone });

    assert.ok(report);
    assert.ok(report.trackProfile);
    assert.equal(report.trackProfile.id, 'silverstone-gp');
    assert.equal(report.laps[0].corners.length, 15);
    assert.equal(report.laps[0].corners[0].name, 'Abbey');
  });
});
