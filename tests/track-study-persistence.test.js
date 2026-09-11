import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TrackStudyLibrary } from '../src/analysis/track-study-library.js';

describe('Track Study Persistence & Library', () => {
  let library;
  const testTrackId = 'sebring-international-raceway--full-circuit';

  beforeEach(() => {
    library = new TrackStudyLibrary('apex_test_study_library');
  });

  it('should retrieve default track study profile without errors', () => {
    const profile = library.getTrackStudyProfile(testTrackId);
    assert.ok(profile, 'Profile should exist');
    assert.equal(profile.trackId, testTrackId);
    assert.ok(profile.trackName.includes('Sebring'));
  });

  it('should save and load track study state including custom notes and laps completed', () => {
    const state = {
      lapsCompleted: 3,
      unlockedPhases: [1, 2, 3, 4],
      lastPhase: 3,
      customNotes: {
        'phase1.mandate': 'Focus on late apex at Turn 17 and Turn 7.',
        'phase3.turn.1.brakeMarker': '100m Board at pit wall entrance'
      },
      certified: false
    };

    library.saveTrackStudyState(testTrackId, state);
    const loaded = library.getTrackStudyState(testTrackId);

    assert.equal(loaded.lapsCompleted, 3);
    assert.deepEqual(loaded.unlockedPhases, [1, 2, 3, 4]);
    assert.equal(loaded.lastPhase, 3);
    assert.equal(loaded.customNotes['phase1.mandate'], 'Focus on late apex at Turn 17 and Turn 7.');
    assert.equal(loaded.customNotes['phase3.turn.1.brakeMarker'], '100m Board at pit wall entrance');
  });

  it('should reset track study state cleanly', () => {
    library.saveTrackStudyState(testTrackId, { lapsCompleted: 5, certified: true });
    library.resetTrackStudyState(testTrackId);
    const loaded = library.getTrackStudyState(testTrackId);
    assert.equal(loaded.lapsCompleted, 0);
  });
});
