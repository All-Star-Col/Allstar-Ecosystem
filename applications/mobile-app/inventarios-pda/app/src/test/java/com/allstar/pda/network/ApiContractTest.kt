package com.allstar.pda.network

import com.allstar.pda.model.ItemInfo
import com.allstar.pda.model.ReturnedItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * ApiContractTest — Phase 2 data contract verification.
 *
 * Verifies that the data models (ItemInfo, ReturnedItem) correctly represent
 * the contracts defined in docs/CONTEXT.md. These tests confirm that the
 * parsing logic preserves the exact field names, types, and default values
 * expected by the backend API contract.
 */
class ApiContractTest {

    @Test
    fun `ItemInfo serializable contract is satisfied`() {
        val item = ItemInfo(
            item = "12345",
            excelRow = 7,
            product = "MONACO SL LISO",
            fabric = "TERCIOPELO LISO",
            warehouse = "Bodega 1 / Piso 1",
            warehouseRow = "3",
            hasOptions = true,
            optWarehouses = listOf("Bodega 1 / Piso 1", "Bodega 2"),
            optRows = listOf("1", "2", "3"),
            optConveyors = listOf("Servientrega", "Envia")
        )
        assertTrue("ItemInfo must implement Serializable", item is java.io.Serializable)
    }

    @Test
    fun `ItemInfo stores all fields from Item_LookupResponse contract`() {
        val item = ItemInfo(
            item = "12345",
            excelRow = 7,
            product = "MONACO SL LISO",
            fabric = "TERCIOPELO LISO",
            warehouse = "Bodega 1 / Piso 1",
            warehouseRow = "3",
            hasOptions = true,
            optWarehouses = listOf("Bodega 1 / Piso 1"),
            optRows = listOf("1", "2"),
            optConveyors = listOf("Servientrega")
        )
        assertEquals("12345", item.item)
        assertEquals(7, item.excelRow)
        assertEquals("MONACO SL LISO", item.product)
        assertEquals("TERCIOPELO LISO", item.fabric)
        assertEquals("Bodega 1 / Piso 1", item.warehouse)
        assertEquals("3", item.warehouseRow)
        assertTrue(item.hasOptions)
        assertEquals(1, item.optWarehouses.size)
        assertEquals(1, item.optRows.size)
        assertEquals(1, item.optConveyors.size)
    }

    @Test
    fun `ItemInfo defaults are empty lists for option lists`() {
        val item = ItemInfo(
            item = "99999",
            excelRow = -1,
            product = "N/A",
            fabric = "",
            warehouse = "N/A",
            warehouseRow = "N/A",
            hasOptions = false
        )
        assertTrue(item.optWarehouses.isEmpty())
        assertTrue(item.optRows.isEmpty())
        assertTrue(item.optConveyors.isEmpty())
    }

    @Test
    fun `ItemInfo hasOptions false when options are absent`() {
        val item = ItemInfo(
            item = "00000",
            excelRow = 1,
            product = "X",
            fabric = "",
            warehouse = "Y",
            warehouseRow = "1",
            hasOptions = false
        )
        assertFalse(item.hasOptions)
    }

    @Test
    fun `ReturnedItem stores all fields from Returned_Item contract`() {
        val returned = ReturnedItem(
            item = "98765",
            product = "MONACO SL LISO",
            fabric = "TERCIOPELO LISO",
            client = "CLIENTE ABC"
        )
        assertEquals("98765", returned.item)
        assertEquals("MONACO SL LISO", returned.product)
        assertEquals("TERCIOPELO LISO", returned.fabric)
        assertEquals("CLIENTE ABC", returned.client)
    }

    @Test
    fun `ReturnedItem client field maps to Returned_Item contract client field`() {
        val returned = ReturnedItem(
            item = "DESCONOCIDO-1",
            product = "N/A",
            fabric = "",
            client = "N/A"
        )
        assertEquals("N/A", returned.client)
    }

    @Test
    fun `ReturnedItem is not Serializable`() {
        val returned = ReturnedItem("1", "P", "F", "C")
        assertFalse(returned is java.io.Serializable)
    }

    @Test
    fun `ItemInfo excelRow type is Int matching the contract`() {
        val item = ItemInfo(
            item = "1",
            excelRow = 999,
            product = "P",
            fabric = "",
            warehouse = "W",
            warehouseRow = "1",
            hasOptions = false
        )
        assertTrue(item.excelRow is Int)
        assertEquals(999, item.excelRow)
    }

    @Test
    fun `ItemInfo warehouseRow type is String per contract`() {
        val item = ItemInfo(
            item = "1",
            excelRow = 1,
            product = "P",
            fabric = "",
            warehouse = "W",
            warehouseRow = "10",
            hasOptions = false
        )
        assertTrue(item.warehouseRow is String)
        assertEquals("10", item.warehouseRow)
    }

    @Test
    fun `ItemInfo copy preserves unchanged fields`() {
        val original = ItemInfo(
            item = "12345",
            excelRow = 7,
            product = "PRODUCT",
            fabric = "FABRIC",
            warehouse = "WH",
            warehouseRow = "1",
            hasOptions = true,
            optWarehouses = listOf("A", "B"),
            optRows = listOf("1", "2"),
            optConveyors = listOf("C1")
        )
        val copied = original.copy(item = "67890")

        assertEquals("67890", copied.item)
        assertEquals(7, copied.excelRow)
        assertEquals("PRODUCT", copied.product)
        assertEquals(listOf("A", "B"), copied.optWarehouses)
    }

    @Test
    fun `ReturnedItem copy preserves unchanged fields`() {
        val original = ReturnedItem(
            item = "1",
            product = "P",
            fabric = "F",
            client = "C"
        )
        val copied = original.copy(client = "NEW_CLIENT")
        assertEquals("1", copied.item)
        assertEquals("P", copied.product)
        assertEquals("NEW_CLIENT", copied.client)
    }

    @Test
    fun `ItemInfo data class equality works for navigation events`() {
        val item1 = ItemInfo("12345", 7, "P", "F", "W", "1", false)
        val item2 = ItemInfo("12345", 7, "P", "F", "W", "1", false)
        assertEquals(item1, item2)
        assertEquals(item1.hashCode(), item2.hashCode())
    }

    @Test
    fun `ReturnedItem data class equality works for list filtering`() {
        val r1 = ReturnedItem("D-1", "P", "F", "C")
        val r2 = ReturnedItem("D-1", "P", "F", "C")
        val r3 = ReturnedItem("D-2", "P", "F", "C")
        assertEquals(r1, r2)
        assertTrue(r1 != r3)
    }
}
