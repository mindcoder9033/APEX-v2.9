package com.apex.telemetry.core.analysis.model

import com.apex.telemetry.core.network.model.TelemetrySample

enum class CornerType {
    LEFT,
    RIGHT,
    HAIRPIN
}

/**
 * Detailed corner profile partitioned into Entry, Apex, and Exit phases
 * per Skip Barber "Going Faster!" racecraft methodology.
 */
data class Corner(
    val cornerNumber: Int,
    val name: String,
    val type: CornerType,
    val direction: String, // "Left" or "Right"
    val entryIndex: Int,
    val brakeIndex: Int,
    val turnInIndex: Int,
    val apexIndex: Int,
    val tapIndex: Int,     // Throttle Application Point
    val exitIndex: Int,
    val vMinKmh: Float,
    val vMinMph: Float,
    val maxLateralG: Float,
    val maxBrakePressure: Float,
    val trailBrakingOverlapDistanceMeters: Float,
    val trailBrakingScore: Float, // 0..100
    val exitSpeedKmh: Float,
    val coachingNote: String,
    val apexSample: TelemetrySample
)

