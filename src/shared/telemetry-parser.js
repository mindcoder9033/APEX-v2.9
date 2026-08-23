/**
 * APEX Telemetry Parser
 * Decodes 331-byte binary UDP telemetry packets from Forza Motorsport 2023.
 */

import {
  mpsToMph,
  mpsToKmh,
  accelToG,
  normalizeByteInput,
  normalizeSteerInput,
  CAR_CLASSES,
  DRIVETRAIN_TYPES
} from './telemetry-types.js';

export class TelemetryParser {
  /**
   * Validate if the incoming buffer/ArrayBuffer meets the minimum size requirement
   * @param {ArrayBuffer|Buffer|DataView} buffer 
   * @returns {{ valid: boolean, error?: string }}
   */
  static validate(buffer) {
    if (!buffer) {
      return { valid: false, error: 'Empty telemetry buffer' };
    }
    const byteLength = buffer.byteLength !== undefined ? buffer.byteLength : buffer.length;
    if (byteLength < 311) {
      return { valid: false, error: `Packet too small (${byteLength} bytes, expected at least 311 bytes)` };
    }
    return { valid: true };
  }

  /**
   * Parses binary buffer into structured telemetry sample object
   * @param {ArrayBuffer|Buffer|Uint8Array} rawData 
   * @returns {Object} Parsed telemetry sample
   */
  static parse(rawData) {
    if (!rawData) {
      throw new Error('Null or undefined rawData provided to TelemetryParser.parse');
    }

    let view;
    if (rawData instanceof DataView) {
      view = rawData;
    } else if (rawData.buffer instanceof ArrayBuffer) {
      view = new DataView(rawData.buffer, rawData.byteOffset || 0, rawData.byteLength);
    } else if (rawData instanceof ArrayBuffer) {
      view = new DataView(rawData);
    } else {
      // In Node.js Buffer
      const ab = rawData.buffer.slice(rawData.byteOffset, rawData.byteOffset + rawData.byteLength);
      view = new DataView(ab);
    }

    const byteLength = view.byteLength;
    if (byteLength < 311) {
      throw new Error(`Packet length ${byteLength} is less than minimum 311 bytes`);
    }

    const littleEndian = true;

    // --- Header (8 bytes) ---
    const timestampMs = view.getUint32(0, littleEndian);
    const isRaceOn = view.getInt32(4, littleEndian);

    // --- Sled Data ---
    const engineMaxRpm = view.getFloat32(8, littleEndian);
    const engineIdleRpm = view.getFloat32(12, littleEndian);
    const currentEngineRpm = view.getFloat32(16, littleEndian);

    // Accelerations (in car local space: X=Right, Y=Up, Z=Forward)
    const accelerationX = view.getFloat32(20, littleEndian);
    const accelerationY = view.getFloat32(24, littleEndian);
    const accelerationZ = view.getFloat32(28, littleEndian);

    // Velocities (m/s)
    const velocityX = view.getFloat32(32, littleEndian);
    const velocityY = view.getFloat32(36, littleEndian);
    const velocityZ = view.getFloat32(40, littleEndian);

    // Angular velocities (rad/s)
    const angularVelocityX = view.getFloat32(44, littleEndian);
    const angularVelocityY = view.getFloat32(48, littleEndian);
    const angularVelocityZ = view.getFloat32(52, littleEndian);

    // Orientation (rad)
    const yaw = view.getFloat32(56, littleEndian);
    const pitch = view.getFloat32(60, littleEndian);
    const roll = view.getFloat32(64, littleEndian);

    // Normalized suspension travel (0.0 = fully extended, 1.0 = fully compressed)
    const normSuspensionTravel = {
      frontLeft: view.getFloat32(68, littleEndian),
      frontRight: view.getFloat32(72, littleEndian),
      rearLeft: view.getFloat32(76, littleEndian),
      rearRight: view.getFloat32(80, littleEndian)
    };

    // Tire slip ratio
    const tireSlipRatio = {
      frontLeft: view.getFloat32(84, littleEndian),
      frontRight: view.getFloat32(88, littleEndian),
      rearLeft: view.getFloat32(92, littleEndian),
      rearRight: view.getFloat32(96, littleEndian)
    };

    // Wheel rotation speed (rad/s)
    const wheelRotationSpeed = {
      frontLeft: view.getFloat32(100, littleEndian),
      frontRight: view.getFloat32(104, littleEndian),
      rearLeft: view.getFloat32(108, littleEndian),
      rearRight: view.getFloat32(112, littleEndian)
    };

    // Wheel on rumble strip (0 or 1)
    const wheelOnRumbleStrip = {
      frontLeft: view.getInt32(116, littleEndian) !== 0,
      frontRight: view.getInt32(120, littleEndian) !== 0,
      rearLeft: view.getInt32(124, littleEndian) !== 0,
      rearRight: view.getInt32(128, littleEndian) !== 0
    };

    // Wheel in puddle depth
    const wheelInPuddleDepth = {
      frontLeft: view.getFloat32(132, littleEndian),
      frontRight: view.getFloat32(136, littleEndian),
      rearLeft: view.getFloat32(140, littleEndian),
      rearRight: view.getFloat32(144, littleEndian)
    };

    // Surface rumble
    const surfaceRumble = {
      frontLeft: view.getFloat32(148, littleEndian),
      frontRight: view.getFloat32(152, littleEndian),
      rearLeft: view.getFloat32(156, littleEndian),
      rearRight: view.getFloat32(160, littleEndian)
    };

    // Tire slip angle
    const tireSlipAngle = {
      frontLeft: view.getFloat32(164, littleEndian),
      frontRight: view.getFloat32(168, littleEndian),
      rearLeft: view.getFloat32(172, littleEndian),
      rearRight: view.getFloat32(176, littleEndian)
    };

    // Tire combined slip
    const tireCombinedSlip = {
      frontLeft: view.getFloat32(180, littleEndian),
      frontRight: view.getFloat32(184, littleEndian),
      rearLeft: view.getFloat32(188, littleEndian),
      rearRight: view.getFloat32(192, littleEndian)
    };

    // Suspension travel in meters
    const suspensionTravelMeters = {
      frontLeft: view.getFloat32(196, littleEndian),
      frontRight: view.getFloat32(200, littleEndian),
      rearLeft: view.getFloat32(204, littleEndian),
      rearRight: view.getFloat32(208, littleEndian)
    };

    const carOrdinal = view.getInt32(212, littleEndian);
    const carClassId = view.getInt32(216, littleEndian);
    const carClass = CAR_CLASSES[carClassId] || `Class ${carClassId}`;
    const carPerformanceIndex = view.getInt32(220, littleEndian);
    const drivetrainTypeId = view.getInt32(224, littleEndian);
    const drivetrain = DRIVETRAIN_TYPES[drivetrainTypeId] || 'UNKNOWN';
    const numCylinders = view.getInt32(228, littleEndian);

    // --- Dash Data ---
    const positionX = view.getFloat32(232, littleEndian);
    const positionY = view.getFloat32(236, littleEndian);
    const positionZ = view.getFloat32(240, littleEndian);

    const speedMps = view.getFloat32(244, littleEndian);
    const speedMph = mpsToMph(speedMps);
    const speedKmh = mpsToKmh(speedMps);

    const powerWatts = view.getFloat32(248, littleEndian);
    const torqueNm = view.getFloat32(252, littleEndian);

    const tireTempF = {
      frontLeft: view.getFloat32(256, littleEndian),
      frontRight: view.getFloat32(260, littleEndian),
      rearLeft: view.getFloat32(264, littleEndian),
      rearRight: view.getFloat32(268, littleEndian)
    };

    const tireTempC = {
      frontLeft: (tireTempF.frontLeft - 32) * (5 / 9),
      frontRight: (tireTempF.frontRight - 32) * (5 / 9),
      rearLeft: (tireTempF.rearLeft - 32) * (5 / 9),
      rearRight: (tireTempF.rearRight - 32) * (5 / 9)
    };

    const boost = view.getFloat32(272, littleEndian);
    const fuel = view.getFloat32(276, littleEndian);
    const distanceTraveled = view.getFloat32(280, littleEndian);
    const bestLap = view.getFloat32(284, littleEndian);
    const lastLap = view.getFloat32(288, littleEndian);
    const currentLap = view.getFloat32(292, littleEndian);
    const currentRaceTime = view.getFloat32(296, littleEndian);

    const rawLapNumber = view.getUint16(300, littleEndian);
    const lapNumber = rawLapNumber + 1;
    const racePosition = view.getUint8(302);
    const rawAccel = view.getUint8(303);
    const rawBrake = view.getUint8(304);
    const rawClutch = view.getUint8(305);
    const rawHandBrake = view.getUint8(306);
    const rawGear = view.getUint8(307);
    const rawSteer = view.getInt8(308);
    const normalizedDrivingLine = view.getInt8(309);
    const normalizedAIBrakeDifference = view.getInt8(310);

    // Extended FM23 fields (byteLength >= 331)
    let tireWear = { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 };
    let trackOrdinal = 0;

    if (byteLength >= 331) {
      tireWear = {
        frontLeft: view.getFloat32(311, littleEndian),
        frontRight: view.getFloat32(315, littleEndian),
        rearLeft: view.getFloat32(319, littleEndian),
        rearRight: view.getFloat32(323, littleEndian)
      };
      trackOrdinal = view.getInt32(327, littleEndian);
    }

    return {
      timestampMs,
      isRaceOn: isRaceOn !== 0,
      
      // Engine & Transmission
      engine: {
        currentRpm: currentEngineRpm,
        idleRpm: engineIdleRpm,
        maxRpm: engineMaxRpm,
        powerWatts,
        powerHp: powerWatts * 0.00134102,
        torqueNm,
        torqueFtLb: torqueNm * 0.737562,
        numCylinders,
        boost
      },

      // Vehicle Profile
      vehicle: {
        carOrdinal,
        carClass,
        carClassId,
        carPerformanceIndex,
        drivetrain,
        drivetrainTypeId,
        fuel,
        trackOrdinal
      },

      // Motion & Dynamics
      motion: {
        position: { x: positionX, y: positionY, z: positionZ },
        velocity: { x: velocityX, y: velocityY, z: velocityZ },
        speedMps,
        speedMph,
        speedKmh,
        acceleration: {
          x: accelerationX,
          y: accelerationY,
          z: accelerationZ,
          lateralG: accelToG(accelerationX),
          verticalG: accelToG(accelerationY),
          longitudinalG: accelToG(accelerationZ)
        },
        angularVelocity: { x: angularVelocityX, y: angularVelocityY, z: angularVelocityZ },
        orientation: { yaw, pitch, roll }
      },

      // Driver Inputs (0.0 to 1.0, Steer -1.0 to +1.0)
      inputs: {
        throttle: normalizeByteInput(rawAccel),
        brake: normalizeByteInput(rawBrake),
        clutch: normalizeByteInput(rawClutch),
        handbrake: normalizeByteInput(rawHandBrake),
        steering: normalizeSteerInput(rawSteer),
        rawAccel,
        rawBrake,
        rawClutch,
        rawHandBrake,
        rawSteer,
        gear: rawGear
      },

      // Suspension & Wheels
      chassis: {
        normalizedSuspensionTravel: normSuspensionTravel,
        suspensionTravelMeters,
        wheelRotationSpeed,
        wheelOnRumbleStrip,
        wheelInPuddleDepth,
        surfaceRumble
      },

      // Tires
      tires: {
        tempF: tireTempF,
        tempC: tireTempC,
        slipRatio: tireSlipRatio,
        slipAngle: tireSlipAngle,
        combinedSlip: tireCombinedSlip,
        wear: tireWear
      },

      // Race & Lap Timing
      timing: {
        lapNumber,
        rawLapNumber,
        racePosition,
        currentLapTime: currentLap,
        bestLapTime: bestLap,
        lastLapTime: lastLap,
        currentRaceTime,
        distanceTraveled,
        normalizedDrivingLine,
        normalizedAIBrakeDifference
      }
    };
  }
}
