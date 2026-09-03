import test from 'node:test';
import assert from 'node:assert/strict';
import { STINTS_DATABASE } from '../public/js/stints.js';
import { StintDiagnostics } from '../src/analysis/stint-diagnostics.js';
import { StintDiagnostics as BrowserStintDiagnostics } from '../public/js/analysis/stint-diagnostics.js';

test('Tier 4 Database Integrity: Unified Stint 4-1 is properly configured', () => {
  const tier4Stints = STINTS_DATABASE.filter(s => s.tier === 4);
  assert.equal(tier4Stints.length, 1, 'Tier 4 should contain exactly 1 holistic stint');

  const stint41 = tier4Stints[0];
  assert.equal(stint41.id, 'stint-4-1');
  assert.equal(stint41.name, 'The Holistic Car Control Stint');
  assert.equal(stint41.prescribedCar, '2016 Dodge Viper ACR');
  assert.equal(stint41.prescribedTrack, 'Sebring International Raceway (Full Circuit)');
  assert.equal(stint41.gameType, 'Circuit Race');
  assert.equal(stint41.timeOfDay, 'Late morning');
  assert.equal(stint41.weather, 'Clear');
  assert.equal(stint41.laps, 15);
  assert.equal(stint41.drivatars, 0);
  assert.ok(stint41.quote.includes('Skip Barber'));
  assert.equal(stint41.actionPlan.length, 3);
  assert.equal(stint41.hudWidgets.length, 4);
  assert.ok(stint41.targetMetric.includes('km/h'), 'Target metric must use metric km/h');
  assert.ok(stint41.targetMetric.includes('16m'), 'Target metric must use metric meters for squeeze distance');
});

test('StintDiagnostics: Evaluates Holistic Tier 4 Stint 4-1 in Metric Units (Node and Browser engines)', () => {
  const stint41 = STINTS_DATABASE.find(s => s.id === 'stint-4-1');
  assert.ok(stint41);

  // Generate sample stint data simulating high-performance car control
  const samples = [];
  for (let i = 0; i < 200; i++) {
    samples.push({
      motion: {
        speedMph: 75 + (i % 25),
        speedKmh: 120 + (i % 40),
        lateralG: 1.15,
        longitudinalG: 0.25,
        acceleration: { lateralG: 1.15, longitudinalG: 0.25 }
      },
      inputs: {
        throttle: (i % 15 === 0) ? 0.65 : 0.95, // Includes 65% throttle breathe at turn-in
        brake: (i % 30 === 0) ? 0.40 : 0.0,
        steering: 0.15 * Math.sin(i / 8)
      },
      chassis: {
        tireSlipAngleRearLeft: 0.08,
        tireSlipAngleRearRight: 0.08,
        tireSlipAngleFrontLeft: 0.08,
        tireSlipAngleFrontRight: 0.08
      },
      timing: {
        lapNumber: Math.floor(i / 15) + 1,
        distanceTraveled: (i * 30) % 6000
      }
    });
  }

  // Node engine evaluation
  const nodeReport = StintDiagnostics.evaluate(stint41, samples, { currentLap: 12, squeezeDistMeters: 16.5, exitDeltaKmh: 3.4 });

  assert.equal(nodeReport.stintId, 'stint-4-1');
  assert.equal(nodeReport.primaryMetricLabel, 'Composite Car Control Mastery (CPR / Squeeze / Breathe)');
  assert.ok(nodeReport.scorecard.discipline.score >= 85, 'Discipline score should meet high performance target');
  assert.ok(nodeReport.gradeScore >= 85, 'Overall grade score should meet high performance target');
  assert.ok(nodeReport.primaryMetricValue.includes('m'), 'Primary metric value must include meters');
  assert.ok(nodeReport.primaryMetricValue.includes('km/h'), 'Primary metric value must include km/h');
  assert.ok(nodeReport.nailed.length > 0, 'Should have nailed points');
  assert.ok(nodeReport.refinement.length > 0, 'Should have refinement points');

  // Browser engine parity evaluation
  const browserReport = BrowserStintDiagnostics.evaluate(stint41, samples, { currentLap: 12, squeezeDistMeters: 16.5, exitDeltaKmh: 3.4 });

  assert.equal(browserReport.stintId, 'stint-4-1');
  assert.equal(browserReport.gradeScore, nodeReport.gradeScore, 'Node and Browser diagnostics must yield identical scores');
  assert.equal(browserReport.scorecard.discipline.score, nodeReport.scorecard.discipline.score);
  assert.equal(browserReport.targetAchieved, nodeReport.targetAchieved);
  assert.equal(browserReport.primaryMetricValue, nodeReport.primaryMetricValue);
});
