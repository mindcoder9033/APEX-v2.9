/**
 * APEX Shifting & Powerband Optimization Engine (Browser ES Module)
 * Evaluates powertrain utilization, gear selection efficiency, engine powerband limits,
 * downshift throttle blip accuracy, and brake modulation stability during heel-and-toe events.
 */

export const SHIFT_QUALITY_GRADES = {
  OPTIMAL: { grade: 'A', label: 'OPTIMAL POWERTRAIN UTILIZATION', minScore: 85, color: '#00CC66' },
  GOOD: { grade: 'B', label: 'GOOD GEAR SELECTION', minScore: 70, color: '#0099FF' },
  FAIR: { grade: 'C', label: 'MODERATE INEFFICIENCY', minScore: 55, color: '#E5A910' },
  POOR: { grade: 'D', label: 'SUB-OPTIMAL GEARING', minScore: 0, color: '#E10600' }
};

export class ShiftingPowerbandEngine {
  constructor(options = {}) {
    this.blipThrottleThreshold = options.blipThrottleThreshold || 0.15; // 15% throttle blip
    this.brakeActiveThreshold = options.brakeActiveThreshold || 0.10;    // 10% brake pressure
    this.shiftWindowSamples = options.shiftWindowSamples || 30;         // ~500ms @ 60Hz
  }

  /**
   * Analyzes shifting dynamics, powerband efficiency, and downshift quality
   * @param {Array<Object>} samples Stint/Lap telemetry samples
   * @param {Array<Object>} analyzedLaps Segmented laps
   * @param {Array<Object>} corners Extracted corner features
   * @param {Object} vehicleMeta Vehicle metadata (idleRpm, maxRpm, drivetrain)
   * @returns {Object} Comprehensive Shifting & Powerband Analysis
   */
  analyzeShifting(samples = [], analyzedLaps = [], corners = [], vehicleMeta = {}) {
    const firstSample = (samples && samples.length > 0) ? samples[0] : null;
    const idleRpm = vehicleMeta.idleRpm || firstSample?.engine?.idleRpm || 1000;
    const maxRpm = vehicleMeta.maxRpm || firstSample?.engine?.maxRpm || 8000;
    const usablePowerband = Math.max(1000, maxRpm - idleRpm);

    // 1. Detect Downshift Events across the stint samples
    const downshiftEvents = (samples && samples.length > 0) ? this.extractDownshiftEvents(samples, idleRpm, maxRpm) : [];

    // 2. Compute Downshift Quality Metrics (Throttle Blip & Brake Stability)
    const downshiftStats = this.computeDownshiftStats(downshiftEvents);

    // 3. Analyze Corner-by-Corner Gear Selection & Powerband Utilization
    const cornerShifting = (corners && corners.length > 0)
      ? this.analyzeCornerPowerband(corners, idleRpm, maxRpm, usablePowerband)
      : [];

    // 4. Calculate Overall Shifting & Powerband Scores
    const powerbandEfficiency = cornerShifting.length > 0
      ? Math.round(cornerShifting.reduce((acc, c) => acc + c.powerbandScore, 0) / cornerShifting.length)
      : 85;

    const blipScore = downshiftEvents.length > 0 ? downshiftStats.blipComplianceRate : 100;
    const brakeStabilityScore = downshiftEvents.length > 0 ? downshiftStats.avgBrakeStability : 100;

    // Weighted Overall Transmission & Shifting Score:
    // 40% Powerband Efficiency + 30% Blip Compliance + 30% Brake Modulation Stability
    const compositeScore = Math.round(
      (powerbandEfficiency * 0.40) +
      (blipScore * 0.30) +
      (brakeStabilityScore * 0.30)
    );

    let overallGrade = 'A';
    if (compositeScore < 55) overallGrade = 'D';
    else if (compositeScore < 70) overallGrade = 'C';
    else if (compositeScore < 85) overallGrade = 'B';

    const gradeInfo = Object.values(SHIFT_QUALITY_GRADES).find(g => g.grade === overallGrade) || SHIFT_QUALITY_GRADES.OPTIMAL;

    // 5. Generate Skip Barber Powertrain Coaching Advice
    const recommendations = this.generateRecommendations(cornerShifting, downshiftStats, compositeScore);

    return {
      usablePowerband: {
        idleRpm,
        maxRpm,
        usableRangeRpm: usablePowerband,
        optimalPowerbandMin: Math.round(idleRpm + (0.65 * usablePowerband)),
        optimalPowerbandMax: Math.round(idleRpm + (0.92 * usablePowerband))
      },
      summary: {
        compositeScore,
        grade: overallGrade,
        gradeLabel: gradeInfo.label,
        gradeColor: gradeInfo.color,
        powerbandEfficiency,
        totalDownshifts: downshiftEvents.length,
        blippedDownshiftsCount: downshiftStats.blippedCount,
        blipComplianceRate: downshiftStats.blipComplianceRate,
        avgBrakeStabilityScore: downshiftStats.avgBrakeStability,
        boggingCornersCount: cornerShifting.filter(c => c.isBogging).length,
        overrevCornersCount: cornerShifting.filter(c => c.isOverrev).length
      },
      cornerShifting,
      downshiftEvents: downshiftEvents.slice(0, 15),
      recommendations
    };
  }

  /**
   * Identifies all downshift occurrences and evaluates heel-and-toe dynamics
   */
  extractDownshiftEvents(samples, idleRpm, maxRpm) {
    const events = [];
    const n = samples.length;

    for (let i = 1; i < n; i++) {
      const prevGear = samples[i - 1]?.inputs?.gear;
      const currGear = samples[i]?.inputs?.gear;

      if (typeof prevGear === 'number' && typeof currGear === 'number' &&
          prevGear > 1 && currGear > 0 && currGear < prevGear) {
        
        const shiftIndex = i;
        const windowStart = Math.max(0, shiftIndex - this.shiftWindowSamples);
        const windowEnd = Math.min(n - 1, shiftIndex + this.shiftWindowSamples);
        const windowSamples = samples.slice(windowStart, windowEnd + 1);

        let peakBlipThrottle = 0;
        let blipDetected = false;
        let blipDurationSamples = 0;

        for (const s of windowSamples) {
          const th = s.inputs.throttle || 0;
          if (th > peakBlipThrottle) peakBlipThrottle = th;
          if (th >= this.blipThrottleThreshold) {
            blipDetected = true;
            blipDurationSamples++;
          }
        }

        const brakePressures = windowSamples.map(s => s.inputs.brake || 0);
        const activeBrakes = brakePressures.filter(b => b >= this.brakeActiveThreshold);
        const isBraking = activeBrakes.length > 0;

        let brakeStabilityScore = 100;
        let brakeVariance = 0;

        if (isBraking && activeBrakes.length > 2) {
          const avgBrake = activeBrakes.reduce((a, b) => a + b, 0) / activeBrakes.length;
          const variance = activeBrakes.reduce((acc, b) => acc + Math.pow(b - avgBrake, 2), 0) / activeBrakes.length;
          brakeVariance = Math.sqrt(variance);

          if (brakeVariance > 0.05) {
            brakeStabilityScore = Math.max(20, Math.round(100 - (brakeVariance * 250)));
          }
        }

        const preRpm = samples[windowStart]?.engine?.currentRpm || 0;
        const postRpm = samples[windowEnd]?.engine?.currentRpm || 0;

        events.push({
          shiftIndex,
          timestampMs: samples[shiftIndex]?.timestamp || (shiftIndex * 16.6),
          lapNumber: samples[shiftIndex]?.lap?.currentLap || 1,
          fromGear: prevGear,
          toGear: currGear,
          preShiftRpm: preRpm,
          postShiftRpm: postRpm,
          isBrakingShift: isBraking,
          blipDetected,
          peakBlipThrottlePercent: Math.round(peakBlipThrottle * 100),
          blipDurationMs: Math.round(blipDurationSamples * 16.6),
          brakeStabilityScore: isBraking ? brakeStabilityScore : 100,
          brakeVariance: Number(brakeVariance.toFixed(3)),
          qualityGrade: (!isBraking || (blipDetected && brakeStabilityScore >= 75)) ? 'OPTIMAL' :
                        (blipDetected ? 'MODERATE_FLUTTER' : 'MISSED_BLIP')
        });
      }
    }

    return events;
  }

  /**
   * Computes aggregate stats on downshifts
   */
  computeDownshiftStats(events) {
    if (events.length === 0) {
      return {
        totalDownshifts: 0,
        blippedCount: 0,
        blipComplianceRate: 100,
        avgBrakeStability: 100
      };
    }

    const blippedCount = events.filter(e => e.blipDetected).length;
    const blipComplianceRate = Math.round((blippedCount / events.length) * 100);

    const brakingShifts = events.filter(e => e.isBrakingShift);
    const avgBrakeStability = brakingShifts.length > 0
      ? Math.round(brakingShifts.reduce((acc, e) => acc + e.brakeStabilityScore, 0) / brakingShifts.length)
      : 100;

    return {
      totalDownshifts: events.length,
      blippedCount,
      blipComplianceRate,
      avgBrakeStability
    };
  }

  /**
   * Evaluates each corner's minimum rolling RPM and corner exit RPM
   */
  analyzeCornerPowerband(corners, idleRpm, maxRpm, usablePowerband) {
    return corners.map((c) => {
      const inp = c.inputs || {};
      const spd = c.speed || {};
      const cornerGear = inp.gear || 3;
      const minRpm = inp.minRpm || Math.round(maxRpm * 0.5);
      const exitRpm = inp.exitRpm || Math.round(maxRpm * 0.7);

      const exitPowerbandRatio = Math.max(0, Math.min(1.0, (exitRpm - idleRpm) / usablePowerband));
      const exitPowerbandPercent = Math.round(exitPowerbandRatio * 100);

      const isBogging = (exitPowerbandRatio < 0.60) || (maxRpm > 0 && exitRpm < (0.60 * maxRpm));
      const isOverrev = (exitPowerbandRatio > 0.95) || (maxRpm > 0 && exitRpm > (0.95 * maxRpm));

      let powerbandScore = 95;
      let status = 'OPTIMAL';
      let suggestedGear = cornerGear;

      if (isBogging) {
        powerbandScore = Math.max(30, Math.round(exitPowerbandRatio * 100));
        status = 'BOGGING (DOWNSHIFT REQUIRED)';
        suggestedGear = Math.max(1, cornerGear - 1);
      } else if (isOverrev) {
        powerbandScore = 65;
        status = 'OVER-REV (UPSHIFT EARLIER)';
        suggestedGear = cornerGear + 1;
      } else if (exitPowerbandRatio < 0.70) {
        powerbandScore = 80;
        status = 'ACCEPTABLE (LOW POWERBAND)';
      }

      return {
        cornerNumber: c.cornerNumber,
        cornerType: c.type || 'MID_SPEED',
        gear: cornerGear,
        suggestedGear,
        entrySpeedMph: spd.entryMph || 0,
        apexSpeedMph: spd.apexMph || 0,
        exitSpeedMph: spd.exitMph || 0,
        minRpm: Math.round(minRpm),
        exitRpm: Math.round(exitRpm),
        exitPowerbandPercent,
        isBogging,
        isOverrev,
        powerbandScore,
        status
      };
    });
  }

  /**
   * Formulates actionable Skip Barber racecraft guidance based on telemetry findings
   */
  generateRecommendations(cornerShifting, downshiftStats, compositeScore) {
    const recs = [];

    const boggingCorners = cornerShifting.filter(c => c.isBogging);
    if (boggingCorners.length > 0) {
      const turnsStr = boggingCorners.map(c => `Turn ${c.cornerNumber} (Gear ${c.gear})`).join(', ');
      recs.push({
        title: 'Powertrain Bogging on Exit Drive',
        severity: 'High',
        advice: `Engine RPM is dropping below the active torque band in ${turnsStr}. Downshift 1 gear earlier in the braking zone to ensure exit drive occurs at >65% RPM powerband.`
      });
    }

    const overrevCorners = cornerShifting.filter(c => c.isOverrev);
    if (overrevCorners.length > 0) {
      const turnsStr = overrevCorners.map(c => `Turn ${c.cornerNumber}`).join(', ');
      recs.push({
        title: 'Rev Limiter Strike Risk at Track-Out',
        severity: 'Medium',
        advice: `Engine is touching redline immediately at corner exit in ${turnsStr}. Shift up sooner or carry a taller gear to avoid rev limiter bog and preserve momentum.`
      });
    }

    if (downshiftStats.totalDownshifts > 0 && downshiftStats.blipComplianceRate < 70) {
      recs.push({
        title: 'Throttle Blip Rev-Matching Compliance',
        severity: 'High',
        advice: `Only ${downshiftStats.blipComplianceRate}% of downshifts executed a throttle blip. In unassisted or manual setups, blip the throttle aggressively during downshifts to prevent rear axle hop and Trailing Throttle Oversteer.`
      });
    }

    if (downshiftStats.totalDownshifts > 0 && downshiftStats.avgBrakeStability < 75) {
      recs.push({
        title: 'Brake Pedal Modulation Wobble During Heel-and-Toe',
        severity: 'Medium',
        advice: `Brake pressure fluctuates by over 15% during throttle blips (Stability: ${downshiftStats.avgBrakeStability}%). Maintain firm, continuous ball-of-the-foot pressure on the brake pedal while rolling your ankle to blip.`
      });
    }

    if (recs.length === 0) {
      recs.push({
        title: 'Exemplary Powertrain Execution',
        severity: 'Low',
        advice: 'Gear selection, rev-matching blips, and powerband management are fully optimized across all track sectors.'
      });
    }

    return recs;
  }

  getDefaultReport() {
    return {
      usablePowerband: {
        idleRpm: 1000,
        maxRpm: 8000,
        usableRangeRpm: 7000,
        optimalPowerbandMin: 5550,
        optimalPowerbandMax: 7440
      },
      summary: {
        compositeScore: 100,
        grade: 'A',
        gradeLabel: SHIFT_QUALITY_GRADES.OPTIMAL.label,
        gradeColor: SHIFT_QUALITY_GRADES.OPTIMAL.color,
        powerbandEfficiency: 100,
        totalDownshifts: 0,
        blippedDownshiftsCount: 0,
        blipComplianceRate: 100,
        avgBrakeStabilityScore: 100,
        boggingCornersCount: 0,
        overrevCornersCount: 0
      },
      cornerShifting: [],
      downshiftEvents: [],
      recommendations: []
    };
  }
}
