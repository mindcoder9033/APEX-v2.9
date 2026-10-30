package com.apex.telemetry.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.apex.telemetry.core.database.dao.CornerMetricDao
import com.apex.telemetry.core.database.dao.LapDao
import com.apex.telemetry.core.database.dao.StintDao
import com.apex.telemetry.core.database.entities.CornerMetricEntity
import com.apex.telemetry.core.database.entities.LapEntity
import com.apex.telemetry.core.database.entities.StintEntity

@Database(
    entities = [
        StintEntity::class,
        LapEntity::class,
        CornerMetricEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class ApexDatabase : RoomDatabase() {

    abstract fun stintDao(): StintDao
    abstract fun lapDao(): LapDao
    abstract fun cornerMetricDao(): CornerMetricDao

    companion object {
        private const val DATABASE_NAME = "apex_telemetry.db"

        @Volatile
        private var INSTANCE: ApexDatabase? = null

        fun getInstance(context: Context): ApexDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    ApexDatabase::class.java,
                    DATABASE_NAME
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}

