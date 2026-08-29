/**
 * APEX 3D Real-Time Corner Dynamics & Apex Analysis Engine
 * Implements Skip Barber "Going Faster!" racing principles:
 * - Feature 1: Corner Entry point, Braking initiation, Turn-in with Target Speed & Gear
 * - Feature 2: Geometric Midpoint Apex vs Actual Late Apex detection & delta calculation (meters)
 * - Feature 3: Track-Out Exit spot with Target Speed & Power Gear
 * - Hybrid Benchmark Model: Fastest Clean Lap reference fallback to theoretical v = sqrt(15 * G * R)
 */

export const APEX_TYPE = {
  GEOMETRIC: 'GEOMETRIC',
  LATE: 'LATE',
  EARLY: 'EARLY'
};

export const CORNER_PHASE = {
  APPROACH: 'APPROACH',
  BRAKING: 'BRAKING',
  TURN_IN: 'TURN_IN',
  MID_CORNER: 'MID_CORNER',
  APEX: 'APEX',
  TRACK_OUT: 'TRACK_OUT',
  EXITED: 'EXITED'
};

export class CornerDynamics3DEngine {
  constructor(options = {}) {
    this.minCornerCurvature = options.minCornerCurvature || 0.008; // 1/R threshold (~125m radius)
    this.smoothWindow = options.smoothWindow || 7;
    this.defaultMaxG = options.defaultMaxG || 1.15; // Typical sports car lateral G
    this.lateApexThresholdMeters = options.lateApexThresholdMeters || 3.0; // >=3m past geometric center = Late Apex
    this.earlyApexThresholdMeters = options.earlyApexThresholdMeters || -3.0; // <= -3m = Early Apex
  }

  /**
   * Smooths an array of numbers using a simple moving average
   */
  smoothArray(arr, windowSize = this.smoothWindow) {
    if (!arr || arr.length === 0) return [];
    const half = Math.floor(windowSize / 2);
    const result = new Float64Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      let sum = 0;
      let count = 0;
      for (let w = -half; w <= half; w++) {
        const idx = i + w;
        if (idx >= 0 && idx < arr.length) {
          sum += arr[idx];
          count++;
        }
      }
      result[i] = count > 0 ? sum / count : arr[i];
    }
    return Array.from(result);
  }

  /**
   * Extracts 3D positions and computes cumulative path distance
   * @param {Array<Object>} samples Telemetry samples
   * @returns {Array<{x: number, y: number, z: number, dist: number, speedKmh: number, gear: number, throttle: number, brake: number, steer: number, yaw: number, latG: number, sample: Object}>}
   */
  extract3DPath(samples) {
    if (!samples || samples.length === 0) return [];

    let totalDist = 0;
    const path = [];

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const x = s.motion?.position?.x ?? s.positionX ?? s.posX ?? 0;
      const y = s.motion?.position?.y ?? s.positionY ?? s.posY ?? 0; // Elevation
      const z = s.motion?.position?.z ?? s.positionZ ?? s.posZ ?? 0;

      const speedMps = s.motion?.speedMps ?? (s.speedMps || (s.speedKmh ? s.speedKmh / 3.6 : (s.speed ? s.speed * 0.44704 : 0)));
      const speedKmh = speedMps * 3.6;
      const gear = s.engine?.gear ?? s.gear ?? 1;
      const throttle = s.inputs?.throttle ?? s.accel ?? 0;
      const brake = s.inputs?.brake ?? s.brake ?? 0;
      const steer = s.inputs?.steering ?? s.steer ?? 0;
      const yaw = s.motion?.orientation?.yaw ?? s.yaw ?? 0;
      const latG = s.motion?.acceleration?.lateralG ?? s.accelY ?? s.lateralG ?? 0;

      if (i > 0) {
        const prev = path[i - 1];
        const dx = x - prev.x;
        const dy = y - prev.y;
        const dz = z - prev.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        totalDist += d;
      }

      path.push({
        index: i,
        x,
        y,
        z,
        dist: totalDist,
        speedMps,
        speedKmh,
        gear,
        throttle,
        brake,
        steer,
        yaw,
        latG,
        sample: s
      });
    }

    return path;
  }

  /**
   * Calculates local curvature kappa = 1 / R for each point along the 3D trajectory
   * @param {Array<Object>} path Extracted path points
   * @returns {Array<number>} Curvature array (1/meters)
   */
  calculateCurvature(path) {
    if (!path || path.length < 3) return [];
    const n = path.length;
    const curvature = new Float64Array(n);

    for (let i = 1; i < n - 1; i++) {
      const p0 = path[Math.max(0, i - 2)];
      const p1 = path[i];
      const p2 = path[Math.min(n - 1, i + 2)];

      // 2D horizontal plane curvature (X-Z)
      const dx1 = p1.x - p0.x;
      const dz1 = p1.z - p0.z;
      const dx2 = p2.x - p1.x;
      const dz2 = p2.z - p1.z;

      const cross = dx1 * dz2 - dz1 * dx2;
      const d1 = Math.sqrt(dx1 * dx1 + dz1 * dz1);
      const d2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);
      const d3 = Math.sqrt((p2.x - p0.x) * (p2.x - p0.x) + (p2.z - p0.z) * (p2.z - p0.z));

      if (d1 * d2 * d3 > 1e-4) {
        // Circumscribed circle formula: curvature = 2 * |cross| / (d1 * d2 * d3)
        const kappa = (2 * Math.abs(cross)) / (d1 * d2 * d3);
        curvature[i] = Number.isFinite(kappa) ? kappa : 0;
      } else {
        curvature[i] = 0;
      }
    }

    curvature[0] = curvature[1] || 0;
    curvature[n - 1] = curvature[n - 2] || 0;

    return this.smoothArray(Array.from(curvature), this.smoothWindow);
  }

  /**
   * Estimates theoretical max speed in km/h based on Going Faster! formula:
   * v = sqrt(15 * G * R) where R is radius in meters, G is peak grip
   * @param {number} radiusMeters 
   * @param {number} maxG 
   * @returns {number} Speed in km/h
   */
  calculateTheoreticalSpeedKmh(radiusMeters, maxG = this.defaultMaxG) {
    if (!radiusMeters || radiusMeters <= 0 || !Number.isFinite(radiusMeters)) return 150;
    const r = Math.min(Math.max(radiusMeters, 5), 800); // Clamped between tight hairpin and high-speed sweeper
    // Formula: v (km/h) = 3.6 * sqrt(9.81 * G * R) ≈ sqrt(15 * G * R * 8.64) -> In standard Going Faster!:
    // V_mph = sqrt(15 * G * R_feet), converted to metric: V_kmh = Math.sqrt(127 * G * R_meters)
    const speedKmh = Math.sqrt(127 * maxG * r);
    return Math.round(speedKmh);
  }

  /**
   * Estimates ideal gear for a given corner speed based on typical sports car transmission ratios
   * @param {number} speedKmh 
   * @param {Object} vehicleMeta 
   * @returns {number} Suggested gear (1-6)
   */
  estimateOptimalGear(speedKmh, vehicleMeta = {}) {
    if (speedKmh <= 65) return 2;
    if (speedKmh <= 105) return 3;
    if (speedKmh <= 150) return 4;
    if (speedKmh <= 195) return 5;
    return 6;
  }

  /**
   * Detects 3D corners and computes complete Entry, Apex, and Exit benchmarks
   * @param {Array<Object>} samples Telemetry samples for a lap
   * @param {Object} referenceLap Optional reference best lap
   * @param {Object} vehicleMeta Optional vehicle metadata
   * @returns {Array<Object>} List of detailed 3D corner analysis objects
   */
  analyzeCorners3D(samples, referenceLap = null, vehicleMeta = {}) {
    if (!samples || samples.length < 30) return [];

    const path = this.extract3DPath(samples);
    const curvature = this.calculateCurvature(path);
    const n = path.length;

    // 1. Identify corner zones where curvature exceeds threshold
    const inCorner = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      if (curvature[i] >= this.minCornerCurvature) {
        inCorner[i] = true;
      }
    }

    // Bridge short gaps (< 20 samples / ~0.33s)
    for (let i = 0; i < n - 20; i++) {
      if (inCorner[i] && !inCorner[i + 1]) {
        let gapLength = 0;
        while (i + 1 + gapLength < n && !inCorner[i + 1 + gapLength] && gapLength < 20) {
          gapLength++;
        }
        if (gapLength < 20 && i + 1 + gapLength < n && inCorner[i + 1 + gapLength]) {
          for (let g = 1; g <= gapLength; g++) {
            inCorner[i + g] = true;
          }
        }
      }
    }

    // Extract discrete corner intervals
    const cornerSpans = [];
    let startIdx = null;
    for (let i = 0; i < n; i++) {
      if (inCorner[i] && startIdx === null) {
        startIdx = i;
      } else if (!inCorner[i] && startIdx !== null) {
        if (i - startIdx >= 15) { // Minimum ~0.25s duration
          cornerSpans.push({ start: startIdx, end: i });
        }
        startIdx = null;
      }
    }
    if (startIdx !== null && n - startIdx >= 15) {
      cornerSpans.push({ start: startIdx, end: n - 1 });
    }

    // Reference lap path for hybrid benchmark lookups
    const refPath = referenceLap?.samples ? this.extract3DPath(referenceLap.samples) : null;

    const corners3D = [];

    for (let cIdx = 0; cIdx < cornerSpans.length; cIdx++) {
      const span = cornerSpans[cIdx];
      const startP = path[span.start];
      const endP = path[span.end];

      // --- 1. ENTRY POINT DETECTION ---
      // Look before the corner start for braking initiation and steering turn-in
      const searchLookback = Math.max(0, span.start - 45); // up to ~0.75s before corner
      let brakeStartIndex = span.start;
      let turnInIndex = span.start;

      for (let i = span.start; i >= searchLookback; i--) {
        if (path[i].brake > 0.08) {
          brakeStartIndex = i;
        } else if (i < span.start - 10 && path[i].brake <= 0.05) {
          break;
        }
      }

      // Turn-in is where steering magnitude starts ramping up
      for (let i = searchLookback; i <= span.start + 15; i++) {
        if (Math.abs(path[i].steer) > 0.04) {
          turnInIndex = i;
          break;
        }
      }

      const entryPointIndex = Math.min(brakeStartIndex, turnInIndex);
      const entryP = path[entryPointIndex];

      // --- 2. EXIT / TRACK-OUT POINT DETECTION ---
      // Track-out is where steering unwinds to near-center and throttle reaches full lock
      let exitIndex = span.end;
      const searchLookahead = Math.min(n - 1, span.end + 35);
      for (let i = span.end; i <= searchLookahead; i++) {
        if (Math.abs(path[i].steer) <= 0.05 && path[i].throttle >= 0.75) {
          exitIndex = i;
          break;
        }
      }
      const exitP = path[exitIndex];

      // --- 3. GEOMETRIC & ACTUAL APEX DETECTION ---
      // Geometric Apex: Equidistant midpoint of the corner between entry and exit (Going Faster! center)
      const geomApexIdx = Math.round((entryPointIndex + exitIndex) / 2);
      const geomApexP = path[geomApexIdx] || path[Math.round((span.start + span.end) / 2)];
      
      // Calculate local corner radius from curvature
      let maxCurvVal = 0;
      for (let i = span.start; i <= span.end; i++) {
        if (curvature[i] > maxCurvVal) {
          maxCurvVal = curvature[i];
        }
      }
      const cornerRadiusMeters = maxCurvVal > 0 ? 1 / maxCurvVal : 50;

      // Find Actual Apex: minimum speed point with high steering/lateral G
      let minSpeedIdx = span.start;
      let minSpeedVal = Infinity;
      for (let i = span.start; i <= span.end; i++) {
        if (path[i].speedKmh < minSpeedVal) {
          minSpeedVal = path[i].speedKmh;
          minSpeedIdx = i;
        }
      }
      const actualApexP = path[minSpeedIdx];

      // Calculate Late-Apex distance delta along track (meters)
      const lateApexDeltaMeters = actualApexP.dist - geomApexP.dist;
      let apexClassification = APEX_TYPE.GEOMETRIC;
      let apexRationale = 'Geometric center apex aligned with standard arc.';

      if (lateApexDeltaMeters >= this.lateApexThresholdMeters) {
        apexClassification = APEX_TYPE.LATE;
        apexRationale = `Apex is ${lateApexDeltaMeters.toFixed(1)}m later than geometric center — Late apex enables earlier throttle commitment and maximizes straightaway exit speed.`;
      } else if (lateApexDeltaMeters <= this.earlyApexThresholdMeters) {
        apexClassification = APEX_TYPE.EARLY;
        apexRationale = `Apex is ${Math.abs(lateApexDeltaMeters).toFixed(1)}m earlier than geometric center — Early apex compromises exit trajectory and increases understeer risk.`;
      }

      // --- 4. TARGET SPEEDS & RECOMMENDED GEARS (HYBRID MODEL) ---
      const theoreticalApexSpeed = this.calculateTheoreticalSpeedKmh(cornerRadiusMeters, vehicleMeta.lateralG || this.defaultMaxG);
      const theoreticalEntrySpeed = Math.round(theoreticalApexSpeed * 1.18);
      const theoreticalExitSpeed = Math.round(theoreticalApexSpeed * 1.25);

      let targetEntrySpeed = theoreticalEntrySpeed;
      let targetExitSpeed = theoreticalExitSpeed;
      let recommendedEntryGear = this.estimateOptimalGear(targetEntrySpeed, vehicleMeta);
      let recommendedExitGear = this.estimateOptimalGear(targetExitSpeed, vehicleMeta);

      // If reference lap exists, extract benchmark speed/gear at matching distances
      if (refPath && refPath.length > 0) {
        const refEntry = this.findClosestPointByDist(refPath, entryP.dist);
        const refExit = this.findClosestPointByDist(refPath, exitP.dist);

        if (refEntry) {
          targetEntrySpeed = Math.round(refEntry.speedKmh);
          recommendedEntryGear = refEntry.gear || recommendedEntryGear;
        }
        if (refExit) {
          targetExitSpeed = Math.round(refExit.speedKmh);
          recommendedExitGear = refExit.gear || recommendedExitGear;
        }
      }

      // Determine corner direction (Left vs Right) from average steering / cross-product
      let steerSum = 0;
      for (let i = span.start; i <= span.end; i++) {
        steerSum += path[i].steer;
      }
      const direction = steerSum < 0 ? 'LEFT' : 'RIGHT';

      corners3D.push({
        cornerNumber: cIdx + 1,
        direction,
        radiusMeters: Math.round(cornerRadiusMeters),
        startDistance: startP.dist,
        endDistance: endP.dist,
        lengthMeters: Math.round(endP.dist - startP.dist),
        // Feature 1: Entry
        entry: {
          index: entryPointIndex,
          position: { x: entryP.x, y: entryP.y, z: entryP.z },
          distance: entryP.dist,
          actualSpeedKmh: Math.round(entryP.speedKmh),
          actualGear: entryP.gear,
          targetSpeedKmh: targetEntrySpeed,
          recommendedGear: recommendedEntryGear,
          brakingStartedEarly: brakeStartIndex < turnInIndex - 10
        },
        // Feature 2: Apex (Geometric & Actual)
        geometricApex: {
          index: geomApexIdx,
          position: { x: geomApexP.x, y: geomApexP.y, z: geomApexP.z },
          distance: geomApexP.dist,
          curvature: maxCurvVal
        },
        actualApex: {
          index: minSpeedIdx,
          position: { x: actualApexP.x, y: actualApexP.y, z: actualApexP.z },
          distance: actualApexP.dist,
          actualSpeedKmh: Math.round(actualApexP.speedKmh),
          actualGear: actualApexP.gear,
          targetApexSpeedKmh: theoreticalApexSpeed,
          lateApexDeltaMeters: Math.round(lateApexDeltaMeters * 10) / 10,
          classification: apexClassification,
          coachingFeedback: apexRationale
        },
        // Feature 3: Exit
        exit: {
          index: exitIndex,
          position: { x: exitP.x, y: exitP.y, z: exitP.z },
          distance: exitP.dist,
          actualSpeedKmh: Math.round(exitP.speedKmh),
          actualGear: exitP.gear,
          targetSpeedKmh: targetExitSpeed,
          recommendedGear: recommendedExitGear
        }
      });
    }

    return corners3D;
  }

  /**
   * Helper to find the closest path point by cumulative track distance
   */
  findClosestPointByDist(path, dist) {
    if (!path || path.length === 0) return null;
    let closest = path[0];
    let minDiff = Math.abs(path[0].dist - dist);
    for (let i = 1; i < path.length; i++) {
      const diff = Math.abs(path[i].dist - dist);
      if (diff < minDiff) {
        minDiff = diff;
        closest = path[i];
      }
    }
    return closest;
  }

  /**
   * Evaluates the driver's current position in real-time against corner benchmarks
   * @param {Object} currentSample Live 60Hz telemetry sample
   * @param {Array<Object>} liveLapSamples Rolling buffer of current lap samples
   * @param {Array<Object>} corners3D Pre-calculated or benchmark corners
   * @returns {Object} Active corner state and coaching banner data
   */
  evaluateLiveProgress(currentSample, liveLapSamples, corners3D) {
    if (!corners3D || corners3D.length === 0 || !currentSample) {
      return { activeCorner: null, phase: CORNER_PHASE.APPROACH, coachingBanner: null };
    }

    const curX = currentSample.motion?.position?.x ?? currentSample.positionX ?? currentSample.posX ?? 0;
    const curY = currentSample.motion?.position?.y ?? currentSample.positionY ?? currentSample.posY ?? 0;
    const curZ = currentSample.motion?.position?.z ?? currentSample.positionZ ?? currentSample.posZ ?? 0;
    const curSpeed = (currentSample.motion?.speedMps ?? currentSample.speedMps ?? 0) * 3.6;
    const curGear = currentSample.engine?.gear ?? currentSample.gear ?? 1;

    // Find the nearest corner by 3D Euclidean distance
    let activeCorner = null;
    let minCornerDist = Infinity;

    for (const corner of corners3D) {
      const dx = curX - corner.geometricApex.position.x;
      const dy = curY - corner.geometricApex.position.y;
      const dz = curZ - corner.geometricApex.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < minCornerDist && dist < (corner.lengthMeters * 1.5 || 250)) {
        minCornerDist = dist;
        activeCorner = corner;
      }
    }

    if (!activeCorner) {
      return { activeCorner: null, phase: CORNER_PHASE.APPROACH, coachingBanner: null };
    }

    // Determine phase within the active corner
    const dEntry = Math.sqrt(
      Math.pow(curX - activeCorner.entry.position.x, 2) +
      Math.pow(curZ - activeCorner.entry.position.z, 2)
    );
    const dApex = Math.sqrt(
      Math.pow(curX - activeCorner.actualApex.position.x, 2) +
      Math.pow(curZ - activeCorner.actualApex.position.z, 2)
    );
    const dExit = Math.sqrt(
      Math.pow(curX - activeCorner.exit.position.x, 2) +
      Math.pow(curZ - activeCorner.exit.position.z, 2)
    );

    let phase = CORNER_PHASE.MID_CORNER;
    let coachingText = '';

    if (dEntry < 35) {
      phase = CORNER_PHASE.TURN_IN;
      const speedDelta = Math.round(curSpeed - activeCorner.entry.targetSpeedKmh);
      const deltaSign = speedDelta > 0 ? `+${speedDelta}` : `${speedDelta}`;
      coachingText = `Turn ${activeCorner.cornerNumber} Entry: Target ${activeCorner.entry.targetSpeedKmh} km/h (${activeCorner.entry.recommendedGear}${this.getGearSuffix(activeCorner.entry.recommendedGear)}) · Live: ${Math.round(curSpeed)} km/h [${deltaSign}]`;
    } else if (dApex < 25) {
      phase = CORNER_PHASE.APEX;
      const deltaM = activeCorner.actualApex.lateApexDeltaMeters;
      const deltaText = deltaM >= 3 ? `Late Apex (+${deltaM}m) — Good Exit Prep` : (deltaM <= -3 ? `Early Apex (${deltaM}m) — Caution Exit Understeer` : `Geometric Apex`);
      coachingText = `Turn ${activeCorner.cornerNumber} Apex: ${deltaText}`;
    } else if (dExit < 35) {
      phase = CORNER_PHASE.TRACK_OUT;
      coachingText = `Turn ${activeCorner.cornerNumber} Exit: Aim for ${activeCorner.exit.targetSpeedKmh} km/h (${activeCorner.exit.recommendedGear}${this.getGearSuffix(activeCorner.exit.recommendedGear)}) · Full Throttle Unwind`;
    } else {
      coachingText = `Approaching Turn ${activeCorner.cornerNumber} (${activeCorner.direction}) · R=${activeCorner.radiusMeters}m`;
    }

    return {
      activeCorner,
      phase,
      currentSpeedKmh: Math.round(curSpeed),
      currentGear: curGear,
      coachingBanner: {
        cornerNumber: activeCorner.cornerNumber,
        direction: activeCorner.direction,
        phase,
        text: coachingText,
        entryTarget: `${activeCorner.entry.targetSpeedKmh} km/h (G${activeCorner.entry.recommendedGear})`,
        apexDelta: `${activeCorner.actualApex.lateApexDeltaMeters > 0 ? '+' : ''}${activeCorner.actualApex.lateApexDeltaMeters}m`,
        exitTarget: `${activeCorner.exit.targetSpeedKmh} km/h (G${activeCorner.exit.recommendedGear})`
      }
    };
  }

  getGearSuffix(gear) {
    if (gear === 1) return 'st';
    if (gear === 2) return 'nd';
    if (gear === 3) return 'rd';
    return 'th';
  }
}
