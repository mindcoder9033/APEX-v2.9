import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceSummaryEngine, RecommendationEngine } from '../src/analysis/performance-summary.js';

test('PerformanceSummaryEngine: Computes overall score and grade correctly', () => {
  const analyzedLaps = [
    { lapNumber: 1, lapTime: 82.5, isValid: true },
    { lapNumber: 2, lapTime: 82.1, isValid: true },
    { lapNumber: 3, lapTime: 82.3, isValid: true }
  ];

  const corners = [
    {
      cornerNumber: 1,
      dynamics: {
        isEarlyApex: false,
        isLateApex: false,
        peakDecelG: 1.1,
        trailBrakingOverlapPercent: 40,
        exitEfficiencyPercent: 88,
        tapDeltaFeet: 5.0
      }
    },
    {
      cornerNumber: 2,
      dynamics: {
        isEarlyApex: true, // Line quality penalty
        isLateApex: false,
        peakDecelG: 0.9,
        trailBrakingOverlapPercent: 25,
        exitEfficiencyPercent: 75,
        tapDeltaFeet: 16.0 // Delay TAP penalty
      }
    }
  ];

  const analysisResults = {
    brakingAnalysis: {
      brakingZones: [
        { cornerNumber: 1, efficiency: { percent: 90 }, gForces: { peakDecelG: 1.1 } },
        { cornerNumber: 2, efficiency: { percent: 70 }, gForces: { peakDecelG: 0.9 } }
      ]
    },
    shiftingAnalysis: {
      cornerShifting: [
        { cornerNumber: 1, issue: { severity: 'LOW' } },
        { cornerNumber: 2, issue: { severity: 'HIGH', issue: 'Gear Too High', message: 'Min RPM below powerband' } }
      ]
    },
    tireDynamics: {
      findings: [
        { id: 'TIRE-OVERHEAT', severity: 'High', title: 'Tire Overheating', description: 'FL is hot' }
      ]
    }
  };

  const engine = new PerformanceSummaryEngine(analyzedLaps, corners, analysisResults);
  const summary = engine.generateSummary();

  assert.ok(summary.overallScore > 0);
  assert.ok(summary.overallScore <= 100);
  assert.ok(typeof summary.grade.grade === 'string');
  assert.ok(summary.components.consistency > 90, 'Consistency score should be high for very close lap times');
  assert.equal(summary.components.lineQuality, 50, 'Line quality should be 50% since 1 out of 2 corners had early/late apex');
  assert.ok(summary.components.brakingScore > 0);
  assert.ok(summary.components.exitSpeedScore > 0);
});

test('RecommendationEngine: Generates sorted priority recommendations', () => {
  const corners = [
    {
      cornerNumber: 1,
      speed: { exitMph: 80 },
      exitSpeed: {
        potentialGainMph: 4.5,
        exitEfficiencyPercent: 82,
        isTypeI: true,
        potentialGainSeconds: 0.4
      },
      dynamics: {
        trailBrakingOverlapPercent: 10,
        trailBrakeQualityLabel: 'POOR'
      },
      inputs: { peakBrakePressure: 0.5 }
    }
  ];

  const analysisResults = {
    brakingAnalysis: {
      brakingZones: [
        { cornerNumber: 1, efficiency: { percent: 65 }, gForces: { peakDecelG: 0.8 } }
      ]
    },
    shiftingAnalysis: {
      cornerShifting: [
        { cornerNumber: 1, issue: { severity: 'HIGH', issue: 'Gear Too High', message: 'Downshift' } }
      ]
    },
    tireDynamics: {
      findings: [
        { id: 'R-009-TIRE', severity: 'High', title: 'Rear Wheelspin', description: 'Excessive wheelspin' }
      ]
    }
  };

  const engine = new RecommendationEngine(corners, analysisResults);
  const recs = engine.generateRecommendations();

  assert.ok(recs.length >= 3);
  // Recommendations should be sorted by priority (1 before 2) then impact (seconds)
  assert.equal(recs[0].priority, 1);
  assert.ok(recs[0].impact >= recs[1].impact);
});
