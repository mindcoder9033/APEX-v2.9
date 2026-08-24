/**
 * APEX Vehicle Dynamics & Skid Control Engine
 * Implements vehicle attitude tracking, Yaw vs Slip angle differential,
 * CPR (Correction-Pause-Recovery) oversteer state machine, and TTO detection.
 * Rooted in "Going Faster! Mastering the Art of Race Driving" (Ch. 4 & 11).
 */

export class CarControlEngine {
  constructor(options = {}) {
    this.oversteerThresholdDeg = options.oversteerThresholdDeg || 5.0; // Degrees of yaw above optimum
    this.neutralSlipToleranceDeg = options.neutralSlipToleranceDeg || 1.5; // Slip angle match window
    this.ttoThrottleDropRate = options.ttoThrottleDropRate || 0.6; // Throttle drop per second
    this.ttoLatGMin = options.ttoLatGMin || 0.6; // Min lateral G to trigger TTO
    this.slowRecoveryThresholdSec = options.slowRecoveryThresholdSec || 0.18; // Max time to begin unwinding after pause
  }

  /**
   * Analyze complete lap/stint samples for vehicle dynamics, skid control, and CPR state metrics
   * @param {Array<Object>} samples - Array of telemetry samples
   * @param {Array<Object>} corners - Array of detected corners
   * @returns {Object} Comprehensive car control analysis
   */
  analyze(samples, corners = []) {
    if (!samples || samples.length === 0) {
      return this._getEmptyResult();
    }

    const processedSamples = [];
    const skidEvents = [];
    let currentSkid = null;

    let totalNeutralSamples = 0;
    let totalUndersteerSamples = 0;
    let totalOversteerSamples = 0;
    let maxYawAngleDeg = 0;
    let maxSlipDiffDeg = 0;
    let ttoCount = 0;
    let tankslapperCount = 0;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const prev = i > 0 ? samples[i - 1] : s;
      const dt = s.timestampMs && prev.timestampMs ? Math.max(0.001, (s.timestampMs - prev.timestampMs) / 1000) : 0.016;

      // 1. Calculate Instantaneous Velocity Angle & Vehicle Yaw Angle
      const vx = s.velocityX || 0;
      const vz = s.velocityZ || 0;
      const speed = s.speed || 0;

      let velAngleRad = 0;
      if (Math.abs(vx) > 0.1 || Math.abs(vz) > 0.1) {
        velAngleRad = Math.atan2(vx, vz);
      }

      // Yaw angle in degrees (difference between heading and travel velocity)
      const rawYawRad = s.yaw || 0;
      let yawAngleRad = rawYawRad - velAngleRad;
      // Normalize to [-PI, PI]
      while (yawAngleRad > Math.PI) yawAngleRad -= 2 * Math.PI;
      while (yawAngleRad < -Math.PI) yawAngleRad += 2 * Math.PI;
      const yawAngleDeg = yawAngleRad * (180 / Math.PI);

      if (Math.abs(yawAngleDeg) > Math.abs(maxYawAngleDeg)) {
        maxYawAngleDeg = yawAngleDeg;
      }

      // 2. Compute 4-Wheel Average Slip Angles & Differential
      const slipFL = Math.abs(s.tireSlipAngle?.frontLeft || 0);
      const slipFR = Math.abs(s.tireSlipAngle?.frontRight || 0);
      const slipRL = Math.abs(s.tireSlipAngle?.rearLeft || 0);
      const slipRR = Math.abs(s.tireSlipAngle?.rearRight || 0);

      const avgFrontSlipDeg = ((slipFL + slipFR) / 2) * (180 / Math.PI);
      const avgRearSlipDeg = ((slipRL + slipRR) / 2) * (180 / Math.PI);
      const slipDiffDeg = avgFrontSlipDeg - avgRearSlipDeg; // >0 Understeer, <0 Oversteer

      if (Math.abs(slipDiffDeg) > Math.abs(maxSlipDiffDeg)) {
        maxSlipDiffDeg = slipDiffDeg;
      }

      // 3. Classify Handling State
      const latG = Math.abs(s.accelerationX || 0) / 9.80665;
      let balance = 'Neutral';

      if (latG > 0.25) {
        if (slipDiffDeg > this.neutralSlipToleranceDeg) {
          balance = 'Understeer';
          totalUndersteerSamples++;
        } else if (slipDiffDeg < -this.neutralSlipToleranceDeg || Math.abs(yawAngleDeg) > this.oversteerThresholdDeg) {
          balance = 'Oversteer';
          totalOversteerSamples++;
        } else {
          balance = 'Neutral';
          totalNeutralSamples++;
        }
      } else {
        totalNeutralSamples++;
      }

      // 4. CPR Skid State Machine Tracking
      const isSliding = balance === 'Oversteer' || Math.abs(yawAngleDeg) > this.oversteerThresholdDeg;
      const steerInput = s.steer || 0;
      const prevSteer = prev.steer || 0;
      const steerRate = (steerInput - prevSteer) / dt;
      const yawRate = s.angularVelocityY || 0; // Rotational velocity around vertical axis
      const throttle = s.accel || 0;
      const prevThrottle = prev.accel || 0;
      const throttleRate = (throttle - prevThrottle) / dt;

      if (isSliding) {
        if (!currentSkid) {
          // Onset of a new slide
          const isTTO = throttleRate < -this.ttoThrottleDropRate && latG >= this.ttoLatGMin;
          if (isTTO) ttoCount++;

          currentSkid = {
            startTimeMs: s.timestampMs || i * 16,
            startSampleIndex: i,
            cornerNumber: this._findCornerNumber(s.distanceTraveled, corners),
            maxYawAngleDeg: Math.abs(yawAngleDeg),
            maxSlipDiffDeg: Math.abs(slipDiffDeg),
            peakYawRate: Math.abs(yawRate),
            isTTO,
            isPowerOversteer: throttle > 0.7 && latG > 0.6 && !isTTO,
            phases: {
              correction: { detected: false, countersteerSpeed: 0 },
              pause: { detected: false, timestampMs: null, yawRateAtPause: null },
              recovery: { detected: false, durationSec: 0, isSlowRecovery: false }
            },
            oscillations: 0,
            prevYawRateSign: Math.sign(yawRate)
          };
        } else {
          // Ongoing slide
          if (Math.abs(yawAngleDeg) > currentSkid.maxYawAngleDeg) {
            currentSkid.maxYawAngleDeg = Math.abs(yawAngleDeg);
          }
          if (Math.abs(yawRate) > currentSkid.peakYawRate) {
            currentSkid.peakYawRate = Math.abs(yawRate);
          }

          // Track oscillation reversals (Tankslapper / Death Wiggle)
          const currentSign = Math.sign(yawRate);
          if (currentSign !== 0 && currentSkid.prevYawRateSign !== 0 && currentSign !== currentSkid.prevYawRateSign) {
            currentSkid.oscillations++;
            currentSkid.prevYawRateSign = currentSign;
          }

          // CPR Phase 1: Correction
          const isCountersteering = (yawAngleDeg > 0 && steerInput < -0.05) || (yawAngleDeg < 0 && steerInput > 0.05);
          if (isCountersteering && !currentSkid.phases.correction.detected) {
            currentSkid.phases.correction.detected = true;
            currentSkid.phases.correction.countersteerSpeed = Math.abs(steerRate);
          }

          // CPR Phase 2: The Pause (Yaw velocity slows to ~0 at peak slide)
          if (currentSkid.phases.correction.detected && !currentSkid.phases.pause.detected) {
            if (Math.abs(yawRate) < 0.15) {
              currentSkid.phases.pause.detected = true;
              currentSkid.phases.pause.timestampMs = s.timestampMs || i * 16;
              currentSkid.phases.pause.yawRateAtPause = Math.abs(yawRate);
            }
          }

          // CPR Phase 3: Recovery (Unwinding steering back toward center after pause)
          if (currentSkid.phases.pause.detected && !currentSkid.phases.recovery.detected) {
            const isUnwinding = (yawAngleDeg > 0 && steerRate > 0.2) || (yawAngleDeg < 0 && steerRate < -0.2);
            if (isUnwinding || Math.abs(steerInput) < 0.1) {
              currentSkid.phases.recovery.detected = true;
              const pauseTime = currentSkid.phases.pause.timestampMs || s.timestampMs;
              const recoveryDuration = ((s.timestampMs || i * 16) - pauseTime) / 1000;
              currentSkid.phases.recovery.durationSec = Math.max(0.01, recoveryDuration);
              currentSkid.phases.recovery.isSlowRecovery = recoveryDuration > this.slowRecoveryThresholdSec;
            }
          }
        }
      } else {
        if (currentSkid) {
          // Slide concluded
          currentSkid.endTimeMs = s.timestampMs || i * 16;
          currentSkid.durationSec = Math.max(0.05, (currentSkid.endTimeMs - currentSkid.startTimeMs) / 1000);
          currentSkid.isTankslapper = currentSkid.oscillations >= 2;
          if (currentSkid.isTankslapper) tankslapperCount++;

          skidEvents.push(currentSkid);
          currentSkid = null;
        }
      }

      processedSamples.push({
        index: i,
        timestampMs: s.timestampMs || i * 16,
        distanceTraveled: s.distanceTraveled || 0,
        speedMph: speed * 2.23694,
        yawAngleDeg,
        avgFrontSlipDeg,
        avgRearSlipDeg,
        slipDiffDeg,
        balance,
        latG
      });
    }

    // Close any open skid event
    if (currentSkid) {
      currentSkid.endTimeMs = samples[samples.length - 1].timestampMs || samples.length * 16;
      currentSkid.durationSec = Math.max(0.05, (currentSkid.endTimeMs - currentSkid.startTimeMs) / 1000);
      currentSkid.isTankslapper = currentSkid.oscillations >= 2;
      skidEvents.push(currentSkid);
    }

    const totalActive = Math.max(1, totalNeutralSamples + totalUndersteerSamples + totalOversteerSamples);
    const balancePercentages = {
      neutralPct: Number(((totalNeutralSamples / totalActive) * 100).toFixed(1)),
      understeerPct: Number(((totalUndersteerSamples / totalActive) * 100).toFixed(1)),
      oversteerPct: Number(((totalOversteerSamples / totalActive) * 100).toFixed(1))
    };

    // Calculate Car Control & Skid Recovery Quality Score (0 - 100)
    let carControlScore = 100;
    carControlScore -= Math.min(30, skidEvents.length * 5);
    carControlScore -= Math.min(25, tankslapperCount * 12);
    carControlScore -= Math.min(20, ttoCount * 8);
    skidEvents.forEach(skid => {
      if (skid.phases.recovery.isSlowRecovery) carControlScore -= 4;
      if (!skid.phases.correction.detected) carControlScore -= 6;
    });
    carControlScore = Math.max(0, Math.min(100, Math.round(carControlScore)));

    return {
      carControlScore,
      balancePercentages,
      maxYawAngleDeg: Number(maxYawAngleDeg.toFixed(2)),
      maxSlipDiffDeg: Number(maxSlipDiffDeg.toFixed(2)),
      skidEventsCount: skidEvents.length,
      ttoEventsCount: ttoCount,
      tankslapperEventsCount: tankslapperCount,
      skidEvents,
      coachingNotes: this._generateCoachingNotes(skidEvents, balancePercentages, ttoCount, tankslapperCount),
      processedSamples
    };
  }

  _findCornerNumber(distance, corners) {
    if (!corners || corners.length === 0 || distance === undefined) return null;
    for (const c of corners) {
      if (c.startDistance !== undefined && c.endDistance !== undefined) {
        if (distance >= c.startDistance && distance <= c.endDistance) {
          return c.cornerNumber;
        }
      }
    }
    return null;
  }

  _generateCoachingNotes(skidEvents, balance, ttoCount, tankslappers) {
    const notes = [];

    if (tankslappers > 0) {
      notes.push({
        category: 'CPR Recovery',
        severity: 'High',
        title: 'Tankslapper / Secondary Reaction Spin Risk Detected',
        text: 'You had oscillating countersteer snaps. After making the initial steering correction, wait for "The Pause" and unwind quickly to straight before the counter-rotational momentum snaps the car around.',
        quote: '"Slow recovery is what causes second-reaction spins. Get the wheel straight quickly at the pause." — Carl Lopez'
      });
    }

    if (ttoCount > 0) {
      notes.push({
        category: 'Throttle Control',
        severity: 'High',
        title: 'Trailing Throttle Oversteer (TTO) Detected',
        text: 'Abruptly lifting off the throttle while loaded in mid-corner transfers weight off the rear tires, provoking instant oversteer. Breathe or roll off the throttle smoothly rather than snapping it shut.',
        quote: '"Lifting off the throttle while near the cornering limit will create oversteer in direct proportion to the severity of the lift." — Going Faster!'
      });
    }

    if (balance.understeerPct > 35) {
      notes.push({
        category: 'Handling Balance',
        severity: 'Medium',
        title: 'Excessive Cornering Understeer',
        text: 'The front tires are scrubbing at high slip angles without changing the car direction. Reduce throttle slightly to settle load onto the front contact patch before turning.',
        quote: '"Adding more steering lock will not make the front end turn more when over the tire limit. Correct with throttle, not steering." — Terry Earwood'
      });
    }

    if (skidEvents.length === 0 && balance.neutralPct > 80) {
      notes.push({
        category: 'Mastery',
        severity: 'Low',
        title: 'Excellent Vehicle Balance & Car Control',
        text: 'Consistent neutral slip angles with zero unmanaged slides. The car is operating squarely in its optimum friction window.',
        quote: '"Confidence in your car control comes from having the experience of sliding the car and bringing it back from the edge." — Danny Sullivan'
      });
    }

    return notes;
  }

  _getEmptyResult() {
    return {
      carControlScore: 100,
      balancePercentages: { neutralPct: 100, understeerPct: 0, oversteerPct: 0 },
      maxYawAngleDeg: 0,
      maxSlipDiffDeg: 0,
      skidEventsCount: 0,
      ttoEventsCount: 0,
      tankslapperEventsCount: 0,
      skidEvents: [],
      coachingNotes: [],
      processedSamples: []
    };
  }
}
