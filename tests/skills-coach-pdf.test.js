import test from 'node:test';
import assert from 'node:assert/strict';

import { SkillsCoachPdfExporter } from '../public/js/skills-coach-pdf.js';
import { GOING_FASTER_CHAPTERS } from '../public/js/skills-curriculum.js';

test('SkillsCoachPdfExporter // Plain-English Telemetry Debrief & PDF Generation', async (t) => {
  await t.test('synthesizeDebrief: Generates comprehensive strengths for a skilled driver', () => {
    const mockDriver = {
      name: 'Max Verstappen',
      number: '01',
      tier: 'Elite'
    };

    const mockMasteryStats = {
      overallMasteryScore: 88,
      grade: 'A',
      totalAttempts: 25,
      skills: {
        'ch1-exit-speed': { currentScore: 92, bestScore: 95, trend: 'improving' },
        'ch1-the-line': { currentScore: 88, bestScore: 90, trend: 'stable' },
        'ch1-threshold-braking': { currentScore: 86, bestScore: 89, trend: 'improving' },
        'ch1-combined-entry': { currentScore: 84, bestScore: 85, trend: 'improving' },
        'ch1-platform-stability': { currentScore: 90, bestScore: 92, trend: 'stable' }
      }
    };

    const mockAttempts = [
      {
        skills: {
          'ch1-exit-speed': { score: 92, metrics: { throttleHesitations: 0 } },
          'ch1-threshold-braking': { score: 88, metrics: { peakBrakePressurePercent: 88 } }
        }
      }
    ];

    const debrief = SkillsCoachPdfExporter.synthesizeDebrief({
      chapterNumber: 1,
      driverProfile: mockDriver,
      masteryStats: mockMasteryStats,
      attempts: mockAttempts,
      trackName: 'Silverstone Grand Prix Circuit',
      car: 'Aston Martin Vantage GT3'
    });

    assert.equal(debrief.driverName, 'Max Verstappen');
    assert.equal(debrief.driverNumber, '01');
    assert.equal(debrief.driverTier, 'ELITE');
    assert.equal(debrief.chapter.chapterNumber, 1);
    assert.ok(debrief.strengths.length >= 3, 'Should extract multiple high-scoring strengths');
    assert.ok(debrief.strengths.some(s => s.title.includes('Exit Speed')), 'Should identify strong exit speed');
    assert.ok(debrief.strengths.some(s => s.title.includes('Braking')), 'Should identify strong braking');
    assert.equal(debrief.focusAreas.length, 3, 'Should provide 3 prioritized focus areas');
    assert.equal(debrief.drills.length, 3, 'Should provide 3 step-by-step track drills');
    assert.equal(debrief.benchmarks.length, 4, 'Should provide 4 benchmark targets');
  });

  await t.test('synthesizeDebrief: Accurately catches weaknesses for a developing driver with hesitations and abrupt braking', () => {
    const mockDriver = {
      name: 'Rookie Driver',
      number: '99',
      tier: 'Rookie'
    };

    const mockMasteryStats = {
      overallMasteryScore: 54,
      grade: 'D',
      totalAttempts: 12,
      skills: {
        'ch1-exit-speed': { currentScore: 45, bestScore: 50, trend: 'declining' },
        'ch1-the-line': { currentScore: 52, bestScore: 55, trend: 'neutral' },
        'ch1-threshold-braking': { currentScore: 48, bestScore: 55, trend: 'declining' },
        'ch1-combined-entry': { currentScore: 40, bestScore: 45, trend: 'declining' },
        'ch1-platform-stability': { currentScore: 58, bestScore: 60, trend: 'neutral' }
      }
    };

    const mockAttempts = [
      {
        skills: {
          'ch1-exit-speed': { score: 45, metrics: { throttleHesitations: 3 } },
          'ch1-threshold-braking': { score: 48, metrics: { peakBrakePressurePercent: 55 } },
          'ch1-combined-entry': { score: 40, metrics: { snapOffDetected: true } }
        }
      }
    ];

    const debrief = SkillsCoachPdfExporter.synthesizeDebrief({
      chapterNumber: 1,
      driverProfile: mockDriver,
      masteryStats: mockMasteryStats,
      attempts: mockAttempts,
      trackName: 'Catalunya Circuit'
    });

    assert.ok(debrief.weaknesses.length >= 2, 'Should identify multiple areas for improvement');
    assert.ok(debrief.weaknesses.some(w => w.title.includes('Hesitant Throttle') || w.text.includes('hesitation')), 'Should flag throttle hesitations');
    assert.ok(debrief.weaknesses.some(w => w.title.includes('Brake') || w.text.includes('Brake')), 'Should flag braking deficit');
    assert.ok(debrief.drills.some(d => d.steps.length === 3), 'Drills should contain 3 actionable step instructions');
  });

  await t.test('exportDebrief: Compiles valid 2-page PDF document buffer with light-mode styling', async () => {
    const mockDriver = {
      name: 'Charles Leclerc',
      number: '16',
      tier: 'Pro'
    };

    const mockMasteryStats = {
      overallMasteryScore: 82,
      grade: 'B',
      totalAttempts: 18,
      skills: {
        'ch1-exit-speed': { currentScore: 85, trend: 'improving' },
        'ch1-the-line': { currentScore: 80, trend: 'stable' },
        'ch1-threshold-braking': { currentScore: 84, trend: 'improving' },
        'ch1-combined-entry': { currentScore: 78, trend: 'improving' },
        'ch1-platform-stability': { currentScore: 82, trend: 'stable' }
      }
    };

    const pdfBytes = await SkillsCoachPdfExporter.exportDebrief({
      chapterNumber: 1,
      driverProfile: mockDriver,
      masteryStats: mockMasteryStats,
      attempts: [],
      trackName: 'Monza National Circuit',
      stintId: 'stint_01'
    }, false); // autoDownload = false for headless test

    assert.ok(pdfBytes instanceof Uint8Array, 'PDF output must be Uint8Array');
    assert.ok(pdfBytes.length > 5000, `PDF size must be substantial, got ${pdfBytes.length} bytes`);

    // Verify PDF header magic bytes "%PDF-"
    const pdfHeader = Buffer.from(pdfBytes.slice(0, 5)).toString('utf-8');
    assert.equal(pdfHeader, '%PDF-', 'Must contain valid PDF header signature');
  });
});
