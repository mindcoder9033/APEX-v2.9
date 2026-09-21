/**
 * APEX Going Faster - Skills Evaluator Engine (Metric & Physics Calibration)
 * Based on Skip Barber "Going Faster! Mastering the Art of Race Driving"
 * Chapter 1: "A Plan of Attack"
 * Chapter 2: "The Three Basics: Line, Corner Exit Speed, Braking"
 *
 * All calculations, kinematic derivatives, and feedback are calibrated in SI Metric units:
 * - Velocity: km/h (derived from m/s or telemetry speed)
 * - Distance: Meters (m) / Radius R (m) (with 15GR imperial equivalence)
 * - Acceleration: G (1G = 9.81 m/s²)
 * - Jerk: G/s (m/s³)
 * - Angles: Radians (rad) / Degrees (°)
 */

export class SkillsEvaluator {
  /**
   * Evaluates all Chapter 1 and Chapter 2 skills for a given corner telemetry slice.
   * @param {Array<Object>} cornerSamples - Telemetry frames for the corner (approach to exit)
   * @param {Object} options - Configuration and optional reference telemetry
   * @returns {Object} Quantitative evaluation for each skill and overall corner score
   */
  static evaluateCorner(cornerSamples, options = {}) {
    if (!cornerSamples || cornerSamples.length < 5) {
      return this._generateEmptyEvaluation();
    }

    const apexIndex = this._findApexIndex(cornerSamples);
    const entrySamples = cornerSamples.slice(0, apexIndex + 1);
    const exitSamples = cornerSamples.slice(apexIndex);

    // --- 1. Evaluate Chapter 1 Skills ---
    const exitSpeedSkill = this.evaluateExitSpeed(exitSamples, options);
    const theLineSkill = this.evaluateTheLine(cornerSamples, apexIndex, options);
    const thresholdBrakingSkill = this.evaluateThresholdBraking(entrySamples, options);
    const combinedEntrySkill = this.evaluateCombinedEntry(entrySamples, options);
    const platformStabilitySkill = this.evaluatePlatformStability(cornerSamples, options);

    // --- 2. Evaluate Chapter 2 Skills ---
    const lineGeometry15GRSkill = this.evaluateLineGeometry15GR(cornerSamples, apexIndex, options);
    const balanceSlideControlSkill = this.evaluateBalanceSlideControl(cornerSamples, apexIndex, options);
    const fourBlockEntrySkill = this.evaluateFourBlockEntry(entrySamples, options);

    // Calculate Chapter 1 Score (Exit Speed 35%, Line 25%, Threshold 15%, Combined 15%, Stability 10%)
    const ch1Score = Math.round(
      exitSpeedSkill.score * 0.35 +
      theLineSkill.score * 0.25 +
      thresholdBrakingSkill.score * 0.15 +
      combinedEntrySkill.score * 0.15 +
      platformStabilitySkill.score * 0.10
    );

    // Calculate Chapter 2 Score (15GR Line 35%, Balance/CPR 35%, 4-Block Entry 30%)
    const ch2Score = Math.round(
      lineGeometry15GRSkill.score * 0.35 +
      balanceSlideControlSkill.score * 0.35 +
      fourBlockEntrySkill.score * 0.30
    );

    // Active Chapter context (default to Ch 1 or options.chapterNumber)
    const targetChapter = options.chapterNumber || 1;
    const overallScore = targetChapter === 2 ? ch2Score : ch1Score;
    const grade = this._scoreToGrade(overallScore);

    return {
      timestamp: Date.now(),
      cornerId: options.cornerId || 'T1',
      cornerName: options.cornerName || 'Corner',
      cornerType: options.cornerType || 'Type I (Exit Priority)',
      overallScore,
      grade,
      chapterScores: {
        ch1: ch1Score,
        ch2: ch2Score
      },
      skills: {
        // Chapter 1
        'ch1-exit-speed': exitSpeedSkill,
        'ch1-the-line': theLineSkill,
        'ch1-threshold-braking': thresholdBrakingSkill,
        'ch1-combined-entry': combinedEntrySkill,
        'ch1-platform-stability': platformStabilitySkill,
        // Chapter 2
        'ch2-line-geometry-15gr': lineGeometry15GRSkill,
        'ch2-balance-slide-control': balanceSlideControlSkill,
        'ch2-four-block-entry': fourBlockEntrySkill
      },
      summary: this._generateCornerSummary(overallScore, {
        exitSpeedSkill,
        theLineSkill,
        thresholdBrakingSkill,
        combinedEntrySkill,
        platformStabilitySkill,
        lineGeometry15GRSkill,
        balanceSlideControlSkill,
        fourBlockEntrySkill
      }, targetChapter)
    };
  }

  // =========================================================================
  // CHAPTER 1 SKILL EVALUATORS
  // =========================================================================

  /**
   * Skill 1: Exit Speed & Throttle Commitment (Metric: km/h)
   */
  static evaluateExitSpeed(exitSamples, options = {}) {
    if (exitSamples.length < 3) {
      return { score: 50, grade: 'C', feedback: 'Limited exit telemetry available.', metrics: {} };
    }

    const initialSpeedKmh = this._getSpeedKmh(exitSamples[0]);
    const finalSpeedKmh = this._getSpeedKmh(exitSamples[exitSamples.length - 1]);
    const speedGainKmh = Math.max(0, finalSpeedKmh - initialSpeedKmh);

    let throttleHesitations = 0;
    let timeToFullThrottle = 0;
    let fullThrottleIndex = -1;

    for (let i = 1; i < exitSamples.length; i++) {
      const prevThr = exitSamples[i - 1].inputs?.throttle ?? exitSamples[i - 1].throttle ?? 0;
      const currThr = exitSamples[i].inputs?.throttle ?? exitSamples[i].throttle ?? 0;

      if (currThr >= 0.98 && fullThrottleIndex === -1) {
        fullThrottleIndex = i;
        timeToFullThrottle = (exitSamples[i].timestamp - exitSamples[0].timestamp) / 1000 || (i * 0.016);
      }

      if (currThr < prevThr - 0.08 && prevThr > 0.3) {
        throttleHesitations++;
      }
    }

    let unwindCorrelationScore = 85;
    let unwindMismatches = 0;
    for (let i = 1; i < exitSamples.length; i++) {
      const prevThr = exitSamples[i - 1].inputs?.throttle ?? 0;
      const currThr = exitSamples[i].inputs?.throttle ?? 0;
      const prevSteer = Math.abs(exitSamples[i - 1].inputs?.steering ?? 0);
      const currSteer = Math.abs(exitSamples[i].inputs?.steering ?? 0);

      if (currThr > prevThr + 0.05 && currSteer > prevSteer + 0.03) {
        unwindMismatches++;
      }
    }

    unwindCorrelationScore = Math.max(30, 100 - (unwindMismatches * 12));
    const throttleScore = Math.max(20, 100 - (throttleHesitations * 18));
    const speedScore = Math.min(100, Math.max(40, Math.round(50 + (speedGainKmh * 1.5))));

    const score = Math.round(throttleScore * 0.35 + unwindCorrelationScore * 0.35 + speedScore * 0.30);
    const grade = this._scoreToGrade(score);

    let feedback = `Clean throttle roll-on (+${speedGainKmh.toFixed(1)} km/h exit gain) with progressive steering unwind.`;
    if (unwindMismatches > 2) {
      feedback = 'Pinched exit: Steering was tightened while throttle was applied. Unwind steering earlier to allow full acceleration.';
    } else if (throttleHesitations > 0) {
      feedback = 'Hesitant throttle application: Driver hesitated on throttle roll-on. Commit progressively from apex.';
    } else if (score >= 90) {
      feedback = 'Outstanding exit commitment! Throttle synchronized with wheel unwind carrying maximum speed.';
    }

    return {
      skillId: 'ch1-exit-speed',
      name: 'Exit Speed & Throttle Commitment',
      score,
      grade,
      metrics: {
        speedGainKmh: parseFloat(speedGainKmh.toFixed(1)),
        timeToFullThrottleSeconds: parseFloat(timeToFullThrottle.toFixed(2)),
        throttleHesitations,
        unwindMismatches,
        unit: 'km/h'
      },
      feedback
    };
  }

  /**
   * Skill 2: Line Radius & Arc Consistency
   */
  static evaluateTheLine(cornerSamples, apexIndex, options = {}) {
    if (cornerSamples.length < 5) {
      return { score: 50, grade: 'C', feedback: 'Insufficient samples for line evaluation.', metrics: {} };
    }

    const steerAngles = cornerSamples.map(s => s.inputs?.steering ?? s.steering ?? 0);
    const midTurnSteers = steerAngles.slice(Math.max(0, apexIndex - 5), Math.min(cornerSamples.length, apexIndex + 6));
    
    const meanSteer = midTurnSteers.reduce((a, b) => a + b, 0) / (midTurnSteers.length || 1);
    const variance = midTurnSteers.reduce((acc, v) => acc + Math.pow(v - meanSteer, 2), 0) / (midTurnSteers.length || 1);
    const steerStdDevRad = Math.sqrt(variance);

    let sawtoothCorrections = 0;
    for (let i = 2; i < steerAngles.length; i++) {
      const d1 = steerAngles[i - 1] - steerAngles[i - 2];
      const d2 = steerAngles[i] - steerAngles[i - 1];
      if ((d1 > 0.04 && d2 < -0.04) || (d1 < -0.04 && d2 > 0.04)) {
        sawtoothCorrections++;
      }
    }

    const apexSample = cornerSamples[apexIndex] || cornerSamples[0];
    const apexMinSpeedKmh = this._getSpeedKmh(apexSample);

    const smoothScore = Math.max(20, Math.round(100 - (steerStdDevRad * 250) - (sawtoothCorrections * 10)));
    const apexScore = Math.min(100, Math.max(30, Math.round(apexMinSpeedKmh > 60 ? 80 + (apexMinSpeedKmh * 0.1) : 60)));
    
    const score = Math.max(10, Math.min(100, Math.round(smoothScore * 0.65 + apexScore * 0.35)));
    const grade = this._scoreToGrade(score);

    let feedback = `Smooth circular arc maintained through apex (v_min: ${apexMinSpeedKmh.toFixed(1)} km/h).`;
    if (sawtoothCorrections > 2) {
      feedback = 'Saw-tooth steering detected: Multiple mid-corner corrections. Settle on a single continuous radius.';
    } else if (steerStdDevRad > 0.15) {
      feedback = 'Erratic steering angle: Radius was pinched mid-corner instead of maintaining a wide, high-speed arc.';
    } else if (score >= 90) {
      feedback = 'Textbook line geometry! Smooth, single-input arc maximizing corner radius.';
    }

    return {
      skillId: 'ch1-the-line',
      name: 'Line Radius & Arc Consistency',
      score,
      grade,
      metrics: {
        apexMinSpeedKmh: parseFloat(apexMinSpeedKmh.toFixed(1)),
        steeringStdDevRad: parseFloat(steerStdDevRad.toFixed(3)),
        sawtoothCorrections,
        unit: 'rad'
      },
      feedback
    };
  }

  /**
   * Skill 3: Threshold Braking Precision
   */
  static evaluateThresholdBraking(entrySamples, options = {}) {
    if (entrySamples.length < 3) {
      return { score: 50, grade: 'C', feedback: 'Insufficient entry braking samples.', metrics: {} };
    }

    let peakBrake = 0;
    let initialBrakeIndex = -1;
    let peakBrakeIndex = -1;
    let lockupCount = 0;
    let maxDecelG = 0;

    for (let i = 0; i < entrySamples.length; i++) {
      const brk = entrySamples[i].inputs?.brake ?? entrySamples[i].brake ?? 0;
      const lonG = Math.abs(this._getLonG(entrySamples[i]));

      if (lonG > maxDecelG) maxDecelG = lonG;

      if (brk > 0.05 && initialBrakeIndex === -1) initialBrakeIndex = i;
      if (brk > peakBrake) {
        peakBrake = brk;
        peakBrakeIndex = i;
      }

      if (brk > 0.95 && lonG < 0.6 && i > initialBrakeIndex + 2) {
        lockupCount++;
      }
    }

    let rampTimeSeconds = 0.25;
    if (initialBrakeIndex !== -1 && peakBrakeIndex >= initialBrakeIndex) {
      const tStart = entrySamples[initialBrakeIndex].timestamp || (initialBrakeIndex * 16);
      const tPeak = entrySamples[peakBrakeIndex].timestamp || (peakBrakeIndex * 16);
      rampTimeSeconds = Math.max(0.05, (tPeak - tStart) / 1000);
    }

    let firmnessScore = 80;
    if (peakBrake >= 0.85) firmnessScore = 95;
    else if (peakBrake >= 0.70) firmnessScore = 80;
    else firmnessScore = 55;

    let rampScore = 90;
    if (rampTimeSeconds <= 0.25) rampScore = 95;
    else if (rampTimeSeconds <= 0.45) rampScore = 75;
    else rampScore = 50;

    const lockupPenalty = lockupCount * 25;
    const score = Math.max(10, Math.min(100, Math.round((firmnessScore * 0.45 + rampScore * 0.55) - lockupPenalty)));
    const grade = this._scoreToGrade(score);

    let feedback = `Firm threshold braking hit in ${rampTimeSeconds.toFixed(2)}s (-${maxDecelG.toFixed(2)}G peak decel).`;
    if (lockupCount > 0) {
      feedback = 'Wheel lockup detected! Modulation exceeded tire tractive budget, losing stopping power.';
    } else if (rampTimeSeconds > 0.40) {
      feedback = 'Soft initial brake application. Hit the brake pedal firmly and immediately in a straight line.';
    } else if (score >= 90) {
      feedback = 'Masterclass threshold braking! Instant ramp to tire grip threshold without lockup.';
    }

    return {
      skillId: 'ch1-threshold-braking',
      name: 'Threshold Braking Precision',
      score,
      grade,
      metrics: {
        peakBrakePressurePercent: Math.round(peakBrake * 100),
        rampTimeSeconds: parseFloat(rampTimeSeconds.toFixed(2)),
        maxDecelG: parseFloat(maxDecelG.toFixed(2)),
        lockupCount,
        unit: 's'
      },
      feedback
    };
  }

  /**
   * Skill 4: Combined Entry & Trail-Braking
   */
  static evaluateCombinedEntry(entrySamples, options = {}) {
    if (entrySamples.length < 4) {
      return { score: 50, grade: 'C', feedback: 'Insufficient entry transition samples.', metrics: {} };
    }

    let overlapCount = 0;
    let maxCombinedG = 0;
    let abruptReleases = 0;

    for (let i = 1; i < entrySamples.length; i++) {
      const brk = entrySamples[i].inputs?.brake ?? entrySamples[i].brake ?? 0;
      const prevBrk = entrySamples[i - 1].inputs?.brake ?? entrySamples[i - 1].brake ?? 0;
      const steer = Math.abs(entrySamples[i].inputs?.steering ?? entrySamples[i].steering ?? 0);

      const latG = this._getLatG(entrySamples[i]);
      const lonG = this._getLonG(entrySamples[i]);
      const combinedG = Math.sqrt(latG * latG + lonG * lonG);

      if (combinedG > maxCombinedG) maxCombinedG = combinedG;

      if (brk > 0.05 && steer > 0.08) {
        overlapCount++;
      }

      if (prevBrk > 0.40 && brk < 0.05 && steer > 0.15) {
        abruptReleases++;
      }
    }

    const overlapPct = Math.round((overlapCount / entrySamples.length) * 100);
    let trailScore = 70;
    if (overlapPct >= 20 && overlapPct <= 65) trailScore = 95;
    else if (overlapPct > 0) trailScore = 75;
    else trailScore = 45;

    const penalty = abruptReleases * 25;
    const score = Math.max(10, Math.min(100, trailScore - penalty));
    const grade = this._scoreToGrade(score);

    let feedback = `Smooth trail-braking transition (${overlapPct}% overlap, ${maxCombinedG.toFixed(2)}G combined load).`;
    if (abruptReleases > 0) {
      feedback = 'Abrupt brake release during turn-in! Relax brake pressure progressively as you add steering.';
    } else if (overlapPct < 15) {
      feedback = 'Coasting / disconnect at corner entry: Braking was completed too early before turn-in commenced.';
    } else if (score >= 90) {
      feedback = 'Seamless traction handoff! Friction circle fully loaded during turn-in transition.';
    }

    return {
      skillId: 'ch1-combined-entry',
      name: 'Combined Entry & Trail-Braking',
      score,
      grade,
      metrics: {
        overlapPercentage: overlapPct,
        maxCombinedG: parseFloat(maxCombinedG.toFixed(2)),
        abruptReleases,
        unit: '%'
      },
      feedback
    };
  }

  /**
   * Skill 5: Platform Balance & Anti-Lift
   */
  static evaluatePlatformStability(cornerSamples, options = {}) {
    if (cornerSamples.length < 4) {
      return { score: 50, grade: 'C', feedback: 'Insufficient samples for stability evaluation.', metrics: {} };
    }

    let throttleLifts = 0;
    let maxJerkGPerSec = 0;

    for (let i = 1; i < cornerSamples.length; i++) {
      const prevThr = cornerSamples[i - 1].inputs?.throttle ?? cornerSamples[i - 1].throttle ?? 0;
      const currThr = cornerSamples[i].inputs?.throttle ?? cornerSamples[i].throttle ?? 0;
      const steer = Math.abs(cornerSamples[i].inputs?.steering ?? cornerSamples[i].steering ?? 0);

      if (steer > 0.12 && prevThr > 0.40 && currThr < 0.15) {
        throttleLifts++;
      }

      const prevLonG = this._getLonG(cornerSamples[i - 1]);
      const currLonG = this._getLonG(cornerSamples[i]);
      const dt = ((cornerSamples[i].timestamp - cornerSamples[i - 1].timestamp) / 1000) || 0.016;

      const jerk = Math.abs((currLonG - prevLonG) / (dt || 0.016));
      if (jerk > maxJerkGPerSec) maxJerkGPerSec = jerk;
    }

    let stabilityScore = Math.max(20, 100 - (throttleLifts * 25));
    if (maxJerkGPerSec > 15) stabilityScore -= 15;

    const score = Math.max(10, Math.min(100, Math.round(stabilityScore)));
    const grade = this._scoreToGrade(score);

    let feedback = `Smooth load transfer; pitch jerk within ${maxJerkGPerSec.toFixed(1)} G/s.`;
    if (throttleLifts > 0) {
      feedback = `Careless throttle lifting detected (${throttleLifts}x). Abruptly lifting off unweights the rear tires and invites snap oversteer.`;
    } else if (score >= 90) {
      feedback = 'Rock solid platform stability! Weight transferred fluidly without chassis pitch shock.';
    }

    return {
      skillId: 'ch1-platform-stability',
      name: 'Platform Balance & Anti-Lift',
      score,
      grade,
      metrics: {
        throttleLifts,
        maxJerkGPerSec: parseFloat(maxJerkGPerSec.toFixed(1)),
        unit: 'G/s'
      },
      feedback
    };
  }

  // =========================================================================
  // CHAPTER 2 SKILL EVALUATORS ("The Three Basics")
  // =========================================================================

  /**
   * Chapter 2 - Skill 1: Line Geometry & 15GR Arc Optimization
   * Physics Law: 15 * G * R = (mph)²  or  V(m/s) = √(R * g * μ) -> V(km/h) = √(R * 9.81 * G_lat) * 3.6
   * Compares achieved radius vs geometric corner radius, detects Early Apex pinch vs Late Apex buffer.
   */
  static evaluateLineGeometry15GR(cornerSamples, apexIndex, options = {}) {
    if (cornerSamples.length < 5) {
      return { score: 50, grade: 'C', feedback: 'Insufficient samples for 15GR geometry evaluation.', metrics: {} };
    }

    const apexSample = cornerSamples[apexIndex] || cornerSamples[Math.floor(cornerSamples.length / 2)];
    const actualApexSpeedKmh = this._getSpeedKmh(apexSample);
    const apexSpeedMs = actualApexSpeedKmh / 3.6;
    const apexLatG = Math.max(0.2, Math.abs(this._getLatG(apexSample)));

    // Calculate achieved radius in meters: R = v² / (g * G_lat)
    const achievedRadiusMeters = Math.max(5, (apexSpeedMs * apexSpeedMs) / (9.81 * apexLatG));
    const achievedRadiusFeet = achievedRadiusMeters * 3.28084;

    // Theoretical maximum speed from 15GR law (Skip Barber Chapter 2 formulation)
    // 15 * G * R_ft = (mph)²  -> V_mph = √(15 * G * R_ft) -> V_kmh = V_mph * 1.60934
    const theoreticalVmaxMph = Math.sqrt(15 * apexLatG * achievedRadiusFeet);
    const theoreticalVmaxKmh = theoreticalVmaxMph * 1.60934;

    // Radius efficiency: how well the driver extracted speed for this radius arc
    const radiusEfficiencyPct = Math.min(100, Math.round((actualApexSpeedKmh / (theoreticalVmaxKmh || 1)) * 100));

    // Apex Position and Early / Late Apex Diagnostic:
    // Relative position of apex in the sample array (0.0 to 1.0)
    const apexRelativePos = apexIndex / (cornerSamples.length - 1);
    
    // Check for late exit steering spike (the hallmark of early apex pinch from p. 23 Fig 2-4)
    let exitSteerSpike = false;
    const exitSamples = cornerSamples.slice(apexIndex);
    const apexSteer = Math.abs(apexSample.inputs?.steering ?? apexSample.steering ?? 0);
    for (let i = 1; i < exitSamples.length; i++) {
      const exitSteer = Math.abs(exitSamples[i].inputs?.steering ?? exitSamples[i].steering ?? 0);
      if (exitSteer > apexSteer + 0.08) {
        exitSteerSpike = true;
        break;
      }
    }

    let apexType = 'Geometric Optimal';
    let apexDeduction = 0;
    if (apexRelativePos < 0.38 || exitSteerSpike) {
      apexType = 'Early Apex (Pinched Exit)';
      apexDeduction = 25;
    } else if (apexRelativePos > 0.65) {
      apexType = 'Late Apex (Safety Buffer)';
      apexDeduction = 8; // Small speed trade-off, but safe as described on p. 24-25
    }

    let radiusScore = Math.min(100, Math.max(20, Math.round((radiusEfficiencyPct * 0.70 + (achievedRadiusMeters > 25 ? 30 : 20)) - apexDeduction)));
    const score = Math.max(10, Math.min(100, radiusScore));
    const grade = this._scoreToGrade(score);

    let feedback = `Optimal 15GR arc: R = ${achievedRadiusMeters.toFixed(1)}m (${achievedRadiusFeet.toFixed(0)}ft), apex speed ${actualApexSpeedKmh.toFixed(1)} km/h.`;
    if (apexType === 'Early Apex (Pinched Exit)') {
      feedback = 'Early Apex detected! Turned in too early, forcing a late steering pinch on exit. Wait longer before turn-in to maximize exit radius.';
    } else if (apexType === 'Late Apex (Safety Buffer)') {
      feedback = 'Late Apex line: Carries a slight speed penalty vs geometric limit, but leaves a safe reserve buffer on track-out.';
    } else if (score >= 90) {
      feedback = 'Flawless 15GR line geometry! Maximized corner arc radius (5% extra distance for 37% speed gain).';
    }

    return {
      skillId: 'ch2-line-geometry-15gr',
      name: 'Line Geometry & 15GR Arc Optimization',
      score,
      grade,
      metrics: {
        achievedRadiusMeters: parseFloat(achievedRadiusMeters.toFixed(1)),
        achievedRadiusFeet: parseFloat(achievedRadiusFeet.toFixed(0)),
        theoreticalVmaxKmh: parseFloat(theoreticalVmaxKmh.toFixed(1)),
        actualApexSpeedKmh: parseFloat(actualApexSpeedKmh.toFixed(1)),
        radiusEfficiencyPct,
        apexType,
        apexRelativePositionPct: Math.round(apexRelativePos * 100),
        unit: 'm'
      },
      feedback
    };
  }

  /**
   * Chapter 2 - Skill 2: Throttle Balance & Slide Recovery (CPR)
   * Evaluates the 3-phase rule: Correction -> Pause -> Recovery (p. 28)
   * Detects trailing-throttle oversteer lifts, countersteer reaction time, and snapback prevention.
   */
  static evaluateBalanceSlideControl(cornerSamples, apexIndex, options = {}) {
    if (cornerSamples.length < 5) {
      return { score: 50, grade: 'C', feedback: 'Insufficient telemetry for slide evaluation.', metrics: {} };
    }

    let slideDetected = false;
    let trailingThrottleLift = false;
    let correctionLatencyMs = 0;
    let pauseDurationMs = 0;
    let snapbackDetected = false;
    let peakCountersteerRad = 0;

    let slideStartIndex = -1;
    let peakSlideIndex = -1;
    let recoveryStartIndex = -1;
    let slideEndIndex = -1;

    for (let i = 1; i < cornerSamples.length; i++) {
      const steer = cornerSamples[i].inputs?.steering ?? cornerSamples[i].steering ?? 0;
      const latG = this._getLatG(cornerSamples[i]);
      const prevThr = cornerSamples[i - 1].inputs?.throttle ?? cornerSamples[i - 1].throttle ?? 0;
      const currThr = cornerSamples[i].inputs?.throttle ?? cornerSamples[i].throttle ?? 0;

      // Oversteer / slide condition: steering direction opposite to corner lateral G sign
      const isCountersteering = (latG > 0.4 && steer < -0.05) || (latG < -0.4 && steer > 0.05);

      if (isCountersteering) {
        if (!slideDetected) {
          slideDetected = true;
          slideStartIndex = i;

          // Check if slide was induced by trailing-throttle lift (p. 27)
          if (prevThr > 0.45 && currThr < 0.15) {
            trailingThrottleLift = true;
          }
        }

        const steerMag = Math.abs(steer);
        if (steerMag > peakCountersteerRad) {
          peakCountersteerRad = steerMag;
          peakSlideIndex = i;
        }
      } else if (slideDetected && slideEndIndex === -1 && i > peakSlideIndex + 1) {
        slideEndIndex = i;
      }
    }

    // Check for violent snapback (opposite steering spike right after recovery)
    if (slideEndIndex !== -1 && slideEndIndex < cornerSamples.length - 2) {
      const postRecoverySteer1 = cornerSamples[slideEndIndex].inputs?.steering ?? 0;
      const postRecoverySteer2 = cornerSamples[Math.min(cornerSamples.length - 1, slideEndIndex + 3)].inputs?.steering ?? 0;
      if (Math.sign(postRecoverySteer1) !== 0 && Math.sign(postRecoverySteer1) !== Math.sign(postRecoverySteer2) && Math.abs(postRecoverySteer2) > 0.18) {
        snapbackDetected = true;
      }
    }

    let cprScore = 90;
    let balanceState = 'Neutral';

    if (!slideDetected) {
      balanceState = 'Neutral / High Grip';
      correctionLatencyMs = 0;
      pauseDurationMs = 0;
      cprScore = 95;
    } else {
      balanceState = trailingThrottleLift ? 'Trailing-Throttle Oversteer' : 'Oversteer (Managed)';
      
      const t0 = cornerSamples[slideStartIndex].timestamp || (slideStartIndex * 16);
      const tPeak = cornerSamples[peakSlideIndex].timestamp || (peakSlideIndex * 16);
      const tEnd = cornerSamples[slideEndIndex !== -1 ? slideEndIndex : cornerSamples.length - 1].timestamp || (cornerSamples.length * 16);

      correctionLatencyMs = Math.max(40, Math.round(tPeak - t0));
      pauseDurationMs = Math.max(60, Math.round(tEnd - tPeak));

      let correctionScore = correctionLatencyMs <= 150 ? 95 : Math.max(40, 100 - (correctionLatencyMs - 150) * 0.3);
      let recoveryScore = snapbackDetected ? 35 : 90;
      let liftPenalty = trailingThrottleLift ? 25 : 0;

      cprScore = Math.round((correctionScore * 0.5 + recoveryScore * 0.5) - liftPenalty);
    }

    const score = Math.max(10, Math.min(100, cprScore));
    const grade = this._scoreToGrade(score);

    let feedback = 'Chassis beautifully balanced with neutral slip angle and clean throttle support.';
    if (snapbackDetected) {
      feedback = 'Snapback oscillation! Unwind the steering wheel earlier during the Pause phase before the rear snaps back.';
    } else if (trailingThrottleLift) {
      feedback = 'Trailing Throttle Oversteer: Abrupt throttle release unweighted the rear. Maintain smooth maintenance throttle through the arc.';
    } else if (slideDetected && score >= 85) {
      feedback = `Excellent CPR execution: Quick countersteer (${correctionLatencyMs}ms) and smooth recovery unwind.`;
    }

    return {
      skillId: 'ch2-balance-slide-control',
      name: 'Throttle Balance & Slide Recovery (CPR)',
      score,
      grade,
      metrics: {
        slideDetected,
        balanceState,
        correctionLatencyMs,
        pauseDurationMs,
        peakCountersteerRad: parseFloat(peakCountersteerRad.toFixed(3)),
        trailingThrottleLift,
        snapbackDetected,
        unit: 'ms'
      },
      feedback
    };
  }

  /**
   * Chapter 2 - Skill 3: 4-Block Corner Entry & Dynamic Load Transfer
   * Segments entry into the 4 canonical Skip Barber blocks (p. 29-33):
   * Block 1: Throttle-Brake Transition (< 0.20s)
   * Block 2: Straight-Line Deceleration & 65% Front Load Transfer (Firmness & Lockup Avoidance)
   * Block 3: Brake-Turn (Trail braking traction handoff)
   * Block 4: Brake-Throttle Transition (Seamless handoff without dead coasting)
   */
  static evaluateFourBlockEntry(entrySamples, options = {}) {
    if (entrySamples.length < 3) {
      return { score: 50, grade: 'C', feedback: 'Insufficient entry telemetry for 4-Block evaluation.', metrics: {} };
    }

    let b1TransitionTimeMs = 140;
    let b2PeakDecelG = 0;
    let b2LockupDetected = false;
    let b3TrailOverlapPct = 0;
    let b4HandoffGapMs = 70;

    let throttleLiftIndex = -1;
    let brakeApplyIndex = -1;
    let brakeReleaseIndex = -1;
    let throttleReapplyIndex = -1;

    let b3OverlapCount = 0;

    for (let i = 0; i < entrySamples.length; i++) {
      const thr = entrySamples[i].inputs?.throttle ?? entrySamples[i].throttle ?? 0;
      const brk = entrySamples[i].inputs?.brake ?? entrySamples[i].brake ?? 0;
      const steer = Math.abs(entrySamples[i].inputs?.steering ?? entrySamples[i].steering ?? 0);
      const lonG = Math.abs(this._getLonG(entrySamples[i]));

      if (thr < 0.10 && throttleLiftIndex === -1 && i > 0) {
        throttleLiftIndex = i;
      }
      if (brk > 0.10 && brakeApplyIndex === -1) {
        brakeApplyIndex = i;
      }
      if (lonG > b2PeakDecelG) {
        b2PeakDecelG = lonG;
      }
      // Check 30% traction drop / lockup during straight deceleration
      if (brk > 0.90 && lonG < 0.65 && steer < 0.05 && i > brakeApplyIndex + 2) {
        b2LockupDetected = true;
      }
      // Block 3: Brake-Turn trail overlap
      if (brk > 0.05 && steer > 0.08) {
        b3OverlapCount++;
      }
      if (brk < 0.05 && brakeApplyIndex !== -1 && brakeReleaseIndex === -1) {
        brakeReleaseIndex = i;
      }
      if (brakeReleaseIndex !== -1 && thr > 0.05 && throttleReapplyIndex === -1) {
        throttleReapplyIndex = i;
      }
    }

    // Block 1 Time
    if (throttleLiftIndex !== -1 && brakeApplyIndex !== -1 && brakeApplyIndex >= throttleLiftIndex) {
      const t0 = entrySamples[throttleLiftIndex].timestamp || (throttleLiftIndex * 16);
      const t1 = entrySamples[brakeApplyIndex].timestamp || (brakeApplyIndex * 16);
      b1TransitionTimeMs = Math.max(30, Math.round(t1 - t0));
    }

    // Block 3 Overlap
    b3TrailOverlapPct = Math.round((b3OverlapCount / (entrySamples.length || 1)) * 100);

    // Block 4 Gap
    if (brakeReleaseIndex !== -1 && throttleReapplyIndex !== -1) {
      const tBrk = entrySamples[brakeReleaseIndex].timestamp || (brakeReleaseIndex * 16);
      const tThr = entrySamples[throttleReapplyIndex].timestamp || (throttleReapplyIndex * 16);
      b4HandoffGapMs = Math.max(0, Math.round(tThr - tBrk));
    }

    // Stage Scores (0-100)
    const b1Score = b1TransitionTimeMs <= 180 ? 95 : Math.max(35, Math.round(100 - (b1TransitionTimeMs - 180) * 0.3));
    const b2Score = b2LockupDetected ? 40 : (b2PeakDecelG >= 1.2 ? 95 : Math.round(65 + b2PeakDecelG * 25));
    const b3Score = (b3TrailOverlapPct >= 20 && b3TrailOverlapPct <= 65) ? 95 : (b3TrailOverlapPct > 0 ? 75 : 45);
    const b4Score = b4HandoffGapMs <= 120 ? 95 : Math.max(35, Math.round(100 - (b4HandoffGapMs - 120) * 0.35));

    const overallEntryScore = Math.round(b1Score * 0.20 + b2Score * 0.35 + b3Score * 0.25 + b4Score * 0.20);
    const score = Math.max(10, Math.min(100, overallEntryScore));
    const grade = this._scoreToGrade(score);

    let feedback = `4-Block Entry in sync: Quick B1 transition (${b1TransitionTimeMs}ms), -${b2PeakDecelG.toFixed(2)}G firm decel, smooth B3/B4 handoff.`;
    if (b2LockupDetected) {
      feedback = 'Block 2 Lockup: Exceeded tire rotational grip threshold, losing 30% tractive force. Modulate brake pressure just below lockup.';
    } else if (b1TransitionTimeMs > 300) {
      feedback = 'Block 1 Hesitation: Coasting gap between throttle lift and brake hit. Move foot decisively to the brake pedal.';
    } else if (b4HandoffGapMs > 250) {
      feedback = 'Block 4 Dead-Coast: Lag between releasing brakes and picking up throttle. Roll onto maintenance gas immediately as trail-braking ends.';
    } else if (score >= 90) {
      feedback = 'Masterful 4-Block corner entry! Continuous flow from straight deceleration through trail-brake to throttle pickup.';
    }

    return {
      skillId: 'ch2-four-block-entry',
      name: '4-Block Corner Entry & Dynamic Load Transfer',
      score,
      grade,
      metrics: {
        b1TransitionTimeMs,
        b2PeakDecelG: parseFloat(b2PeakDecelG.toFixed(2)),
        b2LockupDetected,
        b3TrailOverlapPct,
        b4HandoffGapMs,
        blockScores: {
          b1: b1Score,
          b2: b2Score,
          b3: b3Score,
          b4: b4Score
        },
        unit: 'ms'
      },
      feedback
    };
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  static _getSpeedKmh(sample) {
    if (!sample) return 0;
    const raw = sample.speed ?? sample.motion?.speed ?? 0;
    return raw < 120 ? raw * 3.6 : raw;
  }

  static _getLatG(sample) {
    if (!sample) return 0;
    return sample.motion?.latG ?? sample.latG ?? sample.accelX ?? 0;
  }

  static _getLonG(sample) {
    if (!sample) return 0;
    return sample.motion?.lonG ?? sample.lonG ?? sample.accelY ?? 0;
  }

  static _findApexIndex(samples) {
    let minSpeed = Infinity;
    let apexIndex = Math.floor(samples.length / 2);

    for (let i = 0; i < samples.length; i++) {
      const spd = this._getSpeedKmh(samples[i]);
      if (spd < minSpeed) {
        minSpeed = spd;
        apexIndex = i;
      }
    }
    return apexIndex;
  }

  static _scoreToGrade(score) {
    if (score >= 95) return 'S';
    if (score >= 85) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  }

  static _generateCornerSummary(overallScore, skills, targetChapter = 1) {
    if (targetChapter === 2) {
      if (overallScore >= 90) {
        return 'Pro-tier mastery of Chapter 2 fundamentals (15GR line geometry, CPR slide control, and 4-block entry continuity).';
      }
      if (skills.lineGeometry15GRSkill?.metrics?.apexType === 'Early Apex (Pinched Exit)') {
        return 'Line geometry compromised by early apexing. Turn in later to open up exit radius and straightaway exit speed.';
      }
      if (skills.fourBlockEntrySkill?.metrics?.b2LockupDetected) {
        return 'Braking threshold exceeded in Block 2. Avoid locking wheels to prevent the 30% tractive grip loss.';
      }
      if (skills.balanceSlideControlSkill?.metrics?.snapbackDetected) {
        return 'Countersteer recovery delayed during slide. Unwind the steering wheel during the pause phase before the chassis snaps back.';
      }
      return 'Solid execution of Chapter 2 dynamics. Refine your 4-block entry transitions and radius arc consistency.';
    }

    if (overallScore >= 90) {
      return 'Pro-tier execution across all Chapter 1 fundamentals in metric kinematics.';
    }
    if (skills.exitSpeedSkill?.score < 75) {
      return 'Exit speed compromised. Focus on unwinding steering earlier to carry maximum km/h onto the straight.';
    }
    if (skills.thresholdBrakingSkill?.score < 70) {
      return 'Inconsistent braking phase. Practice firmer straight-line deceleration in minimum meters.';
    }
    if (skills.platformStabilitySkill?.score < 70) {
      return 'Chassis unsettled by abrupt throttle lifts. Maintain smooth pedal modulation.';
    }
    return 'Solid baseline attempt. Small gains in trail-braking and throttle commit will unlock faster lap times.';
  }

  static _generateEmptyEvaluation() {
    return {
      timestamp: Date.now(),
      cornerId: 'T1',
      cornerName: 'Corner',
      overallScore: 0,
      grade: 'N/A',
      chapterScores: { ch1: 0, ch2: 0 },
      skills: {},
      summary: 'Awaiting sufficient telemetry data.'
    };
  }
}
