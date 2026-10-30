package com.apex.telemetry.core.analysis

import com.apex.telemetry.core.analysis.model.CornerType
import com.apex.telemetry.core.network.model.FourWheelBooleans
import com.apex.telemetry.core.network.model.FourWheelFloats
import com.apex.telemetry.core.network.model.TelemetrySample
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CornerDetectorTest {

    private fun createCornerSample(
        index: Int,
        speedKmh: Float,
        brake: Float,
        throttle: Float,
        steering: Float,
        lateralG: Float
    ): TelemetrySample {
        return TelemetrySample(
            timestampMs = 1000L + (index * 16L),
            isRaceOn = true,
            currentRpm = 6500f,
            idleRpm = 1000f,
            maxRpm = 8500f,
            powerWatts = 250000f,
            powerHp = 335f,
            torqueNm = 400f,
            torqueFtLb = 295f,
            numCylinders = 6,
            boost = 1.0f,
            carOrdinal = 10,
            carClass = "S",
            carClassId = 5,
            carPerformanceIndex = 800,
            drivetrain = "RWD",
            drivetrainTypeId = 1,
            fuel = 0.8f,
            trackOrdinal = 1,
            positionX = index * 5.0f,
            positionY = 0f,
            positionZ = 0f,
            speedMps = speedKmh / 3.6f,
            speedMph = speedKmh * 0.621371f,
            speedKmh = speedKmh,
            accelerationX = lateralG * 9.80665f,
            accelerationY = 0f,
            accelerationZ = 0f,
            lateralG = lateralG,
            verticalG = 0f,
            longitudinalG = 0f,
            angularVelocityX = 0f,
            angularVelocityY = 0f,
            angularVelocityZ = 0f,
            yaw = if (steering > 0) 0.5f else 0f,
            pitch = 0f,
            roll = 0f,
            throttle = throttle,
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
            currentLapTime = index * 0.016f,
            bestLapTime = 0f,
            lastLapTime = 0f,
            currentRaceTime = 10f,
            distanceTraveled = index * 5f,
            normalizedDrivingLine = 0,
            normalizedAIBrakeDifference = 0
        )
    }

    @Test
    fun detectCorners_singleHairpin_extractsLandmarksAccurately() {
        val detector = CornerDetector()
        val samples = mutableListOf<TelemetrySample>()

        // 1. Straight approach (samples 0..19): 200 km/h, throttle = 1.0, brake = 0, steer = 0
        for (i in 0..19) {
            samples.add(createCornerSample(i, 200f, brake = 0f, throttle = 1.0f, steering = 0f, lateralG = 0f))
        }

        // 2. Threshold braking straight (samples 20..29): 190 -> 120 km/h, brake = 0.90, throttle = 0, steer = 0
        for (i in 20..29) {
            val spd = 190f - ((i - 20) * 7f)
            samples.add(createCornerSample(i, spd, brake = 0.90f, throttle = 0f, steering = 0f, lateralG = 0f))
        }

        // 3. Trail-braking & Turn-in (samples 30..39): 120 -> 85 km/h, brake = 0.40 -> 0.10, steer = 0.45 (Right), latG = 1.1G
        for (i in 30..39) {
            val spd = 120f - ((i - 30) * 3.5f)
            val brk = 0.40f - ((i - 30) * 0.03f)
            samples.add(createCornerSample(i, spd, brake = brk, throttle = 0f, steering = 0.45f, lateralG = 1.1f))
        }

        // 4. Apex (samples 40..42): 80 km/h (minimum), brake = 0, throttle = 0, steer = 0.50, latG = 1.4G
        for (i in 40..42) {
            samples.add(createCornerSample(i, 80f, brake = 0f, throttle = 0f, steering = 0.50f, lateralG = 1.4f))
        }

        // 5. Throttle pickup & Exit acceleration (samples 43..55): 85 -> 150 km/h, throttle = 0.80, steer unwinding 0.30 -> 0.0f
        for (i in 43..55) {
            val spd = 85f + ((i - 43) * 5f)
            val st = (0.35f - ((i - 43) * 0.03f)).coerceAtLeast(0f)
            samples.add(createCornerSample(i, spd, brake = 0f, throttle = 0.85f, steering = st, lateralG = 0.6f))
        }

        // 6. Exit straight (samples 56..70): 160 -> 210 km/h, throttle = 1.0, steer = 0
        for (i in 56..70) {
            val spd = 160f + ((i - 56) * 3f)
            samples.add(createCornerSample(i, spd, brake = 0f, throttle = 1.0f, steering = 0f, lateralG = 0f))
        }

        val corners = detector.detectCorners(samples)

        assertEquals(1, corners.size)
        val corner = corners[0]

        assertEquals("Turn 1", corner.name)
        assertEquals("Right", corner.direction)
        assertTrue(corner.apexIndex in 39..43)
        assertEquals(80f, corner.vMinKmh, 1.0f)
        assertTrue("Brake index must be before apex", corner.brakeIndex < corner.apexIndex)
        assertTrue("Turn-in index must be before or at apex", corner.turnInIndex <= corner.apexIndex)
        assertTrue("Exit index must be after apex", corner.exitIndex >= corner.apexIndex)
        assertTrue("Brake pressure recorded", corner.maxBrakePressure >= 0.80f)
    }
}

