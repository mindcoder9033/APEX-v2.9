package com.apex.telemetry.core.database.storage

import android.content.Context
import com.apex.telemetry.core.network.model.TelemetrySample
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

/**
 * Compact, lightweight data point for high-speed graph rendering and track visualization.
 * Serialized to binary at 48 bytes per 60Hz sample (~172 KB per minute).
 */
data class TracePoint(
    val timestampMs: Long,
    val speedKmh: Float,
    val throttle: Float,
    val brake: Float,
    val steering: Float,
    val gear: Int,
    val lateralG: Float,
    val longitudinalG: Float,
    val positionX: Float,
    val positionY: Float,
    val positionZ: Float,
    val lapNumber: Int,
    val distanceTraveled: Float
)

/**
 * High-performance binary file store for 60Hz raw telemetry traces.
 * Bypasses SQLite relational overhead during high-frequency racing, storing
 * compact sequential chunks in app-private storage (`context.filesDir/traces/`).
 */
class BinaryTraceStore(private val tracesDir: File) {

    constructor(context: Context) : this(File(context.filesDir, "traces").apply { mkdirs() })

    init {
        if (!tracesDir.exists()) {
            tracesDir.mkdirs()
        }
    }

    companion object {
        const val MAGIC_HEADER = 0x41504558 // "APEX" in ASCII hex
        const val FORMAT_VERSION = 1
    }

    fun getTraceFile(stintId: Long): File = File(tracesDir, "stint_${stintId}.bin")

    /**
     * Serializes a list of [TelemetrySample] frames into a compact binary file.
     */
    fun writeTrace(stintId: Long, samples: List<TelemetrySample>): File {
        val file = getTraceFile(stintId)
        DataOutputStream(BufferedOutputStream(FileOutputStream(file), 64 * 1024)).use { out ->
            out.writeInt(MAGIC_HEADER)
            out.writeInt(FORMAT_VERSION)
            out.writeInt(samples.size)

            for (s in samples) {
                out.writeLong(s.timestampMs)
                out.writeFloat(s.speedKmh)
                out.writeFloat(s.throttle)
                out.writeFloat(s.brake)
                out.writeFloat(s.steering)
                out.writeByte(s.gear)
                out.writeFloat(s.lateralG)
                out.writeFloat(s.longitudinalG)
                out.writeFloat(s.positionX)
                out.writeFloat(s.positionY)
                out.writeFloat(s.positionZ)
                out.writeShort(s.lapNumber)
                out.writeFloat(s.distanceTraveled)
            }
            out.flush()
        }
        return file
    }

    /**
     * Reads all recorded [TracePoint] items from a binary trace file.
     */
    fun readTrace(file: File): List<TracePoint> {
        if (!file.exists() || file.length() < 12) return emptyList()

        val points = mutableListOf<TracePoint>()
        DataInputStream(BufferedInputStream(FileInputStream(file), 64 * 1024)).use { input ->
            val magic = input.readInt()
            if (magic != MAGIC_HEADER) {
                throw IllegalStateException("Invalid binary trace file header: $magic")
            }
            val version = input.readInt()
            val sampleCount = input.readInt()

            for (i in 0 until sampleCount) {
                points.add(
                    TracePoint(
                        timestampMs = input.readLong(),
                        speedKmh = input.readFloat(),
                        throttle = input.readFloat(),
                        brake = input.readFloat(),
                        steering = input.readFloat(),
                        gear = input.readByte().toInt(),
                        lateralG = input.readFloat(),
                        longitudinalG = input.readFloat(),
                        positionX = input.readFloat(),
                        positionY = input.readFloat(),
                        positionZ = input.readFloat(),
                        lapNumber = input.readShort().toInt(),
                        distanceTraveled = input.readFloat()
                    )
                )
            }
        }
        return points
    }

    /**
     * Reads trace points filtered to a specific lap number for post-stint graphing.
     */
    fun readLapTrace(file: File, targetLapNumber: Int): List<TracePoint> {
        return readTrace(file).filter { it.lapNumber == targetLapNumber }
    }

    /**
     * Deletes trace file when a stint is removed.
     */
    fun deleteTrace(stintId: Long): Boolean {
        val file = getTraceFile(stintId)
        return if (file.exists()) file.delete() else true
    }
}

