/**
 * APEX Deterministic Corner Detector (Browser Client)
 */
export class CornerDetector {
  constructor(options = {}) {
    this.minSteeringAngleNorm = options.minSteeringAngleNorm || 0.04;
    this.minLateralG = options.minLateralG || 0.30;
    this.smoothWindow = options.smoothWindow || 5;
    this.apexMergeWindow = options.apexMergeWindow || 50;
  }

  detectApexes(samples) {
    if (!samples || samples.length < 20) return [];
    const n = samples.length;
    const smoothedSpeed = this.smoothTrace(samples.map(s => s.motion.speedMps || 0));
    const potentialApexes = [];

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

        if (steer >= this.minSteeringAngleNorm || latG >= this.minLateralG) {
          potentialApexes.push({
            apexIndex: i,
            speed: spd,
            steer: s.inputs.steering,
            latG: s.motion.acceleration.lateralG,
            sample: s
          });
        }
      }
    }

    const merged = this.mergeAdjacentApexes(potentialApexes, samples);
    return merged.map((item, idx) => ({
      cornerNumber: idx + 1,
      apexIndex: item.apexIndex,
      type: item.steer > 0 || item.latG > 0 ? 'Right' : 'Left',
      apexSample: samples[item.apexIndex]
    }));
  }

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
        let lowest = currentCluster[0];
        for (const item of currentCluster) {
          if (item.speed < lowest.speed) lowest = item;
        }
        result.push(lowest);
        currentCluster = [current];
      }
    }

    if (currentCluster.length > 0) {
      let lowest = currentCluster[0];
      for (const item of currentCluster) {
        if (item.speed < lowest.speed) lowest = item;
      }
      result.push(lowest);
    }
    return result;
  }
}
