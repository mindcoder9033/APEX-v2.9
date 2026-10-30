package com.apex.telemetry.core.analysis.model

enum class TrailBrakingGrade(val label: String) {
    OPTIMAL_PRO("OPTIMAL (PRO)"),
    GOOD("GOOD"),
    FAIR("FAIR"),
    POOR("POOR"),
    NOT_AVAILABLE("N/A")
}

/**
 * Quantitative diagnosis of the driver's transition from threshold straight-line braking
 * into apex turn-in per Skip Barber Chapter 5 principles.
 */
data class TrailBrakingResult(
    val score: Int,                         // 0..100
    val grade: TrailBrakingGrade,
    val overlapPercent: Int,                // % of entry samples where brake & steering coexisted
    val releaseSmoothness: Float,           // 0.0 .. 1.0 (decay linearity vs erratic spikes)
    val frictionUtilization: Float,        // 0.0 .. 1.0 (G-G radius retention)
    val brakeAtTurnIn: Float,               // Brake pressure applied at exact turn-in point
    val coachingMessage: String
)

