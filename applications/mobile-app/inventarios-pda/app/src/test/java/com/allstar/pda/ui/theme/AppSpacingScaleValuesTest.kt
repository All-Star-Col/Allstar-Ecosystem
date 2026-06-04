package com.allstar.pda.ui.theme

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AppSpacingScaleValuesTest {

    @Test
    fun `AppSpacing xxs value`() {
        assertEquals(2f, AppSpacing.xxs.value, 0.01f)
    }

    @Test
    fun `AppSpacing xs value`() {
        assertEquals(4f, AppSpacing.xs.value, 0.01f)
    }

    @Test
    fun `AppSpacing sm value`() {
        assertEquals(8f, AppSpacing.sm.value, 0.01f)
    }

    @Test
    fun `AppSpacing md value`() {
        assertEquals(12f, AppSpacing.md.value, 0.01f)
    }

    @Test
    fun `AppSpacing lg value`() {
        assertEquals(16f, AppSpacing.lg.value, 0.01f)
    }

    @Test
    fun `AppSpacing xl value`() {
        assertEquals(20f, AppSpacing.xl.value, 0.01f)
    }

    @Test
    fun `AppSpacing xxl value`() {
        assertEquals(24f, AppSpacing.xxl.value, 0.01f)
    }

    @Test
    fun `AppSpacing xxxl value`() {
        assertEquals(32f, AppSpacing.xxxl.value, 0.01f)
    }

    @Test
    fun `AppSpacing fieldHeight value`() {
        assertEquals(56f, AppSpacing.fieldHeight.value, 0.01f)
    }

    @Test
    fun `AppSpacing buttonHeight value`() {
        assertEquals(50f, AppSpacing.buttonHeight.value, 0.01f)
    }

    @Test
    fun `AppSpacing cardCorner value`() {
        assertEquals(14f, AppSpacing.cardCorner.value, 0.01f)
    }

    @Test
    fun `AppSpacing chipCorner value`() {
        assertEquals(999f, AppSpacing.chipCorner.value, 0.01f)
    }

    @Test
    fun `spacing values are multiples of 2`() {
        assertTrue(AppSpacing.xxs.value % 2 == 0f)
        assertTrue(AppSpacing.sm.value % 2 == 0f)
        assertTrue(AppSpacing.md.value % 2 == 0f)
        assertTrue(AppSpacing.lg.value % 2 == 0f)
        assertTrue(AppSpacing.xl.value % 2 == 0f)
        assertTrue(AppSpacing.xxl.value % 2 == 0f)
    }

    @Test
    fun `fieldHeight meets minimum touch target size`() {
        assertTrue(AppSpacing.fieldHeight.value >= 48f)
    }

    @Test
    fun `buttonHeight meets minimum touch target size`() {
        assertTrue(AppSpacing.buttonHeight.value >= 48f)
    }
}
