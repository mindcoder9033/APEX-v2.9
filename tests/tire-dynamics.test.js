import test from 'node:test';
import assert from 'node:assert/strict';
import { TireDynamicsEngine, TIRE_THERMAL_STATUS } from '../src/analysis/tire-dynamics.js';
import { AnalysisEngine } from '../src/analysis/index.js';
import { ApexPdfBuilder } from '../src/pdf/pdf-builder.js';

function createMockTireSamples({
  flTemp = 215,
  frTemp = 218,
  rlTemp = 222,
  rrTemp = 226,
  flSlip = 0.08,
  frSlip = 0.09,
  rlSlip = 0.15,
  rrSlip = 0.18
} = {}) {
  const samples = [];
  for (let i = 0; i < 50; i++) {
    samples.push({
      timestampMs: 100000 + i * 16,
      motion: {
        position: { x: i * 2, y: 0, z: i * 3 },
        speedMps: 30.0,
        speedMph: 67.1,
        acceleration: { lateralG: 0.8, longitudinalG: 0.1 },
        orientation: { yaw: 0, pitch: 0, roll: 0 }
      },
      inputs: {
        throttle: 0.8,
        brake: 0.0,
        steering: 0.1,
        gear: 3
      },
      engine: { currentRpm: 5500, maxRpm: 8000 },
      tires: {
        tempF: {
          frontLeft: flTemp + (i % 3),
          frontRight: frTemp + (i % 3),
          rearLeft: rlTemp + (i % 3),
          rearRight: rrTemp + (i % 3)
        },
        slipRatio: {
          frontLeft: flSlip,
          frontRight: frSlip,
          rearLeft: rlSlip,
          rearRight: rrSlip
        },
        combinedSlip: {
          frontLeft: 0.60,
          frontRight: 0.65,
          rearLeft: 0.70,
          rearRight: 0.75
        },
        slipAngle: {
          frontLeft: 0.05,
          frontRight: 0.05,
          rearLeft: 0.04,
          rearRight: 0.04
        },
        wear: {
          frontLeft: 0.02,
          frontRight: 0.02,
          rearLeft: 0.04,
          rearRight: 0.04
        }
      }
    });
  }
  return samples;
}

test('TireDynamicsEngine: Classifies thermal operating states correctly', () => {
  const engine = new TireDynamicsEngine();

  assert.equal(engine.classifyThermalStatus(185), TIRE_THERMAL_STATUS.COLD);
  assert.equal(engine.classifyThermalStatus(199.9), TIRE_THERMAL_STATUS.COLD);
  assert.equal(engine.classifyThermalStatus(200.0), TIRE_THERMAL_STATUS.OPTIMAL);
  assert.equal(engine.classifyThermalStatus(225.5), TIRE_THERMAL_STATUS.OPTIMAL);
  assert.equal(engine.classifyThermalStatus(240.0), TIRE_THERMAL_STATUS.OPTIMAL);
  assert.equal(engine.classifyThermalStatus(240.5), TIRE_THERMAL_STATUS.OVERHEATED);
  assert.equal(engine.classifyThermalStatus(265.0), TIRE_THERMAL_STATUS.OVERHEATED);
});

test('TireDynamicsEngine: Analyzes 4-corner metrics & thermal balance', () => {
  const engine = new TireDynamicsEngine();
  const samples = createMockTireSamples({
    flTemp: 210,
    frTemp: 212,
    rlTemp: 235,
    rrTemp: 245,
    rlSlip: 1.15,
    rrSlip: 1.25
  });

  const result = engine.analyzeTires(samples);

  assert.ok(result.tires.frontLeft.avgTempF >= 210 && result.tires.frontLeft.avgTempF <= 212);
  assert.equal(result.tires.frontLeft.status, TIRE_THERMAL_STATUS.OPTIMAL);
  assert.equal(result.tires.rearRight.status, TIRE_THERMAL_STATUS.OVERHEATED);
  assert.ok(result.tires.rearRight.peakSlipRatio > 1.0, 'Rear right slip ratio exceeds 1.0');

  // Axle balance: Rear is significantly hotter than front -> REAR_LIMITED
  assert.equal(result.balance.thermalBias, 'REAR_LIMITED');
  assert.ok(result.balance.tempDeltaFrontVsRearF < -15);

  // Stint Findings should flag overheating and excessive wheelspin
  assert.ok(result.findings.some(f => f.id === 'TIRE-OVERHEAT'), 'Should flag overheating');
  assert.ok(result.findings.some(f => f.id === 'R-009-TIRE'), 'Should flag R-009 wheelspin');
});

test('AnalysisEngine & ApexPdfBuilder: Ingests tire dynamics and builds 4-page PDF', async () => {
  const analysisEngine = new AnalysisEngine();
  const pdfBuilder = new ApexPdfBuilder();

  const samples = createMockTireSamples({ flTemp: 215, frTemp: 218, rlTemp: 225, rrTemp: 230 });
  const report = analysisEngine.analyzeStint(samples);

  assert.ok(report.tireDynamics != null, 'Report should contain tireDynamics');
  assert.ok(report.tireDynamics.tires.frontLeft != null);

  const pdfBytes = await pdfBuilder.build(report, {
    driver: 'Test Driver',
    session: 'Silverstone GP',
    vehicle: 'Porsche 911 GT3 R'
  });

  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.length > 5000, 'PDF should have non-trivial size for 4-page document');
});
