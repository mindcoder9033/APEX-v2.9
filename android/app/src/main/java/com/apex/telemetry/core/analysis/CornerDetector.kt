package com.apex.telemetry.core.analysis

import com.apex.telemetry.core.analysis.model.Corner
import com.apex.telemetry.core.analysis.model.CornerType
import com.apex.telemetry.core.network.model.TelemetrySample
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * APEX Deterministic Corner Detector & Landmark Extractor
 * Identifies track apexes ($V_{min}$ speed minima) and partitions corners into
 * Entry (Braking & Turn-In), Apex, and Exit (Throttle Application Point & Track-Out)
 * according to Skip Barber "Going Faster!" racecraft principles.
 */
class CornerDetector(
    val minSteeringThreshold: Float = 0.04f, // ~5 degrees normalized steering lock
    val minLateralGThreshold: Float = 0.30f,
    val smoothWindow: Int = 5,
    val apexMergeWindow: Int = 50,           // Merge local minima within ~0.8s
    val brakeThreshold: Float = 0.10f,        // 10% brake pressure
    val throttleThreshold: Float = 0.15f,     // 15% throttle pickup
    val maxScanSamples: Int = 300             // ~5 seconds at 60Hz
) {

    /**
     * Extracts all corners and apex landmarks for the given lap samples.
     */
    fun detectCorners(samples: List<TelemetrySample>): List<Corner> {
        if (samples.size < 30) return emptyList()

        val n = samples.size
        val rawSpeeds = samples.map { it.speedKmh }
        val smoothedSpeeds = smoothTrace(rawSpeeds)
        val potentialApexes = mutableListOf<PotentialApex>()

        val pad = smoothWindow / 2 + 2
        for (i in pad until (n - pad)) {
            val spd = smoothedSpeeds[i]
            val isLocalMin = spd <= smoothedSpeeds[i - 1] &&
                    spd <= smoothedSpeeds[i - 2] &&
                    spd <= smoothedSpeeds[i + 1] &&
                    spd <= smoothedSpeeds[i + 2]

            if (isLocalMin) {
                val s = samples[i]
                val steer = abs(s.steering)
                val latG = abs(s.lateralG)

                if (steer >= minSteeringThreshold || latG >= minLateralGThreshold) {
                    potentialApexes.add(
                        PotentialApex(
                            apexIndex = i,
                            speedKmh = spd,
                            steer = s.steering,
                            latG = s.lateralG,
                            yaw = s.yaw,
                            sample = s
                        )
                    )
                }
            }
        }

        // Merge adjacent local minima that belong to the same turn
        val mergedApexes = mergeAdjacentApexes(potentialApexes)

        // Partition each corner into Entry, Apex, and Exit
        return mergedApexes.mapIndexed { index, apex ->
            extractCornerProfile(samples, apex, index + 1)
        }
    }

    private fun extractCornerProfile(
        samples: List<TelemetrySample>,
        apex: PotentialApex,
        turnNumber: Int
    ): Corner {
        val apexIndex = apex.apexIndex
        val apexSample = samples[apexIndex]
        val n = samples.size
        val scanBackLimit = maxOf(0, apexIndex - maxScanSamples)
        val scanForwardLimit = minOf(n - 1, apexIndex + maxScanSamples)

        // 1. Find Brake Point (scan backward from apex)
        var brakeIndex = apexIndex
        var maxBrakePressure = 0f
        for (i in apexIndex downTo scanBackLimit) {
            val b = samples[i].brake
            if (b > maxBrakePressure) maxBrakePressure = b
            if (b >= brakeThreshold) {
                brakeIndex = i
            } else if (maxBrakePressure > brakeThreshold && b < brakeThreshold) {
                brakeIndex = i + 1
                break
            }
        }

        // 2. Find Turn-In Point (scan backward from apex)
        var turnInIndex = apexIndex
        for (i in apexIndex downTo scanBackLimit) {
            if (abs(samples[i].steering) >= minSteeringThreshold) {
                turnInIndex = i
            } else {
                break
            }
        }
        val entryIndex = minOf(brakeIndex, turnInIndex)

        // 3. Find Throttle Application Point (TAP - scan forward from turn-in / apex)
        var tapIndex = apexIndex
        for (i in turnInIndex..scanForwardLimit) {
            if (samples[i].throttle >= throttleThreshold) {
                tapIndex = i
                break
            }
        }

        // 4. Find Track-Out / Exit Point (scan forward from apex)
        var exitIndex = apexIndex
        for (i in apexIndex..scanForwardLimit) {
            val st = abs(samples[i].steering)
            val th = samples[i].throttle
            if (st < minSteeringThreshold && th > 0.60f) {
                exitIndex = i
                break
            }
        }

        // 5. Calculate Trail-Braking Overlap Distance
        var trailBrakingDistanceMeters = 0f
        for (i in turnInIndex..apexIndex) {
            val s = samples[i]
            if (s.brake > 0.05f && abs(s.steering) >= minSteeringThreshold && i > 0) {
                val prev = samples[i - 1]
                val dx = s.positionX - prev.positionX
                val dy = s.positionY - prev.positionY
                val dz = s.positionZ - prev.positionZ
                trailBrakingDistanceMeters += sqrt(dx * dx + dy * dy + dz * dz)
            }
        }

        // 6. Trail-Braking Score & Coaching Diagnostics
        val (score, note) = evaluateCornerCoach(
            entryIndex = entryIndex,
            apexIndex = apexIndex,
            tapIndex = tapIndex,
            maxBrakePressure = maxBrakePressure,
            trailDistance = trailBrakingDistanceMeters,
            samples = samples
        )

        // Classify Corner Direction & Type
        val direction = if (apex.steer > 0 || apex.latG > 0) "Right" else "Left"
        val cornerType = classifyCornerType(apex, samples)
        val exitSpeedKmh = samples[exitIndex].speedKmh

        return Corner(
            cornerNumber = turnNumber,
            name = "Turn $turnNumber",
            type = cornerType,
            direction = direction,
            entryIndex = entryIndex,
            brakeIndex = brakeIndex,
            turnInIndex = turnInIndex,
            apexIndex = apexIndex,
            tapIndex = tapIndex,
            exitIndex = exitIndex,
            vMinKmh = apexSample.speedKmh,
            vMinMph = apexSample.speedMph,
            maxLateralG = abs(apexSample.lateralG),
            maxBrakePressure = maxBrakePressure,
            trailBrakingOverlapDistanceMeters = trailBrakingDistanceMeters,
            trailBrakingScore = score,
            exitSpeedKmh = exitSpeedKmh,
            coachingNote = note,
            apexSample = apexSample
        )
    }

    private fun evaluateCornerCoach(
        entryIndex: Int,
        apexIndex: Int,
        tapIndex: Int,
        maxBrakePressure: Float,
        trailDistance: Float,
        samples: List<TelemetrySample>
    ): Pair<Float, String> {
        val tapAfterApex = tapIndex > apexIndex
        val samplesToTap = tapIndex - apexIndex

        var score = 85f
        var coaching = "Clean corner execution. Good apex speed and exit momentum."

        if (trailDistance > 12f) {
            score = 95f
            coaching = "Excellent trail-braking. Smooth transition maintaining front tire load into apex."
        } else if (trailDistance < 2f && maxBrakePressure > 0.60f) {
            score = 68f
            coaching = "Abrupt brake release before turn-in unloaded front tires early. Bleed off brake progressively."
        } else if (samplesToTap > 30) {
            score = 72f
            coaching = "Delayed throttle pickup after apex. Rotate car earlier at turn-in to commit to power sooner."
        }

        return Pair(score.coerceIn(0f, 100f), coaching)
    }

    private fun classifyCornerType(apex: PotentialApex, samples: List<TelemetrySample>): CornerType {
        val idx = apex.apexIndex
        val preIdx = maxOf(0, idx - 25)
        val postIdx = minOf(samples.size - 1, idx + 25)

        val yawDeltaRad = abs(samples[postIdx].yaw - samples[preIdx].yaw)
        val yawDeltaDeg = yawDeltaRad * (180f / Math.PI.toFloat())

        return when {
            yawDeltaDeg > 60f || abs(apex.latG) > 1.35f -> CornerType.HAIRPIN
            apex.steer > 0 || apex.latG > 0 -> CornerType.RIGHT
            else -> CornerType.LEFT
        }
    }

    private fun smoothTrace(data: List<Float>): List<Float> {
        val smoothed = ArrayList<Float>(data.size)
        val half = smoothWindow / 2

        for (i in data.indices) {
            var sum = 0f
            var count = 0
            for (j in -half..half) {
                val idx = i + j
                if (idx in data.indices) {
                    sum += data[idx]
                    count++
                }
            }
            smoothed.add(if (count > 0) sum / count else data[i])
        }
        return smoothed
    }

    private fun mergeAdjacentApexes(apexes: List<PotentialApex>): List<PotentialApex> {
        if (apexes.size <= 1) return apexes

        val result = mutableListOf<PotentialApex>()
        var currentCluster = mutableListOf(apexes[0])

        for (i in 1 until apexes.size) {
            val current = apexes[i]
            val prev = currentCluster.last()

            if (current.apexIndex - prev.apexIndex <= apexMergeWindow) {
                currentCluster.add(current)
            } else {
                result.add(currentCluster.minByOrNull { it.speedKmh } ?: currentCluster[0])
                currentCluster = mutableListOf(current)
            }
        }

        if (currentCluster.isNotEmpty()) {
            result.add(currentCluster.minByOrNull { it.speedKmh } ?: currentCluster[0])
        }

        return result
    }

    private data class PotentialApex(
        val apexIndex: Int,
        val speedKmh: Float,
        val steer: Float,
        val latG: Float,
        val yaw: Float,
        val sample: TelemetrySample
    )
}

