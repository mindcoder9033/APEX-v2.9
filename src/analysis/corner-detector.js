/**
 * APEX Deterministic Corner Detector
 * Identifies track apexes and cornering zones using speed minima detection,
 * steering threshold validation, and lateral G-force confirmation.
 */

import { RAD_TO_DEG } from '../shared/telemetry-types.js';

export class CornerDetector {
  constructor(options = {}) {
    this.minSteeringAngleNorm = options.minSteeringAngleNorm || 0.04; // ~5 degrees (5/127)
    this.minLateralG = options.minLateralG || 0.30;
    this.smoothWindow = options.smoothWindow || 5;
    this.apexMergeWindow = options.apexMergeWindow || 50; // Merge minima within ~0.8s
  }

  /**
   * Detects apexes across a lap's sample sequence
   * @param {Array<Object>} samples 
   * @returns {Array<{ apexIndex: number, type: string, apexSample: Object }>}
   */
  detectApexes(samples) {
    if (!samples || samples.length < 20) {
      return [];
    }

    const n = samples.length;
    const smoothedSpeed = this.smoothTrace(samples.map(s => s.motion.speedMps || 0));
    const potentialApexes = [];

    // Find local minima in smoothed speed profile
    const pad = Math.floor(this.smoothWindow / 2) + 2;
    for (let i = pad; i < n - pad; i++) {
      const spd = smoothedSpeed[i];
      const isMin =
        spd <= smoothedSpeed[i - 1] &&
        spd <= smoothedSpeed[i - 2] &&
        spd <= smoothedSpeed[i + 1] &&
        spd <= smoothedSpeed[i + 2];

      if (isMin) {
        const s = samples[i];
        const steer = Math.abs(s.inputs.steering || 0);
        const latG = Math.abs(s.motion.acceleration.lateralG || 0);

        // Verify that vehicle is actively cornering (steering or lateral G)
        if (steer >= this.minSteeringAngleNorm || latG >= this.minLateralG) {
          potentialApexes.push({
            apexIndex: i,
            speed: spd,
            steer: s.inputs.steering,
            latG: s.motion.acceleration.lateralG,
            yaw: s.motion?.orientation?.yaw || 0,
            sample: s
          });
        }
      }
    }

    // Merge and deduplicate nearby apex detections
    const merged = this.mergeAdjacentApexes(potentialApexes, samples);

    // Classify corner type (Left, Right, Hairpin)
    return merged.map((item, idx) => {
      const type = this.classifyCornerType(item, samples);
      return {
        cornerNumber: idx + 1,
        apexIndex: item.apexIndex,
        type,
        apexSample: samples[item.apexIndex]
      };
    });
  }

  /**
   * Applies centered moving average smoothing to eliminate sensor noise
   */
  smoothTrace(data) {
    const smoothed = new Array(data.length);
    const half = Math.floor(this.smoothWindow / 2);

    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = -half; j <= half; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < data.length) {
          sum += data[idx];
          count++;
        }
      }
      smoothed[i] = count > 0 ? sum / count : data[i];
    }
    return smoothed;
  }

  /**
   * Merges multiple local minima that belong to the same corner
   */
  mergeAdjacentApexes(apexes, samples) {
    if (apexes.length <= 1) return apexes;

    const result = [];
    let currentCluster = [apexes[0]];

    for (let i = 1; i < apexes.length; i++) {
      const current = apexes[i];
      const prev = currentCluster[currentCluster.length - 1];

      if (current.apexIndex - prev.apexIndex <= this.apexMergeWindow) {
        currentCluster.push(current);
      } else {
        // Find the absolute minimum speed within the cluster
        let lowest = currentCluster[0];
        for (const item of currentCluster) {
          if (item.speed < lowest.speed) {
            lowest = item;
          }
        }
        result.push(lowest);
        currentCluster = [current];
      }
    }

    if (currentCluster.length > 0) {
      let lowest = currentCluster[0];
      for (const item of currentCluster) {
        if (item.speed < lowest.speed) {
          lowest = item;
        }
      }
      result.push(lowest);
    }

    return result;
  }

  /**
   * Classifies corner into Left, Right, or Hairpin
   */
  classifyCornerType(apex, samples) {
    const idx = apex.apexIndex;
    const preIdx = Math.max(0, idx - 25);
    const postIdx = Math.min(samples.length - 1, idx + 25);

    const yawDeltaRad = (samples[postIdx].motion.orientation.yaw || 0) - (samples[preIdx].motion.orientation.yaw || 0);
    const yawDeltaDeg = Math.abs(yawDeltaRad * RAD_TO_DEG);

    if (yawDeltaDeg > 60 || Math.abs(apex.latG) > 1.3) {
      return 'Hairpin';
    }

    if (apex.steer > 0 || apex.latG > 0) {
      return 'Right';
    } else {
      return 'Left';
    }
  }
}
