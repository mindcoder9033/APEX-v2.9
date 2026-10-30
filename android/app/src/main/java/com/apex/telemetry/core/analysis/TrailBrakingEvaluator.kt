package com.apex.telemetry.core.analysis

import com.apex.telemetry.core.analysis.model.TrailBrakingGrade
import com.apex.telemetry.core.analysis.model.TrailBrakingResult
import com.apex.telemetry.core.network.model.TelemetrySample
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * APEX Going Faster - Trail-Braking Evaluator
 * Evaluates the driver's transition from straight-line threshold braking into apex turn-in.
 * Quantifies brake bleed-off rate vs. steering lock ramp-up to ensure optimal friction circle utilization.
 */
class TrailBrakingEvaluator(
    val brakeThreshold: Float = 0.08f,  // 8% brake floor
    val steerThreshold: Float = 0.05f   // ~6 degrees steering angle threshold
) {

    /**
     * Evaluates trail-braking performance through the corner entry zone (from Braking Point to Apex).
     */
    fun evaluateEntry(samples: List<TelemetrySample>): TrailBrakingResult {
        if (samples.size < 5) {
            return TrailBrakingResult(
                score = 0,
                grade = TrailBrakingGrade.NOT_AVAILABLE,
                overlapPercent = 0,
                releaseSmoothness = 0f,
                frictionUtilization = 0f,
                brakeAtTurnIn = 0f,
                coachingMessage = "Insufficient telemetry samples in braking zone."
            )
        }

        var overlapCount = 0
        var maxBrake = 0f
        var brakeAtTurnIn = 0f
        var turnInIndex = 0

        // 1. Identify turn-in landmark and simultaneous brake/steer overlap
        for ((i, s) in samples.withIndex()) {
            val b = s.brake
            val st = abs(s.steering)
            if (b > maxBrake) maxBrake = b

            if (st >= steerThreshold && turnInIndex == 0) {
                turnInIndex = i
                brakeAtTurnIn = b
            }

            if (b >= brakeThreshold && st >= steerThreshold) {
                overlapCount++
            }
        }

        val overlapPercent = ((overlapCount.toFloat() / samples.size) * 100f).roundToInt()

        // 2. Measure brake release linearity and smoothness from turn-in to apex
        val entryToApex = samples.subList(turnInIndex, samples.size)
        var releaseSmoothness = 1.0f

        if (entryToApex.size > 3) {
            var erraticSpikes = 0
            for (i in 1 until entryToApex.size) {
                val prevB = entryToApex[i - 1].brake
                val currB = entryToApex[i].brake
                // Stepping on brakes harder after turn-in or jagged re-applications indicate hesitation
                if (currB > prevB + 0.15f) {
                    erraticSpikes++
                }
            }
            releaseSmoothness = (1.0f - (erraticSpikes.toFloat() / entryToApex.size)).coerceIn(0f, 1f)
        }

        // 3. Traction circle compliance: check for abrupt G-force drop (wasted grip)
        var gripDrops = 0
        for (s in entryToApex) {
            val totalG = sqrt(s.lateralG * s.lateralG + s.longitudinalG * s.longitudinalG)
            if (totalG < 0.40f && maxBrake > 0.50f) {
                gripDrops++
            }
        }
        val frictionUtilization = (1.0f - (gripDrops.toFloat() / maxOf(1, entryToApex.size))).coerceIn(0f, 1f)

        // 4. Composite Skip Barber score calculation (0 - 100)
        // Overlap (40pts) + Release Smoothness (35pts) + Friction Retention (25pts)
        val score = (
                (minOf(1.0f, overlapPercent / 35.0f) * 40f) +
                (releaseSmoothness * 35f) +
                (frictionUtilization * 25f)
        ).roundToInt().coerceIn(0, 100)

        val (grade, coaching) = when {
            score >= 85 -> Pair(
                TrailBrakingGrade.OPTIMAL_PRO,
                "Textbook Skip Barber trail braking! Progressive release maintaining tire load into the apex."
            )
            score >= 70 -> Pair(
                TrailBrakingGrade.GOOD,
                "Good trail-braking overlap. Aim for a slightly smoother release rate as you approach the apex."
            )
            score >= 50 -> Pair(
                TrailBrakingGrade.FAIR,
                "Brake release is disjointed from steering input. Bleed off brake pressure inversely to steering lock."
            )
            else -> Pair(
                TrailBrakingGrade.POOR,
                "Releasing brakes abruptly before turn-in. Carry light brake pressure all the way to the apex."
            )
        }

        return TrailBrakingResult(
            score = score,
            grade = grade,
            overlapPercent = overlapPercent,
            releaseSmoothness = releaseSmoothness,
            frictionUtilization = frictionUtilization,
            brakeAtTurnIn = brakeAtTurnIn,
            coachingMessage = coaching
        )
    }
}

