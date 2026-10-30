package com.apex.telemetry.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.apex.telemetry.core.database.entities.LapEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface LapDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLap(lap: LapEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLaps(laps: List<LapEntity>): List<Long>

    @Query("SELECT * FROM laps WHERE stintId = :stintId ORDER BY lapNumber ASC")
    fun getLapsForStint(stintId: Long): Flow<List<LapEntity>>

    @Query("SELECT * FROM laps WHERE stintId = :stintId AND isValid = 1 AND isFlyingLap = 1 ORDER BY lapTime ASC LIMIT 1")
    suspend fun getBestLapForStint(stintId: Long): LapEntity?

    @Query("SELECT * FROM laps WHERE lapId = :lapId LIMIT 1")
    suspend fun getLapById(lapId: Long): LapEntity?
}

