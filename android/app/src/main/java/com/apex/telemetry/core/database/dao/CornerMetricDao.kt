package com.apex.telemetry.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.apex.telemetry.core.database.entities.CornerMetricEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CornerMetricDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCornerMetric(metric: CornerMetricEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCornerMetrics(metrics: List<CornerMetricEntity>): List<Long>

    @Query("SELECT * FROM corner_metrics WHERE lapId = :lapId ORDER BY cornerNumber ASC")
    fun getCornerMetricsForLap(lapId: Long): Flow<List<CornerMetricEntity>>

    @Query("SELECT * FROM corner_metrics WHERE lapId = :lapId ORDER BY cornerNumber ASC")
    suspend fun getCornerMetricsForLapDirect(lapId: Long): List<CornerMetricEntity>
}

