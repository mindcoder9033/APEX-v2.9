import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackStudyEngine } from '../src/analysis/track-study-engine.js';
import { TrackStudyPdfBuilder } from '../src/pdf/track-study-pdf-builder.js';

test('TrackStudyEngine: Generates full 5-Phase study from track profile', () => {
  const engine = new TrackStudyEngine();
  const mockTrackProfile = {
    id: 'test-sebring',
    trackName: 'Sebring International Raceway',
    layoutName: '12-Hour Course',
    officialLength: '6.019 km',
    lengthMeters: 6019,
    turnsCount: 6,
    corners: [
      { number: 1, name: 'Turn 1', radius: 180, angleDeg: 55, entrySpeedMps: 42, minSpeedMps: 38, exitSpeedMps: 45, gear: 4, followingStraightMeters: 450, camberDeg: 1.0, elevationChangeM: 0, brakingDistanceM: 40 },
      { number: 2, name: 'Turn 2', radius: 140, angleDeg: 40, entrySpeedMps: 40, minSpeedMps: 37, exitSpeedMps: 43, gear: 4, followingStraightMeters: 60, camberDeg: 3.5, elevationChangeM: 0, brakingDistanceM: 20 },
      { number: 3, name: 'Turn 3', radius: 45, angleDeg: 100, entrySpeedMps: 32, minSpeedMps: 18, exitSpeedMps: 28, gear: 2, followingStraightMeters: 400, camberDeg: 0.5, elevationChangeM: 3.2, brakingDistanceM: 70 },
      { number: 4, name: 'Turn 4', radius: 75, angleDeg: 90, entrySpeedMps: 35, minSpeedMps: 22, exitSpeedMps: 30, gear: 2, followingStraightMeters: 80, camberDeg: -1.5, elevationChangeM: -2.0, brakingDistanceM: 55 },
      { number: 5, name: 'Turn 5', radius: 65, angleDeg: 45, entrySpeedMps: 36, minSpeedMps: 32, exitSpeedMps: 35, gear: 3, followingStraightMeters: 120, camberDeg: 0.0, elevationChangeM: 0, brakingDistanceM: 15 },
      { number: 6, name: 'Turn 6', radius: 130, angleDeg: 110, entrySpeedMps: 38, minSpeedMps: 27, exitSpeedMps: 36, gear: 3, followingStraightMeters: 700, camberDeg: 2.0, elevationChangeM: 0, brakingDistanceM: 45 }
    ]
  };

  const study = engine.generateStudy(mockTrackProfile);

  // Circuit metadata
  assert.equal(study.circuit.name, 'Sebring International Raceway');
  assert.equal(study.circuit.turnsCount, 6);

  // Phase 1: Macro Corner Grading
  assert.ok(study.phase1_macro, 'Phase 1 macro should exist');
  assert.equal(study.phase1_macro.corners.length, 6);
  const typeICorners = study.phase1_macro.corners.filter(c => c.type === 'Type I');
  const typeIIICorners = study.phase1_macro.corners.filter(c => c.type === 'Type III');
  assert.ok(typeICorners.length > 0, 'Should identify Type I corners');
  assert.ok(typeIIICorners.length > 0, 'Should identify Type III compromise corners');
  assert.ok(study.phase1_macro.longestStraight.distanceMeters >= 700, 'Longest straight should be detected');

  // Phase 2: Surface Recon
  assert.ok(study.phase2_surface, 'Phase 2 surface recon should exist');
  const offCamber = study.phase2_surface.corners.find(c => c.camberDeg < 0);
  assert.ok(offCamber, 'Should detect off-camber corner (Turn 4)');
  assert.ok(offCamber.camberType.includes('Off-Camber'), 'Should label off-camber correctly');

  // Phase 3: Reference Points
  assert.ok(study.phase3_reference, 'Phase 3 reference points should exist');
  assert.equal(study.phase3_reference.corners.length, 6);
  assert.ok(study.phase3_reference.corners[0].brakePoint.markerText, 'Braking point text must exist');
  assert.ok(study.phase3_reference.corners[0].apex.attitudeCheck, 'Apex attitude check must exist');

  // Phase 4: Order of Effort
  assert.ok(study.phase4_orderOfEffort, 'Phase 4 order of effort should exist');
  assert.equal(study.phase4_orderOfEffort.methodology.length, 3);
  assert.ok(study.phase4_orderOfEffort.corners[0].step2_exitThrottle.tapDistanceBeforeApexM > 0);

  // Phase 5: Hardware & Stint Prep
  assert.ok(study.phase5_hardware, 'Phase 5 hardware should exist');
  assert.ok(study.phase5_hardware.tireThermalManagement.operatingWindowF.includes('200°F'));
  assert.ok(study.phase5_hardware.brakeSystemManagement.baselineBias.includes('64% Front'));
  assert.equal(study.phase5_hardware.gearingMatrix.length, 6);
  assert.ok(study.phase5_hardware.trafficAndAccordionTactics.gridStartPreparation);
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
    turnsCount: 14
  });

  const pdfBytes = await pdfBuilder.generate(study);
  assert.ok(pdfBytes instanceof Uint8Array, 'PDF output should be Uint8Array');
  assert.ok(pdfBytes.length > 5000, 'PDF size should be substantial for 5 pages');
  
  // Verify PDF header magic bytes "%PDF-"
  const header = String.fromCharCode(...pdfBytes.slice(0, 5));
  assert.equal(header, '%PDF-', 'Valid PDF file header signature');
});
