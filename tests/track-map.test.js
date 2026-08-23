import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackMapGenerator, DRIVING_STATE, STATE_COLORS } from '../src/analysis/track-map.js';

// Helper to generate circular track coordinates with throttle & braking zones
function generateSyntheticCircuit(sampleCount = 120) {
  const samples = [];
  const radius = 250;
  const centerX = 300;
  const centerZ = 300;

  for (let i = 0; i < sampleCount; i++) {
    const angle = (i / sampleCount) * 2 * Math.PI;
    const posX = centerX + radius * Math.cos(angle);
    const posZ = centerZ + radius * Math.sin(angle);

    let throttle = 1.0;
    let brake = 0.0;
    let speedMps = 45.0;

    if (i >= 20 && i < 35) {
      // Braking zone into Turn 1
      brake = 0.8;
      throttle = 0.0;
      speedMps = 25.0;
    } else if (i >= 35 && i < 45) {
      // Partial throttle mid-corner
      brake = 0.0;
      throttle = 0.4;
      speedMps = 28.0;
    } else if (i >= 70 && i < 80) {
      // Coasting zone
      brake = 0.0;
      throttle = 0.0;
      speedMps = 38.0;
    } else {
      // Full throttle straight
      brake = 0.0;
      throttle = 1.0;
      speedMps = 55.0;
    }

    samples.push({
      timestampMs: 100000 + i * 16,
      motion: {
        position: { x: posX, y: 0, z: posZ },
        speedMps,
        speedMph: speedMps * 2.236936
      },
      inputs: {
        throttle,
        brake,
        steering: 0.2,
        gear: 3
      }
    });
  }

  return samples;
}

test('TrackMapGenerator: Classifies driving states accurately', () => {
  const generator = new TrackMapGenerator();

  assert.equal(generator.classifyDrivingState({ inputs: { throttle: 0.95, brake: 0.0 } }), DRIVING_STATE.FULL_THROTTLE);
  assert.equal(generator.classifyDrivingState({ inputs: { throttle: 0.45, brake: 0.0 } }), DRIVING_STATE.PARTIAL_THROTTLE);
  assert.equal(generator.classifyDrivingState({ inputs: { throttle: 0.0, brake: 0.75 } }), DRIVING_STATE.BRAKING);
  assert.equal(generator.classifyDrivingState({ inputs: { throttle: 0.02, brake: 0.05 } }), DRIVING_STATE.COASTING);
});

test('TrackMapGenerator: Normalizes 2D coordinates preserving aspect ratio', () => {
  const generator = new TrackMapGenerator();
  const samples = generateSyntheticCircuit(100);
  const rawPoints = generator.extractRawPoints(samples);

  const targetW = 600;
  const targetH = 400;
  const padding = 30;

  const result = generator.normalizeCoordinates(rawPoints, targetW, targetH, padding, false);

  assert.equal(result.points.length, 100);
  assert.ok(result.scale > 0, 'Scale should be positive');

  // Verify all points are inside target box bounds
  for (const pt of result.points) {
    assert.ok(pt.normX >= padding - 0.01, `normX ${pt.normX} < padding`);
    assert.ok(pt.normX <= targetW - padding + 0.01, `normX ${pt.normX} > max`);
    assert.ok(pt.normY >= padding - 0.01, `normY ${pt.normY} < padding`);
    assert.ok(pt.normY <= targetH - padding + 0.01, `normY ${pt.normY} > max`);
  }
});

test('TrackMapGenerator: Segments path into continuous multi-colored segments', () => {
  const generator = new TrackMapGenerator();
  const samples = generateSyntheticCircuit(100);
  const rawPoints = generator.extractRawPoints(samples);
  const { points } = generator.normalizeCoordinates(rawPoints, 600, 400, 30);

  const segments = generator.segmentPath(points);

  assert.ok(segments.length >= 3, 'Should produce multiple colored segments');
  const states = new Set(segments.map(s => s.state));
  assert.ok(states.has(DRIVING_STATE.FULL_THROTTLE), 'Should have full throttle segments');
  assert.ok(states.has(DRIVING_STATE.BRAKING), 'Should have braking segments');
  assert.ok(states.has(DRIVING_STATE.PARTIAL_THROTTLE), 'Should have partial throttle segments');
});

test('TrackMapGenerator: Computes turn overlays and flags problem zones', () => {
  const generator = new TrackMapGenerator();
  const samples = generateSyntheticCircuit(100);
  const rawPoints = generator.extractRawPoints(samples);
  const { points } = generator.normalizeCoordinates(rawPoints, 600, 400, 30);

  const mockCorners = [
    { cornerNumber: 1, type: 'Right 90°', indices: { apexIndex: 30 }, speed: { apexMph: 45 }, dynamics: { tapDeltaFeet: 25 } },
    { cornerNumber: 2, type: 'Left Hairpin', indices: { apexIndex: 75 }, speed: { apexMph: 32 }, dynamics: { tapDeltaFeet: -5 } }
  ];

  const mockFindings = [
    { id: 'R-001', ruleId: 'R-001', cornerNumber: 1, severity: 'High', name: 'Late Throttle Application' }
  ];

  const overlays = generator.computeTurnOverlays(mockCorners, points, mockFindings);

  assert.equal(overlays.length, 2);
  assert.equal(overlays[0].cornerNumber, 1);
  assert.equal(overlays[0].status, 'CRITICAL', 'Turn 1 with High severity rule should be CRITICAL');
  assert.equal(overlays[0].badgeColor, '#E10600');

  assert.equal(overlays[1].cornerNumber, 2);
  assert.equal(overlays[1].status, 'OPTIMAL', 'Turn 2 with no faults should be OPTIMAL');
  assert.equal(overlays[1].badgeColor, '#00CC66');
});

test('TrackMapGenerator: Generates valid SVG markup with grid, paths, and pins', () => {
  const generator = new TrackMapGenerator();
  const samples = generateSyntheticCircuit(100);
  const mockCorners = [
    { cornerNumber: 1, type: 'Right 90°', indices: { apexIndex: 30 }, speed: { apexMph: 45 }, dynamics: { tapDeltaFeet: 10 } }
  ];

  const svg = generator.generateSvg(samples, mockCorners, [], { width: 700, height: 400 });

  assert.ok(svg.includes('<svg'), 'Should contain svg tag');
  assert.ok(svg.includes('viewBox="0 0 700 400"'), 'Should have correct viewBox');
  assert.ok(svg.includes('class="track-segment'), 'Should contain track segments');
  assert.ok(svg.includes('T1'), 'Should contain Turn 1 marker');
  assert.ok(svg.includes('S/F'), 'Should contain Start/Finish badge');
});

test('TrackMapGenerator: Generates PDF vector primitives for pdf-lib drawing', () => {
  const generator = new TrackMapGenerator();
  const samples = generateSyntheticCircuit(100);
  const mockCorners = [
    { cornerNumber: 1, type: 'Right 90°', indices: { apexIndex: 30 }, speed: { apexMph: 45 }, dynamics: { tapDeltaFeet: 25 } }
  ];
  const mockFindings = [
    { id: 'R-001', ruleId: 'R-001', cornerNumber: 1, severity: 'High', name: 'Late Throttle' }
  ];

  const pdfData = generator.generatePdfVectorData(samples, mockCorners, mockFindings, {
    x: 36,
    y: 200,
    width: 523,
    height: 300,
    padding: 20
  });

  assert.ok(pdfData.segments.length > 10, 'Should have vector line segments');
  assert.ok(pdfData.turnMarkers.length === 1, 'Should have turn marker');
  assert.ok(pdfData.startFinish !== null, 'Should have start/finish coordinates');
  assert.equal(pdfData.issues.length, 1, 'Should extract line issues');
  assert.equal(pdfData.issues[0].cornerNumber, 1);
});
