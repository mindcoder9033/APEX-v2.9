package com.apex.telemetry.core.network.model

/**
 * 4-Corner wheel values (Front-Left, Front-Right, Rear-Left, Rear-Right).
 * Used for tire temperatures, slip ratios, suspension travel, etc.
 */
data class FourWheelFloats(
    val frontLeft: Float,
    val frontRight: Float,
    val rearLeft: Float,
    val rearRight: Float
) {
    val average: Float get() = (frontLeft + frontRight + rearLeft + rearRight) / 4.0f
    val max: Float get() = maxOf(frontLeft, frontRight, rearLeft, rearRight)
    val min: Float get() = minOf(frontLeft, frontRight, rearLeft, rearRight)

    companion object {
        val ZERO = FourWheelFloats(0f, 0f, 0f, 0f)
    }
}

data class FourWheelBooleans(
    val frontLeft: Boolean,
    val frontRight: Boolean,
    val rearLeft: Boolean,
    val rearRight: Boolean
) {
    val anyTrue: Boolean get() = frontLeft || frontRight || rearLeft || rearRight
    
    companion object {
        val FALSE = FourWheelBooleans(false, false, false, false)
    }
}

/**
 * Immutable telemetry frame decoded from Forza Motorsport 2023 60Hz UDP data stream.
 */
data class TelemetrySample(
    val timestampMs: Long,
    val isRaceOn: Boolean,

    // Engine & Transmission
    val currentRpm: Float,
    val idleRpm: Float,
    val maxRpm: Float,
    val powerWatts: Float,
    val powerHp: Float,
    val torqueNm: Float,
    val torqueFtLb: Float,
    val numCylinders: Int,
    val boost: Float,

    // Vehicle Classification
    val carOrdinal: Int,
    val carClass: String,
    val carClassId: Int,
    val carPerformanceIndex: Int,
    val drivetrain: String,
    val drivetrainTypeId: Int,
    val fuel: Float,
    val trackOrdinal: Int,

    // Coordinates & Motion (Car Local & World Space)
    val positionX: Float,
    val positionY: Float,
    val positionZ: Float,
    val speedMps: Float,
    val speedMph: Float,
    val speedKmh: Float,
    val accelerationX: Float,
    val accelerationY: Float,
    val accelerationZ: Float,
    val lateralG: Float,
    val verticalG: Float,
    val longitudinalG: Float,
    val angularVelocityX: Float,
    val angularVelocityY: Float,
    val angularVelocityZ: Float,
    val yaw: Float,
    val pitch: Float,
    val roll: Float,

    // Driver Inputs (Normalized 0.0 .. 1.0, Steer -1.0 .. +1.0)
    val throttle: Float,
    val brake: Float,
    val clutch: Float,
    val handbrake: Float,
    val steering: Float,
    val gear: Int,
    val rawGear: Int,

    // Chassis & Suspension
    val normSuspensionTravel: FourWheelFloats,
    val suspensionTravelMeters: FourWheelFloats,
    val wheelRotationSpeed: FourWheelFloats,
    val wheelOnRumbleStrip: FourWheelBooleans,
    val wheelInPuddleDepth: FourWheelFloats,
    val surfaceRumble: FourWheelFloats,

    // Tire Dynamics
    val tireTempF: FourWheelFloats,
    val tireTempC: FourWheelFloats,
    val tireSlipRatio: FourWheelFloats,
    val tireSlipAngle: FourWheelFloats,
    val tireCombinedSlip: FourWheelFloats,
    val tireWear: FourWheelFloats,

    // Timing & Session State
    val lapNumber: Int,
    val rawLapNumber: Int,
    val racePosition: Int,
    val currentLapTime: Float,
    val bestLapTime: Float,
    val lastLapTime: Float,
    val currentRaceTime: Float,
    val distanceTraveled: Float,
    val normalizedDrivingLine: Int,
    val normalizedAIBrakeDifference: Int
) {
    /** Total combined horizontal G-force for Friction Circle calculations */
    val totalHorizontalG: Float
        get() = kotlin.math.sqrt(lateralG * lateralG + longitudinalG * longitudinalG)

    /** RPM percentage relative to engine powerband */
    val rpmPercentage: Float
        get() = if (maxRpm > idleRpm) {
            ((currentRpm - idleRpm) / (maxRpm - idleRpm)).coerceIn(0.0f, 1.0f)
        } else 0.0f
}

