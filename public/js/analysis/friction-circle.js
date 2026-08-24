/**
 * APEX Friction Circle (G-G Diagram) Analyzer (Browser ES Module)
 * Implements ANALYSIS.md §9 — Friction Circle Analysis.
 *
 * Based on "Going Faster!" Ch.5:
 * "The friction circle allows you to think about what happens to one ability of the tire
 *  as you increase or decrease the demands for another ability."
 *
 * Produces a scatter plot of lateral G vs longitudinal G, phase-classified for rendering
 * and driver coaching. Calculates traction circle utilization (% of samples where the
 * combined G vector exceeds 70% of the session maximum — indicating limit driving).
 */

const mpsToMph = (mps) => (mps || 0) * 2.23693629;

/** Phase identifiers for friction circle scatter points */
export const FRICTION_PHASE = {
  BRAKE_TURN: 'brake-turn',
  BRAKING: 'braking',
  ACCELERATE_TURN: 'accelerate-turn',
  ACCELERATING: 'accelerating',
  CORNERING: 'cornering',
  STRAIGHT: 'straight'
};

/** Phase display colors matching APEX F1 design system */
export const FRICTION_PHASE_COLORS = {
  [FRICTION_PHASE.BRAKE_TURN]:       '#E5A910',
  [FRICTION_PHASE.BRAKING]:          '#E10600',
  [FRICTION_PHASE.ACCELERATE_TURN]:  '#0099FF',
  [FRICTION_PHASE.ACCELERATING]:     '#00CC66',
  [FRICTION_PHASE.CORNERING]:        '#9966FF',
  [FRICTION_PHASE.STRAIGHT]:         '#333333'
};

export class FrictionCircleAnalyzer {
  /**
   * @param {Array<Object>} samples - Full stint or best lap telemetry samples
   * @param {Object} options
   * @param {number} options.brakeThreshold    - Brake input floor (default 0.10 = 10%)
   * @param {number} options.throttleThreshold - Throttle input floor (default 0.50 = 50%)
   * @param {number} options.latGThreshold     - Lateral G floor for cornering (default 0.1)
   * @param {number} options.utilizationFloor  - G-radius floor for limit driving (default 0.70)
   */
  constructor(samples, options = {}) {
    this.samples = samples || [];
    this.brakeThreshold = options.brakeThreshold ?? 0.10;
    this.throttleThreshold = options.throttleThreshold ?? 0.50;
    this.latGThreshold = options.latGThreshold ?? 0.10;
    this.utilizationFloor = options.utilizationFloor ?? 0.70;
    this._maxG = null;
  }

  /** Finds the maximum combined G magnitude across all samples. */
  findMaxG() {
    if (this._maxG !== null) return this._maxG;
    let maxG = 0.1;
    for (const s of this.samples) {
      const lateral = Math.abs(s.motion?.acceleration?.lateralG ?? s.latG ?? 0);
      const longitudinal = Math.abs(s.motion?.acceleration?.longitudinalG ?? s.longG ?? 0);
      const combined = Math.sqrt(lateral * lateral + longitudinal * longitudinal);
      if (combined > maxG) maxG = combined;
    }
    this._maxG = maxG;
    return maxG;
  }

  /** Classifies a sample into a friction circle phase. */
  classifyPhase(sample, absLatG) {
    const brake = sample.inputs?.brake ?? sample.brake ?? 0;
    const throttle = sample.inputs?.throttle ?? sample.throttle ?? 0;
    const isCornering = absLatG > this.latGThreshold;

    if (brake > this.brakeThreshold && isCornering)      return FRICTION_PHASE.BRAKE_TURN;
    if (brake > this.brakeThreshold)                     return FRICTION_PHASE.BRAKING;
    if (throttle > this.throttleThreshold && isCornering) return FRICTION_PHASE.ACCELERATE_TURN;
    if (throttle > this.throttleThreshold)               return FRICTION_PHASE.ACCELERATING;
    if (isCornering)                                     return FRICTION_PHASE.CORNERING;
    return FRICTION_PHASE.STRAIGHT;
  }

  /** Calculates traction circle utilisation metrics. */
  calculateUtilization(points, maxG) {
    if (points.length === 0) return { highUtilization: 0, averageRadius: 0 };

    let usedCount = 0;
    let radiusSum = 0;

    for (const p of points) {
      const radius = Math.sqrt(p.latG * p.latG + p.longG * p.longG) / maxG;
      radiusSum += radius;
      if (radius > this.utilizationFloor) usedCount++;
    }

    return {
      highUtilization: Number(((usedCount / points.length) * 100).toFixed(1)),
      averageRadius: Number((radiusSum / points.length).toFixed(3))
    };
  }

  /**
   * Generates the full friction circle dataset for rendering and coaching.
   * @returns {{ points, cornerPoints, maxG, utilization, phaseBreakdown, totalSamples }}
   */
  generateFrictionCircle() {
    if (!this.samples || this.samples.length === 0) {
      return {
        points: [],
        cornerPoints: [],
        maxG: 1.0,
        utilization: { highUtilization: 0, averageRadius: 0 },
        phaseBreakdown: {},
        totalSamples: 0
      };
    }

    const maxG = this.findMaxG();
    const points = [];
    const cornerPoints = [];
    const phaseCounts = {};

    for (const phase of Object.values(FRICTION_PHASE)) {
      phaseCounts[phase] = 0;
    }

    for (const s of this.samples) {
      const latG = s.motion?.acceleration?.lateralG ?? s.latG ?? 0;
      const longG = s.motion?.acceleration?.longitudinalG ?? s.longG ?? 0;
      const absLatG = Math.abs(latG);

      const phase = this.classifyPhase(s, absLatG);
      phaseCounts[phase]++;

      const point = {
        latG: Number(latG.toFixed(3)),
        longG: Number(longG.toFixed(3)),
        latGAbs: Number(absLatG.toFixed(3)),
        longGAbs: Number(Math.abs(longG).toFixed(3)),
        phase,
        color: FRICTION_PHASE_COLORS[phase],
        speedMph: Math.round(s.speedMph ?? (s.motion?.speedMs ? (s.motion.speedMs * 2.23694) : 0)),
        timestamp: s.timestamp || 0
      };

      points.push(point);

      if (phase === FRICTION_PHASE.BRAKE_TURN || phase === FRICTION_PHASE.ACCELERATE_TURN) {
        cornerPoints.push(point);
      }
    }

    const utilization = this.calculateUtilization(points, maxG);

    const phaseBreakdown = {};
    for (const [phase, count] of Object.entries(phaseCounts)) {
      phaseBreakdown[phase] = {
        count,
        percent: Number(((count / points.length) * 100).toFixed(1)),
        color: FRICTION_PHASE_COLORS[phase]
      };
    }

    return {
      points,
      cornerPoints,
      maxG: Number(maxG.toFixed(3)),
      utilization,
      phaseBreakdown,
      totalSamples: points.length
    };
  }
}
