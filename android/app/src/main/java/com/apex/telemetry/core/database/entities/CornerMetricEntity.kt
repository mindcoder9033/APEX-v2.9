package com.apex.telemetry.core.database.entities

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Persisted turn-by-turn corner coaching and dynamics data linked to a [LapEntity].
 */
@Entity(
    tableName = "corner_metrics",
    foreignKeys = [
        ForeignKey(
            entity = LapEntity::class,
            parentColumns = ["lapId"],
            childColumns = ["lapId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["lapId"])]
)
data class CornerMetricEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0L,
    val lapId: Long,
    val cornerNumber: Int,
    val name: String,
    val cornerType: String,             // LEFT, RIGHT, HAIRPIN
    val direction: String,              // Left or Right
    val vMinKmh: Float,
    val maxLateralG: Float,
    val maxBrakePressure: Float,
    val trailBrakingScore: Float,
    val trailBrakingGrade: String,
    val exitSpeedKmh: Float,
    val coachingNote: String
)

