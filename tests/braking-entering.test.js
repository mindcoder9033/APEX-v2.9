import test from 'node:test';
import assert from 'node:assert/strict';
import { STINTS_DATABASE } from '../public/js/stints.js';
import { StintDiagnostics } from '../src/analysis/stint-diagnostics.js';
import { StintDiagnostics as BrowserStintDiagnostics } from '../public/js/analysis/stint-diagnostics.js';

test('Tier 5 Database Integrity: Unified Stint 5-1 is properly configured', () => {
  const tier5Stints = STINTS_DATABASE.filter(s => s.tier === 5);
  assert.equal(tier5Stints.length, 1, 'Tier 5 should contain exactly 1 holistic stint replacing the 3 old stints');

  const stint51 = tier5Stints[0];
  assert.equal(stint51.id, 'stint-5-1');
  assert.equal(stint51.name, 'The Analytical Braker: Braking & Entering');
  assert.equal(stint51.prescribedCar, '2014 BAC Mono');
  assert.equal(stint51.prescribedTrack, 'Sebring International Raceway (Full Circuit)');
  assert.equal(stint51.gameType, 'Circuit Race / Solitary Testing');
  assert.equal(stint51.timeOfDay, 'Late Morning (10:00 AM)');
  assert.equal(stint51.weather, 'Clear (Dry Asphalt)');
  assert.equal(stint51.laps, 15);
  assert.equal(stint51.drivatars, 0);
  assert.ok(stint51.quote.includes('Mario Andretti') || stint51.quote.includes('Skip Barber'));
  assert.equal(stint51.actionPlan.length, 3);
  assert.equal(stint51.hudWidgets.length, 4);
  assert.ok(stint51.targetMetric.includes('km/h'), 'Target metric must include metric km/h');
  assert.ok(stint51.targetMetric.includes('140->100 lbs') || stint51.targetMetric.includes('30-40 lbs'));
});

test('StintDiagnostics: Evaluates Holistic Tier 5 Stint 5-1 with 40/30/30 Composite Scoring (Node & Browser Parity)', () => {
  const stint51 = STINTS_DATABASE.find(s => s.id === 'stint-5-1');
  assert.ok(stint51, 'stint-5-1 must exist');

  // Simulated clean threshold braking + trail-braking samples (>75% quadrant grip)
  const samples = [];
  for (let i = 0; i < 120; i++) {
    const isBraking = i % 40 < 25;
    const isTurning = i % 40 >= 5 && i % 40 < 35; // 20 overlapping samples out of 25 braking = 80% trail usage
    samples.push({
      motion: {
        speedMph: 85 - (i % 40) * 1.5,
        speedKmh: 136 - (i % 40) * 2.4,
        lateralG: isTurning ? 1.15 : 0.05,
        longitudinalG: isBraking ? -1.25 : 0.2,
        acceleration: { lateralG: isTurning ? 1.15 : 0.05, longitudinalG: isBraking ? -1.25 : 0.2 }
      },
      inputs: {
        throttle: isBraking ? 0 : 0.9,
        brake: isBraking ? (isTurning ? 0.45 : 0.92) : 0, // 0.92 = ~129 lbs threshold, 0.45 = trail-braking blend
        steering: isTurning ? 0.35 : 0.0
      },
      timing: {
        lapNumber: Math.floor(i / 30) + 1,
        distanceTraveled: (i * 40) % 5000
      }
    });
  }

  // Node engine evaluation
  const nodeReport = StintDiagnostics.evaluate(stint51, samples, { currentLap: 4, exitDeltaKmh: 2.8 });
  assert.equal(nodeReport.stintId, 'stint-5-1');
  assert.equal(nodeReport.primaryMetricLabel, 'Composite Braking Mastery (Modulation / Trail-Braking / The Procedure)');
  assert.ok(nodeReport.gradeScore >= 85, 'Overall grade score should achieve target');
  assert.equal(nodeReport.targetAchieved, true);
  assert.ok(nodeReport.primaryMetricValue.includes('lbs') || nodeReport.primaryMetricValue.includes('Modulation'));
  assert.ok(nodeReport.primaryMetricValue.includes('km/h'));
  assert.ok(nodeReport.nailed.length >= 2, 'Should provide nailed diagnostic points');
  assert.ok(nodeReport.refinement.length >= 2, 'Should provide refinement coaching points');

  // Browser engine parity evaluation
  const browserReport = BrowserStintDiagnostics.evaluate(stint51, samples, { currentLap: 4, exitDeltaKmh: 2.8 });
  assert.equal(browserReport.stintId, 'stint-5-1');
  assert.equal(browserReport.gradeScore, nodeReport.gradeScore, 'Browser and Node diagnostics must be identical');
  assert.equal(browserReport.targetAchieved, nodeReport.targetAchieved);
  assert.equal(browserReport.primaryMetricValue, nodeReport.primaryMetricValue);
});

test('StintDiagnostics: Detects excessive harsh lockup/panic lift penalties on Tier 5 Stint 5-1', () => {
  const stint51 = STINTS_DATABASE.find(s => s.id === 'stint-5-1');

  // Simulated harsh lockup panic-lift samples
  const harshSamples = [];
  for (let i = 0; i < 60; i++) {
    harshSamples.push({
      motion: { speedMph: 90 - i * 1.2, acceleration: { lateralG: 0.1, longitudinalG: -1.45 } },
      inputs: { throttle: 0, brake: i % 10 === 0 ? 1.0 : (i % 10 === 1 ? 0.0 : 0.95), steering: 0 },
      timing: { lapNumber: 1 }
    });
  }

  const report = StintDiagnostics.evaluate(stint51, harshSamples, { currentLap: 1, harshBrakingEvents: 5, exitDeltaKmh: 0.5 });
  assert.equal(report.stintId, 'stint-5-1');
  assert.equal(report.targetAchieved, false, 'Target should fail with 5 harsh lockups and low exit speed');
  assert.ok(report.attention.some(a => a.includes('harsh lockup') || a.includes('panic-lift') || a.includes('30–40 lbs')));
});
