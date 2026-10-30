package com.apex.telemetry.core.database.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Persisted high-level racing stint record.
 */
@Entity(tableName = "stints")
data class StintEntity(
    @PrimaryKey(autoGenerate = true)
    val stintId: Long = 0L,
    val startTimeMs: Long,
    val endTimeMs: Long,
    val totalLaps: Int,
    val bestLapTime: Float,
    val averageLapTime: Float,
    val consistencyScore: Float,       // 0..100 (consistency between consecutive flying laps)
    val carClass: String,
    val trackOrdinal: Int,
    val traceFilePath: String?,        // File path to compact binary trace file
    val createdAt: Long = System.currentTimeMillis()
)

