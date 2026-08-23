import test from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryCsvExporter } from '../src/shared/csv-exporter.js';

test('TelemetryCsvExporter: Generates valid CSV header row on empty samples', () => {
  const csv = TelemetryCsvExporter.exportToCsv([]);
  assert.ok(csv.startsWith('TimestampMs,LapNumber,DistanceTraveledM,PositionX,PositionY,PositionZ'));
  const headerCols = csv.split(',');
  assert.ok(headerCols.length >= 35, `Expected >= 35 header columns, got ${headerCols.length}`);
});

test('TelemetryCsvExporter: Accurately formats full telemetry frames into CSV rows', () => {
  const sample = {
    timestamp: 16000,
    lap: { currentLap: 2, distanceTraveledMeters: 1450.75 },
    motion: {
      position: { x: 120.4567, y: 12.3456, z: -450.8912 },
      speedMps: 44.704, // 100 mph, 160.934 kmh
      acceleration: { longitudinalG: -1.25, lateralG: 1.45, verticalG: 0.05 },
      orientation: { yaw: 45.2, pitch: -1.1, roll: 0.5 }
    },
    inputs: { throttle: 0.85, brake: 0.0, clutch: 0.0, steering: 0.125, handbrake: false, gear: 4 },
    engine: { currentRpm: 6850, maxRpm: 8200, idleRpm: 1100 },
    tires: {
      temperatures: { frontLeft: 215, frontRight: 218, rearLeft: 228, rearRight: 231 },
      slipRatio: { frontLeft: 0.08, frontRight: 0.09, rearLeft: 0.15, rearRight: 0.16 },
      slipAngle: { frontLeft: 0.04, frontRight: 0.04, rearLeft: 0.06, rearRight: 0.06 },
      suspensionTravel: { frontLeft: 0.12, frontRight: 0.12, rearLeft: 0.14, rearRight: 0.14 },
      surfaceRumble: { frontLeft: 0.0, frontRight: 0.0, rearLeft: 0.0, rearRight: 0.0 }
    }
  };

  const csv = TelemetryCsvExporter.exportToCsv([sample]);
  const lines = csv.split(/\r?\n/);
  
  assert.equal(lines.length, 2, 'CSV should contain header + 1 row');
  
  const headers = lines[0].split(',');
  const row = lines[1].split(',');
  assert.equal(headers.length, row.length, 'Header and row column counts must match exactly');

  // Verify specific column values
  assert.equal(row[0], '16000'); // TimestampMs
  assert.equal(row[1], '2');     // LapNumber
  assert.equal(row[2], '1450.75'); // DistanceTraveledM
  assert.equal(row[3], '120.4567'); // PositionX
  assert.equal(row[6], '100.00'); // SpeedMph (44.704 * 2.23694)
  assert.equal(row[8], '-1.250'); // AccelLongG
  assert.equal(row[9], '1.450');  // AccelLatG
  assert.equal(row[14], '85');    // ThrottlePct
  assert.equal(row[15], '0');     // BrakePct
  assert.equal(row[19], '4');     // Gear
  assert.equal(row[20], '6850');  // EngineRpm
  assert.equal(row[23], '215');   // TempFL_F
  assert.equal(row[27], '0.0800'); // SlipRatioFL
});
