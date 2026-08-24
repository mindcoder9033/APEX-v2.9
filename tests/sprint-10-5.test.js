import test from 'node:test';
import assert from 'node:assert/strict';
import { FrictionCircleAnalyzer, FRICTION_PHASE } from '../src/analysis/friction-circle.js';
import { PerformanceSummaryEngine, RecommendationEngine } from '../src/analysis/performance-summary.js';
import { ApexPdfBuilder } from '../src/pdf/pdf-builder.js';
import { AnalysisEngine } from '../src/analysis/index.js';

const mockSamples = [
  // Lap 1
  { timestamp: 1.0, speedMph: 120, latG: 0.1, longG: 0.8, throttle: 1.0, brake: 0, steer: 0, lapNumber: 1, distanceLap: 100, x: 0, y: 0, z: 0 },
  { timestamp: 2.0, speedMph: 80, latG: 0.2, longG: -1.2, throttle: 0, brake: 0.9, steer: 0.05, lapNumber: 1, distanceLap: 300, x: 50, y: 0, z: 50 },
  { timestamp: 3.0, speedMph: 55, latG: 1.1, longG: -0.5, throttle: 0, brake: 0.3, steer: 0.35, lapNumber: 1, distanceLap: 400, x: 80, y: 0, z: 100 },
  { timestamp: 4.0, speedMph: 52, latG: 1.3, longG: 0.0, throttle: 0.1, brake: 0, steer: 0.4, lapNumber: 1, distanceLap: 450, x: 100, y: 0, z: 120 },
  { timestamp: 5.0, speedMph: 68, latG: 0.9, longG: 0.6, throttle: 0.7, brake: 0, steer: 0.2, lapNumber: 1, distanceLap: 550, x: 130, y: 0, z: 150 },
  { timestamp: 6.0, speedMph: 110, latG: 0.1, longG: 0.9, throttle: 1.0, brake: 0, steer: 0, lapNumber: 1, distanceLap: 800, x: 200, y: 0, z: 200 },
  // Lap 2
  { timestamp: 7.0, speedMph: 122, latG: 0.1, longG: 0.8, throttle: 1.0, brake: 0, steer: 0, lapNumber: 2, distanceLap: 100, x: 0, y: 0, z: 0 },
  { timestamp: 8.0, speedMph: 82, latG: 0.2, longG: -1.3, throttle: 0, brake: 0.95, steer: 0.05, lapNumber: 2, distanceLap: 300, x: 50, y: 0, z: 50 },
  { timestamp: 9.0, speedMph: 56, latG: 1.2, longG: -0.6, throttle: 0, brake: 0.35, steer: 0.35, lapNumber: 2, distanceLap: 400, x: 80, y: 0, z: 100 },
  { timestamp: 10.0, speedMph: 53, latG: 1.35, longG: 0.0, throttle: 0.1, brake: 0, steer: 0.4, lapNumber: 2, distanceLap: 450, x: 100, y: 0, z: 120 },
  { timestamp: 11.0, speedMph: 70, latG: 0.95, longG: 0.65, throttle: 0.75, brake: 0, steer: 0.2, lapNumber: 2, distanceLap: 550, x: 130, y: 0, z: 150 },
  { timestamp: 12.0, speedMph: 112, latG: 0.1, longG: 0.9, throttle: 1.0, brake: 0, steer: 0, lapNumber: 2, distanceLap: 800, x: 200, y: 0, z: 200 }
];

test('Sprint 10.5: FrictionCircleAnalyzer calculates points, limit utilization, and phase breakdown', () => {
  const analyzer = new FrictionCircleAnalyzer(mockSamples);
  const result = analyzer.generateFrictionCircle();

  assert.ok(result);
  assert.strictEqual(result.points.length, mockSamples.length);
  assert.ok(result.maxG > 1.0);
  assert.ok(result.utilization);
  assert.ok(result.utilization.highUtilization >= 0);
  assert.ok(result.phaseBreakdown);
  assert.ok(result.phaseBreakdown['brake-turn'] !== undefined);
  assert.ok(result.phaseBreakdown['accelerate-turn'] !== undefined);
});

test('Sprint 10.5: PerformanceSummaryEngine computes score and letter grade', () => {
  const mockLaps = [
    { lapNumber: 1, lapTime: 92.5, isValid: true },
    { lapNumber: 2, lapTime: 92.1, isValid: true }
  ];
  const engine = new PerformanceSummaryEngine(mockLaps, [], {});
  const summary = engine.generateSummary();

  assert.ok(summary);
  assert.ok(summary.overallScore >= 0 && summary.overallScore <= 100);
  assert.ok(summary.grade);
  assert.match(summary.grade.grade, /^[A-F][+-]?$/);
  assert.ok(summary.components);
  assert.ok(summary.components.consistency > 0);
});

test('Sprint 10.5: RecommendationEngine generates prioritized recommendations', () => {
  const mockFindings = [
    { ruleId: 'R-003', name: 'Slow Corner Exit Speed', cornerNumber: 9, severity: 'High', actionPlan: 'Feed throttle earlier.', metric: '3.4 mph slower', quote: 'Exit speed is king.' },
    { ruleId: 'R-005', name: 'Threshold Braking Delay', cornerNumber: 7, severity: 'Medium', actionPlan: 'Brake in one continuous hit.', metric: '0.3s delayed', quote: 'Use the procedure.' }
  ];
  const mockCorners = [
    { cornerNumber: 9, speed: { exitMph: 72 }, exitSpeed: { potentialGainMph: 4.2, exitEfficiencyPercent: 65, isTypeI: true, potentialGainSeconds: 0.4 } }
  ];
  const engine = new RecommendationEngine(mockCorners, {});
  const recs = engine.generateRecommendations();

  assert.ok(recs.length > 0);
  assert.ok(recs[0].impact >= recs[recs.length - 1].impact);
  assert.ok(recs[0].quote);
  assert.ok(recs[0].action);
});

test('Sprint 10.5: AnalysisEngine end-to-end integration provides frictionCircle, performanceSummary, and recommendations', () => {
  const engine = new AnalysisEngine();
  const report = engine.analyzeStint(mockSamples);

  assert.ok(report.frictionCircle);
  assert.ok(report.performanceSummary);
  assert.ok(report.recommendations);
});

test('Sprint 10.5: PdfBuilder compiles PDF report containing G-G vector plot and performance grade', async () => {
  const engine = new AnalysisEngine();
  const report = engine.analyzeStint(mockSamples);
  const pdfBuilder = new ApexPdfBuilder();

  const pdfBytes = await pdfBuilder.build(report, {
    driverName: 'Sprint 10.5 Test Driver',
    trackName: 'Road America',
    sessionName: 'Qualifying Simulation',
    carClass: 'GT3'
  });

  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.length > 1000);
});
