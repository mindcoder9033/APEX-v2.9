/**
 * APEX Delta Lap Comparison Matrix & Corner Priority Ranking Engine (Browser Client)
 * Implements Sprint 8 (Phase 3) comparative analytics:
 * - Best Lap vs Average Lap baseline delta traces (ΔSpeed, ΔThrottle, ΔBrake, ΔTime)
 * - Segment-by-segment time loss attribution (Braking/Entry, Mid-Corner, Exit, Straights)
 * - Skip Barber Type I/II/III corner categorization and coaching priority ranking
 */

export const CORNER_TYPE = {
  TYPE_I: 'Type I',     // Leading onto a straightaway (Highest priority)
  TYPE_II: 'Type II',   // End of a straightaway (Medium priority)
  TYPE_III: 'Type III'  // Connecting / compromise corners (Lowest priority)
};

export const CORNER_TYPE_INFO = {
  [CORNER_TYPE.TYPE_I]: {
    priority: 1,
    priorityLabel: 'Highest (P1)',
    focus: 'Exit Speed & Early Throttle',
    description: 'Precedes a significant straightaway. Speed carried out of this corner compounds down the entire straight.'
  },
  [CORNER_TYPE.TYPE_II]: {
    priority: 2,
    priorityLabel: 'Medium (P2)',
    focus: 'Braking Efficiency & Entry Speed',
    description: 'Follows a high-speed straightaway. Heavy braking zone where threshold braking and deep entry matter most.'
  },
  [CORNER_TYPE.TYPE_III]: {
    priority: 3,
    priorityLabel: 'Lowest (P3)',
    focus: 'Positioning & Transition Flow',
    description: 'Connecting / compromise corner between turns. Sacrifice outright speed to optimize entry for the next corner.'
  }
};

export function mpsToMph(speedMps) {
  return (speedMps || 0) * 2.236936;
}

export class DeltaComparisonEngine {
  constructor(options = {}) {
    this.straightDistanceThresholdMeters = options.straightDistanceThresholdMeters || 120.0;
    this.numInterpolationPoints = options.numInterpolationPoints || 100;
  }

  /**
   * Classifies corners into Skip Barber Type I, II, or III
   * @param {Array<Object>} corners - Array of extracted corner objects
   * @param {Array<Object>} samples - Lap telemetry samples
   * @returns {Array<Object>} Corners enriched with Skip Barber classification
   */
  classifyCorners(corners, samples) {
    if (!corners || corners.length === 0) return [];
    if (!samples || samples.length === 0) {
      return corners.map(c => ({
        ...c,
        cornerType: CORNER_TYPE.TYPE_I,
        cornerTypeInfo: CORNER_TYPE_INFO[CORNER_TYPE.TYPE_I],
        classificationReason: 'Default assignment (insufficient telemetry)'
      }));
    }

    const n = corners.length;
    const classified = [];

    for (let i = 0; i < n; i++) {
      const currentCorner = corners[i];
      const prevCorner = i > 0 ? corners[i - 1] : corners[n - 1];
      const nextCorner = i < n - 1 ? corners[i + 1] : corners[0];

      // 1. Preceding straight distance
      let precedingDist = 0;
      const prevExitIdx = prevCorner.indexes ? prevCorner.indexes.exit : 0;
      const currEntryIdx = currentCorner.indexes ? currentCorner.indexes.entry : 0;

      if (currEntryIdx > prevExitIdx) {
        precedingDist = this._calculateDistanceBetween(samples, prevExitIdx, currEntryIdx);
      } else {
        precedingDist = this._calculateDistanceBetween(samples, prevExitIdx, samples.length - 1) +
                        this._calculateDistanceBetween(samples, 0, currEntryIdx);
      }

      // 2. Succeeding straight distance
      let succeedingDist = 0;
      const currExitIdx = currentCorner.indexes ? currentCorner.indexes.exit : 0;
      const nextEntryIdx = nextCorner.indexes ? nextCorner.indexes.entry : 0;

      if (nextEntryIdx > currExitIdx) {
        succeedingDist = this._calculateDistanceBetween(samples, currExitIdx, nextEntryIdx);
      } else {
        succeedingDist = this._calculateDistanceBetween(samples, currExitIdx, samples.length - 1) +
                         this._calculateDistanceBetween(samples, 0, nextEntryIdx);
      }

      // 3. Skip Barber Classification
      let cornerType = CORNER_TYPE.TYPE_III;
      let reason = '';

      if (succeedingDist >= this.straightDistanceThresholdMeters && succeedingDist >= precedingDist * 1.15) {
        cornerType = CORNER_TYPE.TYPE_I;
        reason = `Leads onto a long straight (${Math.round(succeedingDist)}m). Exit speed is paramount.`;
      } else if (precedingDist >= this.straightDistanceThresholdMeters && precedingDist > succeedingDist * 1.15) {
        cornerType = CORNER_TYPE.TYPE_II;
        reason = `Follows a high-speed straight (${Math.round(precedingDist)}m). Heavy threshold braking zone.`;
      } else if (succeedingDist >= this.straightDistanceThresholdMeters && precedingDist >= this.straightDistanceThresholdMeters) {
        cornerType = CORNER_TYPE.TYPE_I;
        reason = `Connects two major straights (${Math.round(precedingDist)}m in, ${Math.round(succeedingDist)}m out). Prioritize exit drive.`;
      } else {
        cornerType = CORNER_TYPE.TYPE_III;
        reason = `Connecting / complex section (${Math.round(precedingDist)}m in, ${Math.round(succeedingDist)}m out). Line and positioning dominate.`;
      }

      classified.push({
        ...currentCorner,
        cornerType,
        cornerTypeInfo: CORNER_TYPE_INFO[cornerType],
        classificationReason: reason,
        precedingStraightMeters: Number(precedingDist.toFixed(1)),
        succeedingStraightMeters: Number(succeedingDist.toFixed(1))
      });
    }

    return classified;
  }

  /**
   * Resamples and aligns telemetry traces between a baseline lap and comparison lap
   */
  alignLapTraces(baselineSamples, targetSamples, numPoints = this.numInterpolationPoints) {
    if (!baselineSamples || baselineSamples.length === 0 || !targetSamples || targetSamples.length === 0) {
      return [];
    }

    const baselineTotalDist = this._calculateLapCumulativeDistance(baselineSamples);
    const targetTotalDist = this._calculateLapCumulativeDistance(targetSamples);

    const alignedPoints = [];
    const maxPoints = Math.max(10, numPoints);

    for (let i = 0; i <= maxPoints; i++) {
      const progress = i / maxPoints;
      const baseDistTarget = progress * baselineTotalDist[baselineTotalDist.length - 1];
      const targDistTarget = progress * targetTotalDist[targetTotalDist.length - 1];

      const baseSample = this._interpolateSampleAtDistance(baselineSamples, baselineTotalDist, baseDistTarget);
      const targSample = this._interpolateSampleAtDistance(targetSamples, targetTotalDist, targDistTarget);

      const baseSpeedMph = mpsToMph(baseSample.speedMps);
      const targSpeedMph = mpsToMph(targSample.speedMps);
      const deltaSpeedMph = targSpeedMph - baseSpeedMph;
      const deltaThrottle = (targSample.throttle || 0) - (baseSample.throttle || 0);
      const deltaBrake = (targSample.brake || 0) - (baseSample.brake || 0);
      const deltaTimeSec = (targSample.lapTimeSec || 0) - (baseSample.lapTimeSec || 0);

      alignedPoints.push({
        progressPercent: Number((progress * 100).toFixed(1)),
        distanceMeters: Number(baseDistTarget.toFixed(1)),
        baseline: {
          speedMph: Number(baseSpeedMph.toFixed(1)),
          throttle: Number((baseSample.throttle || 0).toFixed(2)),
          brake: Number((baseSample.brake || 0).toFixed(2)),
          timeSec: Number((baseSample.lapTimeSec || 0).toFixed(3))
        },
        target: {
          speedMph: Number(targSpeedMph.toFixed(1)),
          throttle: Number((targSample.throttle || 0).toFixed(2)),
          brake: Number((targSample.brake || 0).toFixed(2)),
          timeSec: Number((targSample.lapTimeSec || 0).toFixed(3))
        },
        delta: {
          speedMph: Number(deltaSpeedMph.toFixed(1)),
          throttle: Number(deltaThrottle.toFixed(2)),
          brake: Number(deltaBrake.toFixed(2)),
          timeDeltaSec: Number(deltaTimeSec.toFixed(3))
        }
      });
    }

    return alignedPoints;
  }

  /**
   * Deconstructs time loss across corner phases
   */
  attributeSegmentTimeLoss(baselineLap, targetLap, classifiedCorners) {
    if (!classifiedCorners || classifiedCorners.length === 0) {
      return { cornerLosses: [], straightLosses: [], totalCornerTimeLossSec: 0, totalStraightTimeLossSec: 0 };
    }

    const baseSamples = baselineLap.samples || [];
    const targSamples = targetLap.samples || [];

    if (baseSamples.length === 0 || targSamples.length === 0) {
      return { cornerLosses: [], straightLosses: [], totalCornerTimeLossSec: 0, totalStraightTimeLossSec: 0 };
    }

    const baseDistances = this._calculateLapCumulativeDistance(baseSamples);
    const targDistances = this._calculateLapCumulativeDistance(targSamples);
    const baseTotalDist = baseDistances[baseDistances.length - 1] || 1;
    const targTotalDist = targDistances[targDistances.length - 1] || 1;

    const cornerLosses = [];
    let totalCornerTimeLoss = 0;

    for (const corner of classifiedCorners) {
      const idx = corner.indexes || {};
      const entryIdx = idx.entry || 0;
      const turnInIdx = idx.turnIn || entryIdx;
      const apexIdx = idx.apex || turnInIdx;
      const tapIdx = idx.tap || apexIdx;
      const exitIdx = idx.exit || apexIdx;

      const entryDistFrac = (baseDistances[entryIdx] || 0) / baseTotalDist;
      const midDistFrac = (baseDistances[apexIdx] || 0) / baseTotalDist;
      const exitDistFrac = (baseDistances[exitIdx] || 0) / baseTotalDist;

      const baseEntryTime = this._getElapsedTimeInRange(baseSamples, baseDistances, entryDistFrac, midDistFrac);
      const baseMidTime = this._getElapsedTimeInRange(baseSamples, baseDistances, midDistFrac, (baseDistances[tapIdx] || baseDistances[midDistFrac]) / baseTotalDist || midDistFrac);
      const baseExitTime = this._getElapsedTimeInRange(baseSamples, baseDistances, midDistFrac, exitDistFrac);
      const baseTotalCornerTime = this._getElapsedTimeInRange(baseSamples, baseDistances, entryDistFrac, exitDistFrac);

      const targEntryTime = this._getElapsedTimeInRange(targSamples, targDistances, entryDistFrac, midDistFrac);
      const targMidTime = this._getElapsedTimeInRange(targSamples, targDistances, midDistFrac, (targDistances[tapIdx] || targDistances[midDistFrac]) / targTotalDist || midDistFrac);
      const targExitTime = this._getElapsedTimeInRange(targSamples, targDistances, midDistFrac, exitDistFrac);
      const targTotalCornerTime = this._getElapsedTimeInRange(targSamples, targDistances, entryDistFrac, exitDistFrac);

      const brakingDeltaSec = Number((targEntryTime - baseEntryTime).toFixed(3));
      const midCornerDeltaSec = Number((targMidTime - baseMidTime).toFixed(3));
      const exitDeltaSec = Number((targExitTime - baseExitTime).toFixed(3));
      const totalCornerDeltaSec = Number((targTotalCornerTime - baseTotalCornerTime).toFixed(3));

      const baseEntrySpeed = mpsToMph(baseSamples[entryIdx]?.motion?.speedMps || 0);
      const targEntrySpeed = mpsToMph(this._interpolateSampleAtDistance(targSamples, targDistances, entryDistFrac * targTotalDist).speedMps);
      const baseApexSpeed = mpsToMph(baseSamples[apexIdx]?.motion?.speedMps || 0);
      const targApexSpeed = mpsToMph(this._interpolateSampleAtDistance(targSamples, targDistances, midDistFrac * targTotalDist).speedMps);
      const baseExitSpeed = mpsToMph(baseSamples[exitIdx]?.motion?.speedMps || 0);
      const targExitSpeed = mpsToMph(this._interpolateSampleAtDistance(targSamples, targDistances, exitDistFrac * targTotalDist).speedMps);

      totalCornerTimeLoss += totalCornerDeltaSec;

      cornerLosses.push({
        cornerNumber: corner.cornerNumber,
        cornerType: corner.cornerType,
        cornerTypeInfo: corner.cornerTypeInfo,
        classificationReason: corner.classificationReason,
        succeedingStraightMeters: corner.succeedingStraightMeters || 0,
        precedingStraightMeters: corner.precedingStraightMeters || 0,
        phases: {
          braking: {
            baselineTimeSec: Number(baseEntryTime.toFixed(3)),
            targetTimeSec: Number(targEntryTime.toFixed(3)),
            deltaSec: brakingDeltaSec,
            deltaTenths: Number((brakingDeltaSec * 10).toFixed(1)),
            entrySpeedDeltaMph: Number((targEntrySpeed - baseEntrySpeed).toFixed(1)),
            entrySpeedDeltaKmh: Number(((targEntrySpeed - baseEntrySpeed) * 1.60934).toFixed(1))
          },
          midCorner: {
            baselineTimeSec: Number(baseMidTime.toFixed(3)),
            targetTimeSec: Number(targMidTime.toFixed(3)),
            deltaSec: midCornerDeltaSec,
            deltaTenths: Number((midCornerDeltaSec * 10).toFixed(1)),
            apexSpeedDeltaMph: Number((targApexSpeed - baseApexSpeed).toFixed(1)),
            apexSpeedDeltaKmh: Number(((targApexSpeed - baseApexSpeed) * 1.60934).toFixed(1))
          },
          exit: {
            baselineTimeSec: Number(baseExitTime.toFixed(3)),
            targetTimeSec: Number(targExitTime.toFixed(3)),
            deltaSec: exitDeltaSec,
            deltaTenths: Number((exitDeltaSec * 10).toFixed(1)),
            exitSpeedDeltaMph: Number((targExitSpeed - baseExitSpeed).toFixed(1)),
            exitSpeedDeltaKmh: Number(((targExitSpeed - baseExitSpeed) * 1.60934).toFixed(1))
          }
        },
        totalDeltaSec: totalCornerDeltaSec,
        totalDeltaTenths: Number((totalCornerDeltaSec * 10).toFixed(1)),
        speeds: {
          baseEntryMph: Number(baseEntrySpeed.toFixed(1)),
          targEntryMph: Number(targEntrySpeed.toFixed(1)),
          baseApexMph: Number(baseApexSpeed.toFixed(1)),
          targApexMph: Number(targApexSpeed.toFixed(1)),
          baseExitMph: Number(baseExitSpeed.toFixed(1)),
          targExitMph: Number(targExitSpeed.toFixed(1)),
          baseEntryKmh: Number((baseEntrySpeed * 1.60934).toFixed(1)),
          targEntryKmh: Number((targEntrySpeed * 1.60934).toFixed(1)),
          baseApexKmh: Number((baseApexSpeed * 1.60934).toFixed(1)),
          targApexKmh: Number((targApexSpeed * 1.60934).toFixed(1)),
          baseExitKmh: Number((baseExitSpeed * 1.60934).toFixed(1)),
          targExitKmh: Number((targExitSpeed * 1.60934).toFixed(1))
        }
      });
    }

    // Straights
    const straightLosses = [];
    let totalStraightTimeLoss = 0;
    const numCorners = classifiedCorners.length;

    for (let i = 0; i < numCorners; i++) {
      const currCorner = classifiedCorners[i];
      const nextCorner = i < numCorners - 1 ? classifiedCorners[i + 1] : classifiedCorners[0];

      const currExitIdx = currCorner.indexes?.exit || 0;
      const nextEntryIdx = nextCorner.indexes?.entry || 0;

      const straightStartFrac = (baseDistances[currExitIdx] || 0) / baseTotalDist;
      const straightEndFrac = (baseDistances[nextEntryIdx] || 0) / baseTotalDist;

      let baseStraightTime = 0;
      let targStraightTime = 0;

      if (straightEndFrac > straightStartFrac) {
        baseStraightTime = this._getElapsedTimeInRange(baseSamples, baseDistances, straightStartFrac, straightEndFrac);
        targStraightTime = this._getElapsedTimeInRange(targSamples, targDistances, straightStartFrac, straightEndFrac);
      } else {
        baseStraightTime = this._getElapsedTimeInRange(baseSamples, baseDistances, straightStartFrac, 1.0) +
                           this._getElapsedTimeInRange(baseSamples, baseDistances, 0.0, straightEndFrac);
        targStraightTime = this._getElapsedTimeInRange(targSamples, targDistances, straightStartFrac, 1.0) +
                           this._getElapsedTimeInRange(targSamples, targDistances, 0.0, straightEndFrac);
      }

      const straightDeltaSec = Number((targStraightTime - baseStraightTime).toFixed(3));
      totalStraightTimeLoss += straightDeltaSec;

      straightLosses.push({
        straightName: `Straight T${currCorner.cornerNumber} -> T${nextCorner.cornerNumber}`,
        fromCorner: currCorner.cornerNumber,
        toCorner: nextCorner.cornerNumber,
        baselineTimeSec: Number(baseStraightTime.toFixed(3)),
        targetTimeSec: Number(targStraightTime.toFixed(3)),
        deltaSec: straightDeltaSec,
        deltaTenths: Number((straightDeltaSec * 10).toFixed(1))
      });
    }

    return {
      cornerLosses,
      straightLosses,
      totalCornerTimeLossSec: Number(totalCornerTimeLoss.toFixed(3)),
      totalStraightTimeLossSec: Number(totalStraightTimeLoss.toFixed(3))
    };
  }

  /**
   * Ranks corner opportunities by projected lap time gain
   */
  rankCornerOpportunities(cornerLosses) {
    if (!cornerLosses || cornerLosses.length === 0) return [];

    const ranked = cornerLosses.map(corner => {
      const cornerType = corner.cornerType;
      const brakingDelta = corner.phases.braking.deltaSec;
      const midDelta = corner.phases.midCorner.deltaSec;
      const exitDelta = corner.phases.exit.deltaSec;
      const exitSpeedDelta = corner.phases.exit.exitSpeedDeltaMph;
      const straightMeters = corner.succeedingStraightMeters || 100;

      let downstreamGainSec = 0;
      if (cornerType === CORNER_TYPE.TYPE_I && exitSpeedDelta < 0) {
        const speedDeficit = Math.abs(exitSpeedDelta);
        downstreamGainSec = (speedDeficit / 10.0) * (straightMeters / 150.0) * 0.12;
      }

      const baseRecoverable = Math.max(0, corner.totalDeltaSec);
      const projectedGainSec = Number((baseRecoverable + downstreamGainSec).toFixed(3));

      let primaryFaultZone = 'Exit Drive';
      let tacticalAdvice = '';
      let badgeColor = 'blue';

      const maxPhaseLoss = Math.max(brakingDelta, midDelta, exitDelta);

      if (cornerType === CORNER_TYPE.TYPE_I) {
        badgeColor = 'gold';
        if (exitSpeedDelta < -2.0 || exitDelta > 0.05) {
          primaryFaultZone = 'Throttle Timing & Exit';
          const exitSpeedDeltaKmh = exitSpeedDelta * 1.60934;
          tacticalAdvice = `Type I Corner: Sacrificed exit speed (${exitSpeedDeltaKmh.toFixed(1)} km/h). Apply throttle progressively earlier at apex to carry top speed onto the ${Math.round(straightMeters)}m straight.`;
        } else if (midDelta > 0.05) {
          primaryFaultZone = 'Apex Roll Speed';
          tacticalAdvice = `Type I Corner: Minimum apex speed too low. Release brake smoothly to avoid binding front tires before applying power.`;
        } else {
          primaryFaultZone = 'Braking Efficiency';
          tacticalAdvice = `Type I Corner: Solid exit drive, but braking entry can be cleaned up without sacrificing exit line.`;
        }
      } else if (cornerType === CORNER_TYPE.TYPE_II) {
        badgeColor = 'amber';
        if (brakingDelta > 0.05 || maxPhaseLoss === brakingDelta) {
          primaryFaultZone = 'Threshold Braking';
          tacticalAdvice = `Type II Corner: Time lost in heavy braking zone. Maximize initial deceleration spike and trail-brake deeper toward turn-in.`;
        } else {
          primaryFaultZone = 'Mid-Corner Rotation';
          tacticalAdvice = `Type II Corner: Focus on quick car rotation at apex to get back to straight-line braking / acceleration sooner.`;
        }
      } else {
        badgeColor = 'cyan';
        primaryFaultZone = maxPhaseLoss === midDelta ? 'Transition Flow' : (maxPhaseLoss === exitDelta ? 'Exit Line' : 'Entry Setup');
        tacticalAdvice = `Type III Corner: Connecting section. Maintain vehicle balance and prioritize positioning for the subsequent turn over absolute speed.`;
      }

      return {
        cornerNumber: corner.cornerNumber,
        cornerType,
        cornerTypeInfo: corner.cornerTypeInfo,
        priority: corner.cornerTypeInfo.priority,
        projectedGainSec,
        projectedGainTenths: Number((projectedGainSec * 10).toFixed(1)),
        directTimeLossSec: corner.totalDeltaSec,
        downstreamGainSec: Number(downstreamGainSec.toFixed(3)),
        primaryFaultZone,
        tacticalAdvice,
        badgeColor,
        phases: corner.phases,
        speeds: corner.speeds
      };
    });

    ranked.sort((a, b) => {
      if (b.projectedGainSec !== a.projectedGainSec) {
        return b.projectedGainSec - a.projectedGainSec;
      }
      return a.priority - b.priority;
    });

    return ranked.map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  }

  /**
   * Executes complete comparison
   */
  compareLaps(baselineLap, targetLap, rawCorners = []) {
    if (!baselineLap || !targetLap) {
      return {
        summary: null,
        classifiedCorners: [],
        cornerLosses: [],
        straightLosses: [],
        rankedOpportunities: [],
        alignedTraces: []
      };
    }

    const baseSamples = baselineLap.samples || [];
    const targSamples = targetLap.samples || [];
    const corners = (baselineLap.corners && baselineLap.corners.length > 0)
      ? baselineLap.corners
      : rawCorners;

    const classifiedCorners = this.classifyCorners(corners, baseSamples);
    const alignedTraces = this.alignLapTraces(baseSamples, targSamples, this.numInterpolationPoints);
    const attribution = this.attributeSegmentTimeLoss(baselineLap, targetLap, classifiedCorners);
    const rankedOpportunities = this.rankCornerOpportunities(attribution.cornerLosses);
    const totalPotentialGainSec = rankedOpportunities.reduce((sum, r) => sum + r.projectedGainSec, 0);

    const baseLapTime = baselineLap.lapTime || (baseSamples[baseSamples.length - 1]?.timing?.currentLapTime || 0);
    const targLapTime = targetLap.lapTime || (targSamples[targSamples.length - 1]?.timing?.currentLapTime || 0);
    const totalLapDeltaTime = targLapTime - baseLapTime;

    return {
      summary: {
        baselineLapNumber: baselineLap.lapNumber || 1,
        baselineLapTime: Number(baseLapTime.toFixed(3)),
        targetLapNumber: targetLap.lapNumber || 2,
        targetLapTime: Number(targLapTime.toFixed(3)),
        totalDeltaTimeSec: Number(totalLapDeltaTime.toFixed(3)),
        totalDeltaTimeTenths: Number((totalLapDeltaTime * 10).toFixed(1)),
        totalCornerLossSec: attribution.totalCornerTimeLossSec,
        totalStraightLossSec: attribution.totalStraightTimeLossSec,
        totalPotentialGainSec: Number(totalPotentialGainSec.toFixed(3)),
        type1CornerCount: classifiedCorners.filter(c => c.cornerType === CORNER_TYPE.TYPE_I).length,
        type2CornerCount: classifiedCorners.filter(c => c.cornerType === CORNER_TYPE.TYPE_II).length,
        type3CornerCount: classifiedCorners.filter(c => c.cornerType === CORNER_TYPE.TYPE_III).length
      },
      classifiedCorners,
      cornerLosses: attribution.cornerLosses,
      straightLosses: attribution.straightLosses,
      rankedOpportunities,
      alignedTraces
    };
  }

  // --- Internal Helpers ---

  _calculateDistanceBetween(samples, startIdx, endIdx) {
    if (!samples || startIdx >= endIdx || startIdx < 0 || endIdx >= samples.length) return 0;
    let dist = 0;
    for (let i = startIdx + 1; i <= endIdx; i++) {
      const p1 = samples[i - 1].motion?.position || { x: 0, y: 0, z: 0 };
      const p2 = samples[i].motion?.position || { x: 0, y: 0, z: 0 };
      const dx = (p2.x || 0) - (p1.x || 0);
      const dy = (p2.y || 0) - (p1.y || 0);
      const dz = (p2.z || 0) - (p1.z || 0);
      dist += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return dist;
  }

  _calculateLapCumulativeDistance(samples) {
    if (!samples || samples.length === 0) return [0];
    const distances = [0];
    let total = 0;
    for (let i = 1; i < samples.length; i++) {
      const p1 = samples[i - 1].motion?.position || { x: 0, y: 0, z: 0 };
      const p2 = samples[i].motion?.position || { x: 0, y: 0, z: 0 };
      const dx = (p2.x || 0) - (p1.x || 0);
      const dy = (p2.y || 0) - (p1.y || 0);
      const dz = (p2.z || 0) - (p1.z || 0);
      const step = Math.sqrt(dx * dx + dy * dy + dz * dz);
      total += (step > 0.0001 ? step : 0.5);
      distances.push(total);
    }
    return distances;
  }

  _interpolateSampleAtDistance(samples, cumulativeDistances, targetDist) {
    if (!samples || samples.length === 0) {
      return { speedMps: 0, throttle: 0, brake: 0, lapTimeSec: 0 };
    }
    if (targetDist <= 0 || samples.length === 1) {
      const s0 = samples[0];
      return {
        speedMps: s0.motion?.speedMps || 0,
        throttle: s0.inputs?.throttle || 0,
        brake: s0.inputs?.brake || 0,
        lapTimeSec: s0.timing?.currentLapTime || 0
      };
    }

    const maxDist = cumulativeDistances[cumulativeDistances.length - 1];
    if (targetDist >= maxDist) {
      const sEnd = samples[samples.length - 1];
      return {
        speedMps: sEnd.motion?.speedMps || 0,
        throttle: sEnd.inputs?.throttle || 0,
        brake: sEnd.inputs?.brake || 0,
        lapTimeSec: sEnd.timing?.currentLapTime || 0
      };
    }

    let low = 0;
    let high = cumulativeDistances.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (cumulativeDistances[mid] <= targetDist && cumulativeDistances[mid + 1] > targetDist) {
        const d0 = cumulativeDistances[mid];
        const d1 = cumulativeDistances[mid + 1];
        const factor = (targetDist - d0) / (d1 - d0 || 1);

        const s0 = samples[mid];
        const s1 = samples[mid + 1];

        const speed0 = s0.motion?.speedMps || 0;
        const speed1 = s1.motion?.speedMps || 0;
        const th0 = s0.inputs?.throttle || 0;
        const th1 = s1.inputs?.throttle || 0;
        const br0 = s0.inputs?.brake || 0;
        const br1 = s1.inputs?.brake || 0;
        const t0 = s0.timing?.currentLapTime || 0;
        const t1 = s1.timing?.currentLapTime || 0;

        return {
          speedMps: speed0 + factor * (speed1 - speed0),
          throttle: th0 + factor * (th1 - th0),
          brake: br0 + factor * (br1 - br0),
          lapTimeSec: t0 + factor * (t1 - t0)
        };
      } else if (cumulativeDistances[mid] < targetDist) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const s = samples[0];
    return {
      speedMps: s.motion?.speedMps || 0,
      throttle: s.inputs?.throttle || 0,
      brake: s.inputs?.brake || 0,
      lapTimeSec: s.timing?.currentLapTime || 0
    };
  }

  _getElapsedTimeInRange(samples, cumulativeDistances, startFrac, endFrac) {
    if (!samples || samples.length === 0) return 0;
    const totalDist = cumulativeDistances[cumulativeDistances.length - 1] || 1;
    const sDist = Math.max(0, startFrac * totalDist);
    const eDist = Math.min(totalDist, endFrac * totalDist);

    if (eDist <= sDist) return 0;

    const startSample = this._interpolateSampleAtDistance(samples, cumulativeDistances, sDist);
    const endSample = this._interpolateSampleAtDistance(samples, cumulativeDistances, eDist);

    return Math.max(0, (endSample.lapTimeSec || 0) - (startSample.lapTimeSec || 0));
  }
}
