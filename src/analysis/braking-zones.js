/**
 * APEX Braking Zone G-Force & Threshold Braking Engine
 * Implements Sprint 9 (Phase 3) quantitative racecraft analytics:
 * - Threshold braking efficiency calculation (peak deceleration Gs vs car's theoretical max)
 * - Exact straight-line braking distance (ft & m) from brake onset to turn-in
 * - "The Procedure" evaluation: lap-by-lap brake point stepping consistency & discipline
 * - Deceleration G profile curves (longitudinal G vs brake pressure) for PDF vector plotting
 * - Skip Barber R-010 Sub-Threshold Braking fault diagnostics
 */

import { mpsToMph, mpsToKmh, accelToG } from '../shared/telemetry-types.js';

export const METERS_TO_FEET = 3.28084;

/**
 * Baseline theoretical maximum longitudinal deceleration capability (in Gs) by Car Class.
 * Used as a reference benchmark when analyzing driver threshold compliance.
 */
export const CLASS_THEORETICAL_MAX_DECEL_G = {
  'E': 1.05,
  'D': 1.15,
  'C': 1.25,
  'B': 1.40,
  'A': 1.60,
  'S': 1.90,
  'R': 2.35,
  'P': 2.90,
  'X': 3.40,
  'UNKNOWN': 1.50
};

/**
 * Threshold Braking Compliance Grading
 */
export const THRESHOLD_EFFICIENCY_GRADES = [
  { minPercent: 92, grade: 'A+', label: 'Optimal Threshold', color: '#00CC66' },
  { minPercent: 84, grade: 'A',  label: 'High Efficiency', color: '#00CC66' },
  { minPercent: 74, grade: 'B',  label: 'Moderate Efficiency', color: '#E5A910' },
  { minPercent: 62, grade: 'C',  label: 'Sub-Threshold', color: '#FF8800' },
  { minPercent: 0,  grade: 'D',  label: 'Significant Under-Braking', color: '#E10600' }
];

export class BrakingZoneEngine {
  constructor(options = {}) {
    this.brakeOnsetThreshold = options.brakeOnsetThreshold || 0.10; // 10% brake pressure
    this.steerOnsetThreshold = options.steerOnsetThreshold || 0.04; // ~5 deg steering
    this.interpolationPoints = options.interpolationPoints || 25;   // curve points for rendering
  }

  /**
   * Helper to calculate Euclidean travel distance (meters) between two sample indices
   * @param {Array<Object>} samples 
   * @param {number} startIdx 
   * @param {number} endIdx 
   * @returns {number} Distance in meters
   */
  calculateDistanceBetween(samples, startIdx, endIdx) {
    if (!samples || startIdx >= endIdx || startIdx < 0 || endIdx >= samples.length) {
      return 0;
    }

    let dist = 0;
    for (let i = startIdx + 1; i <= endIdx; i++) {
      const p1 = samples[i - 1].motion.position;
      const p2 = samples[i].motion.position;
      const dx = (p2.x || 0) - (p1.x || 0);
      const dy = (p2.y || 0) - (p1.y || 0);
      const dz = (p2.z || 0) - (p1.z || 0);
      dist += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return dist;
  }

  /**
   * Extracts single corner braking zone profile
   * @param {Array<Object>} samples - Lap telemetry samples
   * @param {Object} corner - Extracted corner object from CornerExtractor
   * @param {number} carClassTheoreticalMaxG - Benchmark max G for car class
   * @returns {Object} Comprehensive braking zone analysis
   */
  extractCornerBrakingZone(samples, corner, carClassTheoreticalMaxG = 1.50) {
    const brakeIdx = corner.indexes?.brake ?? corner.indexes?.entry ?? 0;
    const turnInIdx = corner.indexes?.turnIn ?? corner.indexes?.apex ?? brakeIdx;
    const apexIdx = corner.indexes?.apex ?? turnInIdx;

    const brakeStartSample = samples[brakeIdx] || samples[0];
    const turnInSample = samples[turnInIdx] || samples[brakeIdx] || samples[0];
    const apexSample = samples[apexIdx] || turnInSample;

    // 1. Speeds at key transition points
    const entrySpeedMph = mpsToMph(brakeStartSample.motion?.speedMps || 0);
    const turnInSpeedMph = mpsToMph(turnInSample.motion?.speedMps || 0);
    const apexSpeedMph = mpsToMph(apexSample.motion?.speedMps || 0);
    const speedBledMph = Math.max(0, entrySpeedMph - turnInSpeedMph);

    // 2. Exact straight-line braking distance (onset to turn-in)
    const straightLineBrakeDistanceMeters = this.calculateDistanceBetween(samples, brakeIdx, turnInIdx);
    const straightLineBrakeDistanceFeet = straightLineBrakeDistanceMeters * METERS_TO_FEET;

    // Total deceleration distance (onset to apex)
    const totalBrakeDistanceMeters = this.calculateDistanceBetween(samples, brakeIdx, apexIdx);
    const totalBrakeDistanceFeet = totalBrakeDistanceMeters * METERS_TO_FEET;

    // Braking duration in seconds
    const brakeDurationSeconds = Math.max(0.01, (turnInIdx - brakeIdx) / 60.0);

    // 3. Deceleration G-forces analysis in straight-line braking zone
    let peakDecelG = 0;
    let sumDecelG = 0;
    let countDecelSamples = 0;
    let peakBrakePressure = 0;
    let timeTo90PercentPressureMs = 0;
    let found90 = false;

    for (let i = brakeIdx; i <= turnInIdx; i++) {
      const s = samples[i];
      const brakeVal = s.inputs?.brake || 0;
      if (brakeVal > peakBrakePressure) {
        peakBrakePressure = brakeVal;
      }

      // Longitudinal deceleration G (forward decel = positive magnitude)
      const decelG = Math.abs(s.motion?.acceleration?.longitudinalG || 0);
      if (decelG > peakDecelG) {
        peakDecelG = decelG;
      }

      sumDecelG += decelG;
      countDecelSamples++;
    }

    // Measure time from brake onset to 90% peak pressure
    const targetPressure = peakBrakePressure * 0.90;
    for (let i = brakeIdx; i <= turnInIdx; i++) {
      const brakeVal = samples[i].inputs?.brake || 0;
      if (!found90 && brakeVal >= targetPressure && targetPressure > 0.1) {
        timeTo90PercentPressureMs = (i - brakeIdx) * (1000 / 60.0);
        found90 = true;
        break;
      }
    }

    const avgDecelG = countDecelSamples > 0 ? (sumDecelG / countDecelSamples) : 0;

    // 4. Threshold Braking Efficiency Calculation
    // Ratio of driver's peak deceleration G to theoretical benchmark (capped at 100%)
    const efficiencyRatio = carClassTheoreticalMaxG > 0 ? (peakDecelG / carClassTheoreticalMaxG) : 0;
    const thresholdEfficiencyPercent = Math.min(100, Math.round(efficiencyRatio * 100));

    // Grade assignment
    let gradeObj = THRESHOLD_EFFICIENCY_GRADES[THRESHOLD_EFFICIENCY_GRADES.length - 1];
    for (const g of THRESHOLD_EFFICIENCY_GRADES) {
      if (thresholdEfficiencyPercent >= g.minPercent) {
        gradeObj = g;
        break;
      }
    }

    // 5. Deceleration Profile Curves (normalized 0..1 from brake start to apex)
    const curvePoints = [];
    const span = Math.max(1, apexIdx - brakeIdx);
    const step = span / (this.interpolationPoints - 1);

    for (let p = 0; p < this.interpolationPoints; p++) {
      const samplePos = brakeIdx + Math.round(p * step);
      const s = samples[Math.min(apexIdx, Math.max(brakeIdx, samplePos))];
      const progress = p / (this.interpolationPoints - 1); // 0.0 = brake onset, 1.0 = apex

      curvePoints.push({
        progress: Number(progress.toFixed(2)),
        decelG: Number(Math.abs(s.motion?.acceleration?.longitudinalG || 0).toFixed(2)),
        brakePressure: Number((s.inputs?.brake || 0).toFixed(2)),
        speedMph: Number(mpsToMph(s.motion?.speedMps || 0).toFixed(1)),
        lateralG: Number(Math.abs(s.motion?.acceleration?.lateralG || 0).toFixed(2))
      });
    }

    return {
      cornerNumber: corner.cornerNumber,
      cornerType: corner.cornerType || corner.type || 'Standard',
      indexes: {
        brakeOnset: brakeIdx,
        turnIn: turnInIdx,
        apex: apexIdx
      },
      speed: {
        entrySpeedMph: Number(entrySpeedMph.toFixed(1)),
        turnInSpeedMph: Number(turnInSpeedMph.toFixed(1)),
        apexSpeedMph: Number(apexSpeedMph.toFixed(1)),
        speedBledMph: Number(speedBledMph.toFixed(1)),
        entrySpeedKmh: Number(mpsToKmh(brakeStartSample.motion?.speedMps || 0).toFixed(1)),
        turnInSpeedKmh: Number(mpsToKmh(turnInSample.motion?.speedMps || 0).toFixed(1)),
        apexSpeedKmh: Number(mpsToKmh(apexSample.motion?.speedMps || 0).toFixed(1)),
        speedBledKmh: Number(Math.max(0, mpsToKmh(brakeStartSample.motion?.speedMps || 0) - mpsToKmh(turnInSample.motion?.speedMps || 0)).toFixed(1))
      },
      distance: {
        straightLineBrakeFeet: Number(straightLineBrakeDistanceFeet.toFixed(1)),
        straightLineBrakeMeters: Number(straightLineBrakeDistanceMeters.toFixed(1)),
        totalBrakeFeet: Number(totalBrakeDistanceFeet.toFixed(1)),
        totalBrakeMeters: Number(totalBrakeDistanceMeters.toFixed(1))
      },
      durationSeconds: Number(brakeDurationSeconds.toFixed(2)),
      gForces: {
        peakDecelG: Number(peakDecelG.toFixed(2)),
        avgDecelG: Number(avgDecelG.toFixed(2)),
        classMaxDecelG: Number(carClassTheoreticalMaxG.toFixed(2)),
        peakBrakePressure: Number(peakBrakePressure.toFixed(2)),
        timeTo90PercentMs: Math.round(timeTo90PercentPressureMs)
      },
      efficiency: {
        percent: thresholdEfficiencyPercent,
        grade: gradeObj.grade,
        label: gradeObj.label,
        color: gradeObj.color,
        isSubThreshold: thresholdEfficiencyPercent < 70 && peakBrakePressure > 0.20
      },
      profileCurve: curvePoints
    };
  }

  /**
   * Evaluates "The Procedure" discipline across multiple laps for all corners
   * Tracks consistency of stepping brake markers deeper into braking zones
   * @param {Array<Object>} laps - Analyzed laps with extracted corners
   * @returns {Object} Stint-wide "The Procedure" consistency analytics
   */
  evaluateTheProcedure(laps) {
    const validLaps = (laps || []).filter(l => l.isValid && l.corners && l.corners.length > 0);
    if (validLaps.length === 0) {
      return {
        overallConsistencyScore: 100,
        cornerSteppingMetrics: [],
        rating: 'N/A',
        recommendation: 'Complete multiple valid laps to evaluate The Procedure progression.'
      };
    }

    // Group braking distance and brake onset location by corner number across laps
    const cornerMap = new Map();

    for (const lap of validLaps) {
      for (const corner of lap.corners) {
        if (!cornerMap.has(corner.cornerNumber)) {
          cornerMap.set(corner.cornerNumber, []);
        }

        const bIdx = corner.indexes?.brake ?? corner.indexes?.entry ?? 0;
        const tIdx = corner.indexes?.turnIn ?? corner.indexes?.apex ?? bIdx;
        const distMeters = this.calculateDistanceBetween(lap.samples, bIdx, tIdx);
        const distFeet = distMeters * METERS_TO_FEET;

        cornerMap.get(corner.cornerNumber).push({
          lapNumber: lap.lapNumber,
          brakeDistanceFeet: distFeet,
          peakDecelG: corner.dynamics?.peakDecelG || 0
        });
      }
    }

    const cornerSteppingMetrics = [];
    let totalVarianceSum = 0;
    let cornersEvaluated = 0;

    cornerMap.forEach((lapData, cornerNum) => {
      if (lapData.length === 0) return;

      const distances = lapData.map(d => d.brakeDistanceFeet);
      const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
      
      // Calculate standard deviation in brake marker distance
      const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDist, 2), 0) / distances.length;
      const stdDevFeet = Math.sqrt(variance);

      // Measure progressive step delta from first lap to best lap
      const firstLapDist = distances[0];
      const minLapDist = Math.min(...distances);
      const stepProgressionFeet = firstLapDist - minLapDist; // positive = stepped deeper

      // Consistency Score per corner (100 = < 5ft std dev, drops as std dev increases)
      const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - (stdDevFeet * 2.5))));

      totalVarianceSum += consistencyScore;
      cornersEvaluated++;

      cornerSteppingMetrics.push({
        cornerNumber: cornerNum,
        lapsTracked: lapData.length,
        avgBrakeDistanceFeet: Number(avgDist.toFixed(1)),
        avgBrakeDistanceMeters: Number((avgDist * 0.3048).toFixed(1)),
        stdDevFeet: Number(stdDevFeet.toFixed(1)),
        stdDevMeters: Number((stdDevFeet * 0.3048).toFixed(1)),
        stepProgressionFeet: Number(stepProgressionFeet.toFixed(1)),
        stepProgressionMeters: Number((stepProgressionFeet * 0.3048).toFixed(1)),
        consistencyScore,
        status: stdDevFeet < 8.0 ? 'Highly Disciplined' : (stdDevFeet < 18.0 ? 'Consistent' : 'Erratic Reference')
      });
    });

    const overallConsistencyScore = cornersEvaluated > 0 ? Math.round(totalVarianceSum / cornersEvaluated) : 100;

    let rating = 'Mastery';
    let recommendation = 'Exceptional brake marker discipline. Maintain reference point consistency.';
    if (overallConsistencyScore < 65) {
      rating = 'Needs Discipline';
      recommendation = 'Braking points vary widely between laps. Pick fixed physical trackside markers and step deeper in 2-meter increments.';
    } else if (overallConsistencyScore < 82) {
      rating = 'Developing';
      recommendation = 'Good progression. Tighten variance by focusing on instant straight-line brake pressure.';
    }

    return {
      overallConsistencyScore,
      rating,
      recommendation,
      cornerSteppingMetrics
    };
  }

  /**
   * Performs end-to-end Braking Zone & G-Force Deep-Dive on a stint
   * @param {Array<Object>} samples - Full stint or best lap samples
   * @param {Array<Object>} laps - All segmented laps
   * @param {Array<Object>} bestLapCorners - Analyzed corners for best lap
   * @param {Object} vehicleMetadata - Vehicle info (carClass, etc.)
   * @returns {Object} Stint braking analysis report
   */
  analyzeBrakingZones(samples, laps = [], bestLapCorners = [], vehicleMetadata = {}) {
    const carClass = vehicleMetadata?.carClass || 'A';
    const classTheoreticalMaxG = CLASS_THEORETICAL_MAX_DECEL_G[carClass] || CLASS_THEORETICAL_MAX_DECEL_G['UNKNOWN'];

    // 1. Analyze braking zones for each corner in the best lap (or default corners)
    const brakingZones = (bestLapCorners || []).map(corner => {
      return this.extractCornerBrakingZone(samples, corner, classTheoreticalMaxG);
    });

    // 2. Calculate Stint-Wide Aggregate Braking Metrics
    let stintMaxDecelG = 0;
    let sumEfficiency = 0;
    let totalBrakingDistanceFeet = 0;
    let heavyBrakingCount = 0;

    for (const bz of brakingZones) {
      if (bz.gForces.peakDecelG > stintMaxDecelG) {
        stintMaxDecelG = bz.gForces.peakDecelG;
      }
      sumEfficiency += bz.efficiency.percent;
      totalBrakingDistanceFeet += bz.distance.straightLineBrakeFeet;
      if (bz.speed.speedBledMph > 20) {
        heavyBrakingCount++;
      }
    }

    const avgEfficiencyPercent = brakingZones.length > 0 ? Math.round(sumEfficiency / brakingZones.length) : 0;

    // 3. Evaluate "The Procedure" multi-lap stepping consistency
    const theProcedure = this.evaluateTheProcedure(laps);

    // 4. Identify Heavy Braking Showcase Corners (Top Type II or highest speed-bleed corners)
    const showcaseCorners = [...brakingZones]
      .sort((a, b) => b.speed.speedBledMph - a.speed.speedBledMph)
      .slice(0, 3);

    return {
      carClass,
      classTheoreticalMaxG,
      stintMaxDecelG: Number(stintMaxDecelG.toFixed(2)),
      avgEfficiencyPercent,
      totalBrakingDistanceFeet: Math.round(totalBrakingDistanceFeet),
      totalBrakingDistanceMeters: Math.round(totalBrakingDistanceFeet * 0.3048),
      heavyBrakingCount,
      brakingZones,
      theProcedure,
      showcaseCorners
    };
  }
}
