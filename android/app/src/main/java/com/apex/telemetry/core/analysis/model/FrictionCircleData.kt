package com.apex.telemetry.core.analysis.model

/**
 * Operating phase within the tire traction envelope (G-G diagram).
 */
enum class FrictionPhase(val displayName: String, val hexColor: String) {
    BRAKE_TURN("Trail-Braking", "#E5A910"),       // Amber: Simultaneous brake + steering
    BRAKING("Straight Braking", "#E10600"),       // Red: Threshold deceleration
    ACCELERATE_TURN("Power Cornering", "#00E5FF"),// Cyan: Throttle on corner exit
    ACCELERATING("Straight Acceleration", "#00E676"),// Green: Longitudinal acceleration
    CORNERING("Lateral Grip (Apex)", "#9966FF"),  // Purple: Pure cornering load
    STRAIGHT("Coast / Straight", "#333333")       // Neutral
}

/**
 * Single coordinate point on the G-G friction circle.
 */
data class FrictionPoint(
    val lateralG: Float,       // X-axis (-1.5G Left to +1.5G Right)
    val longitudinalG: Float,  // Y-axis (-1.5G Braking to +1.0G Accel)
    val totalG: Float,         // sqrt(latG^2 + longG^2)
    val phase: FrictionPhase,
    val speedKmh: Float,
    val timestampMs: Long
)

/**
 * Stint-wide or lap-wide friction circle diagnostics.
 */
data class FrictionAnalysisResult(
    val points: List<FrictionPoint>,
    val maxG: Float,
    val averageRadius: Float,
    val limitUtilizationPercent: Float, // % of samples >= 70% of maxG
    val phaseBreakdown: Map<FrictionPhase, PhaseStats>,
    val totalSamples: Int
)

data class PhaseStats(
    val count: Int,
    val percent: Float
)

