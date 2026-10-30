package com.apex.telemetry.core.network.model

/**
 * Real-time connection and telemetry feed state for the UDP receiver.
 */
sealed class ConnectionStatus {

    /** Socket is closed and receiver is stopped. */
    object Disconnected : ConnectionStatus()

    /** Socket is open and listening on [port], waiting for incoming Forza UDP packets. */
    data class Listening(val port: Int) : ConnectionStatus()

    /** Actively receiving and decoding telemetry packets at [packetRateHz] frequency. */
    data class Streaming(
        val port: Int,
        val packetRateHz: Int,
        val totalPackets: Long,
        val lastTimestampMs: Long
    ) : ConnectionStatus()

    /** An error occurred while opening or reading from the socket. */
    data class Error(val message: String, val cause: Throwable? = null) : ConnectionStatus()
}

