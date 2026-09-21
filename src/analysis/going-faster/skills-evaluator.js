/**
 * APEX Going Faster - Skills Evaluator Engine
 * Based on Skip Barber "Going Faster! Mastering the Art of Race Driving"
 * Chapter 1: "A Plan of Attack"
 *
 * Deconstructs corner telemetry into 5 core measurable skills:
 * 1. Exit Speed & Throttle Commitment (Car Control for Exit Speed)
 * 2. Line Radius & Arc Consistency (Finding the Line)
 * 3. Threshold Braking Precision (Slowing for Corners)
 * 4. Combined Entry & Trail-Braking (Braking and Entering)
 * 5. Platform Balance & Anti-Lift (Preventing Chassis Unsettle)
 */

export class SkillsEvaluator {
  /**
   * Evaluates all Chapter 1 skills for a given corner telemetry slice.
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

    // 1. Evaluate Individual Chapter 1 Skills
    const exitSpeedSkill = this.evaluateExitSpeed(exitSamples, options);
    const theLineSkill = this.evaluateTheLine(cornerSamples, apexIndex, options);
    const thresholdBrakingSkill = this.evaluateThresholdBraking(entrySamples, options);
    const combinedEntrySkill = this.evaluateCombinedEntry(entrySamples, options);
    const platformStabilitySkill = this.evaluatePlatformStability(cornerSamples, options);

    // Calculate Overall Corner Mastery Score (Weighted based on Chapter 1 priorities)
    // Chapter 1: "Exit speed is the #1 priority (70-80% of lap time is straights), followed by line, braking and entering"
    const overallScore = Math.round(
      exitSpeedSkill.score * 0.35 +
      theLineSkill.score * 0.25 +
      thresholdBrakingSkill.score * 0.15 +
      combinedEntrySkill.score * 0.15 +
      platformStabilitySkill.score * 0.10
    );

    const grade = this._scoreToGrade(overallScore);

    return {
      timestamp: Date.now(),
      cornerId: options.cornerId || 'T1',
      cornerName: options.cornerName || 'Corner',
      cornerType: options.cornerType || 'Type I (Exit Priority)',
      overallScore,
      grade,
      skills: {
        'ch1-exit-speed': exitSpeedSkill,
        'ch1-the-line': theLineSkill,
        'ch1-threshold-braking': thresholdBrakingSkill,
        'ch1-combined-entry': combinedEntrySkill,
        'ch1-platform-stability': platformStabilitySkill
      },
      summary: this._generateCornerSummary(overallScore, {
        exitSpeedSkill,
        theLineSkill,
        thresholdBrakingSkill,
        combinedEntrySkill,
        platformStabilitySkill
      })
    };
  }

  /**
   * Skill 1: Exit Speed & Throttle Commitment
   * Evaluates throttle application rate, smooth unwinding of steering, and exit velocity.
   */
  static evaluateExitSpeed(exitSamples, options = {}) {
    if (exitSamples.length < 3) {
      return { score: 50, grade: 'C', feedback: 'Limited exit telemetry available.', metrics: {} };
    }

    let initialSpeed = exitSamples[0].speed || exitSamples[0].motion?.speed || 0;
    let finalSpeed = exitSamples[exitSamples.length - 1].speed || exitSamples[exitSamples.length - 1].motion?.speed || 0;
    let speedGainKmh = Math.max(0, (finalSpeed - initialSpeed) * 3.6);

    let throttleSmoothness = 1.0;
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

      // Detect throttle hesitation / mid-acceleration dips
      if (currThr < prevThr - 0.08 && prevThr > 0.3) {
        throttleHesitations++;
      }
    }

    // Unwinding correlation: as throttle goes up, steering angle should decrease
    let unwindCorrelationScore = 85;
    let unwindMismatches = 0;
    for (let i = 1; i < exitSamples.length; i++) {
      const prevThr = exitSamples[i - 1].inputs?.throttle ?? 0;
      const currThr = exitSamples[i].inputs?.throttle ?? 0;
      const prevSteer = Math.abs(exitSamples[i - 1].inputs?.steering ?? 0);
      const currSteer = Math.abs(exitSamples[i].inputs?.steering ?? 0);

      // Squeezing more throttle while tightening steering = pinched exit
      if (currThr > prevThr + 0.05 && currSteer > prevSteer + 0.03) {
        unwindMismatches++;
      }
    }

    unwindCorrelationScore = Math.max(30, 100 - (unwindMismatches * 12));
    const throttleScore = Math.max(20, 100 - (throttleHesitations * 18));
    const speedScore = Math.min(100, Math.max(40, Math.round(50 + (speedGainKmh * 1.2))));

    const score = Math.round(throttleScore * 0.35 + unwindCorrelationScore * 0.35 + speedScore * 0.30);
    const grade = this._scoreToGrade(score);

    let feedback = 'Clean throttle roll-on with progressive steering unwind.';
    if (unwindMismatches > 2) {
      feedback = 'Pinched exit: Steering was tightened while throttle was applied. Unwind steering earlier to allow full acceleration.';
    } else if (throttleHesitations > 0) {
      feedback = 'Hesitant throttle application: Driver hesitated on throttle roll-on. Commit progressively from apex.';
    } else if (score >= 90) {
      feedback = 'Masterclass exit! Optimal throttle squeeze matching steering unwinding down the straight.';
    }

    return {
      skillId: 'ch1-exit-speed',
      name: 'Exit Speed & Throttle Commitment',
      score,
      grade,
      metrics: {
        speedGainKmh: parseFloat(speedGainKmh.toFixed(1)),
        timeToFullThrottleSec: parseFloat(timeToFullThrottle.toFixed(2)),
        throttleHesitations,
        unwindMismatches
      },
      feedback
    };
  }

  /**
   * Skill 2: Line Radius & Arc Consistency
   * Evaluates geometric radius consistency, absence of saw-toothing, and minimum corner speed.
   */
  static evaluateTheLine(samples, apexIndex, options = {}) {
    if (samples.length < 5) {
      return { score: 50, grade: 'C', feedback: 'Insufficient samples for line evaluation.', metrics: {} };
    }

    const midStart = Math.max(0, apexIndex - 5);
    const midEnd = Math.min(samples.length - 1, apexIndex + 5);
    const midSamples = samples.slice(midStart, midEnd + 1);

    // Measure steering variance across mid-corner (saw-toothing check)
    let steerAngles = midSamples.map(s => Math.abs(s.inputs?.steering ?? s.steering ?? 0));
    let meanSteer = steerAngles.reduce((a, b) => a + b, 0) / steerAngles.length;
    let steerVariance = steerAngles.reduce((sum, val) => sum + Math.pow(val - meanSteer, 2), 0) / steerAngles.length;
    let steerStdDev = Math.sqrt(steerVariance);

    // Find minimum apex speed
    let minSpeed = Infinity;
    for (const s of samples) {
      const spd = (s.speed || s.motion?.speed || 0) * 3.6; // km/h
      if (spd < minSpeed) minSpeed = spd;
    }
    if (minSpeed === Infinity) minSpeed = 0;

    // Line smoothness score: low steering fluctuation = clean arc
    let smoothnessScore = Math.max(30, Math.round(100 - (steerStdDev * 250)));
    let apexRetentionScore = Math.min(100, Math.max(50, Math.round(minSpeed > 40 ? 80 + (minSpeed * 0.1) : 70)));

    const score = Math.round(smoothnessScore * 0.6 + apexRetentionScore * 0.4);
    const grade = this._scoreToGrade(score);

    let feedback = 'Smooth circular arc maintained through corner apex.';
    if (steerStdDev > 0.12) {
      feedback = 'Saw-tooth steering: Multiple mid-corner steering adjustments detected. Settle on a single arc radius.';
    } else if (score >= 90) {
      feedback = 'Perfect geometric line! Maximum radius arc maximizing apex minimum velocity.';
    }

    return {
      skillId: 'ch1-the-line',
      name: 'Line Radius & Arc Consistency',
      score,
      grade,
      metrics: {
        minApexSpeedKmh: parseFloat(minSpeed.toFixed(1)),
        steeringFluctuation: parseFloat(steerStdDev.toFixed(3)),
        arcStabilityPercent: Math.min(100, Math.max(0, Math.round(100 - steerStdDev * 200)))
      },
      feedback
    };
  }

  /**
   * Skill 3: Threshold Braking Precision
   * Evaluates straight-line braking firmness, ramp rate to peak pressure, and absence of lockup.
   */
  static evaluateThresholdBraking(entrySamples, options = {}) {
    if (entrySamples.length < 4) {
      return { score: 70, grade: 'B', feedback: 'Brief braking phase.', metrics: {} };
    }

    let maxBrake = 0;
    let maxDecelG = 0;
    let brakeRiseFrames = 0;
    let brakeActive = false;
    let lockupDetected = false;

    for (let i = 0; i < entrySamples.length; i++) {
      const b = entrySamples[i].inputs?.brake ?? entrySamples[i].brake ?? 0;
      const lonG = Math.abs(entrySamples[i].motion?.accelerationY ?? entrySamples[i].accelerationY ?? 0) / 9.81;

      if (b > maxBrake) maxBrake = b;
      if (lonG > maxDecelG) maxDecelG = lonG;

      if (b > 0.1 && !brakeActive) {
        brakeActive = true;
      }
      if (brakeActive && b < 0.8 && maxBrake < 0.8) {
        brakeRiseFrames++;
      }

      // Lockup detection: high brake pressure with zero or dropping wheel rotation / high slip
      const tireSlip = entrySamples[i].tires?.slipRatio || entrySamples[i].tireSlip || 0;
      if (b > 0.85 && tireSlip > 0.25) {
        lockupDetected = true;
      }
    }

    // Ramp time in seconds (assuming ~60Hz)
    const rampTimeSec = brakeRiseFrames * 0.016;

    // Firmness: reaching >80% threshold quickly
    let firmnessScore = maxBrake >= 0.85 ? 95 : Math.round(maxBrake * 100);
    let rampScore = rampTimeSec <= 0.25 ? 95 : Math.max(40, Math.round(100 - (rampTimeSec * 120)));
    let lockupPenalty = lockupDetected ? 25 : 0;

    const score = Math.max(10, Math.round((firmnessScore * 0.5 + rampScore * 0.5) - lockupPenalty));
    const grade = this._scoreToGrade(score);

    let feedback = 'Crisp threshold braking with rapid initial pressure buildup.';
    if (lockupDetected) {
      feedback = 'Tire lockup detected: Exceeded tire threshold in braking zone. Modulate brake at the threshold.';
    } else if (maxBrake < 0.70) {
      feedback = 'Soft initial brake application: Hit the brakes harder and quicker initially while the car is straight.';
    } else if (score >= 90) {
      feedback = 'Textbook threshold braking! Maximum deceleration achieved in minimum distance.';
    }

    return {
      skillId: 'ch1-threshold-braking',
      name: 'Threshold Braking Precision',
      score,
      grade,
      metrics: {
        peakBrakePressurePercent: Math.round(maxBrake * 100),
        peakDecelG: parseFloat(maxDecelG.toFixed(2)),
        rampTimeSec: parseFloat(rampTimeSec.toFixed(2)),
        lockupDetected
      },
      feedback
    };
  }

  /**
   * Skill 4: Combined Entry & Trail-Braking
   * Evaluates friction circle blending as steering angle rises and brake pressure eases.
   */
  static evaluateCombinedEntry(entrySamples, options = {}) {
    if (entrySamples.length < 5) {
      return { score: 70, grade: 'B', feedback: 'Short entry transition.', metrics: {} };
    }

    let peakCombinedG = 0;
    let blendCount = 0;
    let totalTurnInSamples = 0;

    for (let i = 0; i < entrySamples.length; i++) {
      const b = entrySamples[i].inputs?.brake ?? entrySamples[i].brake ?? 0;
      const s = Math.abs(entrySamples[i].inputs?.steering ?? entrySamples[i].steering ?? 0);
      const latG = Math.abs(entrySamples[i].motion?.accelerationX ?? entrySamples[i].accelerationX ?? 0) / 9.81;
      const lonG = Math.abs(entrySamples[i].motion?.accelerationY ?? entrySamples[i].accelerationY ?? 0) / 9.81;

      const combinedG = Math.sqrt(latG * latG + lonG * lonG);
      if (combinedG > peakCombinedG) peakCombinedG = combinedG;

      if (s > 0.08) {
        totalTurnInSamples++;
        // Blending: braking is easing off (0.05 - 0.50) while steering is active
        if (b >= 0.05 && b <= 0.60) {
          blendCount++;
        }
      }
    }

    const trailPercent = totalTurnInSamples > 0 ? Math.round((blendCount / totalTurnInSamples) * 100) : 0;
    const gripScore = Math.min(100, Math.round(peakCombinedG * 75));
    const blendScore = trailPercent >= 20 && trailPercent <= 70 ? 92 : (trailPercent > 70 ? 75 : 60);

    const score = Math.round(blendScore * 0.6 + gripScore * 0.4);
    const grade = this._scoreToGrade(score);

    let feedback = 'Smooth transition from straight braking to corner entry.';
    if (trailPercent < 15) {
      feedback = 'Abrupt brake release: Released brake 100% before turning in. Trail off the brakes smoothly into apex.';
    } else if (trailPercent > 75) {
      feedback = 'Over-braking past turn-in: Carrying excessive brake into the apex, risking front understeer.';
    } else if (score >= 90) {
      feedback = 'Elite trail-braking! Seamless friction circle handoff from longitudinal to lateral grip.';
    }

    return {
      skillId: 'ch1-combined-entry',
      name: 'Combined Entry & Trail-Braking',
      score,
      grade,
      metrics: {
        peakCombinedG: parseFloat(peakCombinedG.toFixed(2)),
        trailBrakingOverlapPercent: trailPercent
      },
      feedback
    };
  }

  /**
   * Skill 5: Platform Balance & Anti-Lift
   * Evaluates smooth load transfer and penalizes abrupt mid-corner throttle lifting / pumping.
   */
  static evaluatePlatformStability(samples, options = {}) {
    if (samples.length < 5) {
      return { score: 85, grade: 'A', feedback: 'Stable corner platform.', metrics: {} };
    }

    let throttleLifts = 0;
    let maxJerkGPerSec = 0;

    for (let i = 1; i < samples.length; i++) {
      const prevThr = samples[i - 1].inputs?.throttle ?? 0;
      const currThr = samples[i].inputs?.throttle ?? 0;
      const prevG = (samples[i - 1].motion?.accelerationY ?? 0) / 9.81;
      const currG = (samples[i].motion?.accelerationY ?? 0) / 9.81;
      const dt = 0.016;

      const jerk = Math.abs((currG - prevG) / dt);
      if (jerk > maxJerkGPerSec) maxJerkGPerSec = jerk;

      // Abrupt lift off mid corner (>20% drop while cornering)
      const latG = Math.abs(samples[i].motion?.accelerationX ?? 0) / 9.81;
      if (prevThr - currThr > 0.20 && latG > 0.4) {
        throttleLifts++;
      }
    }

    let stabilityScore = Math.max(20, 100 - (throttleLifts * 25));
    if (maxJerkGPerSec > 15) stabilityScore -= 15;

    const score = Math.max(10, Math.min(100, Math.round(stabilityScore)));
    const grade = this._scoreToGrade(score);

    let feedback = 'Smooth load transfer; stable chassis pitch and yaw platform.';
    if (throttleLifts > 0) {
      feedback = `Careless throttle lifting detected (${throttleLifts}x). Abruptly lifting off unweights the rear tires and invites snap oversteer.`;
    } else if (score >= 90) {
      feedback = 'Rock solid platform stability! Weight transferred fluidly without chassis shock.';
    }

    return {
      skillId: 'ch1-platform-stability',
      name: 'Platform Balance & Anti-Lift',
      score,
      grade,
      metrics: {
        throttleLifts,
        maxJerkGPerSec: parseFloat(maxJerkGPerSec.toFixed(1))
      },
      feedback
    };
  }

  // --- Helper Methods ---

  static _findApexIndex(samples) {
    let minSpeed = Infinity;
    let apexIndex = Math.floor(samples.length / 2);

    for (let i = 0; i < samples.length; i++) {
      const spd = samples[i].speed || samples[i].motion?.speed || 0;
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

  static _generateCornerSummary(overallScore, skills) {
    if (overallScore >= 90) {
      return 'Pro-tier execution across all Chapter 1 fundamentals.';
    }
    if (skills.exitSpeedSkill.score < 75) {
      return 'Exit speed compromised. Focus on unwinding steering earlier to carry maximum speed onto the straight.';
    }
    if (skills.thresholdBrakingSkill.score < 70) {
      return 'Inconsistent braking phase. Practice firmer straight-line deceleration.';
    }
    if (skills.platformStabilitySkill.score < 70) {
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
      skills: {},
      summary: 'Awaiting sufficient telemetry data.'
    };
  }
}
