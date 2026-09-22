import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ElevationDynamicsEngine, TOPOGRAPHY_FEATURE, TOPOGRAPHY_RISK } from '../src/analysis/elevation-dynamics.js';
import { OptimalLineEngine, LINE_ARCHETYPE } from '../src/analysis/optimal-line-engine.js';
import { CircuitStrategistEngine, CORNER_STRATEGY_TYPE } from '../src/analysis/circuit-strategist.js';

describe('Circuit Strategist - Phase 1: Core Physics & Optimal Line Engine', () => {

  describe('ElevationDynamicsEngine: 3D Topography & Vertical Normal Force', () => {
    const elevationEngine = new ElevationDynamicsEngine();

    it('calculates slope grade percent correctly', () => {
      // 5m rise over 100m distance = +5.0% grade
      const uphill = elevationEngine.calculateGradePercent(10.0, 15.0, 100.0);
      assert.strictEqual(uphill, 5.0);

      // 6m drop over 120m distance = -5.0% grade
      const downhill = elevationEngine.calculateGradePercent(20.0, 14.0, 120.0);
      assert.strictEqual(downhill, -5.0);
    });

    it('calculates crest unweighting and compression normal force variation', () => {
      const ds = 10.0;
      const speedMps = 40.0; // ~144 km/h

      // Crest (convex curve: center is higher than ends)
      const crestDyn = elevationEngine.calculateVerticalDynamics(10.0, 12.0, 10.0, ds, speedMps);
      assert.strictEqual(crestDyn.verticalCurvature < 0, true, 'Crest vertical curvature must be negative');
      assert.strictEqual(crestDyn.normalForceRatio < 1.0, true, 'Crest normal force ratio must be < 1.0');

      // Compression / Dip (concave curve: center is lower than ends)
      const compDyn = elevationEngine.calculateVerticalDynamics(12.0, 10.0, 12.0, ds, speedMps);
      assert.strictEqual(compDyn.verticalCurvature > 0, true, 'Compression curvature must be positive');
      assert.strictEqual(compDyn.normalForceRatio > 1.0, true, 'Compression normal force ratio must be > 1.0');
    });

    it('calculates elevation-adjusted braking distance modifier per Going Faster Ch. 5', () => {
      // Flat track: modifier should be ~1.0
      const flatMod = elevationEngine.calculateBrakingDistanceModifier(0.0);
      assert.strictEqual(Math.round(flatMod * 10) / 10, 1.0);

      // Downhill -6% slope: stopping distance must increase (> 1.0)
      const downhillMod = elevationEngine.calculateBrakingDistanceModifier(-6.0);
      assert.strictEqual(downhillMod > 1.0, true, 'Downhill braking distance must be longer');

      // Uphill +6% slope: stopping distance must decrease (< 1.0)
      const uphillMod = elevationEngine.calculateBrakingDistanceModifier(6.0);
      assert.strictEqual(uphillMod < 1.0, true, 'Uphill braking distance must be shorter');
    });

    it('analyzes corner topography and triggers risk warnings on steep downhill crest', () => {
      const mockSamples = [];
      for (let i = 0; i < 20; i++) {
        // Downhill crest profile
        const elevation = i < 10 ? 20 - (i * 0.2) : 18 - (i - 10) * 1.5;
        mockSamples.push({
          x: i * 5,
          y: elevation,
          z: i * 5,
          dist: i * 7.07,
          speedMps: 35.0
        });
      }

      const topo = elevationEngine.analyzeCornerTopography(mockSamples, 2, 10, 18);
      assert.strictEqual(topo.warnings.length > 0, true, 'Should produce racecraft warnings');
      assert.strictEqual(topo.brakingDistanceMod > 1.0, true, 'Downhill braking mod should be > 1.0');
    });
  });

  describe('OptimalLineEngine: Going Faster Driving Line Spline & Curvature', () => {
    const lineEngine = new OptimalLineEngine();

    it('generates Late Apex archetype with asymmetric apex depth ~70%', () => {
      const offsets = lineEngine.getArchetypeOffsets(LINE_ARCHETYPE.LATE_APEX);
      assert.strictEqual(offsets.entry, 1.0, 'Entry should start at 100% outside edge');
      assert.strictEqual(offsets.apexDepth >= 0.65 && offsets.apexDepth <= 0.75, true, 'Late apex depth should be ~70%');
      assert.strictEqual(offsets.trackOut >= 0.95, true, 'Track-out should use full outside curb');
    });

    it('generates Geometric archetype with symmetric apex depth at 50%', () => {
      const offsets = lineEngine.getArchetypeOffsets(LINE_ARCHETYPE.GEOMETRIC);
      assert.strictEqual(offsets.apexDepth, 0.50, 'Geometric apex must be at 50% midpoint');
    });

    it('computes continuous optimal line nodes, radius, and target speeds', () => {
      // 90-degree right turn telemetry path
      const cornerSamples = [];
      const totalPoints = 30;
      for (let i = 0; i < totalPoints; i++) {
        const angle = (i / (totalPoints - 1)) * (Math.PI / 2);
        const r = 50.0;
        cornerSamples.push({
          x: Math.sin(angle) * r,
          y: 5.0,
          z: (1 - Math.cos(angle)) * r,
          dist: i * 2.6,
          speedMps: 25.0
        });
      }

      const optLine = lineEngine.generateOptimalLine(cornerSamples, LINE_ARCHETYPE.LATE_APEX);
      assert.strictEqual(optLine.length, cornerSamples.length);
      assert.strictEqual(optLine[10].radiusMeters > 0, true);
      assert.strictEqual(optLine[10].targetSpeedKmh > 0, true);
    });

    it('evaluates line quality and track utilization', () => {
      const samples = [];
      for (let i = 0; i < 20; i++) {
        samples.push({ x: i * 5, y: 0, z: i * 2, dist: i * 5 });
      }

      const optLine = lineEngine.generateOptimalLine(samples, LINE_ARCHETYPE.LATE_APEX);
      const quality = lineEngine.evaluateLineQuality(samples, optLine, 12.0);

      assert.strictEqual(quality.trackUtilizationPercent >= 0 && quality.trackUtilizationPercent <= 100, true);
      assert.strictEqual(quality.lineQualityScore >= 0 && quality.lineQualityScore <= 100, true);
    });
  });

  describe('CircuitStrategistEngine: End-to-End Simulation & Compounding Gains', () => {
    const strategist = new CircuitStrategistEngine();

    it('correctly classifies Corner Types 1, 2, and 3', () => {
      // Preceding 100m, Following 400m -> Type 1 (Exit Priority)
      const type1 = strategist.classifyCornerType(100, 400, false);
      assert.strictEqual(type1, CORNER_STRATEGY_TYPE.TYPE_1_EXIT_PRIORITY);

      // Preceding 350m, Following 100m -> Type 2 (Entry Priority)
      const type2 = strategist.classifyCornerType(350, 100, false);
      assert.strictEqual(type2, CORNER_STRATEGY_TYPE.TYPE_2_ENTRY_PRIORITY);

      // Linked S-Curve -> Type 3 (Compromise)
      const type3 = strategist.classifyCornerType(100, 100, true);
      assert.strictEqual(type3, CORNER_STRATEGY_TYPE.TYPE_3_COMPROMISE);
    });

    it('computes compounding straightaway gain accurately per Going Faster Ch. 2', () => {
      // +1.5 m/s (+5.4 km/h) exit speed over 400m straight
      const gain = strategist.computeStraightawayGain(1.5, 400, 35.0);
      assert.strictEqual(gain < 0, true, 'Gain must be negative (time saved)');
      assert.strictEqual(gain <= -0.20 && gain >= -0.60, true, `Expected ~ -0.35s gain, got ${gain}s`);
    });

    it('simulates a What-If Late Apex scenario and outputs complete racecraft coaching delta', () => {
      const mockCorner = {
        entrySpeedKmh: 110,
        apexSpeedKmh: 72,
        exitSpeedKmh: 90,
        lengthMeters: 140,
        radiusMeters: 45,
        brakeIndex: 2,
        apexIndex: 12,
        exitIndex: 24,
        followingStraightMeters: 450,
        precedingStraightMeters: 120
      };

      const mockSamples = [];
      for (let i = 0; i < 25; i++) {
        mockSamples.push({
          x: i * 6,
          y: 10 + Math.sin(i * 0.2) * 2,
          z: i * 4,
          dist: i * 7.2,
          speedMps: (90 / 3.6)
        });
      }

      const adjustments = strategist.getPreset('LATE_APEX_EXIT');
      const result = strategist.simulateCorner(mockCorner, adjustments, mockSamples, { followingStraightMeters: 450 });

      assert.strictEqual(result.cornerType, CORNER_STRATEGY_TYPE.TYPE_1_EXIT_PRIORITY);
      assert.strictEqual(result.deltas.exitSpeedKmh > 0, true, 'Late apex must increase exit speed');
      assert.strictEqual(result.deltas.straightawayDeltaSec < 0, true, 'Must save time down following straight');
      assert.strictEqual(result.deltas.totalLapDeltaSec < 0, true, 'Total lap delta must reflect time gained');
      assert.strictEqual(result.advisory.badges.length > 0, true, 'Advisory must contain strategy badges');
      assert.strictEqual(result.advisory.coaching.length > 0, true, 'Advisory must contain coaching notes');
    });

    it('loads standard Skip Barber presets correctly', () => {
      const lateApexPreset = strategist.getPreset('LATE_APEX_EXIT');
      assert.strictEqual(lateApexPreset.archetype, LINE_ARCHETYPE.LATE_APEX);

      const deepBrakePreset = strategist.getPreset('DEEP_BRAKE_DEFENSE');
      assert.strictEqual(deepBrakePreset.deltaBrakeMeters, 12);

      const rainPreset = strategist.getPreset('RAIN_LINE');
      assert.strictEqual(rainPreset.archetype, LINE_ARCHETYPE.RAIN_LINE);
    });
  });

});
