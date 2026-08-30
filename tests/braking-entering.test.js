import test from 'node:test';
import assert from 'node:assert/strict';
import { STINTS_DATABASE } from '../public/js/stints.js';
import { StintDiagnostics } from '../src/analysis/stint-diagnostics.js';
import { StintDiagnostics as BrowserStintDiagnostics } from '../public/js/analysis/stint-diagnostics.js';

test('Tier 5 Database Integrity: Stints 5-1, 5-2, 5-3 are properly configured', () => {
  const stint51 = STINTS_DATABASE.find(s => s.id === 'stint-5-1');
  const stint52 = STINTS_DATABASE.find(s => s.id === 'stint-5-2');
  const stint53 = STINTS_DATABASE.find(s => s.id === 'stint-5-3');

  assert.ok(stint51, 'stint-5-1 should exist in STINTS_DATABASE');
  assert.equal(stint51.tier, 5);
  assert.equal(stint51.name, 'The Threshold Hunter');
  assert.equal(stint51.prescribedCar, '2014 BAC Mono');
  assert.equal(stint51.prescribedTrack, 'Sebring International Raceway (Full Circuit)');
  assert.equal(stint51.laps, 15);
  assert.ok(stint51.quote.includes('Jeremy Dale'));
  assert.ok(stint51.hudWidgets.length >= 4);

  assert.ok(stint52, 'stint-5-2 should exist in STINTS_DATABASE');
  assert.equal(stint52.tier, 5);
  assert.equal(stint52.name, 'The Trail-Braker');
  assert.equal(stint52.prescribedCar, '2014 BAC Mono');
  assert.ok(stint52.quote.includes('Skip Barber'));
  assert.ok(stint52.hudWidgets.some(w => w.includes('Friction Circle')));

  assert.ok(stint53, 'stint-5-3 should exist in STINTS_DATABASE');
  assert.equal(stint53.tier, 5);
  assert.equal(stint53.name, 'The Procedure Driller');
  assert.equal(stint53.prescribedCar, '2014 BAC Mono');
  assert.ok(stint53.quote.includes('The Procedure'));
  assert.ok(stint53.actionPlan.length >= 3);
});

test('StintDiagnostics: Evaluates stint-5-1 (The Threshold Hunter) with subtle ankle modulation vs panic lift', () => {
  const stint51 = STINTS_DATABASE.find(s => s.id === 'stint-5-1');

  // Simulated clean threshold braking samples with subtle modulation
  const cleanSamples = [];
  for (let i = 0; i < 60; i++) {
    cleanSamples.push({
      motion: { speedMph: 90 - i * 0.8, acceleration: { lateralG: 0.1, longitudinalG: -1.2 } },
      inputs: { throttle: 0, brake: 0.92, steering: 0 },
      timing: { lapNumber: 1 }
    });
  }

  const evalClean = StintDiagnostics.evaluate(stint51, cleanSamples, { currentLap: 5 });
  assert.equal(evalClean.stintId, 'stint-5-1');
  assert.equal(evalClean.targetAchieved, true);
  assert.ok(evalClean.gradeScore >= 90);
  assert.ok(evalClean.primaryMetricLabel.includes('Threshold Force'));
  assert.ok(evalClean.nailed.some(n => n.includes('125-140 lbs')));

  // Browser copy test
  const browserEvalClean = BrowserStintDiagnostics.evaluate(stint51, cleanSamples, { currentLap: 5 });
  assert.equal(browserEvalClean.gradeScore, evalClean.gradeScore);
});

test('StintDiagnostics: Evaluates stint-5-2 (The Trail-Braker) Donohue Friction Circle Quadrant Blending', () => {
  const stint52 = STINTS_DATABASE.find(s => s.id === 'stint-5-2');

  const trailSamples = [];
  for (let i = 0; i < 50; i++) {
    // Blended braking and cornering (Grip boundary in top-right quadrant)
    trailSamples.push({
      motion: { speedMph: 60 - i * 0.5, acceleration: { lateralG: 0.9, longitudinalG: -0.8 } },
      inputs: { throttle: 0, brake: 0.60 - i * 0.01, steering: 0.4 },
      timing: { lapNumber: 3 }
    });
  }

  const evalTrail = StintDiagnostics.evaluate(stint52, trailSamples, { currentLap: 3 });
  assert.equal(evalTrail.stintId, 'stint-5-2');
  assert.equal(evalTrail.targetAchieved, true);
  assert.ok(evalTrail.gradeScore >= 90);
  assert.ok(evalTrail.primaryMetricLabel.includes('Friction Circle'));
  assert.ok(evalTrail.nailed.some(n => n.includes('Donohue Friction Circle')));
});

test('StintDiagnostics: Evaluates stint-5-3 (The Procedure Driller) 3-foot increment progression', () => {
  const stint53 = STINTS_DATABASE.find(s => s.id === 'stint-5-3');

  const procSamples = [];
  for (let i = 0; i < 50; i++) {
    procSamples.push({
      motion: { speedMph: 75 - i * 0.5, acceleration: { lateralG: 0.7, longitudinalG: -1.1 } },
      inputs: { throttle: i > 30 ? 0.9 : 0, brake: i <= 25 ? 0.85 : 0, steering: 0.3 },
      timing: { lapNumber: 5 }
    });
  }

  const evalProc = StintDiagnostics.evaluate(stint53, procSamples, { currentLap: 5, exitDeltaMph: 1.5 });
  assert.equal(evalProc.stintId, 'stint-5-3');
  assert.equal(evalProc.targetAchieved, true);
  assert.ok(evalProc.gradeScore >= 90);
  assert.ok(evalProc.primaryMetricLabel.includes('Procedure Precision'));
  assert.ok(evalProc.nailed.some(n => n.includes('Jeremy Dale')));
});
