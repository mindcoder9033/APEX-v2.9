import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfaceIntelligenceEngine } from '../src/analysis/surface-intelligence.js';

test('SurfaceIntelligenceEngine: Returns default values for empty samples', () => {
  const engine = new SurfaceIntelligenceEngine();
  const res = engine.analyze([]);
  assert.equal(res.surfaceScore, 100);
  assert.equal(res.isWetSession, false);
  assert.equal(res.asymmetricDragEvents, 0);
});

test('SurfaceIntelligenceEngine: Detects wet conditions, asymmetric puddle drag, and hydroplaning risk', () => {
  const engine = new SurfaceIntelligenceEngine();
  const samples = [];

  for (let i = 0; i < 50; i++) {
    samples.push({
      timestampMs: i * 16,
      speed: 30, // ~67 mph
      roll: 0.05,
      pitch: 0.02,
      accelerationY: 9.8,
      wheelOnPuddleDepth: {
        frontLeft: 0.08, // 80mm puddle on left side
        rearLeft: 0.08,
        frontRight: 0.01, // 10mm puddle on right side
        rearRight: 0.01
      },
      surfaceRumble: { frontLeft: 0.3, frontRight: 0.0 }
    });
  }

  const res = engine.analyze(samples);
  assert.equal(res.isWetSession, true, 'Should detect wet session');
  assert.ok(res.asymmetricDragEvents > 0, 'Should detect asymmetric puddle drag');
  assert.ok(res.hydroplaningRiskEvents > 0, 'Should detect hydroplaning risk');
  assert.ok(res.coachingNotes.some(n => n.title.includes('Puddle Drag')));
});

test('SurfaceIntelligenceEngine: Detects crest unweighting and generates elevation coaching', () => {
  const engine = new SurfaceIntelligenceEngine();
  const samples = [
    {
      timestampMs: 16,
      speed: 35, // ~78 mph
      accelerationY: 4.9, // 0.5G vertical (50% unweighting)
      roll: 0.02,
      wheelOnPuddleDepth: { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 }
    }
  ];

  const res = engine.analyze(samples);
  assert.ok(res.maxCrestUnweightingPct > 40, 'Should detect crest unweighting');
  assert.ok(res.coachingNotes.some(n => n.title.includes('Crest Unweighting')));
});
