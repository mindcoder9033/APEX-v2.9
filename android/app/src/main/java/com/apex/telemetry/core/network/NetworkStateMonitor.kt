package com.apex.telemetry.core.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.net.Inet4Address
import java.net.NetworkInterface

data class NetworkInfo(
    val isConnected: Boolean = false,
    val ipAddress: String? = null,
    val interfaceType: String = "None"
)

/**
 * Monitors active network connectivity and discovers the local Wi-Fi / LAN IPv4 address.
 * Drivers configure this exact IP in Forza Motorsport's "Data Out" settings menu.
 */
class NetworkStateMonitor(context: Context) {

    private val connectivityManager =
        context.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _networkInfo = MutableStateFlow(resolveCurrentNetworkInfo())
    val networkInfo: StateFlow<NetworkInfo> = _networkInfo.asStateFlow()

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            refresh()
        }

        override fun onLost(network: Network) {
            refresh()
        }

        override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
            refresh()
        }
    }

    /**
     * Starts listening for network state changes.
     */
    fun startMonitoring() {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        try {
            connectivityManager.registerNetworkCallback(request, networkCallback)
        } catch (_: Exception) {
            // Fallback to initial probe
        }
        refresh()
    }

    /**
     * Stops listening to network callbacks.
     */
    fun stopMonitoring() {
        try {
            connectivityManager.unregisterNetworkCallback(networkCallback)
        } catch (_: Exception) {
        }
    }

    fun refresh() {
        _networkInfo.value = resolveCurrentNetworkInfo()
    }

    private fun resolveCurrentNetworkInfo(): NetworkInfo {
        val activeNetwork = connectivityManager.activeNetwork
        val capabilities = activeNetwork?.let { connectivityManager.getNetworkCapabilities(it) }

        val isConnected = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        val interfaceType = when {
            capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true -> "Wi-Fi"
            capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) == true -> "Ethernet"
            capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true -> "Cellular"
            else -> "None"
        }

        val ipAddress = getLocalIpv4Address()

        return NetworkInfo(
            isConnected = isConnected,
            ipAddress = ipAddress,
            interfaceType = interfaceType
        )
    }

    companion object {
        /**
         * Scans active network interfaces for a non-loopback, non-virtual IPv4 address.
         */
        fun getLocalIpv4Address(): String? {
            try {
                val interfaces = NetworkInterface.getNetworkInterfaces() ?: return null
                for (networkInterface in interfaces) {
                    if (networkInterface.isLoopback || !networkInterface.isUp) continue

                    val addresses = networkInterface.inetAddresses
                    for (address in addresses) {
                        if (!address.isLoopbackAddress && address is Inet4Address) {
                            val hostAddress = address.hostAddress
                            // Prefer standard LAN subnet IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
                            if (hostAddress != null && !hostAddress.startsWith("127.")) {
                                return hostAddress
                            }
                        }
                    }
                }
            } catch (_: Exception) {
            }
            return null
        }
    }
}

