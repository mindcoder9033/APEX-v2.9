import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackStudyEngine } from '../src/analysis/track-study-engine.js';
import { TrackStudyPdfBuilder } from '../src/pdf/track-study-pdf-builder.js';
import { TrackStudyLibrary } from '../src/analysis/track-study-library.js';

test('TrackStudyEngine: Extracts 5-phase study with zero mock data when no telemetry is present', () => {
  const engine = new TrackStudyEngine();
  const rawProfile = {
    id: 'test-track',
    trackName: 'Silverstone Circuit',
    layoutName: 'Grand Prix Circuit',
    officialLength: '5.891 km',
    lengthMeters: 5891
  };

  const study = engine.generateStudy(rawProfile, []);

  // Must have 0 corners and NO mock data
  assert.equal(study.circuit.name, 'Silverstone Circuit');
  assert.equal(study.circuit.turnsCount, 0);
  assert.equal(study.phase1_macro.corners.length, 0);
  assert.equal(study.phase2_surface.corners.length, 0);
  assert.equal(study.phase3_reference.corners.length, 0);
  assert.equal(study.phase4_orderOfEffort.corners.length, 0);
  assert.equal(study.phase5_hardware.gearingMatrix.length, 0);
  assert.ok(study.phase1_macro.strategySummary.includes('Awaiting telemetry'));
});

test('TrackStudyEngine: Dynamically parses track corners from raw telemetry samples', () => {
  const engine = new TrackStudyEngine();
  
  // Synthesize realistic telemetry lap with 3 distinct corner deceleration/steering sequences
  const samples = [];
  const totalSamples = 300;
  
  for (let i = 0; i < totalSamples; i++) {
    const dist = i * 15; // 0 to 4500m
    let speed = 65; // m/s on straights (~145 mph)
    let steer = 0;
    let brake = 0;
    let throttle = 1.0;
    let latG = 0;

    // Turn 1 around sample 60 (Hairpin Right)
    if (i >= 45 && i <= 75) {
      if (i < 60) {
        brake = 0.9;
        throttle = 0;
        speed = 65 - (i - 45) * 3; // slows to 20 m/s
      } else {
        brake = 0;
        throttle = 0.8;
        speed = 20 + (i - 60) * 2;
      }
      steer = 0.45;
      latG = 1.6;
    }

    // Turn 2 around sample 160 (Fast Sweeper Left)
    if (i >= 145 && i <= 175) {
      if (i < 160) {
        brake = 0.3;
        throttle = 0.2;
        speed = 60 - (i - 145) * 1.2; // slows to 42 m/s
      } else {
        brake = 0;
        throttle = 1.0;
        speed = 42 + (i - 160) * 1.5;
      }
      steer = -0.25;
      latG = -1.4;
    }

    // Turn 3 around sample 240 (90-deg Right)
    if (i >= 225 && i <= 255) {
      if (i < 240) {
        brake = 0.8;
        throttle = 0;
        speed = 62 - (i - 225) * 2.2; // slows to 29 m/s
      } else {
        brake = 0;
        throttle = 0.9;
        speed = 29 + (i - 240) * 2.0;
      }
      steer = 0.35;
      latG = 1.5;
    }

    samples.push({
      motion: {
        speedMps: Math.max(15, speed),
        acceleration: { lateralG: latG },
        position: { z: i * 0.05 },
        orientation: { roll: steer * 0.05 }
      },
      inputs: {
        steering: steer,
        brake: brake,
        throttle: throttle
      },
      lapDistanceMeters: dist,
      vehicle: { gear: speed < 25 ? 2 : (speed < 45 ? 3 : 5) }
    });
  }

  const study = engine.generateStudy({ trackName: 'Telemetry Circuit', lengthMeters: 4500 }, samples);

  // Assert corners were detected and parsed from telemetry
  assert.ok(study.phase1_macro.corners.length >= 2, 'Should detect at least 2 corners from telemetry');
  assert.equal(study.circuit.turnsCount, study.phase1_macro.corners.length);
  
  const t1 = study.phase1_macro.corners[0];
  assert.ok(t1.apexSpeedMph > 0);
  assert.ok(t1.followingStraightMeters > 0);
  assert.ok(t1.brakingDistanceM > 0);
  assert.ok(t1.priorityRank >= 1);

  // Phase 2, 3, 4, 5 should all be populated from the parsed corners
  assert.equal(study.phase2_surface.corners.length, study.phase1_macro.corners.length);
  assert.equal(study.phase3_reference.corners.length, study.phase1_macro.corners.length);
  assert.equal(study.phase4_orderOfEffort.corners.length, study.phase1_macro.corners.length);
  assert.equal(study.phase5_hardware.gearingMatrix.length, study.phase1_macro.corners.length);
});

test('TrackStudyPdfBuilder: Compiles a valid 5-page PDF document', async () => {
  const engine = new TrackStudyEngine();
  const pdfBuilder = new TrackStudyPdfBuilder();

  const study = engine.generateStudy({
    id: 'test-circuit',
    trackName: 'Road America',
    layoutName: 'Grand Prix Course',
    officialLength: '6.515 km',
    lengthMeters: 6515,
    corners: [
      { number: 1, name: 'Turn 1', entrySpeedMps: 45, minSpeedMps: 35, exitSpeedMps: 42, gear: 4, followingStraightMeters: 400, camberDeg: 1.0, elevationChangeM: 0, brakingDistanceM: 50 },
      { number: 2, name: 'Turn 2', entrySpeedMps: 40, minSpeedMps: 30, exitSpeedMps: 38, gear: 3, followingStraightMeters: 300, camberDeg: -1.0, elevationChangeM: 2, brakingDistanceM: 40 }
    ]
  });

  const pdfBytes = await pdfBuilder.generate(study);
  assert.ok(pdfBytes instanceof Uint8Array, 'PDF output should be Uint8Array');
  assert.ok(pdfBytes.length > 5000, 'PDF size should be substantial for 5 pages');
  
  // Verify PDF header magic bytes "%PDF-"
  const header = String.fromCharCode(...pdfBytes.slice(0, 5));
  assert.equal(header, '%PDF-', 'Valid PDF file header signature');
});

test('TrackStudyLibrary: Catalog extraction and independent per-track profile without mock corners', () => {
  const library = new TrackStudyLibrary('test_study_store_clean');
  const catalog = library.getAllCatalogTracks();

  // 1. Catalog extraction from FM23 Tracks
  assert.ok(catalog.length >= 71, 'Should contain all 71+ FM23 track layouts');
  const realCount = catalog.filter(t => t.type === 'Real').length;
  const fictionalCount = catalog.filter(t => t.type !== 'Real').length;
  assert.ok(realCount > 30, 'Should categorize Real circuits');
  assert.ok(fictionalCount > 10, 'Should categorize Fictional circuits');

  // 2. Verified that initial profile has ZERO mock corners
  const sebringProfile = library.getTrackStudyProfile('sebring-international-raceway--full-circuit');
  assert.ok(sebringProfile, 'Sebring profile metadata should exist');
  assert.equal(sebringProfile.turnsCount, 0, 'Initial turnsCount must be 0 (no mock data)');
  assert.deepEqual(sebringProfile.corners, [], 'Initial corners must be empty (no mock data)');

  // 3. Per-track state persistence test
  const testTrackId = 'test-track-circuit';
  const initialState = library.getTrackStudyState(testTrackId);
  assert.deepEqual(initialState.unlockedPhases, [1]);
  assert.deepEqual(initialState.completedDebriefings, []);
  assert.deepEqual(initialState.corners, []);

  library.saveTrackStudyState(testTrackId, {
    unlockedPhases: [1, 2, 3],
    completedDebriefings: [1, 2],
    lastPhase: 3,
    corners: [{ number: 1, name: 'Turn 1', apexSpeedMph: 45 }]
  });

  const modifiedState = library.getTrackStudyState(testTrackId);
  assert.deepEqual(modifiedState.unlockedPhases, [1, 2, 3]);
  assert.deepEqual(modifiedState.completedDebriefings, [1, 2]);
  assert.equal(modifiedState.lastPhase, 3);
  assert.equal(modifiedState.corners.length, 1);

  library.resetTrackStudyState(testTrackId);
  const resetState = library.getTrackStudyState(testTrackId);
  assert.deepEqual(resetState.unlockedPhases, [1]);
  assert.deepEqual(resetState.completedDebriefings, []);
});
