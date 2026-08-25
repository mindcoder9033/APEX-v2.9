/**
 * APEX Corner Feature Extractor (Browser Client)
 */
export const METERS_TO_FEET = 3.28084;

export class CornerExtractor {
  constructor(options = {}) {
    this.brakeThreshold = options.brakeThreshold || 0.10;
    this.throttleThreshold = options.throttleThreshold || 0.15;
    this.steerThreshold = options.steerThreshold || 0.04;
    this.maxScanSamples = options.maxScanSamples || 300;
  }

  extractAll(samples, detectedApexes) {
    if (!samples || samples.length === 0 || !detectedApexes || detectedApexes.length === 0) return [];
    return detectedApexes.map(apexInfo => this.extractCorner(samples, apexInfo));
  }

  extractCorner(samples, apexInfo) {
    const apexIndex = apexInfo.apexIndex;
    const apexSample = samples[apexIndex];
    const n = samples.length;

    let brakeIndex = apexIndex;
    let maxBrakePressure = 0;
    const scanBackLimit = Math.max(0, apexIndex - this.maxScanSamples);

    for (let i = apexIndex; i >= scanBackLimit; i--) {
      const b = samples[i].inputs.brake || 0;
      if (b > maxBrakePressure) maxBrakePressure = b;
      if (b >= this.brakeThreshold) {
        brakeIndex = i;
      } else if (maxBrakePressure > this.brakeThreshold && b < this.brakeThreshold) {
        brakeIndex = i + 1;
        break;
      }
    }

    let turnInIndex = apexIndex;
    for (let i = apexIndex; i >= scanBackLimit; i--) {
      const st = Math.abs(samples[i].inputs.steering || 0);
      if (st >= this.steerThreshold) {
        turnInIndex = i;
      } else {
        break;
      }
    }
    const entryIndex = Math.min(brakeIndex, turnInIndex);

    let tapIndex = apexIndex;
    const scanForwardLimit = Math.min(n - 1, apexIndex + this.maxScanSamples);

    for (let i = turnInIndex; i <= scanForwardLimit; i++) {
      const th = samples[i].inputs.throttle || 0;
      if (th >= this.throttleThreshold) {
        tapIndex = i;
        break;
      }
    }

    let exitIndex = apexIndex;
    for (let i = apexIndex; i <= scanForwardLimit; i++) {
      const st = Math.abs(samples[i].inputs.steering || 0);
      const th = samples[i].inputs.throttle || 0;
      if (st < this.steerThreshold && th > 0.60) {
        exitIndex = i;
        break;
      }
    }
    if (exitIndex === apexIndex) exitIndex = Math.min(n - 1, apexIndex + 40);

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

    const signedTapDistanceMeters = tapIndex >= apexIndex ? tapDistanceMeters : -tapDistanceMeters;
    const signedTapDistanceFeet = signedTapDistanceMeters * METERS_TO_FEET;

    // Trail-Braking Overlap % (Turn-In to Apex)
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

    // Brake Snap-Off Rate (max release rate dBrake/dt over ~100ms / 6 samples)
    let maxBrakeReleaseRate = 0;
    for (let i = entryIndex; i < apexIndex; i++) {
      const b1 = samples[i].inputs.brake || 0;
      const b2 = samples[Math.min(apexIndex, i + 6)].inputs.brake || 0;
      const releaseRate = (b1 - b2);
      if (releaseRate > maxBrakeReleaseRate) {
        maxBrakeReleaseRate = releaseRate;
      }
    }

    // Geometric Apex Fault Analysis
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
    const postApexSteerCorrectionDeg = postApexSteerDeltaNorm * 45.0;

    const entrySpeedMph = (samples[entryIndex].motion.speedMps || 0) * 2.236936;
    const apexSpeedMph = (apexSample.motion.speedMps || 0) * 2.236936;
    const exitSpeedMph = (samples[exitIndex].motion.speedMps || 0) * 2.236936;

    let earlyUnwindSamples = 0;
    const midToExitWindow = Math.max(1, exitIndex - apexIndex);
    for (let i = apexIndex + Math.floor(midToExitWindow * 0.2); i <= exitIndex; i++) {
      if (Math.abs(samples[i].inputs.steering || 0) < this.steerThreshold) {
        earlyUnwindSamples++;
      }
    }
    const isLateApex = (earlyUnwindSamples > (midToExitWindow * 0.5)) && (apexSpeedMph < entrySpeedMph * 0.65) && (signedTapDistanceFeet > 20);

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
        entryKmh: (entrySample.motion.speedMps || 0) * 3.6,
        apexKmh: (apexSample.motion.speedMps || 0) * 3.6,
        exitKmh: (exitSample.motion.speedMps || 0) * 3.6,
        entryMps: entrySample.motion.speedMps,
        apexMps: apexSample.motion.speedMps,
        exitMps: exitSample.motion.speedMps,
        deltaExitVsApexMph: exitSpeedMph - apexSpeedMph,
        deltaExitVsApexKmh: ((exitSample.motion.speedMps || 0) - (apexSample.motion.speedMps || 0)) * 3.6
      },
      inputs: {
        entryBrakePressure: entrySample.inputs.brake,
        peakBrakePressure: maxBrakePressure,
        apexBrakePressure: apexSample.inputs.brake,
        apexSteering: apexSample.inputs.steering,
        gear: apexSample.inputs.gear,
        exitRpm: exitSample.engine?.currentRpm || 0,
        maxRpm: apexSample.engine?.maxRpm || 8000
      },
      dynamics: {
        tapDeltaFeet: signedTapDistanceFeet,
        tapDeltaMeters: signedTapDistanceMeters,
        trailBrakingOverlapPercent: Math.round(trailBrakingOverlapRatio * 100),
        maxBrakeReleaseRate,
        postApexSteerCorrectionDeg: Number(postApexSteerCorrectionDeg.toFixed(1)),
        isEarlyApex: postApexSteerCorrectionDeg > 5.0,
        isLateApex,
        apexLateralG: Math.abs(apexSample.motion.acceleration?.lateralG || 0)
      }
    };
  }
}
