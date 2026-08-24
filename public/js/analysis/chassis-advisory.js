/**
 * APEX Suspension Load Transfer & Chassis Setup Coach (Client-Side)
 * Implements 4-wheel suspension travel tracking, bottoming-out shock detection,
 * dynamic aerodynamic rake estimation, and prescriptive mechanical setup adjustments.
 * Rooted in "Going Faster!" Ch. 14 (Chassis Adjustments).
 */

export class ChassisAdvisoryEngine {
  constructor(options = {}) {
    this.bottomingThreshold = options.bottomingThreshold || 0.96;
    this.maxSafeRollDeg = options.maxSafeRollDeg || 4.5;
    this.maxSafePitchDeg = options.maxSafePitchDeg || 3.5;
  }

  analyze(samples, carControlData = null) {
    if (!samples || samples.length === 0) {
      return this._getEmptyResult();
    }

    let bottomingEvents = {
      frontLeft: 0,
      frontRight: 0,
      rearLeft: 0,
      rearRight: 0,
      total: 0
    };

    let maxTravel = {
      frontLeft: 0,
      frontRight: 0,
      rearLeft: 0,
      rearRight: 0
    };

    let maxRollDeg = 0;
    let maxPitchDeg = 0;
    let highSpeedSamples = 0;
    let highSpeedRakeSum = 0;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const speedMph = (s.speed || 0) * 2.23694;

      const normTravel = s.normSuspensionTravel || {
        frontLeft: 0,
        frontRight: 0,
        rearLeft: 0,
        rearRight: 0
      };

      ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'].forEach(pos => {
        const val = normTravel[pos] || 0;
        if (val > maxTravel[pos]) maxTravel[pos] = val;
        if (val >= this.bottomingThreshold) {
          bottomingEvents[pos]++;
          bottomingEvents.total++;
        }
      });

      const rollDeg = Math.abs((s.roll || 0) * (180 / Math.PI));
      const pitchDeg = Math.abs((s.pitch || 0) * (180 / Math.PI));
      if (rollDeg > maxRollDeg) maxRollDeg = rollDeg;
      if (pitchDeg > maxPitchDeg) maxPitchDeg = pitchDeg;

      if (speedMph > 80) {
        const frontAvg = ((normTravel.frontLeft + normTravel.frontRight) / 2);
        const rearAvg = ((normTravel.rearLeft + normTravel.rearRight) / 2);
        const dynamicRakeIndex = rearAvg - frontAvg;
        highSpeedRakeSum += dynamicRakeIndex;
        highSpeedSamples++;
      }
    }

    const avgHighSpeedRakeIndex = highSpeedSamples > 0
      ? Number((highSpeedRakeSum / highSpeedSamples).toFixed(3))
      : 0;

    const balance = carControlData?.balancePercentages || { neutralPct: 80, understeerPct: 10, oversteerPct: 10 };

    const setupAdjustments = this._diagnoseSetupAdjustments(
      bottomingEvents,
      maxRollDeg,
      maxPitchDeg,
      avgHighSpeedRakeIndex,
      balance
    );

    let chassisHealthScore = 100;
    chassisHealthScore -= Math.min(35, bottomingEvents.total * 3);
    if (maxRollDeg > this.maxSafeRollDeg) chassisHealthScore -= 10;
    if (maxPitchDeg > this.maxSafePitchDeg) chassisHealthScore -= 10;
    if (balance.understeerPct > 35 || balance.oversteerPct > 35) chassisHealthScore -= 15;
    chassisHealthScore = Math.max(0, Math.min(100, Math.round(chassisHealthScore)));

    return {
      chassisHealthScore,
      maxSuspensionTravel: {
        frontLeftPct: Number((maxTravel.frontLeft * 100).toFixed(1)),
        frontRightPct: Number((maxTravel.frontRight * 100).toFixed(1)),
        rearLeftPct: Number((maxTravel.rearLeft * 100).toFixed(1)),
        rearRightPct: Number((maxTravel.rearRight * 100).toFixed(1))
      },
      bottomingStrikes: bottomingEvents,
      maxBodyAngles: {
        maxRollDeg: Number(maxRollDeg.toFixed(2)),
        maxPitchDeg: Number(maxPitchDeg.toFixed(2))
      },
      dynamicRakeIndex: avgHighSpeedRakeIndex,
      setupAdjustments,
      coachingNotes: this._generateCoachingNotes(bottomingEvents, maxRollDeg, setupAdjustments)
    };
  }

  _diagnoseSetupAdjustments(bottoming, maxRoll, maxPitch, rakeIndex, balance) {
    const adjustments = [];

    if (bottoming.total > 5) {
      const frontBottom = bottoming.frontLeft + bottoming.frontRight;
      const rearBottom = bottoming.rearLeft + bottoming.rearRight;
      if (frontBottom > rearBottom) {
        adjustments.push({
          component: 'Front Springs / Ride Height',
          action: 'Increase front spring rate by 15-20% or raise front ride height 5mm',
          rationale: 'Front chassis is slamming onto bump-stops under heavy braking and aero downforce, causing catastrophic front grip loss.'
        });
      } else {
        adjustments.push({
          component: 'Rear Ride Height / Bumpstop',
          action: 'Raise rear ride height 5mm or stiffen rear compression damping',
          rationale: 'Rear suspension bottoming under squat and high speed downforce.'
        });
      }
    }

    if (maxRoll > 4.5) {
      adjustments.push({
        component: 'Anti-Roll Bars (ARBs)',
        action: 'Stiffen both Front and Rear Anti-Roll Bars 1-2 clicks',
        rationale: 'Excessive chassis roll (>4.5 deg) rolls outside tires out of optimal camber contact patch window.'
      });
    }

    if (balance.understeerPct > 30) {
      adjustments.push({
        component: 'Front Anti-Roll Bar & Brake Bias',
        action: 'Soften front ARB by 1 click; shift brake bias 1% rearward',
        rationale: 'Softening front roll resistance transfers less lateral load to the outside front tire, restoring front turning bite.'
      });
    } else if (balance.oversteerPct > 30) {
      adjustments.push({
        component: 'Rear Anti-Roll Bar & Rebound',
        action: 'Soften rear ARB by 1 click; soften rear shock rebound damping',
        rationale: 'Reducing rear roll stiffness allows the rear tires to share cornering load more progressively, taming oversteer.'
      });
    }

    if (adjustments.length === 0) {
      adjustments.push({
        component: 'Chassis Baseline',
        action: 'Maintain current mechanical suspension settings',
        rationale: 'Suspension travel is operating in healthy range (0-90%) with balanced pitch/roll dynamics.'
      });
    }

    return adjustments;
  }

  _generateCoachingNotes(bottoming, maxRoll, adjustments) {
    const notes = [];
    if (bottoming.total > 0) {
      notes.push({
        category: 'Suspension Limit',
        severity: 'High',
        title: `Chassis Bottoming Detected (${bottoming.total} strikes)`,
        text: 'The suspension reached 100% mechanical compression. When a car bottoms, tire download collapses abruptly, throwing the car into snap breakaway.',
        quote: '"If the chassis slams onto the track, the download on the tires suddenly falls and awful things happen to the handling." — Going Faster!'
      });
    }
    if (maxRoll > 4.5) {
      notes.push({
        category: 'Chassis Roll',
        severity: 'Medium',
        title: 'Excessive Cornering Body Roll',
        text: 'The car is rolling excessively in high-G corners. Consider stiffening anti-roll bars to keep tire contact patches flat on the pavement.',
        quote: '"A stiffer anti-roll bar increases resistance to roll, stabilizing the contact patch through the apex." — Carl Lopez'
      });
    }
    return notes;
  }

  _getEmptyResult() {
    return {
      chassisHealthScore: 100,
      maxSuspensionTravel: { frontLeftPct: 0, frontRightPct: 0, rearLeftPct: 0, rearRightPct: 0 },
      bottomingStrikes: { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0, total: 0 },
      maxBodyAngles: { maxRollDeg: 0, maxPitchDeg: 0 },
      dynamicRakeIndex: 0,
      setupAdjustments: [],
      coachingNotes: []
    };
  }
}
