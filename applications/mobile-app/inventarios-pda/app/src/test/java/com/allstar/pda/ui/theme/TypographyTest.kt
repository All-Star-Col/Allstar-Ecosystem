package com.allstar.pda.ui.theme

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight

class TypographyTest {

    @Test
    fun `Typography should define all required text styles`() {
        val typography = Typography

        assertNotNull("displayLarge should be defined", typography.displayLarge)
        assertNotNull("displayMedium should be defined", typography.displayMedium)
        assertNotNull("displaySmall should be defined", typography.displaySmall)
        assertNotNull("headlineLarge should be defined", typography.headlineLarge)
        assertNotNull("headlineMedium should be defined", typography.headlineMedium)
        assertNotNull("headlineSmall should be defined", typography.headlineSmall)
        assertNotNull("titleLarge should be defined", typography.titleLarge)
        assertNotNull("titleMedium should be defined", typography.titleMedium)
        assertNotNull("titleSmall should be defined", typography.titleSmall)
        assertNotNull("bodyLarge should be defined", typography.bodyLarge)
        assertNotNull("bodyMedium should be defined", typography.bodyMedium)
        assertNotNull("bodySmall should be defined", typography.bodySmall)
        assertNotNull("labelLarge should be defined", typography.labelLarge)
        assertNotNull("labelMedium should be defined", typography.labelMedium)
        assertNotNull("labelSmall should be defined", typography.labelSmall)
    }

    @Test
    fun `Display text styles should be bold`() {
        val typography = Typography

        assertEquals("displayLarge should be Bold", FontWeight.Bold, typography.displayLarge.fontWeight)
        assertEquals("displayMedium should be Bold", FontWeight.Bold, typography.displayMedium.fontWeight)
        assertTrue("displaySmall should be SemiBold or Bold",
            typography.displaySmall.fontWeight?.weight ?: 0 >= FontWeight.SemiBold.weight)
    }

    @Test
    fun `Headline text styles should have appropriate weights`() {
        val typography = Typography

        assertTrue("headlineLarge should be SemiBold or Bold",
            typography.headlineLarge.fontWeight?.weight ?: 0 >= FontWeight.SemiBold.weight)
        assertTrue("headlineMedium should be SemiBold or Bold",
            typography.headlineMedium.fontWeight?.weight ?: 0 >= FontWeight.SemiBold.weight)
        assertTrue("headlineSmall should be SemiBold or Bold",
            typography.headlineSmall.fontWeight?.weight ?: 0 >= FontWeight.SemiBold.weight)
    }

    @Test
    fun `Title text styles should have appropriate weights`() {
        val typography = Typography

        assertTrue("titleLarge should be SemiBold or Bold",
            typography.titleLarge.fontWeight?.weight ?: 0 >= FontWeight.SemiBold.weight)
        assertTrue("titleMedium should be SemiBold or above",
            typography.titleMedium.fontWeight?.weight ?: 0 >= FontWeight.Medium.weight)
        assertTrue("titleSmall should be Medium or above",
            typography.titleSmall.fontWeight?.weight ?: 0 >= FontWeight.Medium.weight)
    }

    @Test
    fun `Body text styles should be normal weight`() {
        val typography = Typography

        assertEquals("bodyLarge should be Normal", FontWeight.Normal, typography.bodyLarge.fontWeight)
        assertEquals("bodyMedium should be Normal", FontWeight.Normal, typography.bodyMedium.fontWeight)
        assertEquals("bodySmall should be Normal", FontWeight.Normal, typography.bodySmall.fontWeight)
    }

    @Test
    fun `Label text styles should be medium weight`() {
        val typography = Typography

        assertTrue("labelLarge should be SemiBold or above",
            typography.labelLarge.fontWeight?.weight ?: 0 >= FontWeight.Medium.weight)
        assertTrue("labelMedium should be Medium or above",
            typography.labelMedium.fontWeight?.weight ?: 0 >= FontWeight.Medium.weight)
        assertTrue("labelSmall should be Medium or above",
            typography.labelSmall.fontWeight?.weight ?: 0 >= FontWeight.Medium.weight)
    }

    @Test
    fun `Font sizes should follow a decreasing hierarchy`() {
        val typography = Typography

        assertTrue("displayLarge > displayMedium",
            typography.displayLarge.fontSize > typography.displayMedium.fontSize)
        assertTrue("displayMedium > displaySmall",
            typography.displayMedium.fontSize > typography.displaySmall.fontSize)

        assertTrue("headlineLarge > headlineMedium",
            typography.headlineLarge.fontSize > typography.headlineMedium.fontSize)
        assertTrue("headlineMedium > headlineSmall",
            typography.headlineMedium.fontSize > typography.headlineSmall.fontSize)

        assertTrue("titleLarge > titleMedium",
            typography.titleLarge.fontSize > typography.titleMedium.fontSize)
        assertTrue("titleMedium > titleSmall",
            typography.titleMedium.fontSize > typography.titleSmall.fontSize)
    }

    @Test
    fun `Line heights should be appropriate for readability`() {
        val typography = Typography

        assertTrue("bodyLarge line height should be > font size",
            typography.bodyLarge.lineHeight > typography.bodyLarge.fontSize)
        assertTrue("bodyMedium line height should be > font size",
            typography.bodyMedium.lineHeight > typography.bodyMedium.fontSize)
        assertTrue("bodySmall line height should be > font size",
            typography.bodySmall.lineHeight > typography.bodySmall.fontSize)
    }

    @Test
    fun `Letter spacing should follow Material 3 guidelines`() {
        val typography = Typography

        assertTrue("bodyLarge letter spacing should be positive",
            typography.bodyLarge.letterSpacing.value > 0)
    }

    @Test
    fun `titleLarge font size should match design spec 22sp`() {
        val typography = Typography
        assertEquals("titleLarge should be 22sp as per design", 22f, typography.titleLarge.fontSize.value, 0.01f)
    }

    @Test
    fun `titleMedium font size should match design spec 16sp`() {
        val typography = Typography
        assertEquals("titleMedium should be 16sp as per design", 16f, typography.titleMedium.fontSize.value, 0.01f)
    }

    @Test
    fun `bodyLarge font size should match design spec 16sp`() {
        val typography = Typography
        assertEquals("bodyLarge should be 16sp as per design", 16f, typography.bodyLarge.fontSize.value, 0.01f)
    }

    @Test
    fun `bodySmall font size should match design spec 12sp`() {
        val typography = Typography
        assertEquals("bodySmall should be 12sp as per design", 12f, typography.bodySmall.fontSize.value, 0.01f)
    }

    @Test
    fun `labelMedium font size should match design spec 12sp`() {
        val typography = Typography
        assertEquals("labelMedium should be 12sp as per design", 12f, typography.labelMedium.fontSize.value, 0.01f)
    }

    @Test
    fun `Default font family should be used`() {
        val typography = Typography

        assertNotNull("displayLarge should have font family set", typography.displayLarge.fontFamily)
        assertNotNull("bodyLarge should have font family set", typography.bodyLarge.fontFamily)
    }
}
