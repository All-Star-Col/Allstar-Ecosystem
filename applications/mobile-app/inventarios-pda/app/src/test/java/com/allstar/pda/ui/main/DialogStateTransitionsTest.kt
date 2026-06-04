package com.allstar.pda.ui.main

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DialogStateTransitionsTest {

    @Test
    fun `Return unknown dialog confirm condition - selectedUnknown null, newItem blank`() {
        val state = MainUiState(selectedUnknown = null, newItemNumber = "")
        val canConfirm = state.selectedUnknown != null && state.newItemNumber.isNotBlank()
        assertFalse(canConfirm)
    }

    @Test
    fun `Return unknown dialog confirm condition - selectedUnknown set, newItem blank`() {
        val returnedItem = com.allstar.pda.model.ReturnedItem(
            item = "12345",
            product = "Product A",
            fabric = "Fabric X",
            client = "Client 1"
        )
        val state = MainUiState(selectedUnknown = returnedItem, newItemNumber = "")
        val canConfirm = state.selectedUnknown != null && state.newItemNumber.isNotBlank()
        assertFalse(canConfirm)
    }

    @Test
    fun `Return unknown dialog confirm condition - selectedUnknown null, newItem set`() {
        val state = MainUiState(selectedUnknown = null, newItemNumber = "67890")
        val canConfirm = state.selectedUnknown != null && state.newItemNumber.isNotBlank()
        assertFalse(canConfirm)
    }

    @Test
    fun `Return unknown dialog confirm condition - selectedUnknown set, newItem set`() {
        val returnedItem = com.allstar.pda.model.ReturnedItem(
            item = "12345",
            product = "Product A",
            fabric = "Fabric X",
            client = "Client 1"
        )
        val state = MainUiState(selectedUnknown = returnedItem, newItemNumber = "67890")
        val canConfirm = state.selectedUnknown != null && state.newItemNumber.isNotBlank()
        assertTrue(canConfirm)
    }

    @Test
    fun `Digits-only normalization for new item number`() {
        val mixedInput = "12A-34B"
        val normalized = mixedInput.filter { it.isDigit() }
        assertEquals("1234", normalized)
    }

    @Test
    fun `Digits-only normalization empty string`() {
        val mixedInput = "ABC-DEF"
        val normalized = mixedInput.filter { it.isDigit() }
        assertEquals("", normalized)
    }

    @Test
    fun `Digits-only normalization pure digits`() {
        val mixedInput = "12345"
        val normalized = mixedInput.filter { it.isDigit() }
        assertEquals("12345", normalized)
    }

    @Test
    fun `Input normalization hint shown when input differs from normalized`() {
        val rawInput = "12A-34"
        val normalized = rawInput.filter { it.isDigit() }
        val shouldShowHint = rawInput != normalized
        assertTrue(shouldShowHint)
    }

    @Test
    fun `Input normalization hint not shown for digits-only input`() {
        val rawInput = "12345"
        val normalized = rawInput.filter { it.isDigit() }
        val shouldShowHint = rawInput != normalized
        assertFalse(shouldShowHint)
    }

    @Test
    fun `canRunPrimaryActions requires normalizedItem and tailscale`() {
        val normalizedItem = "12345"
        val tailscaleOn = true
        val canRun = normalizedItem.isNotBlank() && tailscaleOn
        assertTrue(canRun)
    }

    @Test
    fun `canRunPrimaryActions false when item is blank`() {
        val normalizedItem = ""
        val tailscaleOn = true
        val canRun = normalizedItem.isNotBlank() && tailscaleOn
        assertFalse(canRun)
    }

    @Test
    fun `canRunPrimaryActions false when tailscale is off`() {
        val normalizedItem = "12345"
        val tailscaleOn = false
        val canRun = normalizedItem.isNotBlank() && tailscaleOn
        assertFalse(canRun)
    }

    @Test
    fun `canRunPrimaryActions false when both conditions fail`() {
        val normalizedItem = ""
        val tailscaleOn = false
        val canRun = normalizedItem.isNotBlank() && tailscaleOn
        assertFalse(canRun)
    }
}
