package com.apex.telemetry.core.analysis

import com.apex.telemetry.core.analysis.model.FrictionPhase
import com.apex.telemetry.core.network.model.FourWheelBooleans
import com.apex.telemetry.core.network.model.FourWheelFloats
import com.apex.telemetry.core.network.model.TelemetrySample
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FrictionCircleCalculatorTest {

    private fun createSample(
        brake: Float = 0f,
        throttle: Float = 0f,
        lateralG: Float = 0f,
        longitudinalG: Float = 0f
    ): TelemetrySample {
        return TelemetrySample(
            timestampMs = 1000L,
            isRaceOn = true,
            currentRpm = 6000f,
            idleRpm = 1000f,
            maxRpm = 8500f,
            powerWatts = 200000f,
            powerHp = 268f,
            torqueNm = 350f,
            torqueFtLb = 258f,
            numCylinders = 6,
            boost = 0.8f,
            carOrdinal = 1,
            carClass = "A",
            carClassId = 4,
            carPerformanceIndex = 700,
            drivetrain = "RWD",
            drivetrainTypeId = 1,
            fuel = 0.9f,
            trackOrdinal = 10,
            positionX = 0f,
            positionY = 0f,
            positionZ = 0f,
            speedMps = 30f,
            speedMph = 67f,
            speedKmh = 108f,
            accelerationX = lateralG * 9.80665f,
            accelerationY = 0f,
            accelerationZ = longitudinalG * 9.80665f,
            lateralG = lateralG,
            verticalG = 0f,
            longitudinalG = longitudinalG,
            angularVelocityX = 0f,
            angularVelocityY = 0f,
            angularVelocityZ = 0f,
            yaw = 0f,
            pitch = 0f,
            roll = 0f,
            throttle = throttle,
            brake = brake,
            clutch = 0f,
            handbrake = 0f,
            steering = if (lateralG != 0f) 0.3f else 0f,
            gear = 3,
            rawGear = 3,
            normSuspensionTravel = FourWheelFloats.ZERO,
            suspensionTravelMeters = FourWheelFloats.ZERO,
            wheelRotationSpeed = FourWheelFloats.ZERO,
            wheelOnRumbleStrip = FourWheelBooleans.FALSE,
            wheelInPuddleDepth = FourWheelFloats.ZERO,
            surfaceRumble = FourWheelFloats.ZERO,
            tireTempF = FourWheelFloats.ZERO,
            tireTempC = FourWheelFloats.ZERO,
            tireSlipRatio = FourWheelFloats.ZERO,
            tireSlipAngle = FourWheelFloats.ZERO,
            tireCombinedSlip = FourWheelFloats.ZERO,
            tireWear = FourWheelFloats.ZERO,
            lapNumber = 1,
            rawLapNumber = 0,
            racePosition = 1,
            currentLapTime = 10f,
            bestLapTime = 0f,
            lastLapTime = 0f,
            currentRaceTime = 10f,
            distanceTraveled = 500f,
            normalizedDrivingLine = 0,
            normalizedAIBrakeDifference = 0
        )
    }

    @Test
    fun classifyPoint_phasesDetectedCorrectly() {
        val calc = FrictionCircleCalculator()

        // 1. Trail-Braking (Brake + Cornering)
        val p1 = calc.classifyPoint(createSample(brake = 0.5f, lateralG = 1.0f))
        assertEquals(FrictionPhase.BRAKE_TURN, p1.phase)

        // 2. Straight threshold braking
        val p2 = calc.classifyPoint(createSample(brake = 0.9f, lateralG = 0.05f))
        assertEquals(FrictionPhase.BRAKING, p2.phase)

        // 3. Power Exit (Throttle + Cornering)
        val p3 = calc.classifyPoint(createSample(throttle = 0.7f, lateralG = 0.8f))
        assertEquals(FrictionPhase.ACCELERATE_TURN, p3.phase)

        // 4. Straight Acceleration
        val p4 = calc.classifyPoint(createSample(throttle = 1.0f, lateralG = 0.0f))
        assertEquals(FrictionPhase.ACCELERATING, p4.phase)

        // 5. Neutral Apex Cornering (Zero pedals, high lateral G)
        val p5 = calc.classifyPoint(createSample(brake = 0f, throttle = 0f, lateralG = 1.3f))
        assertEquals(FrictionPhase.CORNERING, p5.phase)

        // 6. Straight Coast
        val p6 = calc.classifyPoint(createSample(brake = 0f, throttle = 0f, lateralG = 0f))
        assertEquals(FrictionPhase.STRAIGHT, p6.phase)
    }

    @Test
    fun analyze_stintSamples_calculatesLimitUtilization() {
        val calc = FrictionCircleCalculator()
        val samples = listOf(
            createSample(brake = 0.9f, longitudinalG = -1.5f), // High G brake (1.5G)
            createSample(lateralG = 1.4f),                    // High G corner (1.4G)
            createSample(throttle = 0.8f, longitudinalG = 0.9f), // Moderate accel (0.9G)
            createSample(brake = 0f, throttle = 0f, lateralG = 0.1f) // Coast
        )

        val result = calc.analyze(samples)

        assertEquals(4, result.totalSamples)
        assertEquals(1.5f, result.maxG, 0.01f)
        assertTrue(result.limitUtilizationPercent > 0f)
        assertEquals(4, result.points.size)
    }
}

