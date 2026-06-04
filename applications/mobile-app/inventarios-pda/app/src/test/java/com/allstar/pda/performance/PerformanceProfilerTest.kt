package com.allstar.pda.performance

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PerformanceProfilerTest {

    private companion object {
        const val MAX_ENTRIES_PER_METRIC = 500
    }

    @After
    fun tearDown() {
        PerformanceProfiler.setEnabled(false)
    }

    @Test
    fun `profiler starts disabled and does not collect metrics`() {
        assertFalse(PerformanceProfiler.isEnabled())

        val trace = PerformanceProfiler.startNetworkOperation("consultar_item")
        val metric = PerformanceProfiler.endNetworkOperation(
            trace = trace,
            statusCode = 200,
            responseSizeBytes = 512
        )
        val memory = PerformanceProfiler.captureMemorySnapshot("disabled")

        assertNull(trace)
        assertNull(metric)
        assertNull(memory)
        assertTrue(PerformanceProfiler.getBaselineMetrics().networkMetrics.isEmpty())
        assertTrue(PerformanceProfiler.getBaselineMetrics().memorySnapshots.isEmpty())
    }

    @Test
    fun `network metric keeps contract fields when profiler is enabled`() {
        PerformanceProfiler.setEnabled(true)

        val trace = PerformanceProfiler.startNetworkOperation("get_item")
        assertNotNull(trace)

        val metric = PerformanceProfiler.endNetworkOperation(
            trace = trace,
            statusCode = 404,
            responseSizeBytes = 2048
        )

        assertNotNull(metric)
        metric!!
        assertEquals("get_item", metric.operationId)
        assertEquals(404, metric.statusCode)
        assertEquals(2048L, metric.responseSizeBytes)
        assertTrue(metric.durationMs >= 0L)
        assertTrue(metric.timestamp > 0L)
        assertEquals(1, PerformanceProfiler.getBaselineMetrics().networkMetrics.size)
    }

    @Test
    fun `memory snapshot keeps contract fields when profiler is enabled`() {
        PerformanceProfiler.setEnabled(true)

        val snapshot = PerformanceProfiler.captureMemorySnapshot("post_consulta")

        assertNotNull(snapshot)
        snapshot!!
        assertEquals("post_consulta", snapshot.label)
        assertTrue(snapshot.timestamp > 0L)
        assertTrue(snapshot.heapUsedMb >= 0L)
        assertTrue(snapshot.heapTotalMb >= snapshot.heapUsedMb)
        assertTrue(snapshot.nonHeapUsedMb >= 0L)
        assertEquals(1, PerformanceProfiler.getBaselineMetrics().memorySnapshots.size)
    }

    @Test
    fun `setEnabled false resets collected metrics`() {
        PerformanceProfiler.setEnabled(true)

        val trace = PerformanceProfiler.startNetworkOperation("dispatch")
        PerformanceProfiler.endNetworkOperation(
            trace = trace,
            statusCode = 200,
            responseSizeBytes = 128
        )
        PerformanceProfiler.captureMemorySnapshot("before_reset")

        val before = PerformanceProfiler.getBaselineMetrics()
        assertEquals(1, before.networkMetrics.size)
        assertEquals(1, before.memorySnapshots.size)

        PerformanceProfiler.setEnabled(false)

        val after = PerformanceProfiler.getBaselineMetrics()
        assertTrue(after.networkMetrics.isEmpty())
        assertTrue(after.memorySnapshots.isEmpty())
        assertFalse(PerformanceProfiler.isEnabled())
    }

    @Test
    fun `network metrics retention is capped and evicts oldest entries`() {
        PerformanceProfiler.setEnabled(true)
        val totalWrites = MAX_ENTRIES_PER_METRIC + 25

        repeat(totalWrites) { index ->
            val trace = PerformanceProfiler.startNetworkOperation("op_$index")
            PerformanceProfiler.endNetworkOperation(
                trace = trace,
                statusCode = 200,
                responseSizeBytes = index.toLong()
            )
        }

        val metrics = PerformanceProfiler.getBaselineMetrics().networkMetrics
        val firstRetainedIndex = totalWrites - MAX_ENTRIES_PER_METRIC

        assertEquals(MAX_ENTRIES_PER_METRIC, metrics.size)
        assertEquals("op_$firstRetainedIndex", metrics.first().operationId)
        assertEquals("op_${totalWrites - 1}", metrics.last().operationId)
    }

    @Test
    fun `memory snapshots retention is capped and evicts oldest entries`() {
        PerformanceProfiler.setEnabled(true)
        val totalWrites = MAX_ENTRIES_PER_METRIC + 40

        repeat(totalWrites) { index ->
            PerformanceProfiler.captureMemorySnapshot("snap_$index")
        }

        val snapshots = PerformanceProfiler.getBaselineMetrics().memorySnapshots
        val firstRetainedIndex = totalWrites - MAX_ENTRIES_PER_METRIC

        assertEquals(MAX_ENTRIES_PER_METRIC, snapshots.size)
        assertEquals("snap_$firstRetainedIndex", snapshots.first().label)
        assertEquals("snap_${totalWrites - 1}", snapshots.last().label)
    }
}
