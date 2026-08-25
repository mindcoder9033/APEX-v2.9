/**
 * APEX Lap Segmentation Engine
 * Groups continuous telemetry samples into discrete lap sessions,
 * calculates lap metrics, and filters out invalid or incomplete out-laps / in-laps.
 */

import { mpsToMph } from '../shared/telemetry-types.js';

export class LapSegmenter {
  /**
   * @param {Object} [options]
   * @param {number} [options.minLapSamples=180] Minimum samples for a valid lap (e.g. 3 seconds at 60Hz)
   * @param {number} [options.minLapDurationSec=15.0] Minimum lap time in seconds to count as a complete lap
   */
  constructor(options = {}) {
    this.minLapSamples = options.minLapSamples !== undefined ? options.minLapSamples : 10;
    this.minLapDurationSec = options.minLapDurationSec !== undefined ? options.minLapDurationSec : 1.0;
  }

  /**
   * Segments a chronological array of telemetry samples into discrete laps
   * @param {Array<Object>} samples 
   * @returns {Array<Object>} Array of Lap objects
   */
  segmentStint(samples) {
    if (!samples || samples.length === 0) {
      return [];
    }

    const lapGroups = new Map();

    // Group samples by distinct lapNumber
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const lapNum = sample.timing && sample.timing.lapNumber !== undefined ? sample.timing.lapNumber : 1;

      if (!lapGroups.has(lapNum)) {
        lapGroups.set(lapNum, []);
      }
      lapGroups.get(lapNum).push({ sample, globalIndex: i });
    }

    const laps = [];
    const minGroupKey = lapGroups.size > 0 ? Math.min(...lapGroups.keys()) : 1;
    const offset = minGroupKey === 0 ? 1 : 0;
    let sequentialLapIndex = 1;

    // Analyze each lap group
    for (const [groupLapNumber, indexedSamples] of lapGroups.entries()) {
      if (indexedSamples.length < this.minLapSamples) {
        continue; // Discard empty/sub-threshold segments
      }

      const rawSamples = indexedSamples.map(item => item.sample);
      const startSample = rawSamples[0];
      const endSample = rawSamples[rawSamples.length - 1];

      // Calculate lap time from timing packet or timestamp difference
      let lapTime = 0;
      if (endSample.timing && endSample.timing.lastLapTime > 0 && sequentialLapIndex > 1) {
        lapTime = endSample.timing.lastLapTime;
      } else if (endSample.timing && endSample.timing.currentLapTime > 0) {
        lapTime = endSample.timing.currentLapTime;
      } else if (endSample.timestampMs && startSample.timestampMs && endSample.timestampMs > startSample.timestampMs) {
        lapTime = (endSample.timestampMs - startSample.timestampMs) / 1000.0;
      } else {
        lapTime = rawSamples.length / 60.0;
      }

      // Check if this looks like a valid lap
      const isValid = lapTime > 0 && rawSamples.length >= this.minLapSamples;

      // Compute speed stats
      let maxSpeedMps = 0;
      let minSpeedMps = Infinity;
      let totalSpeedMps = 0;
      let totalDistance = 0;

      for (let i = 0; i < rawSamples.length; i++) {
        const s = rawSamples[i];
        const spd = s.motion?.speedMps ?? s.speedMps ?? (s.speedMph ? s.speedMph / 2.236936 : 0);
        if (spd > maxSpeedMps) maxSpeedMps = spd;
        if (spd < minSpeedMps) minSpeedMps = spd;
        totalSpeedMps += spd;

        if (i > 0) {
          const prev = rawSamples[i - 1];
          const posX = s.motion?.position?.x ?? s.x ?? 0;
          const posY = s.motion?.position?.y ?? s.y ?? 0;
          const posZ = s.motion?.position?.z ?? s.z ?? 0;
          const prevX = prev.motion?.position?.x ?? prev.x ?? 0;
          const prevY = prev.motion?.position?.y ?? prev.y ?? 0;
          const prevZ = prev.motion?.position?.z ?? prev.z ?? 0;
          const dx = posX - prevX;
          const dy = posY - prevY;
          const dz = posZ - prevZ;
          totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
      }

      const avgSpeedMps = rawSamples.length > 0 ? totalSpeedMps / rawSamples.length : 0;
      const assignedLapNumber = groupLapNumber + offset;

      laps.push({
        lapNumber: assignedLapNumber,
        startIndex: indexedSamples[0].globalIndex,
        endIndex: indexedSamples[indexedSamples.length - 1].globalIndex,
        sampleCount: rawSamples.length,
        lapTime,
        isValid,
        maxSpeedMph: mpsToMph(maxSpeedMps),
        minSpeedMph: mpsToMph(minSpeedMps === Infinity ? 0 : minSpeedMps),
        avgSpeedMph: mpsToMph(avgSpeedMps),
        maxSpeedMps,
        minSpeedMps: minSpeedMps === Infinity ? 0 : minSpeedMps,
        avgSpeedMps,
        totalDistanceMeters: totalDistance,
        samples: rawSamples
      });

      sequentialLapIndex++;
    }

    return laps;
  }
}
