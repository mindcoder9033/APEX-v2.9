# APEX Telemetry ProGuard / R8 Rules

# Keep Room annotations and generated classes
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**

# Keep Coroutines internal reflection
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# Keep Telemetry data classes and binary models
-keep class com.apex.telemetry.core.network.model.** { *; }
-keep class com.apex.telemetry.core.database.entities.** { *; }

