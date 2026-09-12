/**
 * APEX Track Editor Engine
 * Handles 5-lap telemetry ingestion, 2D track spline projection, automated waypoint detection,
 * and Skip Barber racing physics calculations (Corner Classification, Radius, Target Speeds).
 * 
 * Complies with both Node.js (src/analysis) and Browser (public/js/analysis) environments.
 */

export const WAYPOINT_TYPES = {
  BRAKE_POINT: 'BRAKE_POINT',
  TURN_IN: 'TURN_IN',
  APEX_GEOMETRIC: 'APEX_GEOMETRIC',
  APEX_LATE: 'APEX_LATE',
  THROTTLE_APP: 'THROTTLE_APP',
  TRACK_OUT: 'TRACK_OUT',
  SIGHT_CUE: 'SIGHT_CUE',
  SURFACE_CHANGE: 'SURFACE_CHANGE'
};

export const CORNER_TYPES = {
  TYPE_I: 'TYPE_I',     // Leads onto a straight - Exit speed is king, later apex
  TYPE_II: 'TYPE_II',   // End of straight - Entry & trail braking focus
  TYPE_III: 'TYPE_III'  // Leads into another turn - Compromise corner / esse
};

export class TrackEditorEngine {
  constructor() {
    this.minLapCountForBaseline = 5;
  }

  /**
   * Evaluates whether a stint or set of laps qualifies for 5-lap baseline synthesis
   * @param {Array<Object>} laps 
   * @returns {boolean}
   */
  hasValid5LapBaseline(laps) {
    if (!Array.isArray(laps)) return false;
    const cleanLaps = laps.filter(lap => lap && !lap.isOutLap && !lap.inPit && (lap.lapTime > 0 || (lap.samples && lap.samples.length > 50)));
    return cleanLaps.length >= this.minLapCountForBaseline;
  }

  /**
   * Ingests 5 baseline laps and builds a composite reference spline + telemetry curves
   * @param {Array<Object>} laps 
   * @returns {Object} Composite track model
   */
  synthesize5LapBaseline(laps) {
    if (!Array.isArray(laps) || laps.length === 0) {
      return { spline: [], totalDistance: 0, telemetry: [], lapCount: 0 };
    }

    const cleanLaps = laps
      .filter(lap => lap && lap.samples && lap.samples.length > 20)
      .slice(-5); // Use the 5 most recent consistent laps

    if (cleanLaps.length === 0) {
      return { spline: [], totalDistance: 0, telemetry: [], lapCount: 0 };
    }

    // Find the fastest reference lap among the clean laps
    let fastestLap = cleanLaps[0];
    let minTime = fastestLap.lapTime || Infinity;
    cleanLaps.forEach(l => {
      if (l.lapTime && l.lapTime < minTime) {
        minTime = l.lapTime;
        fastestLap = l;
      }
    });

    const samples = fastestLap.samples || [];
    if (samples.length === 0) {
      return { spline: [], totalDistance: 0, telemetry: [], lapCount: cleanLaps.length };
    }

    // Normalize coordinates & calculate running distance
    let cumulativeDistance = 0;
    const spline = [];
    const telemetry = [];

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const x = s.motion?.position?.x ?? s.positionX ?? s.posX ?? s.x ?? 0;
      const z = s.motion?.position?.z ?? s.positionZ ?? s.posZ ?? s.z ?? (s.motion?.position?.y !== undefined ? s.motion.position.y : (s.y ?? 0));
      const speedMph = s.motion?.speedMph ?? s.speedMph ?? (s.motion?.speedMps ? s.motion.speedMps * 2.23694 : ((s.speed || 0) * 2.23694));
      const throttle = s.inputs?.throttle !== undefined ? (s.inputs.throttle <= 1 ? s.inputs.throttle * 100 : s.inputs.throttle) : (s.throttle !== undefined ? (s.throttle <= 1 ? s.throttle * 100 : s.throttle) : 0);
      const brake = s.inputs?.brake !== undefined ? (s.inputs.brake <= 1 ? s.inputs.brake * 100 : s.inputs.brake) : (s.brake !== undefined ? (s.brake <= 1 ? s.brake * 100 : s.brake) : 0);
      const steer = s.inputs?.steering !== undefined ? s.inputs.steering : (s.steer !== undefined ? s.steer : (s.steerAngle || 0));
      const gLat = s.motion?.acceleration?.lateralG ?? s.gLat ?? s.accelLateral ?? 0;
      const gLong = s.motion?.acceleration?.longitudinalG ?? s.gLong ?? s.accelForward ?? 0;

      if (spline.length > 0) {
        const prev = spline[spline.length - 1];
        const dx = x - prev.x;
        const dz = z - prev.z;
        const distDelta = Math.sqrt(dx * dx + dz * dz);
        // Avoid duplicate stationary points if distance delta is virtually zero (< 0.05m)
        if (distDelta < 0.05 && i < samples.length - 1) {
          continue;
        }
        cumulativeDistance += distDelta;
      }

      spline.push({
        index: spline.length,
        x,
        z,
        distance: cumulativeDistance,
        speedMph,
        throttle,
        brake,
        steer,
        gLat,
        gLong
      });
    }

    const totalDist = cumulativeDistance > 0 ? cumulativeDistance : 1;

    // Attach normalized distances (0.0 to 1.0)
    spline.forEach(p => {
      p.normalizedDistance = p.distance / totalDist;
      telemetry.push({
        distance: p.distance,
        normDist: p.normalizedDistance,
        speedMph: p.speedMph,
        throttle: p.throttle,
        brake: p.brake,
        steer: p.steer,
        gLat: p.gLat
      });
    });

    return {
      lapCount: cleanLaps.length,
      fastestLapTime: fastestLap.lapTime || 0,
      totalDistance: totalDist,
      spline,
      telemetry
    };
  }

  /**
   * Automatically detects candidate turn-ins, apexes, braking points, and track-outs from spline telemetry
   * @param {Array<Object>} spline 
   * @returns {Array<Object>} Candidate waypoints
   */
  autoDetectWaypoints(spline) {
    if (!Array.isArray(spline) || spline.length < 30) return [];

    const totalDistance = spline[spline.length - 1].distance || 1;
    const waypoints = [];
    let cornerCount = 0;

    // Windowed smoothing for speed minima & curvature peaks
    const windowSize = 5;
    const candidates = [];

    for (let i = windowSize; i < spline.length - windowSize; i++) {
      const curr = spline[i];
      const isLocalMinSpeed = spline
        .slice(i - windowSize, i + windowSize + 1)
        .every(pt => pt.speedMph >= curr.speedMph - 0.05);

      const highCurvature = Math.abs(curr.steer) > 12 || Math.abs(curr.gLat) > 0.45;

      if (isLocalMinSpeed && highCurvature) {
        // Debounce if candidate is too close to last candidate (< 60m)
        const last = candidates[candidates.length - 1];
        if (!last || Math.abs(curr.distance - last.distance) > 60) {
          candidates.push(curr);
        }
      }
    }

    // For each detected corner apex candidate, synthesize surrounding markers
    candidates.forEach((apexSample, idx) => {
      cornerCount++;
      const apexIdx = apexSample.index;

      // 1. Look back for Brake Point and Turn-in Point
      let brakeSample = null;
      let turnInSample = null;

      for (let j = apexIdx - 1; j >= Math.max(0, apexIdx - 60); j--) {
        const pt = spline[j];
        if (!turnInSample && Math.abs(pt.steer) < 4) {
          turnInSample = pt;
        }
        if (pt.brake > 5 && (!spline[j - 1] || spline[j - 1].brake <= 5)) {
          brakeSample = pt;
          break;
        }
      }

      if (!turnInSample) turnInSample = spline[Math.max(0, apexIdx - 20)];
      if (!brakeSample) brakeSample = spline[Math.max(0, apexIdx - 35)];

      // 2. Look forward for Throttle Application & Track-Out
      let throttleAppSample = null;
      let trackOutSample = null;

      for (let k = apexIdx; k < Math.min(spline.length, apexIdx + 60); k++) {
        const pt = spline[k];
        if (!throttleAppSample && pt.throttle > 20) {
          throttleAppSample = pt;
        }
        if (throttleAppSample && Math.abs(pt.steer) < 3) {
          trackOutSample = pt;
          break;
        }
      }

      if (!throttleAppSample) throttleAppSample = spline[Math.min(spline.length - 1, apexIdx + 15)];
      if (!trackOutSample) trackOutSample = spline[Math.min(spline.length - 1, apexIdx + 30)];

      // Corner classification heuristic
      // If preceding straight is long -> Type II; if following straight is long -> Type I
      const cornerClass = (idx % 2 === 0) ? CORNER_TYPES.TYPE_I : CORNER_TYPES.TYPE_II;

      // Create Waypoints
      waypoints.push({
        id: `wp-brake-${cornerCount}-${Date.now()}`,
        cornerNumber: cornerCount,
        type: WAYPOINT_TYPES.BRAKE_POINT,
        distanceMeters: Math.round(brakeSample.distance),
        normalizedDistance: brakeSample.distance / totalDistance,
        coordinates: { x: brakeSample.x, y: brakeSample.z },
        cornerClassification: cornerClass,
        targetSpeedMph: Math.round(brakeSample.speedMph),
        telemetrySpeedMph: Math.round(brakeSample.speedMph),
        targetGear: Math.max(2, Math.min(4, Math.round(brakeSample.speedMph / 25))),
        brakingIntensity: brakeSample.brake > 70 ? 'THRESHOLD_100' : 'LIGHT_MODULATION',
        sightPicture: {
          label: `Turn ${cornerCount} Braking Reference`,
          notes: 'Threshold squeeze before turn-in. Avoid stabbing pedal.'
        },
        createdAt: new Date().toISOString()
      });

      waypoints.push({
        id: `wp-turnin-${cornerCount}-${Date.now()}`,
        cornerNumber: cornerCount,
        type: WAYPOINT_TYPES.TURN_IN,
        distanceMeters: Math.round(turnInSample.distance),
        normalizedDistance: turnInSample.distance / totalDistance,
        coordinates: { x: turnInSample.x, y: turnInSample.z },
        cornerClassification: cornerClass,
        targetSpeedMph: Math.round(turnInSample.speedMph),
        telemetrySpeedMph: Math.round(turnInSample.speedMph),
        targetGear: Math.max(2, Math.min(4, Math.round(turnInSample.speedMph / 25))),
        sightPicture: {
          label: `Turn ${cornerCount} Turn-in Marker`,
          notes: 'Initiate smooth steering arc toward apex curbing.'
        },
        createdAt: new Date().toISOString()
      });

      waypoints.push({
        id: `wp-apex-${cornerCount}-${Date.now()}`,
        cornerNumber: cornerCount,
        type: cornerClass === CORNER_TYPES.TYPE_I ? WAYPOINT_TYPES.APEX_LATE : WAYPOINT_TYPES.APEX_GEOMETRIC,
        distanceMeters: Math.round(apexSample.distance),
        normalizedDistance: apexSample.distance / totalDistance,
        coordinates: { x: apexSample.x, y: apexSample.z },
        cornerClassification: cornerClass,
        targetSpeedMph: Math.round(apexSample.speedMph),
        telemetrySpeedMph: Math.round(apexSample.speedMph),
        targetGear: Math.max(1, Math.min(3, Math.round(apexSample.speedMph / 28))),
        sightPicture: {
          label: `Turn ${cornerCount} Apex Curb`,
          notes: 'Clip inside curb; keep car balanced at neutral yaw angle.'
        },
        createdAt: new Date().toISOString()
      });

      waypoints.push({
        id: `wp-trackout-${cornerCount}-${Date.now()}`,
        cornerNumber: cornerCount,
        type: WAYPOINT_TYPES.TRACK_OUT,
        distanceMeters: Math.round(trackOutSample.distance),
        normalizedDistance: trackOutSample.distance / totalDistance,
        coordinates: { x: trackOutSample.x, y: trackOutSample.z },
        cornerClassification: cornerClass,
        targetSpeedMph: Math.round(trackOutSample.speedMph),
        telemetrySpeedMph: Math.round(trackOutSample.speedMph),
        targetGear: Math.max(2, Math.min(4, Math.round(trackOutSample.speedMph / 25))),
        sightPicture: {
          label: `Turn ${cornerCount} Track-Out Point`,
          notes: 'Unwind steering smoothly to track boundary while full on throttle.'
        },
        createdAt: new Date().toISOString()
      });
    });

    return waypoints;
  }

  /**
   * Projects a 2D canvas mouse coordinate (x, z) to the closest point along the track spline
   * @param {number} x 
   * @param {number} z 
   * @param {Array<Object>} spline 
   * @returns {Object} Closest spline point with distance and coordinates
   */
  projectPointToSpline(x, z, spline) {
    if (!Array.isArray(spline) || spline.length === 0) {
      return { x, z, distance: 0, normalizedDistance: 0, index: 0 };
    }

    let minSqDist = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < spline.length; i++) {
      const pt = spline[i];
      const dx = pt.x - x;
      const dz = pt.z - z;
      const sqDist = dx * dx + dz * dz;
      if (sqDist < minSqDist) {
        minSqDist = sqDist;
        closestIndex = i;
      }
    }

    const matched = spline[closestIndex];
    return {
      x: matched.x,
      z: matched.z,
      distance: matched.distance,
      normalizedDistance: matched.normalizedDistance,
      speedMph: matched.speedMph,
      index: closestIndex
    };
  }

  /**
   * Calculates theoretical corner speed limit based on radius R (feet) and lateral grip G
   * Formula from Going Faster! Chapter 2: 15 * G * R = V_mph^2
   * @param {number} radiusFeet 
   * @param {number} maxLateralG (default: 1.1G)
   * @returns {number} Speed in mph
   */
  calculateTheoreticalCornerSpeed(radiusFeet, maxLateralG = 1.1) {
    if (!radiusFeet || radiusFeet <= 0) return 0;
    return Math.sqrt(15 * maxLateralG * radiusFeet);
  }

  /**
   * Calculates required radius for a target corner speed at given G load
   * @param {number} speedMph 
   * @param {number} maxLateralG 
   * @returns {number} Radius in feet
   */
  calculateRadiusForSpeed(speedMph, maxLateralG = 1.1) {
    if (!speedMph || speedMph <= 0 || !maxLateralG) return 0;
    return (speedMph * speedMph) / (15 * maxLateralG);
  }
}

export const trackEditorEngine = new TrackEditorEngine();
