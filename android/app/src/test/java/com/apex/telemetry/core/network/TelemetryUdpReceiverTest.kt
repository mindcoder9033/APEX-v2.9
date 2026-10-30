package com.apex.telemetry.core.network

import com.apex.telemetry.core.network.model.ConnectionStatus
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.nio.ByteBuffer
import java.nio.ByteOrder

@OptIn(ExperimentalCoroutinesApi::class)
class TelemetryUdpReceiverTest {

    private lateinit var receiver: TelemetryUdpReceiver
    private val testPort = 19999 // High port for testing

    @Before
    fun setup() {
        receiver = TelemetryUdpReceiver()
    }

    @After
    fun tearDown() {
        receiver.stop()
    }

    @Test
    fun startReceiver_bindsAndListens() = runTest {
        receiver.start(this, port = testPort)
        assertTrue(receiver.isRunning)

        val status = receiver.connectionStatus.value
        assertTrue(status is ConnectionStatus.Listening)
        assertEquals(testPort, (status as ConnectionStatus.Listening).port)
    }

    @Test
    fun sendUdpPacket_receivedAndDecoded() = runTest {
        receiver.start(this, port = testPort)

        // Create a 311-byte valid telemetry packet
        val buffer = ByteBuffer.allocate(311).order(ByteOrder.LITTLE_ENDIAN)
        buffer.putInt(0, 7777)        // timestampMs
        buffer.putInt(4, 1)           // isRaceOn
        buffer.putFloat(8, 8500f)     // engineMaxRpm
        buffer.putFloat(16, 6000f)    // currentRpm
        buffer.putFloat(244, 45f)     // speedMps (45 * 3.6 = 162 km/h)
        buffer.put(303, 255.toByte()) // 100% throttle
        buffer.put(307, 3.toByte())   // 3rd gear

        val packetBytes = buffer.array()
        val clientSocket = DatagramSocket()
        val packet = DatagramPacket(
            packetBytes,
            packetBytes.size,
            InetAddress.getByName("127.0.0.1"),
            testPort
        )

        // Send packet to receiver
        clientSocket.send(packet)
        clientSocket.close()

        // Wait for parsed sample to emit from SharedFlow
        val sample = receiver.telemetryStream.first()

        assertEquals(7777L, sample.timestampMs)
        assertTrue(sample.isRaceOn)
        assertEquals(6000f, sample.currentRpm, 0.01f)
        assertEquals(162f, sample.speedKmh, 0.01f)
        assertEquals(1.0f, sample.throttle, 0.001f)
        assertEquals(3, sample.gear)

        // Verify sample added to Ring Buffer
        assertEquals(1, receiver.ringBuffer.size)
        assertEquals(sample, receiver.ringBuffer.latest())
    }

    @Test
    fun stopReceiver_transitionsToDisconnected() = runTest {
        receiver.start(this, port = testPort)
        receiver.stop()

        assertEquals(ConnectionStatus.Disconnected, receiver.connectionStatus.value)
        assertTrue(!receiver.isRunning)
    }
}

