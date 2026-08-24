/**
 * APEX 4-Block Corner Entry & Overslowing Diagnostic Engine (Client-Side)
 * Implements Skip Barber 4-Block Corner Entry decomposition,
 * Apex overslowing time loss calculation, and downshift brake dip analysis.
 * Rooted in "Going Faster!" Ch. 5 (Braking and Entering) & Ch. 8 (Finding Lap Time).
 */

export class BrakingEntryEngine {
  constructor(options = {}) {
    this.squeezeTimeMaxSec = options.squeezeTimeMaxSec || 0.35;
    this.slamThresholdRate = options.slamThresholdRate || 5.0;
    this.downshiftBrakeDipPct = options.downshiftBrakeDipPct || 0.20;
  }

  analyze(samples, corners = [], optimalLap = null) {
    if (!samples || samples.length === 0 || !corners || corners.length === 0) {
      return this._getEmptyResult();
    }

    const cornerEntryReports = [];
    let totalBrakeScore = 0;
    let totalOverslowTimeLoss = 0;
    let totalDownshiftDips = 0;
    let totalSlamEvents = 0;

    corners.forEach(corner => {
      const entryReport = this._analyzeCornerEntry(samples, corner, optimalLap);
      if (entryReport) {
        cornerEntryReports.push(entryReport);
        totalBrakeScore += entryReport.cornerBrakeScore;
        totalOverslowTimeLoss += entryReport.overslowing.straightawayTimeLossSec || 0;
        if (entryReport.downshiftBrakeDip.detected) totalDownshiftDips++;
        if (entryReport.block1.isHammerSlam) totalSlamEvents++;
      }
    });

    const avgBrakeScore = cornerEntryReports.length > 0
      ? Math.round(totalBrakeScore / cornerEntryReports.length)
      : 100;

    return {
      brakingEntryScore: avgBrakeScore,
      totalOverslowTimeLossSec: Number(totalOverslowTimeLoss.toFixed(3)),
      totalDownshiftDips,
      totalSlamEvents,
      cornerEntries: cornerEntryReports,
      coachingNotes: this._generateCoachingNotes(cornerEntryReports, totalOverslowTimeLoss, totalDownshiftDips, totalSlamEvents)
    };
  }

  _analyzeCornerEntry(samples, corner, optimalLap) {
    const startIndex = corner.startIndex || 0;
    const apexIndex = corner.apexIndex || startIndex;
    const cornerSamples = samples.slice(startIndex, apexIndex + 1);

    if (cornerSamples.length < 5) return null;

    let brakeStartIdx = -1;
    let throttleReleaseIdx = -1;

    for (let i = 0; i < cornerSamples.length; i++) {
      const s = cornerSamples[i];
      if (s.accel < 0.1 && throttleReleaseIdx === -1) {
        throttleReleaseIdx = i;
      }
      if (s.brake > 0.05 && brakeStartIdx === -1) {
        brakeStartIdx = i;
        break;
      }
    }

    if (brakeStartIdx === -1) brakeStartIdx = 0;
    if (throttleReleaseIdx === -1) throttleReleaseIdx = 0;

    const t0 = cornerSamples[throttleReleaseIdx].timestampMs || 0;
    const tb = cornerSamples[brakeStartIdx].timestampMs || t0;
    const transitionLatencySec = Math.max(0, (tb - t0) / 1000);

    let peakBrake = 0;
    let peakBrakeIdx = brakeStartIdx;
    for (let i = brakeStartIdx; i < cornerSamples.length; i++) {
      if (cornerSamples[i].brake > peakBrake) {
        peakBrake = cornerSamples[i].brake;
        peakBrakeIdx = i;
      }
    }

    const tPeak = cornerSamples[peakBrakeIdx].timestampMs || tb;
    const squeezeDurationSec = Math.max(0.01, (tPeak - tb) / 1000);
    const squeezeRate = peakBrake / squeezeDurationSec;
    const isHammerSlam = squeezeDurationSec < 0.08 && peakBrake > 0.8;

    const block1 = {
      transitionLatencySec: Number(transitionLatencySec.toFixed(3)),
      squeezeDurationSec: Number(squeezeDurationSec.toFixed(3)),
      squeezeRate: Number(squeezeRate.toFixed(2)),
      isHammerSlam,
      quality: isHammerSlam ? 'Hammer Slam (Lockup Risk)' : (squeezeDurationSec <= this.squeezeTimeMaxSec ? 'Optimal Squeeze' : 'Lazy Transition')
    };

    let peakDecelG = 0;
    let thresholdSamples = 0;
    for (let i = brakeStartIdx; i < cornerSamples.length; i++) {
      const decelG = Math.abs(cornerSamples[i].accelerationZ || 0) / 9.80665;
      if (decelG > peakDecelG) peakDecelG = decelG;
      if (cornerSamples[i].brake > 0.75) thresholdSamples++;
    }

    const block2 = {
      peakDecelG: Number(peakDecelG.toFixed(2)),
      peakBrakePct: Number((peakBrake * 100).toFixed(1)),
      thresholdBrakingUtilized: thresholdSamples > 3
    };

    let trailSamples = 0;
    for (let i = brakeStartIdx; i < cornerSamples.length; i++) {
      const s = cornerSamples[i];
      if (Math.abs(s.steer || 0) > 0.05 && s.brake > 0.05) {
        trailSamples++;
      }
    }

    const trailOverlapPct = Number(((trailSamples / Math.max(1, cornerSamples.length - brakeStartIdx)) * 100).toFixed(1));
    const trailStyle = trailOverlapPct > 40 ? 'Constant-Hold (Sweeper / Decreasing)' : (trailOverlapPct > 15 ? 'Progressive Bleed-Off' : 'Straight-Line Only');

    const block3 = {
      trailOverlapPct,
      trailStyle,
      utilized: trailOverlapPct >= 15
    };

    let brakeReleaseIdx = -1;
    let throttleApplyIdx = -1;

    for (let i = peakBrakeIdx; i < cornerSamples.length; i++) {
      if (cornerSamples[i].brake < 0.05 && brakeReleaseIdx === -1) {
        brakeReleaseIdx = i;
      }
      if (brakeReleaseIdx !== -1 && cornerSamples[i].accel > 0.05 && throttleApplyIdx === -1) {
        throttleApplyIdx = i;
        break;
      }
    }

    let pauseDurationSec = 0;
    if (brakeReleaseIdx !== -1 && throttleApplyIdx !== -1) {
      const tRel = cornerSamples[brakeReleaseIdx].timestampMs || 0;
      const tApp = cornerSamples[throttleApplyIdx].timestampMs || tRel;
      pauseDurationSec = Math.max(0, (tApp - tRel) / 1000);
    }

    const block4 = {
      pauseDurationSec: Number(pauseDurationSec.toFixed(3)),
      hasControlledPause: pauseDurationSec >= 0.08 && pauseDurationSec <= 0.35,
      isAbruptTransition: pauseDurationSec < 0.03
    };

    let downshiftDipDetected = false;
    let maxDipPct = 0;
    for (let i = brakeStartIdx + 1; i < cornerSamples.length - 1; i++) {
      const s = cornerSamples[i];
      const prev = cornerSamples[i - 1];
      if (prev.brake > 0.5 && s.brake < prev.brake * (1 - this.downshiftBrakeDipPct)) {
        if (s.clutch > 0.2 || (s.gear !== prev.gear && prev.gear > 1)) {
          downshiftDipDetected = true;
          const dip = ((prev.brake - s.brake) / prev.brake) * 100;
          if (dip > maxDipPct) maxDipPct = dip;
        }
      }
    }

    const downshiftBrakeDip = {
      detected: downshiftDipDetected,
      maxDipPct: Number(maxDipPct.toFixed(1))
    };

    const driverApexSpeedMph = (corner.speed?.apexMph || cornerSamples[cornerSamples.length - 1].speed * 2.23694) || 0;
    let optimalApexSpeedMph = driverApexSpeedMph;
    if (optimalLap && optimalLap.corners) {
      const optCorner = optimalLap.corners.find(c => c.cornerNumber === corner.cornerNumber);
      if (optCorner && optCorner.speed?.apexMph) {
        optimalApexSpeedMph = optCorner.speed.apexMph;
      }
    } else {
      optimalApexSpeedMph = driverApexSpeedMph * 1.05;
    }

    const speedDeficitMph = Math.max(0, optimalApexSpeedMph - driverApexSpeedMph);
    const followingStraightFt = corner.followingStraightFeet || 600;
    const vDriverFps = Math.max(10, driverApexSpeedMph * 1.46667);
    const vOptFps = Math.max(10, optimalApexSpeedMph * 1.46667);
    const straightawayTimeLossSec = speedDeficitMph > 1.0
      ? (followingStraightFt / vDriverFps) - (followingStraightFt / vOptFps)
      : 0;

    const overslowing = {
      driverApexSpeedMph: Number(driverApexSpeedMph.toFixed(1)),
      optimalApexSpeedMph: Number(optimalApexSpeedMph.toFixed(1)),
      speedDeficitMph: Number(speedDeficitMph.toFixed(1)),
      straightawayTimeLossSec: Number(straightawayTimeLossSec.toFixed(3)),
      isOverslowed: speedDeficitMph >= 2.5
    };

    let cornerBrakeScore = 100;
    if (isHammerSlam) cornerBrakeScore -= 15;
    if (downshiftDipDetected) cornerBrakeScore -= 12;
    if (overslowing.isOverslowed) cornerBrakeScore -= Math.min(25, Math.round(speedDeficitMph * 3));
    if (!block3.utilized && corner.type !== 'Hairpin') cornerBrakeScore -= 8;
    cornerBrakeScore = Math.max(0, Math.min(100, cornerBrakeScore));

    return {
      cornerNumber: corner.cornerNumber,
      cornerBrakeScore,
      block1,
      block2,
      block3,
      block4,
      downshiftBrakeDip,
      overslowing
    };
  }

  _generateCoachingNotes(cornerEntries, totalOverslowLoss, totalDips, totalSlams) {
    const notes = [];
    if (totalOverslowLoss > 0.25) {
      notes.push({
        category: 'Apex Momentum',
        severity: 'High',
        title: `Apex Overslowing Costing +${totalOverslowLoss.toFixed(2)}s on Straights`,
        text: 'You are slowing too much between turn-in and apex. The speed deficit at the apex carries down the entire length of the following straightaway.',
        quote: '"The biggest chunk of time in data coaching is lost by over-slowing the car between turn-in and the apex." — Carl Lopez'
      });
    }
    if (totalDips > 0) {
      notes.push({
        category: 'Heel-and-Toe Footwork',
        severity: 'Medium',
        title: 'Brake Pressure Dip During Downshift Blips',
        text: 'Brake pedal pressure drops sharply when blipping the throttle for downshifts, extending braking distance. Maintain steady pressure on the ball of the foot while rolling the ankle to blip.',
        quote: '"Drivers tend to release brake pressure when they blip for downshifts. That variation in brake pedal pressure adds car lengths." — Going Faster!'
      });
    }
    if (totalSlams > 0) {
      notes.push({
        category: 'Brake Technique',
        severity: 'Medium',
        title: 'Abrupt Brake Slam vs Squeeze',
        text: 'Initial brake application was an abrupt hammer-slam rather than a rapid, progressive squeeze, triggering tire lockup before dynamic load transferred forward.',
        quote: '"You move your foot fast, but the buildup of pressure is a hard squeeze as opposed to a slam." — Skip Barber'
      });
    }
    return notes;
  }

  _getEmptyResult() {
    return {
      brakingEntryScore: 100,
      totalOverslowTimeLossSec: 0,
      totalDownshiftDips: 0,
      totalSlamEvents: 0,
      cornerEntries: [],
      coachingNotes: []
    };
  }
}
