package com.apex.telemetry.core.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.apex.telemetry.R
import com.apex.telemetry.core.network.NetworkStateMonitor
import com.apex.telemetry.core.network.TelemetryUdpReceiver
import com.apex.telemetry.core.network.model.ConnectionStatus
import com.apex.telemetry.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach

/**
 * Foreground Service responsible for uninterrupted 60Hz UDP telemetry streaming.
 * Manages high-performance Wi-Fi and CPU WakeLocks, binds the socket receiver,
 * and maintains continuous connection health reporting in the Android system notification drawer.
 */
class TelemetryService : Service() {

    inner class LocalBinder : Binder() {
        val service: TelemetryService get() = this@TelemetryService
    }

    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    val receiver = TelemetryUdpReceiver()
    private lateinit var networkMonitor: NetworkStateMonitor

    private var wifiLock: WifiManager.WifiLock? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var notificationManager: NotificationManager? = null

    companion object {
        const val NOTIFICATION_ID = 9991
        const val CHANNEL_ID = "apex_telemetry_live_feed"
        const val ACTION_START = "com.apex.telemetry.action.START"
        const val ACTION_STOP = "com.apex.telemetry.action.STOP"
        const val EXTRA_PORT = "extra_port"

        fun start(context: Context, port: Int = TelemetryUdpReceiver.DEFAULT_PORT) {
            val intent = Intent(context, TelemetryService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_PORT, port)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, TelemetryService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        networkMonitor = NetworkStateMonitor(this)
        networkMonitor.startMonitoring()

        createNotificationChannel()
        acquirePowerAndNetworkLocks()
        observeConnectionStatus()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                val port = intent?.getIntExtra(EXTRA_PORT, TelemetryUdpReceiver.DEFAULT_PORT)
                    ?: TelemetryUdpReceiver.DEFAULT_PORT

                // Start Foreground with initial notification
                val initialNotification = buildNotification("Starting UDP Socket...", "Port: $port")
                startForeground(NOTIFICATION_ID, initialNotification)

                // Start UDP ingestion
                if (!receiver.isRunning) {
                    receiver.start(serviceScope, port)
                }
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onDestroy() {
        super.onDestroy()
        receiver.stop()
        networkMonitor.stopMonitoring()
        releasePowerAndNetworkLocks()
        serviceScope.cancel()
    }

    private fun acquirePowerAndNetworkLocks() {
        // 1. High-Performance Wi-Fi Lock (prevents socket sleep / throttled packets)
        val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        wifiLock = wifiManager?.createWifiLock(
            WifiManager.WIFI_MODE_FULL_HIGH_PERF,
            "APEX:TelemetryWifiLock"
        )?.apply {
            setReferenceCounted(false)
            acquire()
        }

        // 2. CPU WakeLock (guarantees packet processing when device is unattended)
        val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
        wakeLock = powerManager?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "APEX:TelemetryStreamWakeLock"
        )?.apply {
            setReferenceCounted(false)
            acquire(4 * 60 * 60 * 1000L) // 4 hours maximum timeout
        }
    }

    private fun releasePowerAndNetworkLocks() {
        try {
            if (wifiLock?.isHeld == true) wifiLock?.release()
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (_: Exception) {
        }
    }

    private fun observeConnectionStatus() {
        receiver.connectionStatus.onEach { status ->
            val ip = networkMonitor.networkInfo.value.ipAddress ?: "Wi-Fi IP searching..."
            when (status) {
                is ConnectionStatus.Listening -> {
                    updateNotification(
                        title = "APEX Active • Waiting for Forza",
                        content = "Set Forza Data Out to IP: $ip (Port ${status.port})"
                    )
                }
                is ConnectionStatus.Streaming -> {
                    updateNotification(
                        title = "APEX Telemetry Streaming",
                        content = "${status.packetRateHz}Hz Live • ${status.totalPackets} packets received"
                    )
                }
                is ConnectionStatus.Error -> {
                    updateNotification(
                        title = "APEX Telemetry Error",
                        content = status.message
                    )
                }
                is ConnectionStatus.Disconnected -> {
                    // Closed
                }
            }
        }.launchIn(serviceScope)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_LOW // Low priority so it does not beep every second
            ).apply {
                description = getString(R.string.notification_channel_desc)
                setShowBadge(false)
            }
            notificationManager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(title: String, content: String): Notification {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(title: String, content: String) {
        val notification = buildNotification(title, content)
        notificationManager?.notify(NOTIFICATION_ID, notification)
    }
}

