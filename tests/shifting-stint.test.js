import test from 'node:test';
import assert from 'node:assert/strict';
import { STINTS_DATABASE } from '../public/js/stints.js';
import { StintDiagnostics } from '../src/analysis/stint-diagnostics.js';
import { StintDiagnostics as BrowserStintDiagnostics } from '../public/js/analysis/stint-diagnostics.js';

test('Tier 6 Database Integrity: Unified Stint 6-1 is properly configured', () => {
  const tier6Stints = STINTS_DATABASE.filter(s => s.tier === 6);
  assert.equal(tier6Stints.length, 1, 'Tier 6 should contain exactly 1 holistic stint');

  const stint61 = tier6Stints[0];
  assert.equal(stint61.id, 'stint-6-1');
  assert.equal(stint61.name, 'The Gearbox Analyst: Shifting & Synchronization');
  assert.equal(stint61.prescribedCar, '1997 BMW M3');
  assert.equal(stint61.prescribedTrack, 'Lime Rock Park (Full Circuit)');
  assert.equal(stint61.gameType, 'Circuit Race / Solitary Testing');
  assert.equal(stint61.timeOfDay, 'Morning (8:00 AM)');
  assert.equal(stint61.weather, 'Clear (Dry Asphalt)');
  assert.equal(stint61.laps, 15);
  assert.equal(stint61.drivatars, 0);
  assert.ok(stint61.quote.includes('Dorsey Schroeder') || stint61.quote.includes('Skip Barber'));
  assert.equal(stint61.actionPlan.length, 3);
  assert.equal(stint61.hudWidgets.length, 5);
  assert.ok(stint61.targetMetric.includes('RPM Match: <100 RPM Delta'));
  assert.ok(stint61.targetMetric.includes('Brake Drop: <10 lbs'));
  assert.ok(stint61.targetMetric.includes('Upshift: <0.25s'));
});

test('StintDiagnostics: Evaluates Holistic Tier 6 Stint 6-1 with 40/30/30 Composite Scoring (Node & Browser Parity)', () => {
  const stint61 = STINTS_DATABASE.find(s => s.id === 'stint-6-1');
  assert.ok(stint61, 'stint-6-1 must exist');

  // Simulated clean rev-matching, steady heel-toe braking, and crisp upshifts
  const samples = [];
  for (let i = 0; i < 150; i++) {
    const isBraking = i % 50 < 20;
    const isDownshift = i % 50 === 10;
    const isUpshift = i % 50 === 35;
    const currentGear = isBraking ? (i % 50 < 10 ? 4 : 3) : (i % 50 < 35 ? 3 : 4);
    
    samples.push({
      motion: {
        speedMph: isBraking ? 80 - (i % 50) * 2 : 55 + (i % 50 - 20) * 2.5,
        speedKmh: isBraking ? 128 - (i % 50) * 3.2 : 88 + (i % 50 - 20) * 4.0,
        lateralG: isBraking ? 0.2 : 0.85,
        longitudinalG: isBraking ? -1.15 : 0.45,
        acceleration: { lateralG: isBraking ? 0.2 : 0.85, longitudinalG: isBraking ? -1.15 : 0.45 }
      },
      inputs: {
        throttle: isDownshift ? 0.65 : (isBraking ? 0 : 0.95), // Blip during downshift
        brake: isBraking ? 0.85 : 0, // Steady 120 lbs threshold brake
        clutch: (isDownshift || isUpshift) ? 0.8 : 0,
        steering: isBraking ? 0.05 : 0.35,
        gear: currentGear
      },
      engine: {
        currentEngineRpm: isDownshift ? 4800 : (isBraking ? 3600 : 6200)
      },
      timing: {
        lapNumber: Math.floor(i / 50) + 1,
        distanceTraveled: (i * 35) % 5000
      }
    });
  }

  // Node engine evaluation
  const nodeReport = StintDiagnostics.evaluate(stint61, samples, {
    currentLap: 3,
    rpmDelta: 65,
    brakeDropLbs: 6,
    upshiftTimeSec: 0.21,
    severeGrinds: 0,
    powerShifts: 0
  });

  assert.equal(nodeReport.stintId, 'stint-6-1');
  assert.equal(nodeReport.primaryMetricLabel, 'Composite Shifting Mastery (RPM Sync / Heel-Toe / Upshift Speed)');
  assert.ok(nodeReport.gradeScore >= 85, 'Overall grade score should achieve target >= 85%');
  assert.equal(nodeReport.targetAchieved, true);
  assert.ok(nodeReport.primaryMetricValue.includes('RPM Sync: ±65 RPM'));
  assert.ok(nodeReport.primaryMetricValue.includes('Brake Drop: -6 lbs'));
  assert.ok(nodeReport.primaryMetricValue.includes('Upshift: 0.21s'));
  assert.ok(nodeReport.nailed.length >= 2, 'Should provide nailed diagnostic points');
  assert.ok(nodeReport.refinement.length >= 1, 'Should provide refinement coaching points');

  // Browser engine parity evaluation
  const browserReport = BrowserStintDiagnostics.evaluate(stint61, samples, {
    currentLap: 3,
    rpmDelta: 65,
    brakeDropLbs: 6,
    upshiftTimeSec: 0.21,
    severeGrinds: 0,
    powerShifts: 0
  });

  assert.equal(browserReport.stintId, 'stint-6-1');
  assert.equal(browserReport.gradeScore, nodeReport.gradeScore, 'Browser and Node diagnostics must be identical');
  assert.equal(browserReport.targetAchieved, nodeReport.targetAchieved);
  assert.equal(browserReport.primaryMetricValue, nodeReport.primaryMetricValue);
});

test('StintDiagnostics: Detects severe RPM mismatch, heel-toe brake drops, and power shifts on Stint 6-1', () => {
  const stint61 = STINTS_DATABASE.find(s => s.id === 'stint-6-1');

  // Simulated sloppy shifting
  const sloppySamples = [];
  for (let i = 0; i < 60; i++) {
    sloppySamples.push({
      motion: { speedMph: 75, acceleration: { lateralG: 0.2, longitudinalG: -0.8 } },
      inputs: { throttle: 0.9, brake: 0.4, clutch: 0, steering: 0, gear: i < 30 ? 3 : 4 },
      engine: { currentEngineRpm: 4500 },
      timing: { lapNumber: 1 }
    });
  }

  const report = StintDiagnostics.evaluate(stint61, sloppySamples, {
    currentLap: 1,
    rpmDelta: 520,
    brakeDropLbs: 35,
    upshiftTimeSec: 0.48,
    severeGrinds: 2,
    powerShifts: 3
  });

  assert.equal(report.stintId, 'stint-6-1');
  assert.equal(report.targetAchieved, false, 'Target should fail with high mismatch, brake drops, and power shifts');
  assert.ok(report.attention.some(a => a.includes('gear grind') || a.includes('RPM mismatch')));
  assert.ok(report.attention.some(a => a.includes('brake pressure drop') || a.includes('lifting the heel')));
  assert.ok(report.attention.some(a => a.includes('power-shift')));
});
