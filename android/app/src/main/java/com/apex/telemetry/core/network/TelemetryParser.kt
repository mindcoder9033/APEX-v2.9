package com.apex.telemetry.core.network

import com.apex.telemetry.core.network.model.FourWheelBooleans
import com.apex.telemetry.core.network.model.FourWheelFloats
import com.apex.telemetry.core.network.model.TelemetrySample
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * High-performance, zero-copy binary parser for Forza Motorsport 2023 UDP telemetry packets.
 * Decodes 311-byte (Standard Sled/Dash) and 331-byte (Extended CarDash with Tire Wear) frames.
 */
object TelemetryParser {

    const val MIN_PACKET_SIZE = 311
    const val EXTENDED_PACKET_SIZE = 331

    private const val MPS_TO_MPH = 2.236936f
    private const val MPS_TO_KMH = 3.6f
    private const val GRAVITY_MS2 = 9.80665f
    private const val WATTS_TO_HP = 0.00134102f
    private const val NM_TO_FTLB = 0.737562f

    private val CAR_CLASSES = arrayOf("E", "D", "C", "B", "A", "S", "R", "P", "X")
    private val DRIVETRAINS = arrayOf("FWD", "RWD", "AWD")

    /**
     * Checks if the packet size meets minimum telemetry requirements.
     */
    fun validate(byteLength: Int): Boolean = byteLength >= MIN_PACKET_SIZE

    /**
     * Parses a raw byte array into a structured [TelemetrySample].
     */
    fun parse(bytes: ByteArray, offset: Int = 0, length: Int = bytes.size): TelemetrySample {
        require(length >= MIN_PACKET_SIZE) {
            "Packet length $length is less than minimum $MIN_PACKET_SIZE bytes"
        }
        val buffer = ByteBuffer.wrap(bytes, offset, length).order(ByteOrder.LITTLE_ENDIAN)
        return parse(buffer)
    }

    /**
     * Parses from a direct or array-backed [ByteBuffer] configured with LITTLE_ENDIAN.
     */
    fun parse(buffer: ByteBuffer): TelemetrySample {
        val originalOrder = buffer.order()
        buffer.order(ByteOrder.LITTLE_ENDIAN)

        val byteLength = buffer.remaining()
        require(byteLength >= MIN_PACKET_SIZE) {
            "Buffer remaining $byteLength is less than minimum $MIN_PACKET_SIZE bytes"
        }

        // --- Header (8 bytes) ---
        // Timestamp is unsigned 32-bit integer
        val timestampMs = buffer.getInt(0).toLong() and 0xFFFFFFFFL
        val isRaceOn = buffer.getInt(4) != 0

        // --- Sled Data ---
        val engineMaxRpm = buffer.getFloat(8)
        val engineIdleRpm = buffer.getFloat(12)
        val currentEngineRpm = buffer.getFloat(16)

        // Acceleration in car local space (X = Right, Y = Up, Z = Forward)
        val accelerationX = buffer.getFloat(20)
        val accelerationY = buffer.getFloat(24)
        val accelerationZ = buffer.getFloat(28)

        // Velocity (m/s)
        val velocityX = buffer.getFloat(32)
        val velocityY = buffer.getFloat(36)
        val velocityZ = buffer.getFloat(40)

        // Angular velocity (rad/s)
        val angularVelocityX = buffer.getFloat(44)
        val angularVelocityY = buffer.getFloat(48)
        val angularVelocityZ = buffer.getFloat(52)

        // Orientation (rad)
        val yaw = buffer.getFloat(56)
        val pitch = buffer.getFloat(60)
        val roll = buffer.getFloat(64)

        // Normalized suspension travel
        val normSuspensionTravel = FourWheelFloats(
            frontLeft = buffer.getFloat(68),
            frontRight = buffer.getFloat(72),
            rearLeft = buffer.getFloat(76),
            rearRight = buffer.getFloat(80)
        )

        // Tire slip ratio
        val tireSlipRatio = FourWheelFloats(
            frontLeft = buffer.getFloat(84),
            frontRight = buffer.getFloat(88),
            rearLeft = buffer.getFloat(92),
            rearRight = buffer.getFloat(96)
        )

        // Wheel rotation speed (rad/s)
        val wheelRotationSpeed = FourWheelFloats(
            frontLeft = buffer.getFloat(100),
            frontRight = buffer.getFloat(104),
            rearLeft = buffer.getFloat(108),
            rearRight = buffer.getFloat(112)
        )

        // Wheel on rumble strip
        val wheelOnRumbleStrip = FourWheelBooleans(
            frontLeft = buffer.getInt(116) != 0,
            frontRight = buffer.getInt(120) != 0,
            rearLeft = buffer.getInt(124) != 0,
            rearRight = buffer.getInt(128) != 0
        )

        // Wheel in puddle depth
        val wheelInPuddleDepth = FourWheelFloats(
            frontLeft = buffer.getFloat(132),
            frontRight = buffer.getFloat(136),
            rearLeft = buffer.getFloat(140),
            rearRight = buffer.getFloat(144)
        )

        // Surface rumble
        val surfaceRumble = FourWheelFloats(
            frontLeft = buffer.getFloat(148),
            frontRight = buffer.getFloat(152),
            rearLeft = buffer.getFloat(156),
            rearRight = buffer.getFloat(160)
        )

        // Tire slip angle
        val tireSlipAngle = FourWheelFloats(
            frontLeft = buffer.getFloat(164),
            frontRight = buffer.getFloat(168),
            rearLeft = buffer.getFloat(172),
            rearRight = buffer.getFloat(176)
        )

        // Tire combined slip
        val tireCombinedSlip = FourWheelFloats(
            frontLeft = buffer.getFloat(180),
            frontRight = buffer.getFloat(184),
            rearLeft = buffer.getFloat(188),
            rearRight = buffer.getFloat(192)
        )

        // Suspension travel in meters
        val suspensionTravelMeters = FourWheelFloats(
            frontLeft = buffer.getFloat(196),
            frontRight = buffer.getFloat(200),
            rearLeft = buffer.getFloat(204),
            rearRight = buffer.getFloat(208)
        )

        val carOrdinal = buffer.getInt(212)
        val carClassId = buffer.getInt(216)
        val carClass = if (carClassId in CAR_CLASSES.indices) CAR_CLASSES[carClassId] else "Class $carClassId"
        val carPerformanceIndex = buffer.getInt(220)
        val drivetrainTypeId = buffer.getInt(224)
        val drivetrain = if (drivetrainTypeId in DRIVETRAINS.indices) DRIVETRAINS[drivetrainTypeId] else "UNKNOWN"
        val numCylinders = buffer.getInt(228)

        // --- Dash Data ---
        val positionX = buffer.getFloat(232)
        val positionY = buffer.getFloat(236)
        val positionZ = buffer.getFloat(240)

        val speedMps = buffer.getFloat(244)
        val speedMph = speedMps * MPS_TO_MPH
        val speedKmh = speedMps * MPS_TO_KMH

        val powerWatts = buffer.getFloat(248)
        val torqueNm = buffer.getFloat(252)

        val tireTempF = FourWheelFloats(
            frontLeft = buffer.getFloat(256),
            frontRight = buffer.getFloat(260),
            rearLeft = buffer.getFloat(264),
            rearRight = buffer.getFloat(268)
        )

        val tireTempC = FourWheelFloats(
            frontLeft = (tireTempF.frontLeft - 32.0f) * (5.0f / 9.0f),
            frontRight = (tireTempF.frontRight - 32.0f) * (5.0f / 9.0f),
            rearLeft = (tireTempF.rearLeft - 32.0f) * (5.0f / 9.0f),
            rearRight = (tireTempF.rearRight - 32.0f) * (5.0f / 9.0f)
        )

        val boost = buffer.getFloat(272)
        val fuel = buffer.getFloat(276)
        val distanceTraveled = buffer.getFloat(280)
        val bestLap = buffer.getFloat(284)
        val lastLap = buffer.getFloat(288)
        val currentLap = buffer.getFloat(292)
        val currentRaceTime = buffer.getFloat(296)

        val rawLapNumber = buffer.getShort(300).toInt() and 0xFFFF
        val lapNumber = rawLapNumber + 1
        val racePosition = buffer.get(302).toInt() and 0xFF

        val rawAccel = buffer.get(303).toInt() and 0xFF
        val rawBrake = buffer.get(304).toInt() and 0xFF
        val rawClutch = buffer.get(305).toInt() and 0xFF
        val rawHandBrake = buffer.get(306).toInt() and 0xFF
        val rawGear = buffer.get(307).toInt() and 0xFF
        val rawSteer = buffer.get(308).toInt() // signed byte -128..127

        val normalizedDrivingLine = buffer.get(309).toInt()
        val normalizedAIBrakeDifference = buffer.get(310).toInt()

        // Extended FM23 fields
        val tireWear: FourWheelFloats
        val trackOrdinal: Int

        if (byteLength >= EXTENDED_PACKET_SIZE) {
            tireWear = FourWheelFloats(
                frontLeft = buffer.getFloat(311),
                frontRight = buffer.getFloat(315),
                rearLeft = buffer.getFloat(319),
                rearRight = buffer.getFloat(323)
            )
            trackOrdinal = buffer.getInt(327)
        } else {
            tireWear = FourWheelFloats.ZERO
            trackOrdinal = 0
        }

        buffer.order(originalOrder)

        return TelemetrySample(
            timestampMs = timestampMs,
            isRaceOn = isRaceOn,
            currentRpm = currentEngineRpm,
            idleRpm = engineIdleRpm,
            maxRpm = engineMaxRpm,
            powerWatts = powerWatts,
            powerHp = powerWatts * WATTS_TO_HP,
            torqueNm = torqueNm,
            torqueFtLb = torqueNm * NM_TO_FTLB,
            numCylinders = numCylinders,
            boost = boost,
            carOrdinal = carOrdinal,
            carClass = carClass,
            carClassId = carClassId,
            carPerformanceIndex = carPerformanceIndex,
            drivetrain = drivetrain,
            drivetrainTypeId = drivetrainTypeId,
            fuel = fuel,
            trackOrdinal = trackOrdinal,
            positionX = positionX,
            positionY = positionY,
            positionZ = positionZ,
            speedMps = speedMps,
            speedMph = speedMph,
            speedKmh = speedKmh,
            accelerationX = accelerationX,
            accelerationY = accelerationY,
            accelerationZ = accelerationZ,
            lateralG = accelerationX / GRAVITY_MS2,
            verticalG = accelerationY / GRAVITY_MS2,
            longitudinalG = accelerationZ / GRAVITY_MS2,
            angularVelocityX = angularVelocityX,
            angularVelocityY = angularVelocityY,
            angularVelocityZ = angularVelocityZ,
            yaw = yaw,
            pitch = pitch,
            roll = roll,
            throttle = (rawAccel / 255.0f).coerceIn(0.0f, 1.0f),
            brake = (rawBrake / 255.0f).coerceIn(0.0f, 1.0f),
            clutch = (rawClutch / 255.0f).coerceIn(0.0f, 1.0f),
            handbrake = (rawHandBrake / 255.0f).coerceIn(0.0f, 1.0f),
            steering = (rawSteer / 127.0f).coerceIn(-1.0f, 1.0f),
            gear = rawGear,
            rawGear = rawGear,
            normSuspensionTravel = normSuspensionTravel,
            suspensionTravelMeters = suspensionTravelMeters,
            wheelRotationSpeed = wheelRotationSpeed,
            wheelOnRumbleStrip = wheelOnRumbleStrip,
            wheelInPuddleDepth = wheelInPuddleDepth,
            surfaceRumble = surfaceRumble,
            tireTempF = tireTempF,
            tireTempC = tireTempC,
            tireSlipRatio = tireSlipRatio,
            tireSlipAngle = tireSlipAngle,
            tireCombinedSlip = tireCombinedSlip,
            tireWear = tireWear,
            lapNumber = lapNumber,
            rawLapNumber = rawLapNumber,
            racePosition = racePosition,
            currentLapTime = currentLap,
            bestLapTime = bestLap,
            lastLapTime = lastLap,
            currentRaceTime = currentRaceTime,
            distanceTraveled = distanceTraveled,
            normalizedDrivingLine = normalizedDrivingLine,
            normalizedAIBrakeDifference = normalizedAIBrakeDifference
        )
    }
}

