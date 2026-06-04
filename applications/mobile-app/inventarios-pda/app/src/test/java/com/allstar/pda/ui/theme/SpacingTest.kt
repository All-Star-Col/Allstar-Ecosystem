package com.allstar.pda.ui.theme

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for the AppSpacingScale theme configuration.
 * Tests that spacing values are properly defined for consistent visual layout.
 */
class SpacingTest {

    @Test
    fun `AppSpacing should have all required spacing values defined`() {
        val spacing = AppSpacing

        // Verify all spacing levels are defined
        assertTrue("xxs should be defined", spacing.xxs.value >= 0)
        assertTrue("xs should be defined", spacing.xs.value >= 0)
        assertTrue("sm should be defined", spacing.sm.value >= 0)
        assertTrue("md should be defined", spacing.md.value >= 0)
        assertTrue("lg should be defined", spacing.lg.value >= 0)
        assertTrue("xl should be defined", spacing.xl.value >= 0)
        assertTrue("xxl should be defined", spacing.xxl.value >= 0)
        assertTrue("xxxl should be defined", spacing.xxxl.value >= 0)
    }

    @Test
    fun `AppSpacing should have increasing values from small to large`() {
        val spacing = AppSpacing

        assertTrue("md should be greater than sm", spacing.md > spacing.sm)
        assertTrue("lg should be greater than md", spacing.lg > spacing.md)
        assertTrue("xl should be greater than lg", spacing.xl > spacing.lg)
        assertTrue("xxl should be greater than xl", spacing.xxl > spacing.xl)
        assertTrue("xxxl should be greater than xxl", spacing.xxxl > spacing.xxl)
    }

    @Test
    fun `AppSpacing fieldHeight should be at least 56dp for touch targets`() {
        val spacing = AppSpacing
        assertTrue("fieldHeight should be >= 48dp for accessibility", spacing.fieldHeight.value >= 48)
    }

    @Test
    fun `AppSpacing buttonHeight should be at least 50dp for touch targets`() {
        val spacing = AppSpacing
        assertTrue("buttonHeight should be >= 48dp for accessibility", spacing.buttonHeight.value >= 48)
    }

    @Test
    fun `AppSpacing cardCorner should be reasonable (between 8dp and 24dp)`() {
        val spacing = AppSpacing
        assertTrue("cardCorner should be >= 8dp", spacing.cardCorner.value >= 8)
        assertTrue("cardCorner should be <= 24dp", spacing.cardCorner.value <= 24)
    }

    @Test
    fun `AppSpacing chipCorner should be pill-shaped (high radius)`() {
        val spacing = AppSpacing
        // A high corner radius creates the pill/chip shape
        assertTrue("chipCorner should be very high for pill shape", spacing.chipCorner.value >= 100)
    }

    @Test
    fun `AppSpacing xxl value should match design spec 24dp`() {
        val spacing = AppSpacing
        assertEquals("xxl should be 24dp as per design", 24f, spacing.xxl.value, 0.01f)
    }

    @Test
    fun `AppSpacing fieldHeight value should match design spec 56dp`() {
        val spacing = AppSpacing
        assertEquals("fieldHeight should be 56dp as per design", 56f, spacing.fieldHeight.value, 0.01f)
    }

    @Test
    fun `AppSpacing buttonHeight value should match design spec 50dp`() {
        val spacing = AppSpacing
        assertEquals("buttonHeight should be 50dp as per design", 50f, spacing.buttonHeight.value, 0.01f)
    }

    @Test
    fun `AppSpacing cardCorner value should match design spec 14dp`() {
        val spacing = AppSpacing
        assertEquals("cardCorner should be 14dp as per design", 14f, spacing.cardCorner.value, 0.01f)
    }
}
