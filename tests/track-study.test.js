import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackStudyAnalyzer } from '../src/analysis/track-study-analyzer.js';

test('TrackStudyAnalyzer correctly processes track profile and classifies corners into Type I, II, III', () => {
  const analyzer = new TrackStudyAnalyzer();

  const mockTrack = {
    trackId: 'sebring-full',
    trackName: 'Sebring International Raceway',
    layoutName: 'Full 12-Hour Circuit',
    trackLengthMeters: 6019,
    bestLapTime: 123.85,
    turns: [
      {
        turnNumber: 1,
        name: 'Turn 1 (High-Speed Bend)',
        suggestedSpeedMph: 85,
        followingStraightMeters: 450,
        precedingStraightMeters: 380,
        distanceToNextTurn: 80,
        camber: 'Positive (+2°)',
        surfaceType: 'Concrete / Asphalt Seam'
      },
      {
        turnNumber: 2,
        name: 'Turn 2 (Left Sweeper)',
        suggestedSpeedMph: 78,
        followingStraightMeters: 550,
        precedingStraightMeters: 80,
        distanceToNextTurn: 250,
        camber: 'Negative (-1.5°)',
        surfaceType: 'Asphalt'
      },
      {
        turnNumber: 3,
        name: 'Turn 7 (Hairpin)',
        suggestedSpeedMph: 41,
        followingStraightMeters: 420,
        precedingStraightMeters: 360,
        distanceToNextTurn: 300,
        isHeavyBraking: true
      }
    ]
  };

  const study = analyzer.analyzeTrackStudy(mockTrack);

  assert.ok(study, 'Study object should be generated');
  assert.equal(study.trackName, 'Sebring International Raceway');
  assert.equal(study.turns.length, 3);

  // Turn 1 is connected to Turn 2 within 80m -> Type III (Compromise sequence)
  assert.equal(study.turns[0].cornerType, 'Type III');
  assert.equal(study.turns[0].typeLabel, 'Compromise Sequence');

  // Turn 2 leads into a 550m straight -> Type I (Exit Speed Priority)
  assert.equal(study.turns[1].cornerType, 'Type I');
  assert.equal(study.turns[1].typeLabel, 'Exit Speed Priority');

  // Turn 3 (Hairpin) has 360m braking before and 420m straight after -> Type I
  assert.equal(study.turns[2].cornerType, 'Type I');
  assert.equal(study.turns[2].targets.minApexSpeedKmh, 66); // 41 mph * 1.60934 = ~66 km/h

  // Macro Summary
  assert.equal(study.macroSummary.totalCorners, 3);
  assert.equal(study.macroSummary.typeICount, 2);
  assert.equal(study.macroSummary.typeIIICount, 1);
  assert.ok(study.phaseGuidelines.phase1.title.includes('Macro-Analysis'));
  assert.ok(study.phaseGuidelines.phase3.title.includes('Visual Reference Points'));
});

test('TrackStudyAnalyzer fallback generation works for empty turns', () => {
  const analyzer = new TrackStudyAnalyzer();
  const mockTrack = {
    trackId: 'generic-gp',
    trackName: 'Generic GP Raceway',
    turnCount: 8
  };

  const study = analyzer.analyzeTrackStudy(mockTrack);
  assert.equal(study.turns.length, 8);
  assert.ok(study.macroSummary.totalCorners === 8);
  assert.ok(study.turns[0].targets.targetGear >= 1);
});
