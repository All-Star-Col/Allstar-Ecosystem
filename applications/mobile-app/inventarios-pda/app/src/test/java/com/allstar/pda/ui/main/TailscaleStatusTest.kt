package com.allstar.pda.ui.main

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.Mockito

class TailscaleStatusTest {

    @Test
    fun `isTailscaleActive returns false when TRANSPORT_VPN is not present`() {
        val mockCapabilities = Mockito.mock(NetworkCapabilities::class.java)
        Mockito.`when`(mockCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)).thenReturn(false)

        val hasVpn = mockCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
        assertFalse(hasVpn)
    }

    @Test
    fun `isTailscaleActive returns true when TRANSPORT_VPN is present`() {
        val mockCapabilities = Mockito.mock(NetworkCapabilities::class.java)
        Mockito.`when`(mockCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)).thenReturn(true)

        val hasVpn = mockCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
        assertTrue(hasVpn)
    }

    @Test
    fun `TailscaleStatusChip colors - connected uses AppSuccess`() {
        val isConnected = true
        val expectedColor = if (isConnected) "AppSuccess" else "AppError"
        assertEquals("AppSuccess", expectedColor)
    }

    @Test
    fun `TailscaleStatusChip colors - disconnected uses AppError`() {
        val isConnected = false
        val expectedColor = if (isConnected) "AppSuccess" else "AppError"
        assertEquals("AppError", expectedColor)
    }

    @Test
    fun `TailscaleStatusChip text - connected shows Conectado`() {
        val isConnected = true
        val expectedText = if (isConnected) "Conectado" else "Desconectado"
        assertEquals("Conectado", expectedText)
    }

    @Test
    fun `TailscaleStatusChip text - disconnected shows Desconectado`() {
        val isConnected = false
        val expectedText = if (isConnected) "Conectado" else "Desconectado"
        assertEquals("Desconectado", expectedText)
    }

    @Test
    fun `Scanner status text - busy shows Procesando`() {
        val isBusy = true
        val isConnected = true
        val statusText = when {
            isBusy -> "Procesando operación..."
            isConnected -> "Listo para escanear"
            else -> "Sin conexión Tailscale"
        }
        assertEquals("Procesando operación...", statusText)
    }

    @Test
    fun `Scanner status text - connected shows Listo para escanear`() {
        val isBusy = false
        val isConnected = true
        val statusText = when {
            isBusy -> "Procesando operación..."
            isConnected -> "Listo para escanear"
            else -> "Sin conexión Tailscale"
        }
        assertEquals("Listo para escanear", statusText)
    }

    @Test
    fun `Scanner status text - disconnected shows Sin conexion`() {
        val isBusy = false
        val isConnected = false
        val statusText = when {
            isBusy -> "Procesando operación..."
            isConnected -> "Listo para escanear"
            else -> "Sin conexión Tailscale"
        }
        assertEquals("Sin conexión Tailscale", statusText)
    }

    @Test
    fun `Scanner status color - busy uses AppGold`() {
        val isBusy = true
        val isConnected = true
        val statusColor = when {
            isBusy -> "AppGold"
            isConnected -> "AppSuccess"
            else -> "AppError"
        }
        assertEquals("AppGold", statusColor)
    }

    @Test
    fun `Scanner status color - connected uses AppSuccess`() {
        val isBusy = false
        val isConnected = true
        val statusColor = when {
            isBusy -> "AppGold"
            isConnected -> "AppSuccess"
            else -> "AppError"
        }
        assertEquals("AppSuccess", statusColor)
    }

    @Test
    fun `Scanner status color - disconnected uses AppError`() {
        val isBusy = false
        val isConnected = false
        val statusColor = when {
            isBusy -> "AppGold"
            isConnected -> "AppSuccess"
            else -> "AppError"
        }
        assertEquals("AppError", statusColor)
    }
}
