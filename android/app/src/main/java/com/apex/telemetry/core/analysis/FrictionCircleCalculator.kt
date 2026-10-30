package com.apex.telemetry.core.analysis

import com.apex.telemetry.core.analysis.model.FrictionAnalysisResult
import com.apex.telemetry.core.analysis.model.FrictionPhase
import com.apex.telemetry.core.analysis.model.FrictionPoint
import com.apex.telemetry.core.analysis.model.PhaseStats
import com.apex.telemetry.core.network.model.TelemetrySample
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * APEX Friction Circle (G-G Diagram) Analyzer
 * Evaluates tire traction envelope utilization and classifies driver load state
 * based on Skip Barber "Going Faster!" Chapter 5.
 */
class FrictionCircleCalculator(
    val brakeThreshold: Float = 0.10f,       // 10% brake input floor
    val throttleThreshold: Float = 0.40f,    // 40% throttle input floor
    val lateralGThreshold: Float = 0.15f,    // 0.15G lateral cornering threshold
    val limitUtilizationFloor: Float = 0.70f // 70% of max G indicates driving near the traction limit
) {

    /**
     * Classifies a single real-time [TelemetrySample] into a [FrictionPoint] for live HUD rendering.
     */
    fun classifyPoint(sample: TelemetrySample): FrictionPoint {
        val latG = sample.lateralG
        val longG = sample.longitudinalG
        val absLatG = abs(latG)
        val totalG = sqrt(latG * latG + longG * longG)

        val phase = when {
            sample.brake > brakeThreshold && absLatG > lateralGThreshold -> FrictionPhase.BRAKE_TURN
            sample.brake > brakeThreshold -> FrictionPhase.BRAKING
            sample.throttle > throttleThreshold && absLatG > lateralGThreshold -> FrictionPhase.ACCELERATE_TURN
            sample.throttle > throttleThreshold -> FrictionPhase.ACCELERATING
            absLatG > lateralGThreshold -> FrictionPhase.CORNERING
            else -> FrictionPhase.STRAIGHT
        }

        return FrictionPoint(
            lateralG = latG,
            longitudinalG = longG,
            totalG = totalG,
            phase = phase,
            speedKmh = sample.speedKmh,
            timestampMs = sample.timestampMs
        )
    }

    /**
     * Performs full stint/lap analysis, calculating traction circle utilization and phase distribution.
     */
    fun analyze(samples: List<TelemetrySample>): FrictionAnalysisResult {
        if (samples.isEmpty()) {
            return FrictionAnalysisResult(
                points = emptyList(),
                maxG = 1.0f,
                averageRadius = 0f,
                limitUtilizationPercent = 0f,
                phaseBreakdown = emptyMap(),
                totalSamples = 0
            )
        }

        val points = ArrayList<FrictionPoint>(samples.size)
        var maxG = 0.1f
        val phaseCounts = mutableMapOf<FrictionPhase, Int>().apply {
            FrictionPhase.values().forEach { put(it, 0) }
        }

        for (sample in samples) {
            val pt = classifyPoint(sample)
            points.add(pt)
            if (pt.totalG > maxG) {
                maxG = pt.totalG
            }
            phaseCounts[pt.phase] = (phaseCounts[pt.phase] ?: 0) + 1
        }

        // Limit utilization calculation (samples >= 70% of peak capability)
        var limitCount = 0
        var radiusSum = 0f

        for (pt in points) {
            val normalizedRadius = (pt.totalG / maxG).coerceIn(0f, 1f)
            radiusSum += normalizedRadius
            if (normalizedRadius >= limitUtilizationFloor) {
                limitCount++
            }
        }

        val limitUtilizationPercent = ((limitCount.toFloat() / points.size) * 100f)
        val averageRadius = radiusSum / points.size

        val breakdown = phaseCounts.mapValues { (_, count) ->
            PhaseStats(
                count = count,
                percent = ((count.toFloat() / points.size) * 100f)
            )
        }

        return FrictionAnalysisResult(
            points = points,
            maxG = maxG,
            averageRadius = averageRadius,
            limitUtilizationPercent = limitUtilizationPercent,
            phaseBreakdown = breakdown,
            totalSamples = points.size
        )
    }
}

