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
  assert.ok(t1.apexSpeedKmh > 0);
  assert.ok(t1.apexSpeedMph > 0);
  assert.ok(t1.followingStraightMeters > 0);
  assert.ok(t1.brakingDistanceM > 0);
  assert.ok(t1.priorityRank >= 1);
  assert.ok(study.circuit.lengthKm !== undefined);

  // Phase 2, 3, 4, 5 should all be populated from the parsed corners and include metric properties
  assert.equal(study.phase2_surface.corners.length, study.phase1_macro.corners.length);
  assert.equal(study.phase3_reference.corners.length, study.phase1_macro.corners.length);
  assert.ok(study.phase3_reference.corners[0].apex.targetKmh > 0);
  assert.equal(study.phase4_orderOfEffort.corners.length, study.phase1_macro.corners.length);
  assert.ok(study.phase4_orderOfEffort.corners[0].step3_brakingProcedure.thresholdPressureKg > 0);
  assert.equal(study.phase5_hardware.gearingMatrix.length, study.phase1_macro.corners.length);
  assert.ok(study.phase5_hardware.tireThermalManagement.operatingWindowC.includes('°C'));
  assert.ok(study.phase5_hardware.tireThermalManagement.coldToHotTargetPressureGainBar.includes('bar'));
});

test('TrackStudyPdfBuilder: Blocks PDF generation when telemetry data is absent', async () => {
  const engine = new TrackStudyEngine();
  const pdfBuilder = new TrackStudyPdfBuilder();

  const emptyStudy = engine.generateStudy({
    id: 'empty-circuit',
    trackName: 'Spa-Francorchamps',
    lengthMeters: 7004
  }, []);

  await assert.rejects(
    async () => {
      await pdfBuilder.generate(emptyStudy);
    },
    /Cannot export PDF dossier: No telemetry data recorded/,
    'Should block PDF export and throw informative error when no telemetry is present'
  );
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
  assert.equal(initialState.lapsCompleted, 0);
  assert.deepEqual(initialState.corners, []);

  library.saveTrackStudyState(testTrackId, {
    unlockedPhases: [1, 2, 3],
    lapsCompleted: 2,
    lastPhase: 3,
    corners: [{ number: 1, name: 'Turn 1', apexSpeedMph: 45 }]
  });

  const modifiedState = library.getTrackStudyState(testTrackId);
  assert.deepEqual(modifiedState.unlockedPhases, [1, 2, 3]);
  assert.equal(modifiedState.lapsCompleted, 2);
  assert.equal(modifiedState.lastPhase, 3);
  assert.equal(modifiedState.corners.length, 1);

  library.resetTrackStudyState(testTrackId);
  const resetState = library.getTrackStudyState(testTrackId);
  assert.deepEqual(resetState.unlockedPhases, [1]);
  assert.equal(resetState.lapsCompleted, 0);
});

test('TrackStudy: Lap-based stage unlock progression (1-5 laps required)', () => {
  const computeUnlocked = (laps) => {
    const unlocked = new Set([1]);
    for (let s = 1; s <= Math.min(4, laps); s++) {
      unlocked.add(s + 1);
    }
    return unlocked;
  };

  // 0 laps: only Stage 1
  assert.deepEqual(Array.from(computeUnlocked(0)), [1]);

  // 1 lap: unlocks Stage 2
  assert.deepEqual(Array.from(computeUnlocked(1)), [1, 2]);

  // 2 laps: unlocks Stage 3
  assert.deepEqual(Array.from(computeUnlocked(2)), [1, 2, 3]);

  // 3 laps: unlocks Stage 4
  assert.deepEqual(Array.from(computeUnlocked(3)), [1, 2, 3, 4]);

  // 4 laps: unlocks Stage 5
  assert.deepEqual(Array.from(computeUnlocked(4)), [1, 2, 3, 4, 5]);

  // 5 laps: all 5 stages unlocked & certified
  assert.deepEqual(Array.from(computeUnlocked(5)), [1, 2, 3, 4, 5]);
  const readinessPct = (laps) => Math.min(100, Math.round((Math.min(5, laps) / 5) * 100));
  assert.equal(readinessPct(0), 0);
  assert.equal(readinessPct(1), 20);
  assert.equal(readinessPct(3), 60);
  assert.equal(readinessPct(5), 100);
});

test('TrackStudy: Automatic telemetry lap counting across multiple signal sources', () => {
  // Test compute laps from batch telemetry samples
  const computeLapsFromSamples = (samples) => {
    if (!Array.isArray(samples) || samples.length === 0) return 0;
    let maxLap = 0;
    const distinctLaps = new Set();
    let prevLastLapTime = 0;
    let completedFromLapTimes = 0;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const lap = s.timing?.lapNumber !== undefined 
        ? s.timing.lapNumber 
        : (s.lapNumber !== undefined 
            ? s.lapNumber 
            : (s.timing?.rawLapNumber !== undefined ? s.timing.rawLapNumber + 1 : null));
      
      if (lap !== null && lap > 0) {
        distinctLaps.add(lap);
        if (lap > maxLap) maxLap = lap;
      }

      const lastLapTime = s.timing?.lastLapTime !== undefined 
        ? s.timing.lastLapTime 
        : (s.lastLapTime !== undefined ? s.lastLapTime : 0);
      
      if (lastLapTime > 0 && Math.abs(lastLapTime - prevLastLapTime) > 0.05) {
        completedFromLapTimes++;
        prevLastLapTime = lastLapTime;
      }
    }

    const completedFromLapNumbers = maxLap > 1 ? maxLap - 1 : (distinctLaps.size > 1 ? distinctLaps.size - 1 : 0);
    return Math.max(completedFromLapNumbers, completedFromLapTimes);
  };

  // Signal 1: Standard Forza UDP timing.lapNumber progression (laps 1, 2, 3 -> 2 completed laps)
  const forzaSamples = [
    { timing: { lapNumber: 1, lastLapTime: 0 } },
    { timing: { lapNumber: 1, lastLapTime: 0 } },
    { timing: { lapNumber: 2, lastLapTime: 84.32 } },
    { timing: { lapNumber: 2, lastLapTime: 84.32 } },
    { timing: { lapNumber: 3, lastLapTime: 82.15 } }
  ];
  assert.equal(computeLapsFromSamples(forzaSamples), 2, 'Should detect 2 completed laps from Forza UDP packets');

  // Signal 2: Direct top-level lapNumber in recorded/imported stints (laps 1, 2, 3, 4 -> 3 completed laps)
  const stintSamples = [
    { lapNumber: 1 },
    { lapNumber: 2 },
    { lapNumber: 3 },
    { lapNumber: 4 }
  ];
  assert.equal(computeLapsFromSamples(stintSamples), 3, 'Should detect 3 completed laps from stint sample array');

  // Signal 3: Out-lap or practice session with lastLapTime updates (5 completed laps)
  const lastLapTimeSamples = [
    { timing: { lapNumber: 1, lastLapTime: 0 } },
    { timing: { lapNumber: 1, lastLapTime: 95.2 } },
    { timing: { lapNumber: 1, lastLapTime: 94.1 } },
    { timing: { lapNumber: 1, lastLapTime: 93.8 } },
    { timing: { lapNumber: 1, lastLapTime: 92.5 } },
    { timing: { lapNumber: 1, lastLapTime: 91.9 } }
  ];
  assert.equal(computeLapsFromSamples(lastLapTimeSamples), 5, 'Should detect 5 completed laps from lastLapTime updates');
});


