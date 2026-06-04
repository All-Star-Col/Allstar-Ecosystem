package com.allstar.pda.performance

import kotlin.math.max

data class NetworkMetrics(
    val operationId: String,
    val durationMs: Long,
    val timestamp: Long,
    val responseSizeBytes: Long,
    val statusCode: Int
)

data class MemorySnapshot(
    val label: String,
    val timestamp: Long,
    val heapUsedMb: Long,
    val heapTotalMb: Long,
    val nonHeapUsedMb: Long
)

data class BaselineMetrics(
    val networkMetrics: List<NetworkMetrics>,
    val memorySnapshots: List<MemorySnapshot>
)

object PerformanceProfiler {

    private const val BYTES_IN_MB = 1024L * 1024L
    private const val MAX_ENTRIES_PER_METRIC = 500

    @Volatile
    private var enabled: Boolean = false

    private val networkMetricsBuffer = BoundedMetricBuffer<NetworkMetrics>(MAX_ENTRIES_PER_METRIC)
    private val memorySnapshotsBuffer = BoundedMetricBuffer<MemorySnapshot>(MAX_ENTRIES_PER_METRIC)

    data class NetworkTrace(
        val operationId: String,
        val startedAtMs: Long,
        val startedAtNs: Long
    )

    fun isEnabled(): Boolean = enabled

    fun setEnabled(value: Boolean) {
        enabled = value
        if (!value) {
            reset()
        }
    }

    fun startNetworkOperation(operationId: String): NetworkTrace? {
        if (!enabled) return null

        val nowMs = System.currentTimeMillis()
        val nowNs = System.nanoTime()
        return NetworkTrace(
            operationId = operationId,
            startedAtMs = nowMs,
            startedAtNs = nowNs
        )
    }

    fun endNetworkOperation(
        trace: NetworkTrace?,
        statusCode: Int,
        responseSizeBytes: Long
    ): NetworkMetrics? {
        if (!enabled || trace == null) return null

        val durationMs = max(0L, (System.nanoTime() - trace.startedAtNs) / 1_000_000L)
        val metric = NetworkMetrics(
            operationId = trace.operationId,
            durationMs = durationMs,
            timestamp = System.currentTimeMillis(),
            responseSizeBytes = max(0L, responseSizeBytes),
            statusCode = statusCode
        )

        networkMetricsBuffer.add(metric)
        return metric
    }

    fun captureMemorySnapshot(label: String): MemorySnapshot? {
        if (!enabled) return null

        val runtime = Runtime.getRuntime()
        val heapUsedBytes = runtime.totalMemory() - runtime.freeMemory()
        val heapTotalBytes = runtime.totalMemory()
        // Phase 1 placeholder: Android-safe non-heap measurement is not collected yet.
        // We preserve the public contract and return 0 until a future contract revision.
        val nonHeapUsedBytes = 0L

        val snapshot = MemorySnapshot(
            label = label,
            timestamp = System.currentTimeMillis(),
            heapUsedMb = max(0L, heapUsedBytes / BYTES_IN_MB),
            heapTotalMb = max(0L, heapTotalBytes / BYTES_IN_MB),
            nonHeapUsedMb = max(0L, nonHeapUsedBytes / BYTES_IN_MB)
        )

        memorySnapshotsBuffer.add(snapshot)
        return snapshot
    }

    fun getBaselineMetrics(): BaselineMetrics {
        return BaselineMetrics(
            networkMetrics = networkMetricsBuffer.snapshot(),
            memorySnapshots = memorySnapshotsBuffer.snapshot()
        )
    }

    fun reset() {
        networkMetricsBuffer.clear()
        memorySnapshotsBuffer.clear()
    }

    private class BoundedMetricBuffer<T>(
        private val maxEntries: Int
    ) {
        private val lock = Any()
        private val entries = ArrayDeque<T>(maxEntries)

        init {
            require(maxEntries > 0) { "maxEntries must be greater than 0" }
        }

        fun add(entry: T) {
            synchronized(lock) {
                if (entries.size >= maxEntries) {
                    entries.removeFirst()
                }
                entries.addLast(entry)
            }
        }

        fun snapshot(): List<T> {
            synchronized(lock) {
                return entries.toList()
            }
        }

        fun clear() {
            synchronized(lock) {
                entries.clear()
            }
        }
    }
}
