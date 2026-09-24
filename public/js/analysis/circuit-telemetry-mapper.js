/**
 * APEX Circuit Telemetry Mapper
 * Ingests high-rate live telemetry streams (60Hz UDP/WebSocket),
 * builds real-time circuit geometry, performs curvature & lateral G corner detection,
 * manages track bounds & coordinate normalization, and handles strategy/track serialization.
 */

export class CircuitTelemetryMapper {
  constructor(options = {}) {
    this.maxSamples = options.maxSamples || 20000;
    this.minCornerG = options.minCornerG || 0.45; // Minimum lateral G to consider corner activity
    this.minCornerDistance = options.minCornerDistance || 40; // Minimum distance (meters) between distinct corners
    this.curvatureWindow = options.curvatureWindow || 8; // Number of samples for smoothing curvature

    this.liveSamples = [];
    this.lapSamples = [];
    this.corners = [];
    this.currentLap = 1;
    this.isLoopClosed = false;

    // Track Bounding Box
    this.bounds = {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
      centerX: 0,
      centerY: 0,
      centerZ: 0,
      rangeX: 1,
      rangeZ: 1,
      maxRange: 1
    };
  }

  /**
   * Resets all accumulated telemetry data
   */
  reset() {
    this.liveSamples = [];
    this.lapSamples = [];
    this.corners = [];
    this.currentLap = 1;
    this.isLoopClosed = false;
    this.bounds = {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
      centerX: 0,
      centerY: 0,
      centerZ: 0,
      rangeX: 1,
      rangeZ: 1,
      maxRange: 1
    };
  }

  /**
   * Ingests a single live telemetry sample
   * @param {Object} sample Telemetry sample
   * @returns {Object} { newCornerDetected: boolean, lapCompleted: boolean, sample: Object }
   */
  ingestSample(sample) {
    if (!sample) return { newCornerDetected: false, lapCompleted: false };

    // Standardize coordinate properties
    const x = sample.worldPositionX ?? sample.posX ?? sample.x ?? 0;
    const y = sample.worldPositionY ?? sample.posY ?? sample.y ?? 0;
    const z = sample.worldPositionZ ?? sample.posZ ?? sample.z ?? 0;
    const speed = sample.speed ?? sample.speedMps ?? 0;
    const throttle = sample.throttle ?? 0;
    const brake = sample.brake ?? 0;
    const lateralG = sample.lateralG ?? sample.gLat ?? 0;
    const longitudinalG = sample.longitudinalG ?? sample.gLon ?? 0;
    const lapDistance = sample.lapDistance ?? sample.distance ?? 0;
    const lapNum = sample.currentLapNum ?? sample.lap ?? sample.lapNumber ?? this.currentLap;

    const standardized = {
      x,
      y,
      z,
      speed,
      throttle,
      brake,
      lateralG,
      longitudinalG,
      dist: lapDistance,
      lap: lapNum,
      timestamp: sample.timestamp || Date.now()
    };

    // Check for lap transition
    let lapCompleted = false;
    if (lapNum > this.currentLap && this.lapSamples.length > 50) {
      lapCompleted = true;
      this.isLoopClosed = true;
      this.currentLap = lapNum;
      // Re-run full lap corner detection
      this.detectCorners();
    }

    // Update Bounding Box
    this.updateBounds(x, y, z);

    // Append to live and current lap buffers
    this.liveSamples.push(standardized);
    if (this.liveSamples.length > this.maxSamples) {
      this.liveSamples.shift();
    }

    if (lapCompleted) {
      this.lapSamples = [standardized];
    } else {
      this.lapSamples.push(standardized);
    }

    // Real-time incremental corner detection check
    const previousCornerCount = this.corners.length;
    if (this.lapSamples.length % 20 === 0) {
      this.detectCorners();
    }
    const newCornerDetected = this.corners.length > previousCornerCount;

    return {
      newCornerDetected,
      lapCompleted,
      sample: standardized,
      bounds: this.bounds
    };
  }

  /**
   * Updates track bounding box and center coordinates
   */
  updateBounds(x, y, z) {
    if (x < this.bounds.minX) this.bounds.minX = x;
    if (x > this.bounds.maxX) this.bounds.maxX = x;
    if (y < this.bounds.minY) this.bounds.minY = y;
    if (y > this.bounds.maxY) this.bounds.maxY = y;
    if (z < this.bounds.minZ) this.bounds.minZ = z;
    if (z > this.bounds.maxZ) this.bounds.maxZ = z;

    this.bounds.centerX = (this.bounds.minX + this.bounds.maxX) / 2;
    this.bounds.centerY = (this.bounds.minY + this.bounds.maxY) / 2;
    this.bounds.centerZ = (this.bounds.minZ + this.bounds.maxZ) / 2;

    this.bounds.rangeX = Math.max(1, this.bounds.maxX - this.bounds.minX);
    this.bounds.rangeZ = Math.max(1, this.bounds.maxZ - this.bounds.minZ);
    this.bounds.maxRange = Math.max(this.bounds.rangeX, this.bounds.rangeZ);
  }

  /**
   * Automatically segments corners from the telemetry stream based on lateral G and curvature peaks
   * @returns {Array<Object>} List of detected corners
   */
  detectCorners() {
    const samples = this.lapSamples.length >= 30 ? this.lapSamples : this.liveSamples;
    if (samples.length < 30) return this.corners;

    const detected = [];
    let inCorner = false;
    let cornerStartIndex = 0;
    let maxLatG = 0;
    let apexIndex = 0;
    let minSpeedIndex = 0;
    let minSpeed = Infinity;
    let brakeStartIndex = -1;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const absLatG = Math.abs(s.lateralG);
      const isBraking = s.brake > 0.15;

      // Track braking initiation before corner entry
      if (isBraking && brakeStartIndex === -1) {
        brakeStartIndex = i;
      } else if (!isBraking && !inCorner) {
        brakeStartIndex = -1;
      }

      if (!inCorner) {
        if (absLatG >= this.minCornerG) {
          inCorner = true;
          cornerStartIndex = Math.max(0, brakeStartIndex !== -1 ? brakeStartIndex : i - 5);
          maxLatG = absLatG;
          apexIndex = i;
          minSpeed = s.speed;
          minSpeedIndex = i;
        }
      } else {
        // Track apex (peak lateral acceleration or minimum corner speed)
        if (absLatG > maxLatG) {
          maxLatG = absLatG;
          apexIndex = i;
        }
        if (s.speed < minSpeed) {
          minSpeed = s.speed;
          minSpeedIndex = i;
        }

        // Corner Exit condition: LatG falls below threshold and throttle > 30%
        const isExiting = absLatG < this.minCornerG * 0.6 && (s.throttle > 0.3 || i - cornerStartIndex > 80);
        if (isExiting || i === samples.length - 1) {
          inCorner = false;
          const cornerEndIndex = Math.min(samples.length - 1, i + 5);

          const startSample = samples[cornerStartIndex];
          const endSample = samples[cornerEndIndex];
          const apexSample = samples[apexIndex];
          const cornerDist = Math.abs((endSample.dist || 0) - (startSample.dist || 0));

          // Ensure minimum length between corners to filter out curb vibrations/noise
          const prevCorner = detected[detected.length - 1];
          const distFromPrev = prevCorner ? Math.abs((startSample.dist || 0) - (prevCorner.endDistance || 0)) : Infinity;

          if (cornerDist >= 25 && distFromPrev >= this.minCornerDistance) {
            const cornerNum = detected.length + 1;
            const turnDirection = apexSample.lateralG > 0 ? 'Right' : 'Left';

            // Identify Throttle Application Point (TAP)
            let tapIndex = apexIndex;
            for (let k = apexIndex; k <= cornerEndIndex; k++) {
              if (samples[k].throttle > 0.25) {
                tapIndex = k;
                break;
              }
            }

            const cornerObj = {
              cornerNumber: cornerNum,
              cornerName: `Turn ${cornerNum}`,
              direction: turnDirection,
              startIndex: cornerStartIndex,
              endIndex: cornerEndIndex,
              apexIndex: apexIndex,
              brakeIndex: brakeStartIndex !== -1 ? brakeStartIndex : cornerStartIndex,
              tapIndex: tapIndex,
              trackOutIndex: cornerEndIndex,
              startDistance: startSample.dist || 0,
              apexDistance: apexSample.dist || 0,
              endDistance: endSample.dist || 0,
              apexSpeedMps: minSpeed,
              entrySpeedMps: samples[cornerStartIndex].speed,
              exitSpeedMps: samples[cornerEndIndex].speed,
              peakLateralG: maxLatG,
              radiusMeters: Math.max(10, Math.round((minSpeed * minSpeed) / Math.max(1, maxLatG * 9.81))),
              apexDepthPercent: Math.round(((apexIndex - cornerStartIndex) / Math.max(1, cornerEndIndex - cornerStartIndex)) * 100) / 100,
              samples: samples.slice(cornerStartIndex, cornerEndIndex + 1)
            };

            detected.push(cornerObj);
          }

          brakeStartIndex = -1;
          maxLatG = 0;
          minSpeed = Infinity;
        }
      }
    }

    if (detected.length > 0) {
      this.corners = detected;
    }

    return this.corners;
  }

  /**
   * Manually adds or updates a corner segment
   * @param {Object} cornerData Custom corner definition
   */
  addOrUpdateCorner(cornerData) {
    const existingIndex = this.corners.findIndex(c => c.cornerNumber === cornerData.cornerNumber);
    if (existingIndex >= 0) {
      this.corners[existingIndex] = { ...this.corners[existingIndex], ...cornerData };
    } else {
      this.corners.push(cornerData);
      this.corners.sort((a, b) => a.cornerNumber - b.cornerNumber);
    }
    return this.corners;
  }

  /**
   * Serializes the captured circuit map and corner landmarks to JSON
   * @param {string} trackName Name of the track
   * @param {Object} customMetadata Additional metadata (e.g. car, driver, notes)
   * @returns {string} JSON representation
   */
  exportToJson(trackName = 'Custom Telemetry Track', customMetadata = {}) {
    const payload = {
      version: '2.9.0',
      type: 'APEX_CIRCUIT_STRATEGY_MAP',
      timestamp: new Date().toISOString(),
      trackInfo: {
        trackName,
        lapLengthMeters: this.lapSamples.length > 0 ? this.lapSamples[this.lapSamples.length - 1].dist : 0,
        sampleCount: this.lapSamples.length || this.liveSamples.length,
        bounds: this.bounds,
        isLoopClosed: this.isLoopClosed,
        ...customMetadata
      },
      corners: this.corners.map(c => ({
        cornerNumber: c.cornerNumber,
        cornerName: c.cornerName,
        direction: c.direction,
        startDistance: c.startDistance,
        apexDistance: c.apexDistance,
        endDistance: c.endDistance,
        apexSpeedMps: c.apexSpeedMps,
        entrySpeedMps: c.entrySpeedMps,
        exitSpeedMps: c.exitSpeedMps,
        peakLateralG: c.peakLateralG,
        radiusMeters: c.radiusMeters,
        apexDepthPercent: c.apexDepthPercent
      })),
      pathSamples: (this.lapSamples.length >= 30 ? this.lapSamples : this.liveSamples).map(s => ({
        x: Number(s.x.toFixed(2)),
        y: Number(s.y.toFixed(2)),
        z: Number(s.z.toFixed(2)),
        speed: Number(s.speed.toFixed(2)),
        lateralG: Number(s.lateralG.toFixed(2)),
        throttle: Number(s.throttle.toFixed(2)),
        brake: Number(s.brake.toFixed(2)),
        dist: Number((s.dist || 0).toFixed(2))
      }))
    };

    return JSON.stringify(payload, null, 2);
  }

  /**
   * Imports track geometry and corner landmarks from a JSON string or object
   * @param {string|Object} jsonInput JSON string or parsed object
   * @returns {boolean} Success status
   */
  importFromJson(jsonInput) {
    try {
      const data = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
      if (!data || !data.pathSamples || !Array.isArray(data.pathSamples)) {
        throw new Error('Invalid APEX Circuit Strategy Map format: missing pathSamples');
      }

      this.reset();
      this.isLoopClosed = !!data.trackInfo?.isLoopClosed;

      // Restore Samples & Bounds
      for (const s of data.pathSamples) {
        const sample = {
          x: s.x,
          y: s.y,
          z: s.z,
          speed: s.speed || 0,
          lateralG: s.lateralG || 0,
          throttle: s.throttle || 0,
          brake: s.brake || 0,
          dist: s.dist || 0,
          lap: 1,
          timestamp: Date.now()
        };
        this.updateBounds(sample.x, sample.y, sample.z);
        this.liveSamples.push(sample);
        this.lapSamples.push(sample);
      }

      // Restore or Detect Corners
      if (data.corners && Array.isArray(data.corners) && data.corners.length > 0) {
        this.corners = data.corners.map(c => {
          // Re-slice corner samples based on closest distances
          const cSamples = this.lapSamples.filter(s => s.dist >= c.startDistance && s.dist <= c.endDistance);
          return {
            ...c,
            samples: cSamples.length > 0 ? cSamples : this.lapSamples.slice(0, 30)
          };
        });
      } else {
        this.detectCorners();
      }

      return true;
    } catch (err) {
      console.error('[CircuitTelemetryMapper] Import failed:', err);
      return false;
    }
  }
}
