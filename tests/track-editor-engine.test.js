/**
 * APEX Track Editor & Waypoint Engine Unit Tests (Node Test Runner)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { trackEditorEngine, WAYPOINT_TYPES, CORNER_TYPES } from '../src/analysis/track-editor-engine.js';
import { TrackStudyLibrary } from '../src/analysis/track-study-library.js';

describe('TrackEditorEngine', () => {
  describe('5-Lap Baseline Validation & Synthesis', () => {
    it('correctly evaluates 5-lap baseline availability', () => {
      const incompleteLaps = [
        { lapNumber: 1, lapTime: 85.2, isOutLap: false, inPit: false, samples: new Array(60).fill({}) },
        { lapNumber: 2, lapTime: 84.1, isOutLap: false, inPit: false, samples: new Array(60).fill({}) },
        { lapNumber: 3, lapTime: 84.5, isOutLap: false, inPit: false, samples: new Array(60).fill({}) }
      ];
      assert.equal(trackEditorEngine.hasValid5LapBaseline(incompleteLaps), false);

      const valid5Laps = [
        ...incompleteLaps,
        { lapNumber: 4, lapTime: 83.9, isOutLap: false, inPit: false, samples: new Array(60).fill({}) },
        { lapNumber: 5, lapTime: 83.5, isOutLap: false, inPit: false, samples: new Array(60).fill({}) }
      ];
      assert.equal(trackEditorEngine.hasValid5LapBaseline(valid5Laps), true);
    });

    it('synthesizes composite spline and telemetry from 5 laps', () => {
      const mockSamples = [];
      for (let i = 0; i < 50; i++) {
        mockSamples.push({
          x: i * 10,
          z: Math.sin(i * 0.1) * 20,
          speedMph: 80 - (i < 25 ? i : 50 - i),
          throttle: i > 25 ? 100 : 0,
          brake: i < 25 ? 80 : 0,
          steer: 5,
          gLat: 0.8
        });
      }

      const mockLaps = [
        { lapNumber: 1, lapTime: 86.0, samples: mockSamples },
        { lapNumber: 2, lapTime: 85.0, samples: mockSamples },
        { lapNumber: 3, lapTime: 84.5, samples: mockSamples },
        { lapNumber: 4, lapTime: 84.0, samples: mockSamples },
        { lapNumber: 5, lapTime: 83.5, samples: mockSamples }
      ];

      const baseline = trackEditorEngine.synthesize5LapBaseline(mockLaps);
      assert.equal(baseline.lapCount, 5);
      assert.equal(baseline.fastestLapTime, 83.5);
      assert.equal(baseline.spline.length, 50);
      assert.equal(baseline.telemetry.length, 50);
      assert.ok(baseline.totalDistance > 0);
      assert.ok(Math.abs(baseline.spline[baseline.spline.length - 1].normalizedDistance - 1.0) < 0.05);
    });

    it('synthesizes composite spline from raw Forza UDP packet structure with nested motion & inputs', () => {
      const rawUdpSamples = [];
      for (let i = 0; i < 60; i++) {
        rawUdpSamples.push({
          motion: {
            position: { x: i * 8.5, y: 12.0, z: Math.cos(i * 0.12) * 35.0 },
            speedMps: 35.0,
            speedMph: 78.3,
            acceleration: { lateralG: 0.95, longitudinalG: 0.1 }
          },
          inputs: {
            throttle: 0.9,
            brake: 0.0,
            steering: 0.15
          },
          timing: {
            lapNumber: 1,
            lapDistance: i * 8.5
          }
        });
      }

      const rawLaps = [
        { lapNumber: 1, lapTime: 92.0, samples: rawUdpSamples },
        { lapNumber: 2, lapTime: 91.0, samples: rawUdpSamples },
        { lapNumber: 3, lapTime: 90.5, samples: rawUdpSamples },
        { lapNumber: 4, lapTime: 90.0, samples: rawUdpSamples },
        { lapNumber: 5, lapTime: 89.2, samples: rawUdpSamples }
      ];

      const baseline = trackEditorEngine.synthesize5LapBaseline(rawLaps);
      assert.equal(baseline.lapCount, 5);
      assert.equal(baseline.fastestLapTime, 89.2);
      assert.ok(baseline.spline.length > 0);
      // Verify real coordinates were extracted from motion.position
      assert.equal(baseline.spline[0].x, 0);
      assert.ok(baseline.spline[10].x > 0);
      assert.ok(baseline.totalDistance > 0);
    });
  });

  describe('Auto-Waypoint Detection', () => {
    it('detects brake, turn-in, apex, and track-out points from corner telemetry', () => {
      const spline = [];
      for (let i = 0; i < 100; i++) {
        const isCorner = i >= 35 && i <= 65;
        spline.push({
          index: i,
          x: i * 5,
          z: isCorner ? 50 : 0,
          distance: i * 5,
          speedMph: isCorner ? 45 : 100,
          steer: isCorner ? 25 : 0,
          gLat: isCorner ? 1.1 : 0,
          throttle: i > 55 ? 100 : 0,
          brake: (i >= 25 && i < 45) ? 85 : 0
        });
      }
      spline.forEach(p => { p.normalizedDistance = p.distance / 500; });

      const waypoints = trackEditorEngine.autoDetectWaypoints(spline);
      assert.ok(waypoints.length >= 4);

      const types = waypoints.map(w => w.type);
      assert.ok(types.includes(WAYPOINT_TYPES.BRAKE_POINT));
      assert.ok(types.includes(WAYPOINT_TYPES.TURN_IN));
      assert.ok(types.some(t => t.startsWith('APEX')));
      assert.ok(types.includes(WAYPOINT_TYPES.TRACK_OUT));
    });
  });

  describe('Spline Projection', () => {
    it('projects a 2D coordinate to the nearest track spline point', () => {
      const spline = [
        { index: 0, x: 0, z: 0, distance: 0, normalizedDistance: 0.0, speedMph: 100 },
        { index: 1, x: 100, z: 0, distance: 100, normalizedDistance: 0.5, speedMph: 90 },
        { index: 2, x: 200, z: 0, distance: 200, normalizedDistance: 1.0, speedMph: 80 }
      ];

      const proj = trackEditorEngine.projectPointToSpline(95, 5, spline);
      assert.equal(proj.index, 1);
      assert.equal(proj.distance, 100);
      assert.equal(proj.normalizedDistance, 0.5);
    });
  });

  describe('Skip Barber Corner Physics Calculations', () => {
    it('calculates theoretical corner speed from radius (15 * G * R = V^2)', () => {
      // 195 ft radius at 1.0 G -> sqrt(15 * 1.0 * 195) = sqrt(2925) = ~54.08 mph (Sebring Turn 7 example from Ch. 2)
      const speed = trackEditorEngine.calculateTheoreticalCornerSpeed(195, 1.0);
      assert.equal(Math.round(speed), 54);
    });

    it('calculates required corner radius for target speed and G force', () => {
      // 54 mph at 1.0 G -> (54^2) / (15 * 1.0) = 2916 / 15 = 194.4 ft
      const radius = trackEditorEngine.calculateRadiusForSpeed(54, 1.0);
      assert.equal(Math.round(radius), 194);
    });
  });
});

describe('TrackStudyLibrary Waypoint Persistence', () => {
  let library;

  beforeEach(() => {
    library = new TrackStudyLibrary('test_track_study_storage');
  });

  it('performs full CRUD lifecycle on custom waypoints', () => {
    const trackId = 'test-circuit--full';

    // 1. Create
    const wp1 = library.saveWaypoint(trackId, {
      cornerNumber: 1,
      type: WAYPOINT_TYPES.BRAKE_POINT,
      distanceMeters: 250,
      targetSpeedMph: 75,
      sightPicture: { label: 'Brake marker pylon' }
    });
    assert.ok(wp1.id);

    const wp2 = library.saveWaypoint(trackId, {
      cornerNumber: 1,
      type: WAYPOINT_TYPES.APEX_LATE,
      distanceMeters: 380,
      targetSpeedMph: 52,
      sightPicture: { label: 'Red dot curb' }
    });

    // 2. Read
    const list = library.getWaypoints(trackId);
    assert.equal(list.length, 2);
    assert.equal(list[0].distanceMeters, 250);
    assert.equal(list[1].distanceMeters, 380);

    // 3. Update
    library.saveWaypoint(trackId, {
      id: wp1.id,
      cornerNumber: 1,
      type: WAYPOINT_TYPES.BRAKE_POINT,
      distanceMeters: 230,
      targetSpeedMph: 80
    });
    const updatedList = library.getWaypoints(trackId);
    assert.equal(updatedList[0].distanceMeters, 230);
    assert.equal(updatedList[0].targetSpeedMph, 80);

    // 4. Delete
    const deleted = library.deleteWaypoint(trackId, wp2.id);
    assert.equal(deleted, true);
    assert.equal(library.getWaypoints(trackId).length, 1);
  });
});
