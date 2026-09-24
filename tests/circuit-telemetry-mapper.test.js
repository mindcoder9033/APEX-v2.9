import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitTelemetryMapper } from '../src/analysis/circuit-telemetry-mapper.js';

describe('CircuitTelemetryMapper: Live Telemetry Ingestion & Track Mapping Engine', () => {
  it('initializes with clean bounds and state', () => {
    const mapper = new CircuitTelemetryMapper();
    assert.strictEqual(mapper.liveSamples.length, 0);
    assert.strictEqual(mapper.corners.length, 0);
    assert.strictEqual(mapper.isLoopClosed, false);
  });

  it('ingests live telemetry samples and updates 3D bounding box', () => {
    const mapper = new CircuitTelemetryMapper();

    mapper.ingestSample({
      worldPositionX: 100,
      worldPositionY: 10,
      worldPositionZ: 200,
      speed: 40,
      throttle: 0.9,
      brake: 0,
      lateralG: 0.1,
      lapDistance: 100,
      currentLapNum: 1
    });

    mapper.ingestSample({
      worldPositionX: -50,
      worldPositionY: 5,
      worldPositionZ: 350,
      speed: 35,
      throttle: 0.5,
      brake: 0,
      lateralG: 0.8,
      lapDistance: 250,
      currentLapNum: 1
    });

    assert.strictEqual(mapper.bounds.minX, -50);
    assert.strictEqual(mapper.bounds.maxX, 100);
    assert.strictEqual(mapper.bounds.minZ, 200);
    assert.strictEqual(mapper.bounds.maxZ, 350);
    assert.strictEqual(mapper.bounds.centerX, 25);
    assert.strictEqual(mapper.bounds.centerZ, 275);
  });

  it('detects corners and landmark indices from curvature / lateral G peaks', () => {
    const mapper = new CircuitTelemetryMapper({ minCornerG: 0.4 });

    // Simulate straight -> brake -> right corner -> exit -> straight
    let dist = 0;
    // 1. Straight (20 samples)
    for (let i = 0; i < 20; i++) {
      dist += 5;
      mapper.ingestSample({
        x: i * 5,
        y: 0,
        z: 0,
        speed: 50,
        throttle: 1.0,
        brake: 0,
        lateralG: 0.05,
        lapDistance: dist,
        currentLapNum: 1
      });
    }

    // 2. Braking into Turn 1 (10 samples)
    for (let i = 0; i < 10; i++) {
      dist += 3;
      mapper.ingestSample({
        x: 100 + i * 3,
        y: 0,
        z: i * 1,
        speed: 50 - i * 3,
        throttle: 0,
        brake: 0.8,
        lateralG: 0.2,
        lapDistance: dist,
        currentLapNum: 1
      });
    }

    // 3. Corner Arc (20 samples with peak lateral G ~1.2)
    for (let i = 0; i < 20; i++) {
      dist += 2.5;
      const angle = (i / 19) * (Math.PI / 2);
      const latG = Math.sin(angle) * 1.2;
      mapper.ingestSample({
        x: 130 + Math.sin(angle) * 40,
        y: 0,
        z: 10 + (1 - Math.cos(angle)) * 40,
        speed: 20 + Math.sin(angle) * 2,
        throttle: i > 10 ? 0.6 : 0,
        brake: 0,
        lateralG: latG,
        lapDistance: dist,
        currentLapNum: 1
      });
    }

    // 4. Straightaway exit (20 samples)
    for (let i = 0; i < 20; i++) {
      dist += 5;
      mapper.ingestSample({
        x: 170,
        y: 0,
        z: 50 + i * 5,
        speed: 25 + i * 1.5,
        throttle: 1.0,
        brake: 0,
        lateralG: 0.02,
        lapDistance: dist,
        currentLapNum: 1
      });
    }

    const corners = mapper.detectCorners();
    assert.strictEqual(corners.length >= 1, true, 'Must detect at least 1 corner');
    const t1 = corners[0];
    assert.strictEqual(t1.cornerNumber, 1);
    assert.strictEqual(t1.direction, 'Right');
    assert.strictEqual(t1.peakLateralG >= 0.8, true);
    assert.strictEqual(t1.radiusMeters > 0, true);
  });

  it('exports and imports circuit map and strategy telemetry in JSON format', () => {
    const mapper = new CircuitTelemetryMapper();

    for (let i = 0; i < 50; i++) {
      mapper.ingestSample({
        worldPositionX: Math.cos(i * 0.1) * 100,
        worldPositionY: 2,
        worldPositionZ: Math.sin(i * 0.1) * 100,
        speed: 30,
        throttle: 0.8,
        brake: 0,
        lateralG: 0.6,
        lapDistance: i * 10,
        currentLapNum: 1
      });
    }
    mapper.detectCorners();

    const jsonStr = mapper.exportToJson('Silverstone GP', { notes: 'Qualifying Lap' });
    assert.strictEqual(typeof jsonStr, 'string');
    assert.strictEqual(jsonStr.includes('APEX_CIRCUIT_STRATEGY_MAP'), true);
    assert.strictEqual(jsonStr.includes('Silverstone GP'), true);

    const importMapper = new CircuitTelemetryMapper();
    const success = importMapper.importFromJson(jsonStr);
    assert.strictEqual(success, true);
    assert.strictEqual(importMapper.liveSamples.length, 50);
    assert.strictEqual(importMapper.bounds.rangeX > 0, true);
  });
});
