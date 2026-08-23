import test from 'node:test';
import assert from 'node:assert/strict';
import { BrakingZoneEngine, CLASS_THEORETICAL_MAX_DECEL_G, THRESHOLD_EFFICIENCY_GRADES } from '../src/analysis/braking-zones.js';
import { AnalysisEngine } from '../src/analysis/index.js';
import { ApexPdfBuilder } from '../src/pdf/pdf-builder.js';
import { RulesEngine } from '../src/analysis/rules-engine.js';

function createMockSample(options = {}) {
  const {
    timestampMs = 1000,
    speedMps = 50.0,
    brake = 0.0,
    throttle = 0.0,
    steering = 0.0,
    longitudinalG = 0.0,
    lateralG = 0.0,
    x = 0,
    y = 0,
    z = 0,
    rpm = 5000,
    gear = 3,
    lapNumber = 1
  } = options;

  return {
    timestampMs,
    isRaceOn: true,
    engine: {
      currentRpm: rpm,
      idleRpm: 1000,
      maxRpm: 8000,
      powerWatts: 250000,
      torqueNm: 400
    },
    vehicle: {
      carOrdinal: 1,
      carClass: 'A',
      carClassId: 4,
      drivetrain: 'RWD'
    },
    motion: {
      position: { x, y, z },
      velocity: { x: 0, y: 0, z: speedMps },
      speedMps,
      speedMph: speedMps * 2.236936,
      acceleration: {
        x: lateralG * 9.80665,
        y: 0,
        z: -longitudinalG * 9.80665,
        lateralG,
        verticalG: 0,
        longitudinalG: -longitudinalG // forward decel is negative in vehicle space, magnitude is positive
      }
    },
    inputs: {
      throttle,
      brake,
      clutch: 0,
      handbrake: 0,
      steering,
      gear
    },
    chassis: {},
    tires: {
      tempF: { frontLeft: 215, frontRight: 218, rearLeft: 225, rearRight: 227 },
      slipRatio: { frontLeft: 0.05, frontRight: 0.05, rearLeft: 0.10, rearRight: 0.10 }
    },
    timing: {
      lapNumber,
      currentLapTime: timestampMs / 1000.0
    }
  };
}

function generateSyntheticCornerTelemetry(options = {}) {
  const {
    carClass = 'A',
    entrySpeedMps = 60.0, // ~134 mph
    turnInSpeedMps = 35.0, // ~78 mph
    apexSpeedMps = 30.0, // ~67 mph
    peakDecelG = 1.50,
    brakeOnsetDistMeters = 80.0,
    peakBrakePressure = 1.0,
    lapNumber = 1
  } = options;

  const samples = [];
  const totalSamples = 120;
  const brakeIdx = 20;
  const turnInIdx = 60;
  const apexIdx = 80;
  const exitIdx = 110;

  for (let i = 0; i < totalSamples; i++) {
    let speed = entrySpeedMps;
    let brake = 0;
    let throttle = 0;
    let steer = 0;
    let decelG = 0;
    let latG = 0;
    let distZ = i * 2.0;

    if (i < brakeIdx) {
      speed = entrySpeedMps;
      throttle = 1.0;
    } else if (i >= brakeIdx && i < turnInIdx) {
      // Straight-line threshold braking zone
      const brakeProgress = (i - brakeIdx) / (turnInIdx - brakeIdx);
      speed = entrySpeedMps - (entrySpeedMps - turnInSpeedMps) * brakeProgress;
      brake = peakBrakePressure;
      decelG = peakDecelG;
      throttle = 0;
      steer = 0;
    } else if (i >= turnInIdx && i <= apexIdx) {
      // Trail-braking & steering into apex
      const trailProgress = (i - turnInIdx) / (apexIdx - turnInIdx);
      speed = turnInSpeedMps - (turnInSpeedMps - apexSpeedMps) * trailProgress;
      brake = peakBrakePressure * (1.0 - trailProgress * 0.8);
      decelG = peakDecelG * (1.0 - trailProgress * 0.7);
      steer = 0.35 * trailProgress;
      latG = 1.2 * trailProgress;
    } else {
      // Corner exit
      const exitProgress = (i - apexIdx) / (exitIdx - apexIdx);
      speed = apexSpeedMps + (entrySpeedMps * 0.8 - apexSpeedMps) * exitProgress;
      throttle = 0.2 + 0.8 * exitProgress;
      brake = 0;
      steer = 0.35 * (1.0 - exitProgress);
      latG = 1.2 * (1.0 - exitProgress);
    }

    const s = createMockSample({
      timestampMs: 1000 + i * 16.67,
      speedMps: speed,
      brake,
      throttle,
      steering: steer,
      longitudinalG: decelG,
      lateralG: latG,
      x: steer * 10,
      y: 0,
      z: distZ,
      lapNumber
    });
    s.vehicle.carClass = carClass;
    samples.push(s);
  }

  const mockCorner = {
    cornerNumber: 1,
    cornerType: 'Type II',
    type: 'Right',
    indexes: {
      brake: brakeIdx,
      turnIn: turnInIdx,
      entry: brakeIdx,
      apex: apexIdx,
      tap: apexIdx + 5,
      exit: exitIdx
    },
    dynamics: {
      peakDecelG,
      tapDeltaFeet: 10.0,
      trailBrakingOverlapPercent: 40,
      isEarlyApex: false
    },
    inputs: {
      peakBrakePressure,
      entryBrakePressure: peakBrakePressure,
      gear: 3,
      minRpm: 4500,
      exitRpm: 6000,
      maxRpm: 8000
    },
    speed: {
      entryMph: entrySpeedMps * 2.236936,
      apexMph: apexSpeedMps * 2.236936,
      exitMph: 90.0
    }
  };

  return { samples, mockCorner };
}

function createMockLap(lapNumber = 1, lapTime = 70.0, speedMultiplier = 1.0) {
  const samples = [];
  const totalSamples = 300;
  const dt = lapTime / totalSamples;

  for (let i = 0; i < totalSamples; i++) {
    const t = i * dt;
    let speedMps = 40.0 * speedMultiplier;
    let throttle = 1.0;
    let brake = 0.0;
    let steer = 0.0;
    
    const angle = (i / totalSamples) * 2 * Math.PI;
    const posX = 150.0 * Math.cos(angle);
    const posZ = 300.0 * Math.sin(angle);
    const posY = 0;

    // Corner 1: index 30 to 80 (Apex at 60) -> Leads to long straight (Type I)
    if (i >= 30 && i < 60) {
      brake = 0.8;
      throttle = 0.0;
      steer = 0.3;
      speedMps = (50 - (i - 30) * 0.8) * speedMultiplier;
    } else if (i >= 60 && i <= 80) {
      brake = 0.0;
      throttle = 0.9;
      steer = 0.15;
      speedMps = (26 + (i - 60) * 0.8) * speedMultiplier;
    } 
    // Corner 2: index 160 to 220 (Apex at 200) -> Follows long straight (Type II)
    else if (i >= 160 && i < 200) {
      brake = 0.9;
      throttle = 0.0;
      steer = 0.35;
      speedMps = (55 - (i - 160) * 0.8) * speedMultiplier;
    } else if (i >= 200 && i <= 220) {
      brake = 0.0;
      throttle = 0.7;
      steer = 0.1;
      speedMps = (23 + (i - 200) * 0.6) * speedMultiplier;
    }

    samples.push({
      timing: { lapNumber, currentLapTime: t },
      motion: {
        position: { x: posX, y: posY, z: posZ },
        speedMps,
        speedMph: speedMps * 2.236936,
        acceleration: { lateralG: steer * 3.0, longitudinalG: throttle > 0 ? 0.4 : -1.45 },
        orientation: { yaw: steer * 0.5, pitch: 0, roll: 0 }
      },
      inputs: { throttle, brake, steering: steer, gear: 3 },
      engine: { currentRpm: 6000, maxRpm: 8000 },
      vehicle: { carClass: 'A' },
      tires: {
        tempF: { frontLeft: 215, frontRight: 218, rearLeft: 225, rearRight: 228 },
        slipRatio: { frontLeft: 0.05, frontRight: 0.05, rearLeft: 0.08, rearRight: 0.08 }
      }
    });
  }

  const corners = [
    {
      cornerNumber: 1,
      type: 'Right',
      indexes: { entry: 30, turnIn: 40, apex: 60, tap: 65, exit: 80 },
      speed: { entryMph: 100 * speedMultiplier, apexMph: 45 * speedMultiplier, exitMph: 85 * speedMultiplier }
    },
    {
      cornerNumber: 2,
      type: 'Left',
      indexes: { entry: 160, turnIn: 175, apex: 200, tap: 205, exit: 220 },
      speed: { entryMph: 120 * speedMultiplier, apexMph: 42 * speedMultiplier, exitMph: 75 * speedMultiplier }
    }
  ];

  return {
    lapNumber,
    lapTime,
    isValid: true,
    samples,
    corners
  };
}

test('BrakingZoneEngine: Threshold Braking Efficiency Calculation', () => {
  const engine = new BrakingZoneEngine();
  const { samples, mockCorner } = generateSyntheticCornerTelemetry({
    carClass: 'A',
    peakDecelG: 1.48, // Class A max is 1.60G -> efficiency ~93% [A+]
    peakBrakePressure: 1.0
  });

  const bz = engine.extractCornerBrakingZone(samples, mockCorner, CLASS_THEORETICAL_MAX_DECEL_G['A']);

  assert.equal(bz.cornerNumber, 1);
  assert.ok(bz.gForces.peakDecelG >= 1.40, 'Peak decel should be >= 1.40G');
  assert.ok(bz.efficiency.percent >= 85, 'Efficiency should be >= 85%');
  assert.ok(bz.efficiency.grade === 'A+' || bz.efficiency.grade === 'A', 'Grade should be A or A+');
  assert.equal(bz.efficiency.isSubThreshold, false);
});

test('BrakingZoneEngine: Accurate straight-line braking distance in feet & meters', () => {
  const engine = new BrakingZoneEngine();
  const { samples, mockCorner } = generateSyntheticCornerTelemetry();

  const bz = engine.extractCornerBrakingZone(samples, mockCorner, 1.60);

  assert.ok(bz.distance.straightLineBrakeMeters > 0, 'Distance in meters must be > 0');
  assert.ok(bz.distance.straightLineBrakeFeet > bz.distance.straightLineBrakeMeters, 'Distance in feet must be > distance in meters');
  assert.equal(bz.distance.straightLineBrakeFeet, Number((bz.distance.straightLineBrakeMeters * 3.28084).toFixed(1)));
});

test('BrakingZoneEngine: Evaluates "The Procedure" lap-by-lap stepping consistency', () => {
  const engine = new BrakingZoneEngine();

  // Create 3 laps with consistent brake markers
  const lap1 = { isValid: true, lapNumber: 1, samples: [], corners: [] };
  const lap2 = { isValid: true, lapNumber: 2, samples: [], corners: [] };
  const lap3 = { isValid: true, lapNumber: 3, samples: [], corners: [] };

  const data1 = generateSyntheticCornerTelemetry({ lapNumber: 1, peakDecelG: 1.40 });
  const data2 = generateSyntheticCornerTelemetry({ lapNumber: 2, peakDecelG: 1.48 });
  const data3 = generateSyntheticCornerTelemetry({ lapNumber: 3, peakDecelG: 1.52 });

  lap1.samples = data1.samples;
  lap1.corners = [data1.mockCorner];

  lap2.samples = data2.samples;
  lap2.corners = [data2.mockCorner];

  lap3.samples = data3.samples;
  lap3.corners = [data3.mockCorner];

  const theProcedure = engine.evaluateTheProcedure([lap1, lap2, lap3]);

  assert.ok(theProcedure.overallConsistencyScore >= 80, 'Consistency score should be high for tight variance');
  assert.equal(theProcedure.rating, 'Mastery');
  assert.equal(theProcedure.cornerSteppingMetrics.length, 1);
  assert.equal(theProcedure.cornerSteppingMetrics[0].cornerNumber, 1);
});

test('BrakingZoneEngine: Generates Deceleration G and Brake Pressure profile curves', () => {
  const engine = new BrakingZoneEngine();
  const { samples, mockCorner } = generateSyntheticCornerTelemetry({ peakDecelG: 1.55 });

  const bz = engine.extractCornerBrakingZone(samples, mockCorner, 1.60);

  assert.ok(bz.profileCurve.length > 10, 'Profile curve should contain interpolation points');
  assert.equal(bz.profileCurve[0].progress, 0.0, 'First point progress should be 0.0');
  assert.equal(bz.profileCurve[bz.profileCurve.length - 1].progress, 1.0, 'Last point progress should be 1.0');
  assert.ok(bz.profileCurve.some(p => p.decelG > 1.0), 'Profile curve should capture peak deceleration');
});

test('RulesEngine: Diagnoses R-010 Sub-Threshold Braking', () => {
  const rules = new RulesEngine();
  const { mockCorner } = generateSyntheticCornerTelemetry({
    peakDecelG: 0.70, // low peak decel during heavy brake application
    entrySpeedMps: 60,
    turnInSpeedMps: 30
  });
  mockCorner.dynamics.peakDecelG = 0.70;
  mockCorner.speed.entryMph = 130.0;
  mockCorner.speed.apexMph = 70.0;
  mockCorner.inputs.peakBrakePressure = 0.60;

  const findings = rules.evaluateCorner(mockCorner);
  const r010 = findings.find(f => f.id === 'R-010');

  assert.ok(r010, 'R-010 Sub-Threshold Braking should be diagnosed');
  assert.equal(r010.name, 'Sub-Threshold Braking');
});

test('AnalysisEngine & ApexPdfBuilder: End-to-end 5-page PDF compilation with Section 5 (Braking & Entering)', async () => {
  const analysis = new AnalysisEngine();
  const pdfBuilder = new ApexPdfBuilder();

  // Create two distinct laps with corners
  const lap1 = createMockLap(1, 68.5, 1.05);
  const lap2 = createMockLap(2, 71.0, 0.95);
  const stintSamples = [...lap1.samples, ...lap2.samples];

  const report = analysis.analyzeStint(stintSamples, {
    vehicle: { carClass: 'A' }
  });

  assert.ok(report.brakingAnalysis, 'AnalysisEngine report must contain brakingAnalysis');
  assert.ok(report.brakingAnalysis.brakingZones.length > 0, 'Braking zones must be extracted');
  assert.ok(report.brakingAnalysis.stintMaxDecelG > 0, 'Stint max decel G must be computed');
  assert.ok(report.brakingAnalysis.avgEfficiencyPercent > 0, 'Threshold efficiency must be calculated');
  assert.ok(report.brakingAnalysis.theProcedure, 'The Procedure analysis must exist');

  const pdfBytes = await pdfBuilder.build(report, {
    sessionName: 'Sprint 9 Validation Stint',
    driverName: 'Carl Lopez',
    carClass: 'A Class',
    trackName: 'Lime Rock Park'
  });

  assert.ok(pdfBytes instanceof Uint8Array, 'PDF output must be a valid Uint8Array');
  assert.ok(pdfBytes.length > 10000, 'PDF byte length must represent a complete 5-page document');
});
