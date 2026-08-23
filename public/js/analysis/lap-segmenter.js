/**
 * APEX Lap Segmentation Engine (Browser Client)
 */
export class LapSegmenter {
  constructor(options = {}) {
    this.minLapSamples = options.minLapSamples || 180;
    this.minLapDurationSec = options.minLapDurationSec || 15.0;
  }

  segmentStint(samples) {
    if (!samples || samples.length === 0) return [];
    const lapGroups = new Map();

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const lapNum = sample.timing && sample.timing.lapNumber !== undefined ? sample.timing.lapNumber : 1;
      if (!lapGroups.has(lapNum)) lapGroups.set(lapNum, []);
      lapGroups.get(lapNum).push({ sample, globalIndex: i });
    }

    const laps = [];
    const minGroupKey = lapGroups.size > 0 ? Math.min(...lapGroups.keys()) : 1;
    const offset = minGroupKey === 0 ? 1 : 0;
    let sequentialLapIndex = 1;

    for (const [groupLapNumber, indexedSamples] of lapGroups.entries()) {
      if (indexedSamples.length < this.minLapSamples) continue;

      const rawSamples = indexedSamples.map(item => item.sample);
      const startSample = rawSamples[0];
      const endSample = rawSamples[rawSamples.length - 1];

      let lapTime = 0;
      if (endSample.timing && endSample.timing.lastLapTime > 0 && sequentialLapIndex > 1) {
        lapTime = endSample.timing.lastLapTime;
      } else if (endSample.timing && endSample.timing.currentLapTime > 0) {
        lapTime = endSample.timing.currentLapTime;
      } else {
        lapTime = (endSample.timestampMs - startSample.timestampMs) / 1000.0;
      }

      const isValid = lapTime >= this.minLapDurationSec && rawSamples.length >= this.minLapSamples;
      let maxSpeedMps = 0;
      let minSpeedMps = Infinity;
      let totalSpeedMps = 0;

      for (let i = 0; i < rawSamples.length; i++) {
        const spd = rawSamples[i].motion.speedMps || 0;
        if (spd > maxSpeedMps) maxSpeedMps = spd;
        if (spd < minSpeedMps) minSpeedMps = spd;
        totalSpeedMps += spd;
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
        maxSpeedMph: maxSpeedMps * 2.236936,
        minSpeedMph: (minSpeedMps === Infinity ? 0 : minSpeedMps) * 2.236936,
        avgSpeedMph: avgSpeedMps * 2.236936,
        samples: rawSamples
      });
      sequentialLapIndex++;
    }
    return laps;
  }
}
