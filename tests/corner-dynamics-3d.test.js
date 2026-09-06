import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CornerDynamics3DEngine, APEX_TYPE, CORNER_PHASE } from '../src/analysis/corner-dynamics-3d.js';
import { AnalysisEngine } from '../src/analysis/index.js';

describe('CornerDynamics3DEngine: Mathematical & Algorithmic Unit Tests', () => {
  const engine = new CornerDynamics3DEngine();

  it('computes theoretical speed correctly from corner radius and lateral G per Going Faster!', () => {
    // R = 50m, G = 1.15 -> v = sqrt(127 * 1.15 * 50) ≈ 85.46 km/h -> 85 km/h
    const speed50m = engine.calculateTheoreticalSpeedKmh(50, 1.15);
    assert.strictEqual(speed50m >= 80 && speed50m <= 90, true, `Expected ~85 km/h, got ${speed50m}`);

    // R = 150m, G = 1.30 -> high speed sweeper
    const speed150m = engine.calculateTheoreticalSpeedKmh(150, 1.30);
    assert.strictEqual(speed150m > speed50m, true, `High speed sweeper must have higher speed`);
  });

  it('estimates optimal transmission gear based on corner entry/exit speeds', () => {
    assert.strictEqual(engine.estimateOptimalGear(55), 2);
    assert.strictEqual(engine.estimateOptimalGear(90), 3);
    assert.strictEqual(engine.estimateOptimalGear(135), 4);
    assert.strictEqual(engine.estimateOptimalGear(180), 5);
  });

  it('extracts 3D coordinates, elevation, and computes cumulative track distance', () => {
    const mockSamples = [
      { motion: { position: { x: 0, y: 10, z: 0 }, speedMps: 30, orientation: { yaw: 0 }, acceleration: { lateralG: 0 } }, inputs: { throttle: 1, brake: 0, steering: 0 }, engine: { gear: 4 } },
      { motion: { position: { x: 30, y: 12, z: 40 }, speedMps: 28, orientation: { yaw: 0.5 }, acceleration: { lateralG: 0.8 } }, inputs: { throttle: 0, brake: 0.5, steering: 0.2 }, engine: { gear: 3 } },
      { motion: { position: { x: 60, y: 15, z: 80 }, speedMps: 22, orientation: { yaw: 1.0 }, acceleration: { lateralG: 1.1 } }, inputs: { throttle: 0.2, brake: 0, steering: 0.4 }, engine: { gear: 2 } }
    ];

    const path = engine.extract3DPath(mockSamples);
    assert.strictEqual(path.length, 3);
    assert.strictEqual(path[0].dist, 0);
    assert.strictEqual(path[0].y, 10);
    // dist between (0,10,0) and (30,12,40): dx=30, dy=2, dz=40 -> sqrt(900+4+1600)=sqrt(2504)≈50.04m
    assert.strictEqual(Math.round(path[1].dist), 50);
  });

  it('detects corners and distinguishes Late Apex vs Geometric Apex', () => {
    // Generate synthetic hairpin corner telemetry: straight -> braking/turn-in -> apex (late) -> track-out straight
    const samples = [];
    const totalPoints = 120;
    
    // Sector 1: Approach straight (0 to 30)
    for (let i = 0; i < 30; i++) {
      samples.push({
        positionX: i * 5,
        positionY: 5.0,
        positionZ: 0,
        speedMps: 45 - (i > 20 ? (i - 20) * 1.5 : 0),
        gear: i > 25 ? 3 : 4,
        throttle: i < 20 ? 1.0 : 0.0,
        brake: i >= 20 ? 0.8 : 0.0,
        steering: 0.0,
        yaw: 0.0,
        lateralG: 0.0
      });
    }

    // Sector 2: Right-hand corner arc (30 to 90) - circular arc R = 40m
    // Geometric center is at point 60. We make driver reach minimum speed and apex at point 72 (Late apex!)
    for (let i = 30; i < 90; i++) {
      const angle = ((i - 30) / 60) * Math.PI; // 0 to 180 deg
      const r = 40;
      const x = 150 + r * Math.sin(angle);
      const z = r - r * Math.cos(angle);
      const elevation = 5.0 + Math.sin(angle) * 3.0; // Elevation rise

      // Speed minimum at i=72 (late apex)
      const speed = 20 + Math.abs(i - 72) * 0.4;
      const steer = 0.35 + (i >= 60 && i <= 75 ? 0.15 : 0);
      const throttle = i >= 72 ? (i - 72) / 18 : 0.0;

      samples.push({
        positionX: x,
        positionY: elevation,
        positionZ: z,
        speedMps: speed,
        gear: 2,
        throttle: throttle,
        brake: i < 40 ? 0.3 : 0.0,
        steering: steer,
        yaw: angle,
        lateralG: 1.1
      });
    }

    // Sector 3: Exit straight (90 to 120)
    for (let i = 90; i < totalPoints; i++) {
      const step = i - 90;
      samples.push({
        positionX: 150 - step * 5,
        positionY: 5.0,
        positionZ: 80,
        speedMps: 28 + step * 0.8,
        gear: step > 15 ? 4 : 3,
        throttle: 1.0,
        brake: 0.0,
        steering: 0.0,
        yaw: Math.PI,
        lateralG: 0.0
      });
    }

    const corners = engine.analyzeCorners3D(samples);
    assert.strictEqual(corners.length >= 1, true, 'Should detect at least 1 corner');

    const corner = corners[0];
    assert.strictEqual(corner.cornerNumber, 1);
    assert.strictEqual(corner.entry.targetSpeedKmh > 0, true);
    assert.strictEqual(corner.exit.targetSpeedKmh > 0, true);
    assert.strictEqual(corner.actualApex.classification, APEX_TYPE.LATE);
    assert.strictEqual(corner.actualApex.lateApexDeltaMeters > 0, true, 'Late apex delta should be positive');
  });

  it('evaluates live sample progress and generates active corner HUD banner', () => {
    // Generate simple corner
    const samples = [];
    for (let i = 0; i < 80; i++) {
      const angle = (i / 80) * Math.PI;
      samples.push({
        positionX: 50 * Math.sin(angle),
        positionY: 2,
        positionZ: 50 * (1 - Math.cos(angle)),
        speedMps: 25,
        gear: 3,
        throttle: 0.5,
        brake: 0,
        steering: 0.2,
        yaw: angle,
        lateralG: 0.9
      });
    }

    const corners = engine.analyzeCorners3D(samples);
    assert.strictEqual(corners.length > 0, true);

    const liveSample = samples[10]; // Near entry
    const progress = engine.evaluateLiveProgress(liveSample, samples.slice(0, 15), corners);
    assert.strictEqual(progress.activeCorner !== null, true);
    assert.strictEqual(progress.coachingBanner !== null, true);
    assert.strictEqual(typeof progress.coachingBanner.entryTarget, 'string');
    assert.strictEqual(typeof progress.coachingBanner.exitTarget, 'string');
  });

  it('AnalysisEngine end-to-end integration produces corners3D in stint report', () => {
    const analysisEngine = new AnalysisEngine();
    const mockTelemetry = [];
    for (let i = 0; i < 150; i++) {
      mockTelemetry.push({
        lapNumber: 1,
        lapTime: i * 0.05,
        motion: {
          position: {
            x: Math.cos(i * 0.05) * 100,
            y: Math.sin(i * 0.02) * 5,
            z: Math.sin(i * 0.05) * 100
          },
          speedMps: 30,
          orientation: { yaw: i * 0.05, pitch: 0, roll: 0 },
          acceleration: { lateralG: 0.8, longitudinalG: 0.1, verticalG: 1.0 }
        },
        engine: { gear: 3, rpm: 5000 },
        inputs: {
          throttle: 0.6,
          brake: 0.0,
          clutch: 0.0,
          steering: 0.1
        },
        tires: {
          frontLeft: { temp: 85, pressure: 32, slipRatio: 0.02, slipAngle: 0.03 },
          frontRight: { temp: 85, pressure: 32, slipRatio: 0.02, slipAngle: 0.03 },
          rearLeft: { temp: 85, pressure: 32, slipRatio: 0.02, slipAngle: 0.03 },
          rearRight: { temp: 85, pressure: 32, slipRatio: 0.02, slipAngle: 0.03 }
        }
      });
    }

    const report = analysisEngine.analyzeStint(mockTelemetry);
    assert.strictEqual(Array.isArray(report.corners3D), true);
  });
});
