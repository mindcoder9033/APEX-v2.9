/**
 * APEX Corner Feature Extractor
 * Extracts detailed racecraft landmarks (Brake Point, Turn-In, Apex, TAP, Track-Out)
 * and calculates quantitative dynamics metrics (TAP distance delta, trail-braking overlap, speed deltas).
 *
 * ANALYSIS.md §4-§6 compliance additions:
 *  - Corner radius estimation (v²/15G) per Going Faster! Ch.2
 *  - Optimal exit speed √(15 × 1.2 × R) per Going Faster! Ch.2 §5.2
 *  - Exit speed efficiency block (tapSmoothness, exitEfficiency%, potentialGain)
 *  - Trail-brake quality label (EXCELLENT/GOOD/FAIR/POOR) per Going Faster! Ch.5
 */

import { mpsToMph, mpsToKmh } from '../shared/telemetry-types.js';

export const METERS_TO_FEET = 3.28084;

export class CornerExtractor {
  constructor(options = {}) {
    this.brakeThreshold = options.brakeThreshold || 0.10; // 10%
    this.throttleThreshold = options.throttleThreshold || 0.15; // 15%
    this.steerThreshold = options.steerThreshold || 0.04; // ~5 deg
    this.maxScanSamples = options.maxScanSamples || 300; // ~5 seconds @ 60Hz
  }

  /**
   * Extracts detailed corner profiles for all detected apexes in a lap
   * @param {Array<Object>} samples 
   * @param {Array<Object>} detectedApexes 
   * @returns {Array<Object>} Array of comprehensive CornerData objects
   */
  extractAll(samples, detectedApexes) {
    if (!samples || samples.length === 0 || !detectedApexes || detectedApexes.length === 0) {
      return [];
    }

    return detectedApexes.map(apexInfo => this.extractCorner(samples, apexInfo));
  }

  /**
   * Extracts detailed features for a single corner
   * @param {Array<Object>} samples 
   * @param {Object} apexInfo 
   * @returns {Object} CornerData
   */
  extractCorner(samples, apexInfo) {
    const apexIndex = apexInfo.apexIndex;
    const apexSample = samples[apexIndex];
    const n = samples.length;

    // 1. Find Brake Point (scanning backwards from apex)
    let brakeIndex = apexIndex;
    let maxBrakePressure = 0;
    const scanBackLimit = Math.max(0, apexIndex - this.maxScanSamples);

    for (let i = apexIndex; i >= scanBackLimit; i--) {
      const b = samples[i].inputs.brake || 0;
      if (b > maxBrakePressure) maxBrakePressure = b;
      if (b >= this.brakeThreshold) {
        brakeIndex = i;
      } else if (maxBrakePressure > this.brakeThreshold && b < this.brakeThreshold) {
        // Brake was applied and now we've reached the start of the braking zone
        brakeIndex = i + 1;
        break;
      }
    }

    // 2. Find Turn-In Point (where steering exceeds threshold going towards apex)
    let turnInIndex = apexIndex;
    for (let i = apexIndex; i >= scanBackLimit; i--) {
      const st = Math.abs(samples[i].inputs.steering || 0);
      if (st >= this.steerThreshold) {
        turnInIndex = i;
      } else {
        break;
      }
    }
    // Ensure entry index is the earliest of brake or turn-in
    const entryIndex = Math.min(brakeIndex, turnInIndex);

    // 3. Find Throttle Application Point (TAP) (scanning forwards from turn-in)
    let tapIndex = apexIndex;
    const scanForwardLimit = Math.min(n - 1, apexIndex + this.maxScanSamples);

    for (let i = turnInIndex; i <= scanForwardLimit; i++) {
      const th = samples[i].inputs.throttle || 0;
      if (th >= this.throttleThreshold) {
        tapIndex = i;
        break;
      }
    }

    // 4. Find Track-Out / Exit Point (where steering unwinds back to straight)
    let exitIndex = apexIndex;
    for (let i = apexIndex; i <= scanForwardLimit; i++) {
      const st = Math.abs(samples[i].inputs.steering || 0);
      const th = samples[i].inputs.throttle || 0;
      if (st < this.steerThreshold && th > 0.60) {
        exitIndex = i;
        break;
      }
    }
    if (exitIndex === apexIndex) {
      exitIndex = Math.min(n - 1, apexIndex + 40);
    }

    // 5. Calculate Physical Travel Distance from Apex to TAP
    let tapDistanceMeters = 0;
    const fromIdx = Math.min(apexIndex, tapIndex);
    const toIdx = Math.max(apexIndex, tapIndex);

    for (let i = fromIdx + 1; i <= toIdx; i++) {
      const p1 = samples[i - 1].motion.position;
      const p2 = samples[i].motion.position;
      const dx = (p2.x || 0) - (p1.x || 0);
      const dy = (p2.y || 0) - (p1.y || 0);
      const dz = (p2.z || 0) - (p1.z || 0);
      tapDistanceMeters += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    // Signed distance: positive if TAP is AFTER apex (late/ideal), negative if BEFORE apex (early)
    const signedTapDistanceMeters = tapIndex >= apexIndex ? tapDistanceMeters : -tapDistanceMeters;
    const signedTapDistanceFeet = signedTapDistanceMeters * METERS_TO_FEET;

    // 6. Calculate Trail-Braking Overlap % (during Turn-In to Apex)
    let trailBrakeSamples = 0;
    const turnInToApexCount = Math.max(1, apexIndex - turnInIndex + 1);

    for (let i = turnInIndex; i <= apexIndex; i++) {
      const b = samples[i].inputs.brake || 0;
      const st = Math.abs(samples[i].inputs.steering || 0);
      if (b >= this.brakeThreshold && st >= this.steerThreshold) {
        trailBrakeSamples++;
      }
    }
    const trailBrakingOverlapRatio = trailBrakeSamples / turnInToApexCount;

    // 7. Calculate Brake Snap-Off Rate (max release rate dBrake/dt over ~100ms / 6 samples)
    let maxBrakeReleaseRate = 0;
    for (let i = entryIndex; i < apexIndex; i++) {
      const b1 = samples[i].inputs.brake || 0;
      const b2 = samples[Math.min(apexIndex, i + 6)].inputs.brake || 0;
      const releaseRate = (b1 - b2); // positive = releasing
      if (releaseRate > maxBrakeReleaseRate) {
        maxBrakeReleaseRate = releaseRate;
      }
    }

    // 8. Geometric Apex Fault Analysis (Early Apex & Late Apex)
    // Early Apex (R-003): Steering angle increases post-apex (driver drifted wide and had to turn in harder)
    const apexSteerMag = Math.abs(apexSample.inputs.steering || 0);
    let maxPostApexSteerMag = apexSteerMag;
    let postApexCorrectionIndex = apexIndex;

    for (let i = apexIndex + 1; i <= exitIndex; i++) {
      const st = Math.abs(samples[i].inputs.steering || 0);
      if (st > maxPostApexSteerMag) {
        maxPostApexSteerMag = st;
        postApexCorrectionIndex = i;
      }
    }
    const postApexSteerDeltaNorm = Math.max(0, maxPostApexSteerMag - apexSteerMag);
    const postApexSteerCorrectionDeg = postApexSteerDeltaNorm * 45.0; // 1.0 norm steer ~45 deg

    // Late Apex (R-004): Premature steering unwinding with excessive speed loss into apex
    const entrySpeedMph = mpsToMph(samples[entryIndex].motion.speedMps);
    const apexSpeedMph = mpsToMph(apexSample.motion.speedMps);
    const exitSpeedMph = mpsToMph(samples[exitIndex].motion.speedMps);
    
    // Check if steering was fully unwound well before track-out while rolling speed was sacrificed
    let earlyUnwindSamples = 0;
    const midToExitWindow = Math.max(1, exitIndex - apexIndex);
    for (let i = apexIndex + Math.floor(midToExitWindow * 0.2); i <= exitIndex; i++) {
      if (Math.abs(samples[i].inputs.steering || 0) < this.steerThreshold) {
        earlyUnwindSamples++;
      }
    }
    const isLateApex = (earlyUnwindSamples > (midToExitWindow * 0.5)) && (apexSpeedMph < entrySpeedMph * 0.65) && (signedTapDistanceFeet > 20);

    // 9a. Corner Radius Estimation — ANALYSIS.md §4.3, Going Faster! Ch.2
    // R = v² / (15 × |lateralG|); v in mph, R in feet → convert to meters
    const apexLateralG = Math.abs(apexSample.motion.acceleration.lateralG || 0);
    const apexSpeedMphForRadius = mpsToMph(apexSample.motion.speedMps || 0);
    const cornerRadiusFeet = apexLateralG > 0.05
      ? (apexSpeedMphForRadius * apexSpeedMphForRadius) / (15 * apexLateralG)
      : 0;
    const cornerRadiusMeters = cornerRadiusFeet * 0.3048;
    const cornerRadiusEstimated = apexLateralG > 0.05;

    // 9b. Optimal Exit Speed — ANALYSIS.md §5.2, Going Faster! Ch.2 formula: v = √(15 × G × R)
    // Assumes 1.2G maximum cornering capability (class-agnostic benchmark)
    const GRIP_CEILING_G = 1.2;
    const optimalExitSpeedMph = cornerRadiusFeet > 0
      ? Math.sqrt(15 * GRIP_CEILING_G * cornerRadiusFeet)
      : 0;
    const optimalExitSpeedKmh = optimalExitSpeedMph * 1.60934;

    // 9. Extract Corner Segment Samples & Engine Stats
    const cornerSegment = samples.slice(entryIndex, exitIndex + 1);
    let minRpm = Infinity;
    let maxTireSlip = 0;
    let peakDecelG = 0;

    for (const s of cornerSegment) {
      const rpm = s.engine.currentRpm || 0;
      if (rpm > 0 && rpm < minRpm) minRpm = rpm;

      const decel = Math.abs(s.motion.acceleration.longitudinalG || 0);
      if (decel > peakDecelG) peakDecelG = decel;

      if (s.tires && s.tires.slipRatio) {
        const sr = Math.max(
          Math.abs(s.tires.slipRatio.frontLeft || 0),
          Math.abs(s.tires.slipRatio.frontRight || 0),
          Math.abs(s.tires.slipRatio.rearLeft || 0),
          Math.abs(s.tires.slipRatio.rearRight || 0)
        );
        if (sr > maxTireSlip) maxTireSlip = sr;
      }
    }

    // 10. Trail-Brake Quality Assessment — ANALYSIS.md §6.2, Going Faster! Ch.5
    // Measures balance between brake-release rate and steering-increase rate through turn-in to apex.
    // Ideal balance ratio = 1.0 (symmetric release and rotation).
    const trailZoneLen = Math.max(1, apexIndex - turnInIndex);
    const brakeAtTurnIn = samples[turnInIndex]?.inputs?.brake || 0;
    const brakeAtApex = apexSample.inputs?.brake || 0;
    const steerAtTurnIn = Math.abs(samples[turnInIndex]?.inputs?.steering || 0);
    const steerAtApex = Math.abs(apexSample.inputs?.steering || 0);
    const trailBrakeReleaseRate = (brakeAtTurnIn - brakeAtApex) / trailZoneLen;
    const trailSteeringIncreaseRate = (steerAtApex - steerAtTurnIn) / trailZoneLen;
    const trailBrakeBalanceRatio = trailSteeringIncreaseRate > 0.001
      ? trailBrakeReleaseRate / trailSteeringIncreaseRate
      : 0;
    const trailBalanceScore = Math.max(0, 1 - Math.abs(trailBrakeBalanceRatio - 1.0));
    const overlapScore = Math.min(1, (brakeAtTurnIn * steerAtApex) / 0.1);
    const trailQuality = (trailBalanceScore * 0.6 + overlapScore * 0.4) * 100;
    let trailBrakeQualityLabel;
    if (trailQuality > 80) trailBrakeQualityLabel = 'EXCELLENT';
    else if (trailQuality > 60) trailBrakeQualityLabel = 'GOOD';
    else if (trailQuality > 40) trailBrakeQualityLabel = 'FAIR';
    else trailBrakeQualityLabel = 'POOR';

    // 11. Exit Speed Efficiency Block — ANALYSIS.md §5.1, Going Faster! Ch.2
    const exitSpeedBlock = this.calcExitSpeedBlock(
      samples, apexIndex, exitIndex, exitSpeedMph, optimalExitSpeedMph, tapIndex, scanForwardLimit
    );

    const entrySample = samples[entryIndex];
    const exitSample = samples[exitIndex];

    return {
      cornerNumber: apexInfo.cornerNumber,
      name: apexInfo.name || `Turn ${apexInfo.cornerNumber}`,
      type: apexInfo.type,
      canonical: !!apexInfo.canonical,
      refSpeed: apexInfo.refSpeed || null,
      refGear: apexInfo.refGear || null,
      indexes: {
        brake: brakeIndex,
        turnIn: turnInIndex,
        entry: entryIndex,
        apex: apexIndex,
        tap: tapIndex,
        exit: exitIndex,
        postApexCorrection: postApexCorrectionIndex
      },
      speed: {
        entryMph: entrySpeedMph,
        apexMph: apexSpeedMph,
        exitMph: exitSpeedMph,
        entryKmh: mpsToKmh(entrySample.motion.speedMps),
        apexKmh: mpsToKmh(apexSample.motion.speedMps),
        exitKmh: mpsToKmh(exitSample.motion.speedMps),
        entryMps: entrySample.motion.speedMps,
        apexMps: apexSample.motion.speedMps,
        exitMps: exitSample.motion.speedMps,
        deltaExitVsApexMph: exitSpeedMph - apexSpeedMph,
        deltaExitVsApexKmh: mpsToKmh(exitSample.motion.speedMps) - mpsToKmh(apexSample.motion.speedMps)
      },
      inputs: {
        entryBrakePressure: entrySample.inputs.brake,
        peakBrakePressure: maxBrakePressure,
        apexBrakePressure: apexSample.inputs.brake,
        apexSteering: apexSample.inputs.steering,
        gear: apexSample.inputs.gear,
        minRpm: minRpm === Infinity ? 0 : minRpm,
        exitRpm: exitSample.engine.currentRpm || 0,
        maxRpm: apexSample.engine.maxRpm || 8000
      },
      dynamics: {
        tapDeltaFeet: signedTapDistanceFeet,
        tapDeltaMeters: signedTapDistanceMeters,
        trailBrakingOverlapPercent: Math.round(trailBrakingOverlapRatio * 100),
        maxBrakeReleaseRate,
        peakDecelG,
        maxTireSlipRatio: maxTireSlip,
        apexLateralG: apexLateralG,
        postApexSteerCorrectionDeg: Number(postApexSteerCorrectionDeg.toFixed(1)),
        isEarlyApex: postApexSteerCorrectionDeg > 5.0,
        isLateApex,
        // ANALYSIS.md §4.3 — Corner geometry
        cornerRadiusFeet: Number(cornerRadiusFeet.toFixed(1)),
        cornerRadiusMeters: Number(cornerRadiusMeters.toFixed(1)),
        cornerRadiusEstimated,
        // ANALYSIS.md §5.2 — Optimal exit speed
        optimalExitSpeedMph: Number(optimalExitSpeedMph.toFixed(1)),
        optimalExitSpeedKmh: Number(optimalExitSpeedKmh.toFixed(1)),
        exitEfficiencyPercent: optimalExitSpeedMph > 0
          ? Math.min(100, Math.round((exitSpeedMph / optimalExitSpeedMph) * 100))
          : 0,
        // ANALYSIS.md §6.2 — Trail-brake quality
        trailBrakeQualityLabel,
        trailBrakeBalanceRatio: Number(trailBrakeBalanceRatio.toFixed(2))
      },
      // ANALYSIS.md §5.1 — Exit speed efficiency block
      exitSpeed: exitSpeedBlock
    };
  }

  /**
   * Calculates the exit speed efficiency block per ANALYSIS.md §5.1
   * @param {Array<Object>} samples
   * @param {number} apexIndex
   * @param {number} exitIndex
   * @param {number} exitSpeedMph
   * @param {number} optimalExitSpeedMph
   * @param {number} tapIndex
   * @param {number} scanForwardLimit
   * @returns {Object} exitSpeed block
   */
  calcExitSpeedBlock(samples, apexIndex, exitIndex, exitSpeedMph, optimalExitSpeedMph, tapIndex, scanForwardLimit) {
    const n = samples.length;

    // TAP smoothness: variance of throttle rate over 30 samples post-apex
    const postApexEnd = Math.min(apexIndex + 30, scanForwardLimit, n - 1);
    let maxThrottleRate = 0;
    let prevThrottle = samples[apexIndex]?.inputs?.throttle || 0;
    let smoothnessVarianceSum = 0;
    let smoothCount = 0;

    for (let i = apexIndex + 1; i <= postApexEnd; i++) {
      const th = samples[i]?.inputs?.throttle || 0;
      const rate = Math.abs(th - prevThrottle);
      if (rate > maxThrottleRate) maxThrottleRate = rate;
      if (i > apexIndex + 1) {
        const prevRate = Math.abs(prevThrottle - (samples[i - 2]?.inputs?.throttle || 0));
        smoothnessVarianceSum += Math.abs(rate - prevRate);
        smoothCount++;
      }
      prevThrottle = th;
    }
    const smoothnessNormalized = smoothCount > 0 ? smoothnessVarianceSum / smoothCount : 0;
    const tapSmoothness = Number(Math.max(0, 1 - smoothnessNormalized / 0.2).toFixed(2));

    // Exit speed efficiency
    const exitEfficiencyPercent = optimalExitSpeedMph > 0
      ? Math.min(100, Math.round((exitSpeedMph / optimalExitSpeedMph) * 100))
      : 0;

    // Potential gain (Going Faster! Ch.8 heuristic)
    const idealEfficiency = 0.95;
    const currentEfficiency = exitEfficiencyPercent / 100;
    const potentialImprovementPct = Math.max(0, idealEfficiency - currentEfficiency);
    const potentialGainMph = Number((potentialImprovementPct * 100 * 0.3).toFixed(2));

    // Straight length: distance from exit to next 200 samples
    let straightLengthFt = 0;
    const straightEnd = Math.min(exitIndex + 200, n - 1);
    for (let i = exitIndex + 1; i <= straightEnd; i++) {
      const p1 = samples[i - 1].motion.position;
      const p2 = samples[i].motion.position;
      const dx = (p2.x || 0) - (p1.x || 0);
      const dy = (p2.y || 0) - (p1.y || 0);
      const dz = (p2.z || 0) - (p1.z || 0);
      straightLengthFt += Math.sqrt(dx * dx + dy * dy + dz * dz) * METERS_TO_FEET;
    }
    straightLengthFt = Number(straightLengthFt.toFixed(1));

    // Potential time gain on straight (1 mph = 1.5 ft/s advantage)
    const exitSpeedFtPerSec = exitSpeedMph * 1.46667;
    const potentialGainSeconds = exitSpeedFtPerSec > 0 && straightLengthFt > 0
      ? Number(((potentialGainMph * 1.5 * straightLengthFt) / exitSpeedFtPerSec).toFixed(3))
      : 0;

    // Type I corner: speed gain > 30 mph over next 200 samples (leads to a significant straight)
    const futureSpeedMph = exitIndex + 200 < n
      ? mpsToMph(samples[Math.min(exitIndex + 200, n - 1)].motion.speedMps || 0)
      : exitSpeedMph;
    const isTypeI = (futureSpeedMph - exitSpeedMph) > 30;

    return {
      tapSmoothness,
      exitEfficiencyPercent,
      potentialGainMph,
      potentialGainSeconds,
      straightLengthFt,
      isTypeI,
      priority: isTypeI ? 'HIGH' : 'MEDIUM'
    };
  }
}
