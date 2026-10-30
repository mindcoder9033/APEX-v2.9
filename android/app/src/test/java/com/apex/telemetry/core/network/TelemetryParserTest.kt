package com.apex.telemetry.core.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.ByteBuffer
import java.nio.ByteOrder

class TelemetryParserTest {

    @Test
    fun parse_validStandardPacket311Bytes() {
        val buffer = ByteBuffer.allocate(311).order(ByteOrder.LITTLE_ENDIAN)

        // Header
        buffer.putInt(0, 5000)       // timestampMs
        buffer.putInt(4, 1)          // isRaceOn = true

        // Sled
        buffer.putFloat(8, 9000f)    // engineMaxRpm
        buffer.putFloat(12, 1000f)   // engineIdleRpm
        buffer.putFloat(16, 7500f)   // currentEngineRpm
        buffer.putFloat(20, 9.80665f)// accelerationX (1.0G lateral)
        buffer.putFloat(24, 0f)      // accelerationY
        buffer.putFloat(28, -9.80665f)// accelerationZ (-1.0G longitudinal)

        // Dash
        buffer.putFloat(244, 50f)    // speedMps (50 * 3.6 = 180 km/h)
        buffer.putFloat(256, 176f)   // tireTempF FL (176°F = 80°C)
        buffer.putShort(300, 3)      // rawLapNumber = 3 -> lapNumber = 4
        buffer.put(302, 2.toByte())  // racePosition = 2
        buffer.put(303, 255.toByte())// rawAccel = 255 (throttle = 1.0f)
        buffer.put(304, 127.toByte())// rawBrake = 127 (approx 0.498f)
        buffer.put(307, 5.toByte())  // gear = 5
        buffer.put(308, (-127).toByte()) // rawSteer = -127 (-1.0f left)

        val sample = TelemetryParser.parse(buffer.array())

        assertEquals(5000L, sample.timestampMs)
        assertTrue(sample.isRaceOn)
        assertEquals(7500f, sample.currentRpm, 0.01f)
        assertEquals(9000f, sample.maxRpm, 0.01f)
        assertEquals(1.0f, sample.lateralG, 0.01f)
        assertEquals(-1.0f, sample.longitudinalG, 0.01f)
        assertEquals(1.4142f, sample.totalHorizontalG, 0.01f)
        assertEquals(180f, sample.speedKmh, 0.01f)
        assertEquals(80f, sample.tireTempC.frontLeft, 0.01f)
        assertEquals(4, sample.lapNumber)
        assertEquals(2, sample.racePosition)
        assertEquals(1.0f, sample.throttle, 0.001f)
        assertEquals(127f / 255f, sample.brake, 0.001f)
        assertEquals(5, sample.gear)
        assertEquals(-1.0f, sample.steering, 0.001f)
        assertEquals(0f, sample.tireWear.frontLeft, 0.001f)
        assertEquals(0, sample.trackOrdinal)
    }

    @Test
    fun parse_validExtendedPacket331Bytes() {
        val buffer = ByteBuffer.allocate(331).order(ByteOrder.LITTLE_ENDIAN)

        buffer.putInt(0, 10000)
        buffer.putInt(4, 1)
        buffer.putFloat(8, 8000f)
        buffer.putFloat(12, 800f)
        buffer.putFloat(16, 4000f)

        // Extended fields
        buffer.putFloat(311, 0.12f)  // FL tire wear (12%)
        buffer.putFloat(315, 0.15f)  // FR tire wear (15%)
        buffer.putInt(327, 105)      // trackOrdinal = 105 (Silverstone)

        val sample = TelemetryParser.parse(buffer.array())

        assertEquals(0.12f, sample.tireWear.frontLeft, 0.001f)
        assertEquals(0.15f, sample.tireWear.frontRight, 0.001f)
        assertEquals(105, sample.trackOrdinal)
    }

    @Test(expected = IllegalArgumentException::class)
    fun parse_packetTooShort_throwsException() {
        val shortBytes = ByteArray(300)
        TelemetryParser.parse(shortBytes)
    }

    @Test
    fun validate_packetLengths() {
        assertFalse(TelemetryParser.validate(0))
        assertFalse(TelemetryParser.validate(310))
        assertTrue(TelemetryParser.validate(311))
        assertTrue(TelemetryParser.validate(331))
        assertTrue(TelemetryParser.validate(400))
    }
}

