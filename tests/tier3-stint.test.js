import test from 'node:test';
import assert from 'node:assert/strict';
import { STINTS_DATABASE } from '../public/js/stints.js';
import { StintDiagnostics } from '../src/analysis/stint-diagnostics.js';
import { StintDiagnostics as BrowserStintDiagnostics } from '../public/js/analysis/stint-diagnostics.js';

test('Tier 3 Database Integrity: Unified Stint 3-1 is properly configured', () => {
  const tier3Stints = STINTS_DATABASE.filter(s => s.tier === 3);
  assert.equal(tier3Stints.length, 1, 'Tier 3 should contain exactly 1 holistic stint');

  const stint31 = tier3Stints[0];
  assert.equal(stint31.id, 'stint-3-1');
  assert.equal(stint31.name, 'The Real-World Line: Adaptation');
  assert.equal(stint31.prescribedCar, '2015 Chevrolet Corvette Z06');
  assert.equal(stint31.prescribedTrack, 'Lime Rock Park (Full Circuit)');
  assert.equal(stint31.gameType, 'Circuit Race');
  assert.equal(stint31.timeOfDay, 'Late afternoon');
  assert.equal(stint31.weather, 'Mostly clear');
  assert.equal(stint31.laps, 12);
  assert.equal(stint31.drivatars, 0);
  assert.ok(stint31.quote.includes('Mario Andretti'));
  assert.equal(stint31.actionPlan.length, 3);
  assert.equal(stint31.hudWidgets.length, 4);
});

test('StintDiagnostics: Evaluates Tier 3 Stint 3-1 (Node and Browser engines)', () => {
  const stint31 = STINTS_DATABASE.find(s => s.id === 'stint-3-1');
  assert.ok(stint31);

  // Generate sample stint data simulating high-performance real-world adaptation
  const samples = [];
  for (let i = 0; i < 200; i++) {
    samples.push({
      motion: {
        speedMph: 75 + (i % 25),
        speedKmh: 120 + (i % 40),
        lateralG: 1.05,
        longitudinalG: -0.65,
        acceleration: { lateralG: 1.05, longitudinalG: -0.65 }
      },
      inputs: {
        throttle: i % 20 !== 0 ? 0.95 : 0,
        brake: i % 20 === 0 ? 0.85 : 0,
        steering: 0.12 * Math.sin(i / 10)
      },
      timing: {
        lapNumber: Math.floor(i / 20) + 1,
        distanceTraveled: (i * 25) % 2400
      }
    });
  }

  // Node engine evaluation
  const nodeReport = StintDiagnostics.evaluate(stint31, samples, { currentLap: 10 });

  assert.equal(nodeReport.stintId, 'stint-3-1');
  assert.equal(nodeReport.primaryMetricLabel, 'Composite Real-World Mastery');
  assert.ok(nodeReport.gradeScore >= 75, 'Discipline score should be computed');
  assert.ok(nodeReport.nailed.length > 0, 'Should have nailed points');
  assert.ok(nodeReport.refinement.length > 0, 'Should have refinement points');

  // Browser engine parity evaluation
  const browserReport = BrowserStintDiagnostics.evaluate(stint31, samples, { currentLap: 10 });

  assert.equal(browserReport.stintId, 'stint-3-1');
  assert.equal(browserReport.gradeScore, nodeReport.gradeScore, 'Node and Browser diagnostics must yield identical scores');
  assert.equal(browserReport.targetAchieved, nodeReport.targetAchieved);
});
