/**
 * APEX Circuit Strategist: Interactive "What-If" Racecraft & Driving Line Simulation Engine
 * Master simulation engine implementing Skip Barber "Going Faster!" racecraft physics,
 * optimal driving line sculpting, 3D elevation dynamics, and compounding straightaway deltas.
 */

import { ElevationDynamicsEngine, TOPOGRAPHY_FEATURE, TOPOGRAPHY_RISK } from './elevation-dynamics.js';
import { OptimalLineEngine, LINE_ARCHETYPE } from './optimal-line-engine.js';
import { mpsToMph, mpsToKmh } from '../shared/telemetry-types.js';

export const CORNER_STRATEGY_TYPE = {
  TYPE_1_EXIT_PRIORITY: 'TYPE_1_EXIT_PRIORITY',   // Leads to long straight; exit speed is king
  TYPE_2_ENTRY_PRIORITY: 'TYPE_2_ENTRY_PRIORITY', // At end of straight; deep entry braking priority
  TYPE_3_COMPROMISE: 'TYPE_3_COMPROMISE'          // Linked turn / chicane compromise
};

export class CircuitStrategistEngine {
  constructor(options = {}) {
    this.elevationEngine = new ElevationDynamicsEngine(options.elevationOptions);
    this.lineEngine = new OptimalLineEngine(options.lineOptions);
    this.defaultMaxG = options.defaultMaxG || 1.20;
    this.frictionCoeff = options.frictionCoeff || 1.0;
  }

  /**
   * Classifies corner priority type based on preceding and succeeding straight lengths
   * Going Faster Ch. 2: Type 1 leads to long straight; Type 2 is at end of straight; Type 3 is linked
   * @param {number} precedingStraightMeters Length of straight before corner
   * @param {number} followingStraightMeters Length of straight after corner
   * @param {boolean} isLinked Whether corner is part of a chicane/complex
   * @returns {string} CORNER_STRATEGY_TYPE
   */
  classifyCornerType(precedingStraightMeters = 100, followingStraightMeters = 300, isLinked = false) {
    if (isLinked) {
      return CORNER_STRATEGY_TYPE.TYPE_3_COMPROMISE;
    }
    if (followingStraightMeters >= 200) {
      return CORNER_STRATEGY_TYPE.TYPE_1_EXIT_PRIORITY;
    }
    if (precedingStraightMeters >= 250 && followingStraightMeters < 150) {
      return CORNER_STRATEGY_TYPE.TYPE_2_ENTRY_PRIORITY;
    }
    return CORNER_STRATEGY_TYPE.TYPE_1_EXIT_PRIORITY;
  }

  /**
   * Computes the compounding time gain/loss down a following straightaway from an exit speed change
   * Going Faster Ch. 2: 1 mph at corner exit carries all the way down the straight
   * @param {number} deltaExitSpeedMps Change in exit velocity (+ = faster, - = slower)
   * @param {number} straightLengthMeters Length of following straight
   * @param {number} baselineExitSpeedMps Baseline exit speed in m/s
   * @returns {number} Time delta in seconds (negative = time saved / faster lap)
   */
  computeStraightawayGain(deltaExitSpeedMps, straightLengthMeters = 300, baselineExitSpeedMps = 35) {
    if (!straightLengthMeters || straightLengthMeters <= 0 || !baselineExitSpeedMps || baselineExitSpeedMps <= 0) {
      return 0;
    }

    const v1 = baselineExitSpeedMps;
    const v2 = baselineExitSpeedMps + deltaExitSpeedMps;
    if (v2 <= 1.0) return 0;

    // Approximate average speed along the straight assuming constant top speed reach
    const avgSpeed1 = v1 * 1.25;
    const avgSpeed2 = v2 * 1.25;

    const t1 = straightLengthMeters / avgSpeed1;
    const t2 = straightLengthMeters / avgSpeed2;

    const deltaSec = t2 - t1;
    return Number(deltaSec.toFixed(3));
  }

  /**
   * Simulates a "What-If" corner scenario with modified landmarks and driving line
   * @param {Object} baselineCorner Baseline telemetry corner data
   * @param {Object} landmarkAdjustments User modifications { deltaBrakeMeters, deltaTurnInMeters, apexDepthPercent, deltaTapMeters, deltaTrackOutMeters, archetype, customOffsets }
   * @param {Array<Object>} cornerSamples High-rate telemetry samples for the corner
   * @param {Object} context Additional context { followingStraightMeters, precedingStraightMeters, isLinked }
   * @returns {Object} Comprehensive Simulation Results & Racecraft Coaching Report
   */
  simulateCorner(baselineCorner, landmarkAdjustments = {}, cornerSamples = [], context = {}) {
    const adj = {
      deltaBrakeMeters: landmarkAdjustments.deltaBrakeMeters || 0,
      deltaTurnInMeters: landmarkAdjustments.deltaTurnInMeters || 0,
      apexDepthPercent: landmarkAdjustments.apexDepthPercent ?? (baselineCorner?.apexDepthPercent ?? 0.65),
      deltaTapMeters: landmarkAdjustments.deltaTapMeters || 0,
      deltaTrackOutMeters: landmarkAdjustments.deltaTrackOutMeters || 0,
      archetype: landmarkAdjustments.archetype || LINE_ARCHETYPE.LATE_APEX,
      customOffsets: landmarkAdjustments.customOffsets || {}
    };

    const followingStraight = context.followingStraightMeters || baselineCorner?.followingStraightMeters || 300;
    const precedingStraight = context.precedingStraightMeters || baselineCorner?.precedingStraightMeters || 150;
    const isLinked = context.isLinked || baselineCorner?.isLinked || false;
    const cornerType = this.classifyCornerType(precedingStraight, followingStraight, isLinked);

    // 1. Analyze 3D Topography & Elevation
    const topography = this.elevationEngine.analyzeCornerTopography(
      cornerSamples,
      baselineCorner?.brakeIndex || 0,
      baselineCorner?.apexIndex || Math.floor(cornerSamples.length * 0.5),
      baselineCorner?.exitIndex || cornerSamples.length - 1
    );

    // 2. Generate Optimal / Simulated Driving Line
    const optimalLine = this.lineEngine.generateOptimalLine(
      cornerSamples,
      adj.archetype,
      adj.customOffsets
    );

    const lineQuality = this.lineEngine.evaluateLineQuality(
      cornerSamples,
      optimalLine
    );

    // 3. Compute Simulated Speed and Grip
    const baselineEntrySpeed = baselineCorner?.entrySpeedKmh || (baselineCorner?.entrySpeedMps ? baselineCorner.entrySpeedMps * 3.6 : 100);
    const baselineApexSpeed = baselineCorner?.apexSpeedKmh || (baselineCorner?.apexSpeedMps ? baselineCorner.apexSpeedMps * 3.6 : 75);
    const baselineExitSpeed = baselineCorner?.exitSpeedKmh || (baselineCorner?.exitSpeedMps ? baselineCorner.exitSpeedMps * 3.6 : 95);

    // Base radius from baseline apex speed
    const baseRadius = baselineCorner?.radiusMeters || (baselineApexSpeed * baselineApexSpeed) / (127 * this.defaultMaxG);

    // Dynamic radius adjustment based on line archetype & apex depth
    let simulatedRadius = baseRadius;
    if (adj.archetype === LINE_ARCHETYPE.LATE_APEX) {
      // Late apex squares off entry slightly, expands exit radius by 15-25%
      simulatedRadius = baseRadius * 1.18;
    } else if (adj.archetype === LINE_ARCHETYPE.GEOMETRIC) {
      simulatedRadius = baseRadius * 1.05;
    } else if (adj.archetype === LINE_ARCHETYPE.DIAMOND_V) {
      simulatedRadius = baseRadius * 0.90; // tighter rotation, but straight line exit
    } else if (adj.archetype === LINE_ARCHETYPE.RAIN_LINE) {
      simulatedRadius = baseRadius * 1.12; // wider arc
    }

    // Apply Elevation grip modifier
    const effectiveG = this.elevationEngine.calculateEffectiveLateralG(
      this.defaultMaxG,
      topography.gripModifierAtApex,
      topography.averageGrade
    );

    // Simulated apex speed: v = sqrt(127 * G_eff * R)
    const simulatedApexSpeedKmh = Math.sqrt(127.0 * this.frictionCoeff * effectiveG * simulatedRadius);
    const deltaApexSpeedKmh = simulatedApexSpeedKmh - baselineApexSpeed;

    // Simulated exit speed:
    // Earlier TAP + larger exit radius boosts exit speed
    let exitSpeedBoostRatio = 1.0;
    if (adj.archetype === LINE_ARCHETYPE.LATE_APEX) {
      exitSpeedBoostRatio = 1.045; // ~4.5% higher exit speed from late apex
    } else if (adj.archetype === LINE_ARCHETYPE.DIAMOND_V) {
      exitSpeedBoostRatio = 1.035;
    }
    // Modify based on delta TAP (every 5m earlier TAP gives ~1.5 km/h)
    const tapSpeedDelta = -(adj.deltaTapMeters / 5.0) * 1.5;

    const simulatedExitSpeedKmh = (baselineExitSpeed * exitSpeedBoostRatio) + tapSpeedDelta;
    const deltaExitSpeedKmh = simulatedExitSpeedKmh - baselineExitSpeed;
    const deltaExitSpeedMps = deltaExitSpeedKmh / 3.6;

    // Simulated braking & entry speed
    // Braking deeper (+ deltaBrakeMeters) carries higher entry speed into turn-in, but risks overslowing if over-braking
    const brakeDecelG = 1.15 / topography.brakingDistanceMod;
    const entrySpeedDelta = (adj.deltaBrakeMeters / 10.0) * 2.0; // deeper braking carries entry speed
    const simulatedEntrySpeedKmh = baselineEntrySpeed + entrySpeedDelta;

    // 4. Compute Time Deltas (Corner + Straightaway)
    // Corner time delta: braking phase + apex phase + exit phase
    const cornerLengthMeters = baselineCorner?.lengthMeters || (cornerSamples.length > 0 ? (cornerSamples[cornerSamples.length - 1].dist - cornerSamples[0].dist) : 150);
    const avgBaselineSpeedMps = ((baselineEntrySpeed + baselineApexSpeed + baselineExitSpeed) / 3) / 3.6;
    const avgSimulatedSpeedMps = ((simulatedEntrySpeedKmh + simulatedApexSpeedKmh + simulatedExitSpeedKmh) / 3) / 3.6;

    const baselineCornerTime = cornerLengthMeters / Math.max(1, avgBaselineSpeedMps);
    const simulatedCornerTime = cornerLengthMeters / Math.max(1, avgSimulatedSpeedMps);
    const cornerTimeDelta = simulatedCornerTime - baselineCornerTime; // negative = faster

    // Compounding straightaway time gain
    const straightawayDelta = this.computeStraightawayGain(
      deltaExitSpeedMps,
      followingStraight,
      baselineExitSpeed / 3.6
    );

    // Total Net Lap Delta
    const totalLapDelta = Number((cornerTimeDelta + straightawayDelta).toFixed(3));

    // 5. Generate Racecraft Coaching Advisory
    const advisory = this.generateRacecraftAdvisory({
      cornerType,
      archetype: adj.archetype,
      totalLapDelta,
      deltaExitSpeedKmh,
      straightawayDelta,
      topography,
      lineQuality
    });

    return {
      cornerType,
      archetype: adj.archetype,
      simulatedRadius: Number(simulatedRadius.toFixed(1)),
      effectiveG: Number(effectiveG.toFixed(3)),
      baseline: {
        entrySpeedKmh: Number(baselineEntrySpeed.toFixed(1)),
        entrySpeedMph: Number((baselineEntrySpeed * 0.621371).toFixed(1)),
        apexSpeedKmh: Number(baselineApexSpeed.toFixed(1)),
        apexSpeedMph: Number((baselineApexSpeed * 0.621371).toFixed(1)),
        exitSpeedKmh: Number(baselineExitSpeed.toFixed(1)),
        exitSpeedMph: Number((baselineExitSpeed * 0.621371).toFixed(1)),
        cornerTimeSec: Number(baselineCornerTime.toFixed(3))
      },
      simulated: {
        entrySpeedKmh: Number(simulatedEntrySpeedKmh.toFixed(1)),
        entrySpeedMph: Number((simulatedEntrySpeedKmh * 0.621371).toFixed(1)),
        apexSpeedKmh: Number(simulatedApexSpeedKmh.toFixed(1)),
        apexSpeedMph: Number((simulatedApexSpeedKmh * 0.621371).toFixed(1)),
        exitSpeedKmh: Number(simulatedExitSpeedKmh.toFixed(1)),
        exitSpeedMph: Number((simulatedExitSpeedKmh * 0.621371).toFixed(1)),
        cornerTimeSec: Number(simulatedCornerTime.toFixed(3))
      },
      deltas: {
        entrySpeedKmh: Number((simulatedEntrySpeedKmh - baselineEntrySpeed).toFixed(1)),
        apexSpeedKmh: Number(deltaApexSpeedKmh.toFixed(1)),
        exitSpeedKmh: Number(deltaExitSpeedKmh.toFixed(1)),
        exitSpeedMph: Number((deltaExitSpeedKmh * 0.621371).toFixed(1)),
        cornerTimeDeltaSec: Number(cornerTimeDelta.toFixed(3)),
        straightawayDeltaSec: straightawayDelta,
        totalLapDeltaSec: totalLapDelta // < 0 is TIME GAINED
      },
      topography,
      lineQuality,
      optimalLine,
      advisory
    };
  }

  /**
   * Generates expert Skip Barber racecraft coaching advice
   */
  generateRacecraftAdvisory({ cornerType, archetype, totalLapDelta, deltaExitSpeedKmh, straightawayDelta, topography, lineQuality }) {
    const coaching = [];
    const badges = [];

    if (cornerType === CORNER_STRATEGY_TYPE.TYPE_1_EXIT_PRIORITY) {
      badges.push('TYPE 1 // EXIT PRIORITY');
      if (deltaExitSpeedKmh > 0) {
        coaching.push(`Exit Speed Compounding: +${deltaExitSpeedKmh.toFixed(1)} km/h exit speed yields ${Math.abs(straightawayDelta).toFixed(3)}s gain down the following straightaway.`);
      }
      if (archetype === LINE_ARCHETYPE.LATE_APEX) {
        coaching.push(`Late Apex Strategy: Tightens corner entry slightly, allowing earlier steering unwind and full throttle commitment.`);
      }
    } else if (cornerType === CORNER_STRATEGY_TYPE.TYPE_2_ENTRY_PRIORITY) {
      badges.push('TYPE 2 // ENTRY BRAKING');
      coaching.push(`Entry Speed Priority: Maximum braking threshold and deep turn-in saves more time than exit speed.`);
    } else if (cornerType === CORNER_STRATEGY_TYPE.TYPE_3_COMPROMISE) {
      badges.push('TYPE 3 // LINKED COMPROMISE');
      coaching.push(`Sacrifice Turn 1: Hold car tight on exit to optimize entry radius and launch speed for Turn 2.`);
    }

    if (topography.risk === TOPOGRAPHY_RISK.CRITICAL) {
      badges.push('CRITICAL ELEVATION RISK');
    }

    if (lineQuality.trackUtilizationPercent < 80) {
      coaching.push(`Track Width Opportunity: Current line only uses ${lineQuality.trackUtilizationPercent}% of track width. Using full curbs increases corner radius.`);
    }

    return {
      badges,
      coaching,
      topographyWarnings: topography.warnings
    };
  }

  /**
   * Returns a standard preset configuration for quick application
   * @param {string} presetName
   * @returns {Object} Landmark adjustments
   */
  getPreset(presetName) {
    switch (presetName) {
      case 'LATE_APEX_EXIT':
        return {
          archetype: LINE_ARCHETYPE.LATE_APEX,
          deltaBrakeMeters: -5, // Brake 5m earlier for clean turn-in
          deltaTurnInMeters: 4,
          apexDepthPercent: 0.72,
          deltaTapMeters: -8,   // Get on throttle 8m earlier
          deltaTrackOutMeters: 5
        };
      case 'DEEP_BRAKE_DEFENSE':
        return {
          archetype: LINE_ARCHETYPE.DIAMOND_V,
          deltaBrakeMeters: 12,  // Brake 12m deeper
          deltaTurnInMeters: 8,
          apexDepthPercent: 0.78,
          deltaTapMeters: 5,
          deltaTrackOutMeters: 0
        };
      case 'GEOMETRIC_BENCHMARK':
        return {
          archetype: LINE_ARCHETYPE.GEOMETRIC,
          deltaBrakeMeters: 0,
          deltaTurnInMeters: 0,
          apexDepthPercent: 0.50,
          deltaTapMeters: 0,
          deltaTrackOutMeters: 0
        };
      case 'LINKED_COMPROMISE':
        return {
          archetype: LINE_ARCHETYPE.COMPROMISED_S_CURVE,
          deltaBrakeMeters: -3,
          deltaTurnInMeters: 2,
          apexDepthPercent: 0.60,
          deltaTapMeters: 6,
          deltaTrackOutMeters: -10 // Don't track out fully
        };
      case 'RAIN_LINE':
        return {
          archetype: LINE_ARCHETYPE.RAIN_LINE,
          deltaBrakeMeters: -15, // Brake 15m earlier for wet
          deltaTurnInMeters: -5,
          apexDepthPercent: 0.65,
          deltaTapMeters: 5,
          deltaTrackOutMeters: 0
        };
      default:
        return {
          archetype: LINE_ARCHETYPE.LATE_APEX,
          deltaBrakeMeters: 0,
          deltaTurnInMeters: 0,
          apexDepthPercent: 0.65,
          deltaTapMeters: 0,
          deltaTrackOutMeters: 0
        };
    }
  }
}
