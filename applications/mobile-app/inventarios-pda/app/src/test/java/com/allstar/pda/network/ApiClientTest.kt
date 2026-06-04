package com.allstar.pda.network

import okhttp3.ConnectionPool
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.TimeUnit

/**
 * ApiClientTest — Phase 2 network layer verification.
 *
 * Verifies that ApiClient's OkHttpClient singleton is configured with the
 * timeouts and pooling parameters defined in the phase 2 optimization spec.
 * These are unit tests against the static ApiClient singleton; no network
 * I/O is performed.
 */
class ApiClientTest {

    @Test
    fun `BASE_URL is set to the production Tailscale endpoint`() {
        // Contract: BASE_URL must be the Tailscale-hosted API, never the raw IP.
        // This ensures traffic is encrypted over WireGuard and not exposed to the internet.
        assertEquals("https://api-vm.tail6cef8e.ts.net", ApiClient.BASE_URL)
    }

    @Test
    fun `http client is not null`() {
        assertNotNull(ApiClient.http)
    }

    @Test
    fun `connectTimeout is 10 seconds`() {
        // Requirement from phase 2 spec: connection establishment ≤ 10 s.
        val timeoutMs = ApiClient.http.connectTimeoutMillis
        assertEquals(
            "connectTimeout must be 10 seconds",
            TimeUnit.SECONDS.toMillis(10),
            timeoutMs.toLong()
        )
    }

    @Test
    fun `readTimeout is 10 seconds`() {
        // Requirement from phase 2 spec: read operation ≤ 10 s per call.
        val timeoutMs = ApiClient.http.readTimeoutMillis
        assertEquals(
            "readTimeout must be 10 seconds",
            TimeUnit.SECONDS.toMillis(10),
            timeoutMs.toLong()
        )
    }

    @Test
    fun `writeTimeout is 10 seconds`() {
        // Requirement from phase 2 spec: write operation ≤ 10 s per call.
        val timeoutMs = ApiClient.http.writeTimeoutMillis
        assertEquals(
            "writeTimeout must be 10 seconds",
            TimeUnit.SECONDS.toMillis(10),
            timeoutMs.toLong()
        )
    }

    @Test
    fun `callTimeout is 30 seconds`() {
        // Total budget across all redirects, retries, and I/O.
        val timeoutMs = ApiClient.http.callTimeoutMillis
        assertEquals(
            "callTimeout must be 30 seconds",
            TimeUnit.SECONDS.toMillis(30),
            timeoutMs.toLong()
        )
    }

    @Test
    fun `retryOnConnectionFailure is true`() {
        // Allows OkHttp's internal transparent retry for idempotent requests
        // (GET and certain PATCH reuses). Phase 2 preserves this for resilience.
        assertTrue(
            "retryOnConnectionFailure must be enabled for transparent retries",
            ApiClient.http.retryOnConnectionFailure
        )
    }

    @Test
    fun `connectionPool maxIdleConnections is 5`() {
        val delegateField = Class.forName("okhttp3.ConnectionPool")
            .getDeclaredField("delegate")
        delegateField.isAccessible = true

        val delegate = delegateField.get(ApiClient.http.connectionPool)
        val maxIdleField = delegate.javaClass.getDeclaredField("maxIdleConnections")
        maxIdleField.isAccessible = true
        val maxIdle = maxIdleField.getInt(delegate)

        assertEquals(
            "maxIdleConnections must be 5",
            5,
            maxIdle
        )
    }

    @Test
    fun `connectionPool keepAlive duration is 30 seconds`() {
        val delegateField = Class.forName("okhttp3.ConnectionPool")
            .getDeclaredField("delegate")
        delegateField.isAccessible = true

        val delegate = delegateField.get(ApiClient.http.connectionPool)
        val keepAliveField = delegate.javaClass.getDeclaredField("keepAliveDurationNs")
        keepAliveField.isAccessible = true
        val keepAliveNs = keepAliveField.getLong(delegate)

        val keepAliveSeconds = keepAliveNs / 1_000_000_000L
        assertEquals(
            "keepAlive duration must be 30 seconds",
            30L,
            keepAliveSeconds
        )
    }

    @Test
    fun `no response cache is configured`() {
        // Phase 2 explicitly preserves the no-caching invariant from A05.
        // Caching would risk serving stale inventory data (despacho operations
        // are destructive and must always reflect current server state).
        assertFalse(
            "responseCache must not be set — stale inventory data is unsafe",
            ApiClient.http.cache != null
        )
    }
}
