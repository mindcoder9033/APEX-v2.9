package com.apex.telemetry.core.analysis.model

import com.apex.telemetry.core.network.model.TelemetrySample

/**
 * Represents a segmented single lap within a racing stint.
 */
data class Lap(
    val lapNumber: Int,
    val startIndex: Int,
    val endIndex: Int,
    val sampleCount: Int,
    val lapTime: Float,
    val isValid: Boolean,
    val isOutLap: Boolean,
    val isInLap: Boolean,
    val isFlyingLap: Boolean,
    val maxSpeedKmh: Float,
    val minSpeedKmh: Float,
    val avgSpeedKmh: Float,
    val maxSpeedMph: Float,
    val minSpeedMph: Float,
    val avgSpeedMph: Float,
    val totalDistanceMeters: Float,
    val samples: List<TelemetrySample>
) {
    /** Formatted lap time string: MM:SS.mmm */
    val formattedLapTime: String
        get() {
            if (lapTime <= 0f) return "--:--.---"
            val minutes = (lapTime / 60).toInt()
            val seconds = (lapTime % 60).toInt()
            val millis = ((lapTime - lapTime.toInt()) * 1000).toInt()
            return String.format("%02d:%02d.%03d", minutes, seconds, millis)
        }
}

