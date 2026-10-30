package com.apex.telemetry.core.database.entities

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Persisted lap summary with foreign key relation to [StintEntity].
 */
@Entity(
    tableName = "laps",
    foreignKeys = [
        ForeignKey(
            entity = StintEntity::class,
            parentColumns = ["stintId"],
            childColumns = ["stintId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["stintId"]), Index(value = ["stintId", "lapNumber"])]
)
data class LapEntity(
    @PrimaryKey(autoGenerate = true)
    val lapId: Long = 0L,
    val stintId: Long,
    val lapNumber: Int,
    val lapTime: Float,
    val isValid: Boolean,
    val isFlyingLap: Boolean,
    val maxSpeedKmh: Float,
    val minSpeedKmh: Float,
    val avgSpeedKmh: Float,
    val totalDistanceMeters: Float,
    val sampleCount: Int,
    val sampleOffsetInTrace: Int       // Byte/sample offset into the binary trace file
)

