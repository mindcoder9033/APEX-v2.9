package com.apex.telemetry.core.network

import com.apex.telemetry.core.network.model.ConnectionStatus
import com.apex.telemetry.core.network.model.TelemetrySample
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.IOException
import java.net.InetSocketAddress
import java.net.StandardSocketOptions
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.ClosedChannelException
import java.nio.channels.DatagramChannel
import java.util.concurrent.atomic.AtomicLong

/**
 * High-performance, non-blocking UDP socket receiver for Forza Motorsport 60Hz telemetry.
 * Ingests raw binary packets on a background IO dispatcher, decodes them with zero GC pressure,
 * updates the [CircularRingBuffer], and streams samples to subscribers via Kotlin [SharedFlow].
 */
class TelemetryUdpReceiver(
    val ringBuffer: CircularRingBuffer<TelemetrySample> = CircularRingBuffer(100_000),
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {

    companion object {
        const val DEFAULT_PORT = 9999
        private const val RECEIVE_BUFFER_CAPACITY = 1024
        private const val SOCKET_OS_BUFFER_BYTES = 256 * 1024 // 256KB OS network buffer
    }

    private var channel: DatagramChannel? = null
    private var ingestionJob: Job? = null
    private var healthCheckJob: Job? = null

    private val _connectionStatus = MutableStateFlow<ConnectionStatus>(ConnectionStatus.Disconnected)
    val connectionStatus: StateFlow<ConnectionStatus> = _connectionStatus.asStateFlow()

    // High-capacity backpressure-safe stream for 60Hz UI and analysis engines
    private val _telemetryStream = MutableSharedFlow<TelemetrySample>(
        replay = 1,
        extraBufferCapacity = 64,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val telemetryStream: SharedFlow<TelemetrySample> = _telemetryStream.asSharedFlow()

    private val totalPacketsReceived = AtomicLong(0L)
    private val packetsThisSecond = AtomicLong(0L)
    @Volatile private var lastPacketTimeMs = 0L

    val isRunning: Boolean get() = ingestionJob?.isActive == true

    /**
     * Binds the UDP socket to [port] and starts packet ingestion on [scope].
     */
    @Synchronized
    fun start(scope: CoroutineScope, port: Int = DEFAULT_PORT) {
        if (isRunning) return

        try {
            val datagramChannel = DatagramChannel.open().apply {
                setOption(StandardSocketOptions.SO_REUSEADDR, true)
                setOption(StandardSocketOptions.SO_RCVBUF, SOCKET_OS_BUFFER_BYTES)
                bind(InetSocketAddress("0.0.0.0", port))
                configureBlocking(true) // Blocking inside dedicated IO thread loop is most efficient
            }
            channel = datagramChannel

            totalPacketsReceived.set(0L)
            packetsThisSecond.set(0L)
            lastPacketTimeMs = 0L
            _connectionStatus.value = ConnectionStatus.Listening(port)

            // 1. Launch Ingestion Worker
            ingestionJob = scope.launch(ioDispatcher) {
                runIngestionLoop(datagramChannel, port)
            }

            // 2. Launch Rolling Frequency & Heartbeat Monitor
            healthCheckJob = scope.launch(ioDispatcher) {
                runHealthCheckLoop(port)
            }

        } catch (e: Exception) {
            _connectionStatus.value = ConnectionStatus.Error(
                message = "Failed to bind UDP port $port: ${e.message}",
                cause = e
            )
            stop()
        }
    }

    private fun CoroutineScope.runIngestionLoop(datagramChannel: DatagramChannel, port: Int) {
        val receiveBuffer = ByteBuffer.allocateDirect(RECEIVE_BUFFER_CAPACITY)
            .order(ByteOrder.LITTLE_ENDIAN)

        while (isActive && datagramChannel.isOpen) {
            try {
                receiveBuffer.clear()
                val sender = datagramChannel.receive(receiveBuffer)

                if (sender != null) {
                    receiveBuffer.flip()
                    val byteLength = receiveBuffer.remaining()

                    if (byteLength >= TelemetryParser.MIN_PACKET_SIZE) {
                        val sample = TelemetryParser.parse(receiveBuffer)
                        
                        // Push to memory cache
                        ringBuffer.push(sample)
                        
                        // Stream to subscribers
                        _telemetryStream.tryEmit(sample)

                        totalPacketsReceived.incrementAndGet()
                        packetsThisSecond.incrementAndGet()
                        lastPacketTimeMs = System.currentTimeMillis()
                    }
                }
            } catch (_: ClosedChannelException) {
                break
            } catch (ioe: IOException) {
                if (isActive) {
                    _connectionStatus.value = ConnectionStatus.Error("I/O error during packet read", ioe)
                }
                break
            } catch (e: Exception) {
                // Ignore single corrupted packet and continue listening
            }
        }
    }

    private suspend fun runHealthCheckLoop(port: Int) {
        while (true) {
            delay(1000L)
            val hz = packetsThisSecond.getAndSet(0L).toInt()
            val now = System.currentTimeMillis()
            val total = totalPacketsReceived.get()

            if (hz > 0) {
                _connectionStatus.value = ConnectionStatus.Streaming(
                    port = port,
                    packetRateHz = hz,
                    totalPackets = total,
                    lastTimestampMs = lastPacketTimeMs
                )
            } else if (lastPacketTimeMs > 0 && (now - lastPacketTimeMs) > 2500L) {
                // Signal idle/paused
                if (_connectionStatus.value is ConnectionStatus.Streaming) {
                    _connectionStatus.value = ConnectionStatus.Listening(port)
                }
            }
        }
    }

    /**
     * Closes the UDP socket and terminates all background collection workers.
     */
    @Synchronized
    fun stop() {
        try {
            channel?.close()
        } catch (_: Exception) {
        } finally {
            channel = null
        }

        ingestionJob?.cancel()
        healthCheckJob?.cancel()
        ingestionJob = null
        healthCheckJob = null

        _connectionStatus.value = ConnectionStatus.Disconnected
    }
}

