package com.allstar.pda.ui.main

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class MainNavEventTest {

    @Test
    fun `MainNavEvent GoToStock should contain item info`() {
        val itemInfo = com.allstar.pda.model.ItemInfo(
            item = "12345",
            excelRow = 1,
            product = "Test Product",
            fabric = "Test Fabric",
            warehouse = "A1",
            warehouseRow = "F1",
            hasOptions = false
        )

        val event = MainNavEvent.GoToStock(itemInfo)

        assertNotNull(event.itemInfo)
        assertEquals("12345", event.itemInfo.item)
        assertEquals("Test Product", event.itemInfo.product)
    }

    @Test
    fun `MainNavEvent GoToStock equality should work correctly`() {
        val itemInfo = com.allstar.pda.model.ItemInfo(
            item = "12345",
            excelRow = 1,
            product = "Product",
            fabric = "Fabric",
            warehouse = "A1",
            warehouseRow = "F1",
            hasOptions = true
        )

        val event1 = MainNavEvent.GoToStock(itemInfo)
        val event2 = MainNavEvent.GoToStock(itemInfo)

        assertEquals(event1, event2)
    }
}
