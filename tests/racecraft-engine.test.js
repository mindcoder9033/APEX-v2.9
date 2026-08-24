import test from 'node:test';
import assert from 'node:assert/strict';
import { RacecraftEngine } from '../src/analysis/racecraft-engine.js';

test('RacecraftEngine: Compiles all 14 Skip Barber critique categories with valid grades', () => {
  const engine = new RacecraftEngine();
  const context = {
    laps: [
      { lapNumber: 1, lapTime: 65.2, isValid: true },
      { lapNumber: 2, lapTime: 65.4, isValid: true },
      { lapNumber: 3, lapTime: 65.3, isValid: true }
    ],
    carControl: { carControlScore: 92, tankslapperEventsCount: 0 },
    brakingEntry: { brakingEntryScore: 90, totalDownshiftDips: 0, totalSlamEvents: 0, totalOverslowTimeLossSec: 0.1 },
    shifting: { shiftingScore: 94, diagnostics: { summary: { overRevLimiterStrikes: 0 } } },
    surface: { asymmetricDragEvents: 0 },
    tireDynamics: { overallThermalBalance: 'Optimal' },
    perfSummary: { componentScores: { lineQuality: 92, exitSpeed: 90 } }
  };

  const res = engine.analyze(context);
  assert.equal(res.scorecard.length, 14, 'Must have exactly 14 official Skip Barber categories');
  assert.ok(res.overallRacecraftScore >= 85, 'Overall score should be high for clean stint');
  assert.ok(typeof res.overallGrade === 'string', 'Overall grade should be a valid letter string');

  res.scorecard.forEach(item => {
    assert.ok(item.id >= 1 && item.id <= 14);
    assert.ok(item.name.length > 0);
    assert.ok(item.score >= 0 && item.score <= 100);
    assert.ok(item.quote.length > 0);
  });
});
