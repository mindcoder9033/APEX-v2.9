import test from 'node:test';
import assert from 'node:assert/strict';
import { LapAnalyzerMetrics } from '../src/analysis/lap-analyzer-metrics.js';

function createMockLap(lapNumber = 1, lapTime = 84.5) {
  const samples = [];
  const count = 120;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI;
    const x = 500 + 300 * Math.cos(angle);
    const z = 500 + 300 * Math.sin(angle);
    const speedMps = 20 + 25 * (1 + Math.sin(angle)); // 20 - 70 mps (~72 - 252 km/h)
    const brake = (i >= 20 && i <= 35) ? 0.85 : 0;
    const throttle = brake > 0 ? 0 : 0.95;
    const gear = speedMps > 40 ? 4 : (speedMps > 25 ? 3 : 2);

    samples.push({
      motion: {
        position: { x, y: 0, z },
        speedMps
      },
      inputs: {
        throttle,
        brake,
        steering: Math.cos(angle) * 0.3
      },
      engine: {
        gear,
        currentRpm: 6500
      }
    });
  }

  const corners = [
    {
      cornerNumber: 1,
      entryIndex: 20,
      brakeIndex: 20,
      apexIndex: 35,
      exitIndex: 50
    },
    {
      cornerNumber: 2,
      entryIndex: 75,
      brakeIndex: 75,
      apexIndex: 90,
      exitIndex: 105
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

test('LapAnalyzerMetrics.processLap enriches samples with cumulative distance and speeds', () => {
  const mockLap = createMockLap(1, 85.2);
  const processed = LapAnalyzerMetrics.processLap(mockLap);

  assert.ok(processed, 'Processed lap should exist');
  assert.equal(processed.lapNumber, 1);
  assert.equal(processed.lapTime, 85.2);
  assert.ok(processed.totalDistanceM > 1000, 'Track distance should be computed');
  assert.ok(processed.path.length === 120, 'Path points match sample count');

  // Verify distance monotonicity
  for (let i = 1; i < processed.path.length; i++) {
    assert.ok(processed.path[i].distanceM >= processed.path[i - 1].distanceM, 'Distance increases monotonically');
  }

  // Verify corners
  assert.equal(processed.corners.length, 2);
  const t1 = processed.corners[0];
  assert.equal(t1.turnNumber, 1);
  assert.ok(t1.entryDistanceM >= 0);
  assert.ok(t1.exitSpeedKmh > 0);
  assert.ok(t1.exitGear.startsWith('G'));
  assert.ok(t1.brakingDistanceM > 0);
});

test('LapAnalyzerMetrics.computeSessionSummary computes progression, consistency, and inconsistent corner', () => {
  const lap1 = LapAnalyzerMetrics.processLap(createMockLap(1, 86.4));
  const lap2 = LapAnalyzerMetrics.processLap(createMockLap(2, 85.1));
  const lap3 = LapAnalyzerMetrics.processLap(createMockLap(3, 84.3));

  const summary = LapAnalyzerMetrics.computeSessionSummary([lap1, lap2, lap3]);

  assert.equal(summary.totalLaps, 3);
  assert.equal(summary.bestLapTime, 84.3);
  assert.equal(summary.firstLapTime, 86.4);
  assert.equal(summary.improvementSec, 2.1);
  assert.ok(summary.brakingConsistencyScore >= 50 && summary.brakingConsistencyScore <= 100);
  assert.ok(summary.mostInconsistentCorner !== null);
  assert.ok(summary.mostInconsistentCorner.turnNumber > 0);
});
