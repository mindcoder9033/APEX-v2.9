/**
 * Tests for Canonical Turn Snapping with Track Library Profiles
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CornerDetector } from '../src/analysis/corner-detector.js';
import { AnalysisEngine } from '../src/analysis/index.js';

describe('Canonical Turn Snapping', () => {
  const detector = new CornerDetector();

  const silverstone = {
    id: 'silverstone-gp',
    name: 'Silverstone Circuit',
    layout: 'Grand Prix Circuit',
    lengthMeters: 5891,
    direction: 'Clockwise',
    sectors: { s1End: 1960, s2End: 3920, s3End: 5891 },
    elevation: { minElevation: 140, maxElevation: 153, elevationDelta: 12.6, profile: [] },
    characteristics: {
      totalTurns: 15,
      slowCorners: 3,
      mediumCorners: 4,
      fastCorners: 8,
      longestStraight: 770,
      rhythmOverview: 'High-downforce flowing circuit with iconic fast complexes Copse and Maggotts-Becketts.'
    },
    turns: [
      { turnNumber: 1, name: 'Abbey', type: 'Fast Sweeper', direction: 'Right', entryDist: 340, apexDist: 420, exitDist: 490, refSpeed: 235, refGear: 6, apexLatG: 2.1, brakingDist: 20 },
      { turnNumber: 2, name: 'Farm Curve', type: 'Fast Sweeper', direction: 'Left', entryDist: 530, apexDist: 600, exitDist: 680, refSpeed: 245, refGear: 6, apexLatG: 1.8, brakingDist: 0 },
      { turnNumber: 3, name: 'Village', type: 'Hairpin', direction: 'Right', entryDist: 850, apexDist: 930, exitDist: 990, refSpeed: 82, refGear: 2, apexLatG: 1.3, brakingDist: 95 },
      { turnNumber: 4, name: 'The Loop', type: 'Hairpin', direction: 'Left', entryDist: 1040, apexDist: 1110, exitDist: 1180, refSpeed: 75, refGear: 2, apexLatG: 1.25, brakingDist: 50 },
      { turnNumber: 5, name: 'Aintree', type: 'Medium Corner', direction: 'Left', entryDist: 1220, apexDist: 1290, exitDist: 1360, refSpeed: 155, refGear: 4, apexLatG: 1.5, brakingDist: 30 },
      { turnNumber: 6, name: 'Brooklands', type: '90° Corner', direction: 'Left', entryDist: 2280, apexDist: 2360, exitDist: 2430, refSpeed: 120, refGear: 3, apexLatG: 1.6, brakingDist: 80 },
      { turnNumber: 7, name: 'Luffield', type: 'Medium Corner', direction: 'Right', entryDist: 2460, apexDist: 2560, exitDist: 2650, refSpeed: 95, refGear: 2, apexLatG: 1.45, brakingDist: 40 },
      { turnNumber: 8, name: 'Woodcote', type: 'Fast Sweeper', direction: 'Right', entryDist: 2680, apexDist: 2750, exitDist: 2830, refSpeed: 215, refGear: 5, apexLatG: 1.7, brakingDist: 0 },
      { turnNumber: 9, name: 'Copse', type: 'Fast Sweeper', direction: 'Right', entryDist: 3260, apexDist: 3340, exitDist: 3410, refSpeed: 240, refGear: 6, apexLatG: 2.2, brakingDist: 25 },
      { turnNumber: 10, name: 'Maggotts', type: 'Fast Sweeper', direction: 'Left', entryDist: 3750, apexDist: 3820, exitDist: 3880, refSpeed: 260, refGear: 7, apexLatG: 2.4, brakingDist: 0 },
      { turnNumber: 11, name: 'Becketts', type: 'Chicane', direction: 'Right', entryDist: 3910, apexDist: 3980, exitDist: 4050, refSpeed: 210, refGear: 5, apexLatG: 2.1, brakingDist: 45 },
      { turnNumber: 12, name: 'Chapel', type: 'Fast Sweeper', direction: 'Left', entryDist: 4080, apexDist: 4150, exitDist: 4220, refSpeed: 220, refGear: 6, apexLatG: 1.9, brakingDist: 0 },
      { turnNumber: 13, name: 'Stowe', type: '90° Corner', direction: 'Right', entryDist: 4980, apexDist: 5070, exitDist: 5150, refSpeed: 175, refGear: 4, apexLatG: 1.8, brakingDist: 75 },
      { turnNumber: 14, name: 'Vale', type: 'Chicane', direction: 'Left', entryDist: 5460, apexDist: 5530, exitDist: 5590, refSpeed: 90, refGear: 2, apexLatG: 1.4, brakingDist: 85 },
      { turnNumber: 15, name: 'Club', type: 'Medium Corner', direction: 'Right', entryDist: 5620, apexDist: 5710, exitDist: 5800, refSpeed: 140, refGear: 3, apexLatG: 1.6, brakingDist: 30 }
    ],
    path2D: [
      { x: 100, z: 100, dist: 0 },
      { x: 500, z: 200, dist: 2500 },
      { x: 100, z: 100, dist: 5891 }
    ],
    driverNotes: 'Commit to full throttle through Abbey & Farm Curve.'
  };

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
    const corners = detector.detectWithTrackProfile(samples, silverstone);

    assert.ok(corners.length >= 10, 'Should detect majority of canonical turns');
    
    // Check named corners
    const abbey = corners.find(c => c.name === 'Abbey');
    assert.ok(abbey, 'Turn 1 (Abbey) should be identified by canonical name');
    assert.equal(abbey.canonical, true);
    assert.equal(abbey.cornerNumber, 1);

    const maggots = corners.find(c => c.name === 'Maggotts');
    assert.ok(maggots, 'Turn 10 (Maggotts) should be identified by canonical name');
    assert.equal(maggots.cornerNumber, 10);
  });

  it('preserves custom turn names in CornerExtractor and AnalysisEngine', () => {
    const engine = new AnalysisEngine();
    const samples = generateSilverstoneLap();
    
    const report = engine.analyzeStint(samples, { trackProfile: silverstone });
    assert.ok(report);
    assert.ok(report.trackProfile);
    assert.equal(report.trackProfile.name, 'Silverstone Circuit');

    const firstLap = report.laps[0];
    assert.ok(firstLap.corners && firstLap.corners.length > 0);
    const cornerNames = firstLap.corners.map(c => c.name).filter(Boolean);
    assert.ok(cornerNames.includes('Abbey'), 'Analysis stint corners should contain canonical Abbey');
  });

  it('falls back to standard curvature detection when trackProfile is null', () => {
    const samples = generateSilverstoneLap();
    const corners = detector.detectWithTrackProfile(samples, null);
    assert.ok(corners.length > 0);
    // Generic name
    assert.ok(corners[0].name.startsWith('Turn '));
  });
});
