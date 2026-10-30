package com.apex.telemetry.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.apex.telemetry.core.database.entities.StintEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface StintDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStint(stint: StintEntity): Long

    @Update
    suspend fun updateStint(stint: StintEntity)

    @Query("SELECT * FROM stints ORDER BY createdAt DESC")
    fun getAllStints(): Flow<List<StintEntity>>

    @Query("SELECT * FROM stints WHERE stintId = :stintId LIMIT 1")
    suspend fun getStintById(stintId: Long): StintEntity?

    @Query("SELECT * FROM stints ORDER BY createdAt DESC LIMIT :limit")
    suspend fun getRecentStints(limit: Int): List<StintEntity>

    @Query("DELETE FROM stints WHERE stintId = :stintId")
    suspend fun deleteStint(stintId: Long)

    @Query("DELETE FROM stints")
    suspend fun clearAllStints()
}

