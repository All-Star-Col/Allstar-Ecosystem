package com.allstar.pda.ui.main

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MainUiStateTest {

    @Test
    fun `MainUiState should have correct default values`() {
        val state = MainUiState()

        assertFalse(state.isLoadingConsulta)
        assertFalse(state.isLoadingProduccion)
        assertFalse(state.isLoadingDevolucion)
        assertFalse(state.isTailscaleOn)
        assertNull(state.errorMessage)
        assertFalse(state.showErrorDialog)
        assertFalse(state.showConfirmDialog)
        assertNull(state.successMessage)
        assertFalse(state.showSuccessDialog)
        assertNull(state.returnedItem)
        assertTrue(state.returnedUnknownList.isEmpty())
        assertNull(state.selectedUnknown)
        assertFalse(state.showUnknownDropdown)
        assertEquals("", state.newItemNumber)
        assertFalse(state.showReturnKnownDialog)
        assertFalse(state.showReturnUnknownDialog)
    }

    @Test
    fun `MainUiState can be modified with copy`() {
        val state = MainUiState()
        val modified = state.copy(
            isLoadingConsulta = true,
            errorMessage = "Test error",
            showErrorDialog = true
        )

        assertTrue(modified.isLoadingConsulta)
        assertEquals("Test error", modified.errorMessage)
        assertTrue(modified.showErrorDialog)
        assertFalse(modified.isLoadingProduccion)
    }

    @Test
    fun `MainUiState supports loading states simultaneously`() {
        val state = MainUiState().copy(
            isLoadingConsulta = true,
            isLoadingProduccion = true,
            isLoadingDevolucion = true
        )

        assertTrue(state.isLoadingConsulta)
        assertTrue(state.isLoadingProduccion)
        assertTrue(state.isLoadingDevolucion)
    }

    @Test
    fun `MainUiState supports return unknown dialog with selection`() {
        val returnedItem = com.allstar.pda.model.ReturnedItem(
            item = "12345",
            product = "Product A",
            fabric = "Fabric X",
            client = "Client 1"
        )

        val state = MainUiState().copy(
            showReturnUnknownDialog = true,
            returnedUnknownList = listOf(returnedItem),
            selectedUnknown = returnedItem,
            newItemNumber = "67890"
        )

        assertTrue(state.showReturnUnknownDialog)
        assertEquals(1, state.returnedUnknownList.size)
        assertNotNull(state.selectedUnknown)
        assertEquals("12345", state.selectedUnknown?.item)
        assertEquals("67890", state.newItemNumber)
    }
}
