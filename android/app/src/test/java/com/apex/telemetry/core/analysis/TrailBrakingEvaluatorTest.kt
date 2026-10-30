package com.apex.telemetry.core.analysis

import com.apex.telemetry.core.analysis.model.TrailBrakingGrade
import com.apex.telemetry.core.network.model.FourWheelBooleans
import com.apex.telemetry.core.network.model.FourWheelFloats
import com.apex.telemetry.core.network.model.TelemetrySample
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TrailBrakingEvaluatorTest {

    private fun createEntrySample(
        brake: Float,
        steering: Float,
        lateralG: Float,
        longitudinalG: Float
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
            throttle = 0f,
            brake = brake,
            clutch = 0f,
            handbrake = 0f,
            steering = steering,
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
    fun evaluateEntry_proDriver_optimalTrailBraking() {
        val evaluator = TrailBrakingEvaluator()
        val samples = mutableListOf<TelemetrySample>()

        // 1. Straight-line threshold braking (samples 0..4): 0.90 brake, 0 steering
        for (i in 0..4) {
            samples.add(createEntrySample(brake = 0.90f, steering = 0f, lateralG = 0f, longitudinalG = -1.3f))
        }

        // 2. Progressive trail off as steering increases towards apex (samples 5..14)
        for (i in 0..9) {
            val progress = i / 9f
            val brk = 0.70f * (1f - progress) // Bleeds off from 0.70 down to 0.0f
            val steer = 0.10f + (0.40f * progress) // Ramps up from 0.10 to 0.50
            val latG = 0.4f + (1.0f * progress)
            val longG = -1.0f * (1f - progress)
            samples.add(createEntrySample(brake = brk, steering = steer, lateralG = latG, longitudinalG = longG))
        }

        val result = evaluator.evaluateEntry(samples)

        assertTrue(result.score >= 80)
        assertTrue(result.grade == TrailBrakingGrade.OPTIMAL_PRO || result.grade == TrailBrakingGrade.GOOD)
        assertTrue(result.overlapPercent >= 40)
        assertEquals(1.0f, result.releaseSmoothness, 0.01f)
    }

    @Test
    fun evaluateEntry_abruptReleaseBeforeTurnIn_scoresPoor() {
        val evaluator = TrailBrakingEvaluator()
        val samples = mutableListOf<TelemetrySample>()

        // 1. Threshold braking (samples 0..4)
        for (i in 0..4) {
            samples.add(createEntrySample(brake = 0.90f, steering = 0f, lateralG = 0f, longitudinalG = -1.3f))
        }

        // 2. Abrupt total release BEFORE turning (samples 5..9): brake = 0, steer = 0, zero Gs
        for (i in 0..4) {
            samples.add(createEntrySample(brake = 0f, steering = 0f, lateralG = 0f, longitudinalG = 0f))
        }

        // 3. Late steering with no brake assistance (samples 10..14)
        for (i in 0..4) {
            samples.add(createEntrySample(brake = 0f, steering = 0.5f, lateralG = 0.9f, longitudinalG = 0f))
        }

        val result = evaluator.evaluateEntry(samples)

        assertTrue(result.score <= 50)
        assertEquals(TrailBrakingGrade.POOR, result.grade)
        assertEquals(0, result.overlapPercent)
    }
}

