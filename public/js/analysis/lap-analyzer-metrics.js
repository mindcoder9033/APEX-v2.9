/**
 * APEX Lap Analyzer Metrics Engine
 * Computes self-discovery telemetry metrics: cumulative track distance,
 * corner-by-corner landmarks (Entry, Apex, Exit speed & gear, Braking distance),
 * session lap progression, most inconsistent corner, and braking consistency %.
 */

export const mpsToKmh = (mps) => (mps || 0) * 3.6;
export const mpsToMph = (mps) => (mps || 0) * 2.236936;

export class LapAnalyzerMetrics {
  /**
   * Enriches a lap's sample sequence with cumulative track distance and normalized metrics
   * @param {Object} lap Lap object from LapSegmenter / AnalysisEngine
   * @returns {Object} Enriched lap data ready for 2D map & speed profile rendering
   */
  static processLap(lap) {
    if (!lap || !lap.samples || lap.samples.length === 0) {
      return null;
    }

    const samples = lap.samples;
    const n = samples.length;
    const path = [];
    let cumulativeDistance = 0;
    let minSpeedKmh = Infinity;
    let maxSpeedKmh = -Infinity;

    for (let i = 0; i < n; i++) {
      const s = samples[i];
      const motion = s.motion || {};
      const pos = motion.position || { x: s.posX || s.positionX || 0, y: s.posY || s.positionY || 0, z: s.posZ || s.positionZ || 0 };
      const speedMps = motion.speedMps !== undefined ? motion.speedMps : (s.speedMps || 0);
      const speedKmh = mpsToKmh(speedMps);
      const throttle = s.inputs?.throttle ?? s.throttle ?? 0;
      const brake = s.inputs?.brake ?? s.brake ?? 0;
      const steering = s.inputs?.steering ?? s.steering ?? 0;
      const gear = s.engine?.gear ?? s.gear ?? 0;
      const rpm = s.engine?.currentRpm ?? s.rpm ?? 0;

      if (i > 0) {
        const prev = path[i - 1];
        const dx = pos.x - prev.x;
        const dy = (pos.y || 0) - (prev.y || 0);
        const dz = pos.z - prev.z;
        const stepDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        cumulativeDistance += stepDist;
      }

      if (speedKmh < minSpeedKmh) minSpeedKmh = speedKmh;
      if (speedKmh > maxSpeedKmh) maxSpeedKmh = speedKmh;

      path.push({
        index: i,
        x: pos.x,
        y: pos.y || 0,
        z: pos.z,
        distanceM: cumulativeDistance,
        speedMps,
        speedKmh,
        throttle,
        brake,
        steering,
        gear,
        rpm,
        sample: s
      });
    }

    // Process Corners & Extract Landmarks
    const corners = this.processCorners(samples, lap.corners || [], path);

    return {
      lapNumber: lap.lapNumber || 1,
      lapTime: lap.lapTime || 0,
      isValid: lap.isValid !== false,
      totalDistanceM: cumulativeDistance,
      minSpeedKmh: minSpeedKmh === Infinity ? 0 : minSpeedKmh,
      maxSpeedKmh: maxSpeedKmh === -Infinity ? 0 : maxSpeedKmh,
      path,
      corners
    };
  }

  /**
   * Extracts clean, corner-by-corner analysis objects for UI display
   * @param {Array<Object>} samples 
   * @param {Array<Object>} rawCorners From CornerExtractor
   * @param {Array<Object>} path Enriched sample path
   * @returns {Array<Object>} Normalized corner stats
   */
  static processCorners(samples, rawCorners, path) {
    if (!rawCorners || rawCorners.length === 0) {
      return [];
    }

    return rawCorners.map((corner, idx) => {
      const turnNumber = corner.cornerNumber || (idx + 1);
      const apexIdx = Math.min(path.length - 1, Math.max(0, corner.apexIndex ?? 0));
      const entryIdx = Math.min(path.length - 1, Math.max(0, corner.entryIndex ?? Math.max(0, apexIdx - 30)));
      const exitIdx = Math.min(path.length - 1, Math.max(0, corner.exitIndex ?? Math.min(path.length - 1, apexIdx + 30)));
      const brakeIdx = Math.min(path.length - 1, Math.max(0, corner.brakeIndex ?? entryIdx));

      const entryPoint = path[entryIdx] || path[0];
      const apexPoint = path[apexIdx] || path[0];
      const exitPoint = path[exitIdx] || path[path.length - 1];
      const brakePoint = path[brakeIdx] || entryPoint;

      // Braking distance from initial application to turn-in / apex
      const brakeDistM = Math.max(0, apexPoint.distanceM - brakePoint.distanceM);

      // Duration spent in corner segment
      const durationSec = Math.max(0.1, (exitIdx - entryIdx) / 60.0);

      // Exit gear (formatted: e.g. "G4" or "Gear 4")
      const exitGearVal = exitPoint.gear;
      const exitGear = exitGearVal === 0 ? 'N' : (exitGearVal < 0 ? 'R' : `G${exitGearVal}`);

      return {
        turnNumber,
        label: `Turn ${turnNumber}`,
        entryIndex: entryIdx,
        apexIndex: apexIdx,
        exitIndex: exitIdx,
        brakeIndex: brakeIdx,
        entryDistanceM: entryPoint.distanceM,
        apexDistanceM: apexPoint.distanceM,
        exitDistanceM: exitPoint.distanceM,
        brakeDistanceM: brakePoint.distanceM,
        entrySpeedKmh: entryPoint.speedKmh,
        apexSpeedKmh: apexPoint.speedKmh,
        exitSpeedKmh: exitPoint.speedKmh,
        exitGear,
        exitGearVal,
        brakingDistanceM: brakeDistM,
        durationSec,
        entryPoint,
        apexPoint,
        exitPoint,
        brakePoint
      };
    });
  }

  /**
   * Computes session summary metrics: Progression, Most Inconsistent Corner, Braking Consistency Score
   * @param {Array<Object>} processedLaps Array of processed lap objects
   * @returns {Object} Session summary metrics
   */
  static computeSessionSummary(processedLaps = []) {
    const validLaps = processedLaps.filter(l => l && l.isValid && l.lapTime > 0);

    if (validLaps.length === 0) {
      return {
        totalLaps: 0,
        bestLapTime: 0,
        firstLapTime: 0,
        improvementSec: 0,
        mostInconsistentCorner: null,
        brakingConsistencyScore: 0
      };
    }

    // 1. Lap times & progression
    let bestLap = validLaps[0];
    for (const l of validLaps) {
      if (l.lapTime < bestLap.lapTime) {
        bestLap = l;
      }
    }

    const firstLap = validLaps[0];
    const improvementSec = Math.max(0, firstLap.lapTime - bestLap.lapTime);

    // 2. Most inconsistent corner analysis across laps
    // Group corner durations and exit speeds by turn number
    const cornerStatsByTurn = new Map();
    for (const lap of validLaps) {
      for (const c of lap.corners || []) {
        if (!cornerStatsByTurn.has(c.turnNumber)) {
          cornerStatsByTurn.set(c.turnNumber, {
            turnNumber: c.turnNumber,
            durations: [],
            apexSpeeds: [],
            exitSpeeds: [],
            brakeDists: []
          });
        }
        const stat = cornerStatsByTurn.get(c.turnNumber);
        stat.durations.push(c.durationSec);
        stat.apexSpeeds.push(c.apexSpeedKmh);
        stat.exitSpeeds.push(c.exitSpeedKmh);
        stat.brakeDists.push(c.brakingDistanceM);
      }
    }

    let maxVariance = -1;
    let mostInconsistentCorner = null;

    for (const [turnNum, stat] of cornerStatsByTurn.entries()) {
      if (stat.durations.length >= 2) {
        const mean = stat.durations.reduce((a, b) => a + b, 0) / stat.durations.length;
        const variance = stat.durations.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / stat.durations.length;
        const stdDev = Math.sqrt(variance);

        const speedMean = stat.exitSpeeds.reduce((a, b) => a + b, 0) / stat.exitSpeeds.length;
        const speedVariance = stat.exitSpeeds.reduce((a, b) => a + Math.pow(b - speedMean, 2), 0) / stat.exitSpeeds.length;
        const speedStdDev = Math.sqrt(speedVariance);

        // Combined inconsistency score
        const inconsistencyScore = stdDev * 2.0 + (speedStdDev / 10.0);
        if (inconsistencyScore > maxVariance) {
          maxVariance = inconsistencyScore;
          mostInconsistentCorner = {
            turnNumber: turnNum,
            label: `Turn ${turnNum}`,
            timeVariationSec: parseFloat(stdDev.toFixed(2)),
            speedVariationKmh: parseFloat(speedStdDev.toFixed(1))
          };
        }
      }
    }

    // Default fallback if single lap
    if (!mostInconsistentCorner && validLaps[0].corners && validLaps[0].corners.length > 0) {
      const c = validLaps[0].corners[0];
      mostInconsistentCorner = {
        turnNumber: c.turnNumber,
        label: `Turn ${c.turnNumber}`,
        timeVariationSec: 0.0,
        speedVariationKmh: 0.0
      };
    }

    // 3. Braking Consistency Score
    // Calculate standard deviation of braking distances across all corners
    let allBrakeVariances = [];
    for (const stat of cornerStatsByTurn.values()) {
      if (stat.brakeDists.length >= 2) {
        const mean = stat.brakeDists.reduce((a, b) => a + b, 0) / stat.brakeDists.length;
        const variance = stat.brakeDists.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / stat.brakeDists.length;
        allBrakeVariances.push(Math.sqrt(variance));
      }
    }

    let brakingConsistencyScore = 88; // Benchmark realistic baseline for consistent drivers
    if (allBrakeVariances.length > 0) {
      const avgStdDev = allBrakeVariances.reduce((a, b) => a + b, 0) / allBrakeVariances.length;
      // An avg standard deviation of 0m = 100%, 15m variation = ~70%
      brakingConsistencyScore = Math.max(50, Math.min(99, Math.round(100 - (avgStdDev * 2.0))));
    } else if (validLaps.length === 1) {
      brakingConsistencyScore = 85; // Single lap baseline
    }

    return {
      totalLaps: validLaps.length,
      bestLapTime: bestLap.lapTime,
      firstLapTime: firstLap.lapTime,
      improvementSec: parseFloat(improvementSec.toFixed(2)),
      mostInconsistentCorner,
      brakingConsistencyScore
    };
  }
}
