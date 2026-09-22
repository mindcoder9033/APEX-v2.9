/**
 * APEX Elevation Dynamics & 3D Topography Engine
 * Analyzes track grade, vertical curvature (crests/compressions), normal force variation,
 * and elevation-adjusted braking & cornering grip limits per Skip Barber "Going Faster!"
 */

export const TOPOGRAPHY_FEATURE = {
  CREST: 'CREST',             // Unweighting / loss of normal force
  COMPRESSION: 'COMPRESSION', // Dip / increased normal force
  DOWNHILL: 'DOWNHILL',       // Negative slope / extended braking distance
  UPHILL: 'UPHILL',           // Positive slope / gravity-assisted braking
  FLAT: 'FLAT'
};

export const TOPOGRAPHY_RISK = {
  NONE: 'NONE',
  MODERATE: 'MODERATE',
  CRITICAL: 'CRITICAL'
};

export class ElevationDynamicsEngine {
  constructor(options = {}) {
    this.gravity = options.gravity || 9.80665; // m/s²
    this.crestUnweightThreshold = options.crestUnweightThreshold || 0.88; // Fn/Fg <= 0.88 is a crest
    this.compressionThreshold = options.compressionThreshold || 1.12;    // Fn/Fg >= 1.12 is compression
    this.steepGradeThreshold = options.steepGradeThreshold || 4.0;       // >= 4% grade is steep
  }

  /**
   * Calculates slope percentage between two points
   * @param {number} y1 Elevation at point 1 (m)
   * @param {number} y2 Elevation at point 2 (m)
   * @param {number} horizontalDist Distance between points (m)
   * @returns {number} Slope grade in percent (positive = uphill, negative = downhill)
   */
  calculateGradePercent(y1, y2, horizontalDist) {
    if (!horizontalDist || horizontalDist <= 0.001) return 0;
    return ((y2 - y1) / horizontalDist) * 100.0;
  }

  /**
   * Calculates vertical curvature (1/Rv) and vertical acceleration (az)
   * @param {number} yPrev Elevation at i-1
   * @param {number} yCurr Elevation at i
   * @param {number} yNext Elevation at i+1
   * @param {number} ds Distance increment (m)
   * @param {number} speedMps Velocity (m/s)
   * @returns {{ verticalCurvature: number, verticalAccG: number, normalForceRatio: number }}
   */
  calculateVerticalDynamics(yPrev, yCurr, yNext, ds, speedMps) {
    if (!ds || ds <= 0.001) {
      return { verticalCurvature: 0, verticalAccG: 0, normalForceRatio: 1.0 };
    }

    // Second derivative d²y/ds² (vertical curvature)
    const d2y = (yNext - 2 * yCurr + yPrev) / (ds * ds);
    
    // Vertical acceleration az = v² * (d²y/ds²)
    const azMps2 = (speedMps * speedMps) * d2y;
    const verticalAccG = azMps2 / this.gravity;

    // Normal force ratio Fn / (m*g) = 1.0 + verticalAccG
    // (Crest: d2y < 0 -> az < 0 -> Fn < 1.0; Compression: d2y > 0 -> az > 0 -> Fn > 1.0)
    const normalForceRatio = Math.max(0.1, Math.min(2.5, 1.0 + verticalAccG));

    return {
      verticalCurvature: d2y,
      verticalAccG,
      normalForceRatio
    };
  }

  /**
   * Computes elevation-adjusted braking distance modifier
   * Going Faster Ch. 5: Downhill increases stopping distance, uphill reduces it
   * @param {number} gradePercent Grade in %
   * @param {number} frictionCoeff Nominal tire friction coefficient (e.g. 1.15)
   * @returns {number} Distance multiplier (>1.0 = longer distance, <1.0 = shorter)
   */
  calculateBrakingDistanceModifier(gradePercent, frictionCoeff = 1.15) {
    // Deceleration a = g * (mu * cos(theta) + sin(theta))
    // theta = atan(grade / 100)
    const thetaRad = Math.atan(gradePercent / 100.0);
    const cosTheta = Math.cos(thetaRad);
    const sinTheta = Math.sin(thetaRad);

    const nominalDecelG = frictionCoeff;
    const actualDecelG = Math.max(0.2, (frictionCoeff * cosTheta) + sinTheta);

    // Stopping distance d ~ 1 / a
    const distanceMultiplier = nominalDecelG / actualDecelG;
    return Math.max(0.5, Math.min(2.0, distanceMultiplier));
  }

  /**
   * Computes available effective cornering grip modified by normal force and grade
   * Going Faster Ch. 2: Lateral grip is directly proportional to tire normal force Fn
   * @param {number} baseLateralG Nominal max lateral G (e.g. 1.20)
   * @param {number} normalForceRatio Fn / (m*g)
   * @param {number} gradePercent Grade %
   * @returns {number} Effective available lateral G
   */
  calculateEffectiveLateralG(baseLateralG, normalForceRatio = 1.0, gradePercent = 0) {
    const thetaRad = Math.atan(Math.abs(gradePercent) / 100.0);
    const cosTheta = Math.cos(thetaRad);

    // Tire load sensitivity: grip scales sub-linearly with normal force (~ Fn^0.85)
    // Over crest (Fn < 1), grip drops sharply; in dip (Fn > 1), grip increases
    const loadFactor = Math.pow(Math.max(0.1, normalForceRatio), 0.88);
    const effectiveG = baseLateralG * loadFactor * cosTheta;

    return Math.max(0.3, Math.min(baseLateralG * 1.5, effectiveG));
  }

  /**
   * Analyzes an entire corner's 3D elevation profile and extracts topography features & racecraft risks
   * @param {Array<{x: number, y: number, z: number, dist: number, speedMps: number}>} samples
   * @param {number} brakeIdx Index of braking point
   * @param {number} apexIdx Index of apex
   * @param {number} exitIdx Index of track-out point
   * @returns {Object} Comprehensive Topography Profile & Warnings
   */
  analyzeCornerTopography(samples, brakeIdx = 0, apexIdx = 0, exitIdx = 0) {
    if (!samples || samples.length < 3) {
      return {
        feature: TOPOGRAPHY_FEATURE.FLAT,
        risk: TOPOGRAPHY_RISK.NONE,
        averageGrade: 0,
        maxGrade: 0,
        minGrade: 0,
        elevationDelta: 0,
        minNormalForce: 1.0,
        maxNormalForce: 1.0,
        brakingDistanceMod: 1.0,
        gripModifierAtApex: 1.0,
        warnings: [],
        coachingNotes: []
      };
    }

    const n = samples.length;
    const startIdx = Math.max(0, Math.min(brakeIdx, apexIdx));
    const endIdx = Math.min(n - 1, Math.max(apexIdx, exitIdx, startIdx + 2));

    let minElevation = Infinity;
    let maxElevation = -Infinity;
    let minNormalForce = 1.0;
    let maxNormalForce = 1.0;
    let maxGrade = -Infinity;
    let minGrade = Infinity;

    const grades = [];
    const normalForces = [];

    for (let i = 0; i < n; i++) {
      const y = samples[i].y;
      if (y < minElevation) minElevation = y;
      if (y > maxElevation) maxElevation = y;

      if (i > 0) {
        const ds = Math.max(0.1, samples[i].dist - samples[i - 1].dist);
        const grade = this.calculateGradePercent(samples[i - 1].y, samples[i].y, ds);
        grades.push(grade);
        if (grade > maxGrade) maxGrade = grade;
        if (grade < minGrade) minGrade = grade;
      }

      if (i > 0 && i < n - 1) {
        const ds = Math.max(0.1, (samples[i + 1].dist - samples[i - 1].dist) / 2);
        const v = samples[i].speedMps || 30.0;
        const dyn = this.calculateVerticalDynamics(samples[i - 1].y, samples[i].y, samples[i + 1].y, ds, v);
        normalForces.push(dyn.normalForceRatio);
        if (dyn.normalForceRatio < minNormalForce) minNormalForce = dyn.normalForceRatio;
        if (dyn.normalForceRatio > maxNormalForce) maxNormalForce = dyn.normalForceRatio;
      }
    }

    const elevationDelta = samples[endIdx].y - samples[startIdx].y;
    const totalDist = Math.max(1, samples[endIdx].dist - samples[startIdx].dist);
    const averageGrade = (elevationDelta / totalDist) * 100.0;

    // Braking zone grade (from brakeIdx to turn-in / apex)
    const brakeEndIdx = Math.min(apexIdx, n - 1);
    const brakeDist = Math.max(1, samples[brakeEndIdx].dist - samples[startIdx].dist);
    const brakeGrade = ((samples[brakeEndIdx].y - samples[startIdx].y) / brakeDist) * 100.0;
    const brakingDistanceMod = this.calculateBrakingDistanceModifier(brakeGrade);

    // Apex vertical dynamics
    let apexNormalForce = 1.0;
    if (apexIdx > 0 && apexIdx < n - 1) {
      const ds = Math.max(0.1, (samples[apexIdx + 1].dist - samples[apexIdx - 1].dist) / 2);
      const v = samples[apexIdx].speedMps || 30.0;
      apexNormalForce = this.calculateVerticalDynamics(samples[apexIdx - 1].y, samples[apexIdx].y, samples[apexIdx + 1].y, ds, v).normalForceRatio;
    }

    // Determine primary feature
    let feature = TOPOGRAPHY_FEATURE.FLAT;
    if (minNormalForce <= this.crestUnweightThreshold) {
      feature = TOPOGRAPHY_FEATURE.CREST;
    } else if (maxNormalForce >= this.compressionThreshold) {
      feature = TOPOGRAPHY_FEATURE.COMPRESSION;
    } else if (averageGrade <= -this.steepGradeThreshold) {
      feature = TOPOGRAPHY_FEATURE.DOWNHILL;
    } else if (averageGrade >= this.steepGradeThreshold) {
      feature = TOPOGRAPHY_FEATURE.UPHILL;
    }

    // Warnings & Coaching Notes (Going Faster Ch. 2, 5 & 7)
    const warnings = [];
    const coachingNotes = [];
    let risk = TOPOGRAPHY_RISK.NONE;

    if (minNormalForce <= 0.80) {
      risk = TOPOGRAPHY_RISK.CRITICAL;
      const lossPct = Math.round((1.0 - minNormalForce) * 100);
      warnings.push(`Severe Crest Unweighting: Normal force drops by ${lossPct}%. Car will feel light; high risk of lockup or snap-oversteer.`);
      coachingNotes.push(`Brake straight before the crest cresting point. Avoid high lateral steering input while tires are unweighted.`);
    } else if (minNormalForce <= this.crestUnweightThreshold) {
      if (risk === TOPOGRAPHY_RISK.NONE) risk = TOPOGRAPHY_RISK.MODERATE;
      const lossPct = Math.round((1.0 - minNormalForce) * 100);
      warnings.push(`Crest detected: Normal force drops by ${lossPct}% near apex/entry.`);
      coachingNotes.push(`Slightly wider radius needed over crest; anticipate reduced lateral grip.`);
    }

    if (brakeGrade <= -4.0) {
      if (risk === TOPOGRAPHY_RISK.NONE) risk = TOPOGRAPHY_RISK.MODERATE;
      const extraMeters = Math.round((brakingDistanceMod - 1.0) * 100);
      warnings.push(`Downhill Braking Zone (${brakeGrade.toFixed(1)}% slope): Stopping distance increased by ~${extraMeters}%.`);
      coachingNotes.push(`Initiate braking earlier. Trail brake with lighter pedal pressure to prevent front wheel lockup.`);
    } else if (brakeGrade >= 4.0) {
      coachingNotes.push(`Uphill Braking Zone (+${brakeGrade.toFixed(1)}% slope): Gravity assists deceleration. You can brake deeper into the corner.`);
    }

    if (maxNormalForce >= this.compressionThreshold) {
      const gripGainPct = Math.round((maxNormalForce - 1.0) * 100);
      coachingNotes.push(`Compression / Dip in corner: Normal force increases by +${gripGainPct}%. High mechanical grip available at apex.`);
    }

    return {
      feature,
      risk,
      averageGrade: Number(averageGrade.toFixed(1)),
      maxGrade: Number(maxGrade.toFixed(1)),
      minGrade: Number(minGrade.toFixed(1)),
      elevationDelta: Number(elevationDelta.toFixed(2)),
      minNormalForce: Number(minNormalForce.toFixed(3)),
      maxNormalForce: Number(maxNormalForce.toFixed(3)),
      brakingDistanceMod: Number(brakingDistanceMod.toFixed(3)),
      gripModifierAtApex: Number(apexNormalForce.toFixed(3)),
      warnings,
      coachingNotes
    };
  }
}
