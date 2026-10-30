package com.apex.telemetry.core.analysis

import com.apex.telemetry.core.network.model.FourWheelBooleans
import com.apex.telemetry.core.network.model.FourWheelFloats
import com.apex.telemetry.core.network.model.TelemetrySample
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LapSegmenterTest {

    private fun createSample(
        lapNumber: Int,
        timestampMs: Long,
        speedKmh: Float,
        currentLapTime: Float = 0f,
        lastLapTime: Float = 0f,
        posX: Float = 0f
    ): TelemetrySample {
        return TelemetrySample(
            timestampMs = timestampMs,
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
            positionX = posX,
            positionY = 0f,
            positionZ = 0f,
            speedMps = speedKmh / 3.6f,
            speedMph = speedKmh * 0.621371f,
            speedKmh = speedKmh,
            accelerationX = 0f,
            accelerationY = 0f,
            accelerationZ = 0f,
            lateralG = 0f,
            verticalG = 0f,
            longitudinalG = 0f,
            angularVelocityX = 0f,
            angularVelocityY = 0f,
            angularVelocityZ = 0f,
            yaw = 0f,
            pitch = 0f,
            roll = 0f,
            throttle = 1f,
            brake = 0f,
            clutch = 0f,
            handbrake = 0f,
            steering = 0f,
            gear = 4,
            rawGear = 4,
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
            lapNumber = lapNumber,
            rawLapNumber = lapNumber - 1,
            racePosition = 1,
            currentLapTime = currentLapTime,
            bestLapTime = 90f,
            lastLapTime = lastLapTime,
            currentRaceTime = 120f,
            distanceTraveled = posX,
            normalizedDrivingLine = 0,
            normalizedAIBrakeDifference = 0
        )
    }

    @Test
    fun segmentStint_twoLaps_classifiesOutLapAndFlyingLap() {
        val segmenter = LapSegmenter(minLapSamples = 5, minLapDurationSec = 2.0f)
        val samples = mutableListOf<TelemetrySample>()

        // Lap 1: Out-lap (15 samples)
        for (i in 0 until 15) {
            samples.add(
                createSample(
                    lapNumber = 1,
                    timestampMs = 1000L + (i * 100L),
                    speedKmh = 100f + i,
                    currentLapTime = i * 0.1f,
                    posX = i * 10f
                )
            )
        }

        // Lap 2: Flying Lap (20 samples)
        for (i in 0 until 20) {
            samples.add(
                createSample(
                    lapNumber = 2,
                    timestampMs = 3000L + (i * 100L),
                    speedKmh = 180f + i,
                    currentLapTime = i * 0.1f,
                    lastLapTime = 92.5f,
                    posX = 150f + (i * 15f)
                )
            )
        }

        val laps = segmenter.segmentStint(samples)

        assertEquals(2, laps.size)

        // Lap 1 assertions
        val lap1 = laps[0]
        assertEquals(1, lap1.lapNumber)
        assertTrue(lap1.isOutLap)
        assertFalse(lap1.isFlyingLap)
        assertEquals(15, lap1.sampleCount)

        // Lap 2 assertions
        val lap2 = laps[1]
        assertEquals(2, lap2.lapNumber)
        assertFalse(lap2.isOutLap)
        assertTrue(lap2.isFlyingLap)
        assertEquals(92.5f, lap2.lapTime, 0.01f)
        assertEquals(20, lap2.sampleCount)
        assertEquals(199f, lap2.maxSpeedKmh, 0.01f)
        assertEquals(180f, lap2.minSpeedKmh, 0.01f)
    }
}

