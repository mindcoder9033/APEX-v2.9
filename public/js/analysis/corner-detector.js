/**
 * APEX Deterministic Corner Detector (Client-Side)
 * Identifies track apexes and cornering zones using speed minima detection,
 * steering threshold validation, and lateral G-force confirmation.
 * Supports canonical turn snapping against Track Library profiles.
 */

const RAD_TO_DEG = 180 / Math.PI;

export class CornerDetector {
  constructor(options = {}) {
    this.minSteeringAngleNorm = options.minSteeringAngleNorm || 0.04; // ~5 degrees (5/127)
    this.minLateralG = options.minLateralG || 0.30;
    this.smoothWindow = options.smoothWindow || 5;
    this.apexMergeWindow = options.apexMergeWindow || 50; // Merge minima within ~0.8s
  }

  /**
   * Snaps lap samples to canonical Turn IDs defined in an active Track Profile.
   * If trackProfile is not available or has no turns, falls back to detectApexes.
   * @param {Array<Object>} samples 
   * @param {Object} trackProfile 
   * @returns {Array<Object>}
   */
  detectWithTrackProfile(samples, trackProfile) {
    if (!trackProfile || !Array.isArray(trackProfile.turns) || trackProfile.turns.length === 0) {
      return this.detectApexes(samples);
    }

    if (!samples || samples.length < 15) {
      return [];
    }

    const n = samples.length;
    const turns = trackProfile.turns;
    const matchedTurns = [];

    for (const turn of turns) {
      const entryDist = turn.entryDist || Math.max(0, turn.apexDist - 60);
      const exitDist = turn.exitDist || (turn.apexDist + 60);
      const apexDist = turn.apexDist || Math.round((entryDist + exitDist) / 2);

      // Find samples within the turn window
      let bestIdx = -1;
      let minSpeed = Infinity;

      for (let i = 0; i < n; i++) {
        const s = samples[i];
        const d = s.lapDistance ?? s.distance ?? (i * 15);

        if (d >= entryDist - 25 && d <= exitDist + 25) {
          const spd = s.motion?.speedMps ? s.motion.speedMps * 3.6 : (s.speedKmh || (s.speedMps || 0) * 3.6);
          if (spd < minSpeed) {
            minSpeed = spd;
            bestIdx = i;
          }
        }
      }

      if (bestIdx === -1) {
        let closestDistDelta = Infinity;
        for (let i = 0; i < n; i++) {
          const s = samples[i];
          const d = s.lapDistance ?? s.distance ?? (i * 15);
          const delta = Math.abs(d - apexDist);
          if (delta < closestDistDelta) {
            closestDistDelta = delta;
            bestIdx = i;
          }
        }
      }

      if (bestIdx !== -1) {
        const s = samples[bestIdx];
        const actualSpd = s.motion?.speedMps ? s.motion.speedMps * 3.6 : (s.speedKmh || (s.speedMps || 0) * 3.6);
        const actualGear = s.engine?.gear ?? s.gear ?? 3;
        const actualLatG = Math.abs(s.motion?.acceleration?.lateralG ?? s.accelY ?? s.lateralG ?? 0);

        matchedTurns.push({
          cornerNumber: turn.turnNumber,
          turnNumber: turn.turnNumber,
          name: turn.name || `Turn ${turn.turnNumber}`,
          type: turn.type || 'Medium Corner',
          direction: turn.direction || 'Right',
          apexIndex: bestIdx,
          apexSample: s,
          refSpeed: turn.refSpeed || 100,
          actualSpeed: Math.round(actualSpd),
          refGear: turn.refGear || 3,
          actualGear,
          apexLatG: turn.apexLatG || 1.2,
          actualLatG: Number(actualLatG.toFixed(2)),
          brakingDist: turn.brakingDist || 50,
          canonical: true
        });
      }
    }

    return matchedTurns;
  }

  /**
   * Detects apexes across a lap's sample sequence
   * @param {Array<Object>} samples 
   * @returns {Array<{ cornerNumber: number, apexIndex: number, type: string, apexSample: Object }>}
   */
  detectApexes(samples) {
    if (!samples || samples.length < 20) {
      return [];
    }

    const n = samples.length;
    const smoothedSpeed = this.smoothTrace(samples.map(s => s.motion?.speedMps ?? (s.speedMps || (s.speedKmh ? s.speedKmh / 3.6 : 0))));
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
        const steer = Math.abs(s.inputs?.steering ?? s.steering ?? 0);
        const latG = Math.abs(s.motion?.acceleration?.lateralG ?? s.accelY ?? s.lateralG ?? 0);

        if (steer >= this.minSteeringAngleNorm || latG >= this.minLateralG) {
          potentialApexes.push({
            apexIndex: i,
            speed: spd,
            steer: s.inputs?.steering ?? s.steering ?? 0,
            latG: s.motion?.acceleration?.lateralG ?? s.accelY ?? s.lateralG ?? 0,
            yaw: s.motion?.orientation?.yaw ?? s.yaw ?? 0,
            sample: s
          });
        }
      }
    }

    const merged = this.mergeAdjacentApexes(potentialApexes, samples);

    return merged.map((item, idx) => {
      const type = this.classifyCornerType(item, samples);
      return {
        cornerNumber: idx + 1,
        turnNumber: idx + 1,
        name: `Turn ${idx + 1}`,
        apexIndex: item.apexIndex,
        type,
        direction: (item.steer > 0 || item.latG > 0) ? 'Right' : 'Left',
        apexSample: samples[item.apexIndex],
        canonical: false
      };
    });
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

  classifyCornerType(apex, samples) {
    const idx = apex.apexIndex;
    const preIdx = Math.max(0, idx - 25);
    const postIdx = Math.min(samples.length - 1, idx + 25);

    const postYaw = samples[postIdx]?.motion?.orientation?.yaw ?? samples[postIdx]?.yaw ?? 0;
    const preYaw = samples[preIdx]?.motion?.orientation?.yaw ?? samples[preIdx]?.yaw ?? 0;
    const yawDeltaRad = postYaw - preYaw;
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
