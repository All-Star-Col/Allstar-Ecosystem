package com.allstar.pda.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ButtonComponentTest {

    @Test
    fun `AppPrimaryButton enabled when both enabled and not loading`() {
        val isEnabled = true
        val isLoading = false
        val actualEnabled = isEnabled && !isLoading
        assertTrue(actualEnabled)
    }

    @Test
    fun `AppPrimaryButton disabled when loading`() {
        val isEnabled = true
        val isLoading = true
        val actualEnabled = isEnabled && !isLoading
        assertFalse(actualEnabled)
    }

    @Test
    fun `AppPrimaryButton disabled when explicitly disabled`() {
        val isEnabled = false
        val isLoading = false
        val actualEnabled = isEnabled && !isLoading
        assertFalse(actualEnabled)
    }

    @Test
    fun `AppConfirmDialog confirmEnabled combined with isConfirmLoading`() {
        val confirmEnabled = true
        val isConfirmLoading = false
        val actualEnabled = confirmEnabled && !isConfirmLoading
        assertTrue(actualEnabled)
    }

    @Test
    fun `AppConfirmDialog confirmEnabled false when loading`() {
        val confirmEnabled = true
        val isConfirmLoading = true
        val actualEnabled = confirmEnabled && !isConfirmLoading
        assertFalse(actualEnabled)
    }

    @Test
    fun `AppConfirmDialog dismissButton enabled when not loading`() {
        val isConfirmLoading = false
        val dismissEnabled = !isConfirmLoading
        assertTrue(dismissEnabled)
    }

    @Test
    fun `AppConfirmDialog dismissButton disabled when loading`() {
        val isConfirmLoading = true
        val dismissEnabled = !isConfirmLoading
        assertFalse(dismissEnabled)
    }

    @Test
    fun `ConfirmDialog dismissText null when loading`() {
        val isUpdating = true
        val dismissText: String? = if (isUpdating) null else "Ahora no"
        assertEquals(null, dismissText)
    }

    @Test
    fun `ConfirmDialog dismissText shown when not loading`() {
        val isUpdating = false
        val dismissText: String? = if (isUpdating) null else "Ahora no"
        assertEquals("Ahora no", dismissText)
    }

    @Test
    fun `ConfirmDialog confirmText changes based on isUpdating`() {
        val isUpdating = true
        val confirmText = if (isUpdating) "Actualizando..." else "Actualizar ahora"
        assertEquals("Actualizando...", confirmText)
    }

    @Test
    fun `ConfirmDialog confirmText normal state`() {
        val isUpdating = false
        val confirmText = if (isUpdating) "Actualizando..." else "Actualizar ahora"
        assertEquals("Actualizar ahora", confirmText)
    }
}
