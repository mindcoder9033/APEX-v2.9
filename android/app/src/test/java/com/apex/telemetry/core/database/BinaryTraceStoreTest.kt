package com.apex.telemetry.core.database

import com.apex.telemetry.core.database.storage.BinaryTraceStore
import com.apex.telemetry.core.network.model.FourWheelBooleans
import com.apex.telemetry.core.network.model.FourWheelFloats
import com.apex.telemetry.core.network.model.TelemetrySample
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class BinaryTraceStoreTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private fun createSample(
        timestampMs: Long,
        speedKmh: Float,
        throttle: Float,
        brake: Float,
        gear: Int,
        lapNumber: Int
    ): TelemetrySample {
        return TelemetrySample(
            timestampMs = timestampMs,
            isRaceOn = true,
            currentRpm = 6500f,
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
            positionX = 120.5f,
            positionY = 15.2f,
            positionZ = -340.8f,
            speedMps = speedKmh / 3.6f,
            speedMph = speedKmh * 0.621371f,
            speedKmh = speedKmh,
            accelerationX = 9.8f,
            accelerationY = 0f,
            accelerationZ = -4.9f,
            lateralG = 1.0f,
            verticalG = 0f,
            longitudinalG = -0.5f,
            angularVelocityX = 0f,
            angularVelocityY = 0f,
            angularVelocityZ = 0f,
            yaw = 0.25f,
            pitch = 0f,
            roll = 0f,
            throttle = throttle,
            brake = brake,
            clutch = 0f,
            handbrake = 0f,
            steering = 0.15f,
            gear = gear,
            rawGear = gear,
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
            currentLapTime = 12.5f,
            bestLapTime = 72.0f,
            lastLapTime = 73.1f,
            currentRaceTime = 150f,
            distanceTraveled = 850f,
            normalizedDrivingLine = 0,
            normalizedAIBrakeDifference = 0
        )
    }

    @Test
    fun binaryTrace_writeAndReadRoundTrip() {
        val tracesDir = tempFolder.newFolder("traces")
        val store = BinaryTraceStore(tracesDir)

        val samples = listOf(
            createSample(timestampMs = 1000L, speedKmh = 120f, throttle = 1.0f, brake = 0f, gear = 3, lapNumber = 1),
            createSample(timestampMs = 1016L, speedKmh = 125f, throttle = 1.0f, brake = 0f, gear = 3, lapNumber = 1),
            createSample(timestampMs = 1032L, speedKmh = 80f, throttle = 0f, brake = 0.85f, gear = 2, lapNumber = 2)
        )

        val stintId = 42L
        val file = store.writeTrace(stintId, samples)
        assertTrue(file.exists())
        assertTrue(file.length() > 0)

        // Read all
        val points = store.readTrace(file)
        assertEquals(3, points.size)

        val p1 = points[0]
        assertEquals(1000L, p1.timestampMs)
        assertEquals(120f, p1.speedKmh, 0.01f)
        assertEquals(1.0f, p1.throttle, 0.01f)
        assertEquals(0f, p1.brake, 0.01f)
        assertEquals(3, p1.gear)
        assertEquals(1, p1.lapNumber)
        assertEquals(120.5f, p1.positionX, 0.01f)

        // Read filtered to lap 2
        val lap2Points = store.readLapTrace(file, targetLapNumber = 2)
        assertEquals(1, lap2Points.size)
        assertEquals(80f, lap2Points[0].speedKmh, 0.01f)
        assertEquals(0.85f, lap2Points[0].brake, 0.01f)

        // Delete trace
        assertTrue(store.deleteTrace(stintId))
        assertTrue(!file.exists())
    }
}

