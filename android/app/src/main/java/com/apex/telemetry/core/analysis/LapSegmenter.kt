package com.apex.telemetry.core.analysis

import com.apex.telemetry.core.analysis.model.Lap
import com.apex.telemetry.core.network.model.TelemetrySample
import kotlin.math.sqrt

/**
 * APEX Lap Segmentation Engine
 * Groups continuous telemetry sample streams into discrete lap sessions,
 * calculates speed/distance telemetry statistics, and classifies out-laps and flying laps.
 */
class LapSegmenter(
    val minLapSamples: Int = 10,
    val minLapDurationSec: Float = 10.0f
) {

    /**
     * Segments a chronological sequence of telemetry samples into distinct [Lap] objects.
     */
    fun segmentStint(samples: List<TelemetrySample>): List<Lap> {
        if (samples.isEmpty()) return emptyList()

        // Group samples by lapNumber
        val lapGroups = LinkedHashMap<Int, MutableList<IndexedSample>>()
        for ((globalIndex, sample) in samples.withIndex()) {
            val lapNum = if (sample.lapNumber > 0) sample.lapNumber else 1
            lapGroups.getOrPut(lapNum) { mutableListOf() }.add(IndexedSample(sample, globalIndex))
        }

        val laps = mutableListOf<Lap>()
        val totalGroupCount = lapGroups.size
        var sequentialIndex = 1

        for ((lapNumber, indexedSamples) in lapGroups) {
            if (indexedSamples.size < minLapSamples) {
                continue // Discard sub-threshold fragments
            }

            val rawSamples = indexedSamples.map { it.sample }
            val startSample = rawSamples.first()
            val endSample = rawSamples.last()

            // Calculate lap time
            val lapTime: Float = when {
                endSample.lastLapTime > 0f && sequentialIndex > 1 -> endSample.lastLapTime
                endSample.currentLapTime > 0f -> endSample.currentLapTime
                endSample.timestampMs > startSample.timestampMs -> {
                    (endSample.timestampMs - startSample.timestampMs) / 1000.0f
                }
                else -> rawSamples.size / 60.0f
            }

            // Speed & Distance metrics
            var maxSpeedKmh = 0f
            var minSpeedKmh = Float.MAX_VALUE
            var totalSpeedKmh = 0.0
            var totalDistanceMeters = 0f

            for (i in rawSamples.indices) {
                val s = rawSamples[i]
                val spd = s.speedKmh
                if (spd > maxSpeedKmh) maxSpeedKmh = spd
                if (spd < minSpeedKmh) minSpeedKmh = spd
                totalSpeedKmh += spd

                if (i > 0) {
                    val prev = rawSamples[i - 1]
                    val dx = s.positionX - prev.positionX
                    val dy = s.positionY - prev.positionY
                    val dz = s.positionZ - prev.positionZ
                    totalDistanceMeters += sqrt(dx * dx + dy * dy + dz * dz)
                }
            }

            val avgSpeedKmh = if (rawSamples.isNotEmpty()) (totalSpeedKmh / rawSamples.size).toFloat() else 0f
            val resolvedMinSpeedKmh = if (minSpeedKmh == Float.MAX_VALUE) 0f else minSpeedKmh

            val isOutLap = sequentialIndex == 1
            val isInLap = sequentialIndex == totalGroupCount && rawSamples.size < (minLapSamples * 3)
            val isValid = lapTime >= minLapDurationSec && rawSamples.size >= minLapSamples
            val isFlyingLap = isValid && !isOutLap && !isInLap

            laps.add(
                Lap(
                    lapNumber = lapNumber,
                    startIndex = indexedSamples.first().globalIndex,
                    endIndex = indexedSamples.last().globalIndex,
                    sampleCount = rawSamples.size,
                    lapTime = lapTime,
                    isValid = isValid,
                    isOutLap = isOutLap,
                    isInLap = isInLap,
                    isFlyingLap = isFlyingLap,
                    maxSpeedKmh = maxSpeedKmh,
                    minSpeedKmh = resolvedMinSpeedKmh,
                    avgSpeedKmh = avgSpeedKmh,
                    maxSpeedMph = maxSpeedKmh * 0.621371f,
                    minSpeedMph = resolvedMinSpeedKmh * 0.621371f,
                    avgSpeedMph = avgSpeedKmh * 0.621371f,
                    totalDistanceMeters = totalDistanceMeters,
                    samples = rawSamples
                )
            )

            sequentialIndex++
        }

        return laps
    }

    private data class IndexedSample(val sample: TelemetrySample, val globalIndex: Int)
}

