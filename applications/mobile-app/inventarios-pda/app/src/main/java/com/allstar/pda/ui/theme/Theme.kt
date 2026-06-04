package com.allstar.pda.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

private val AppColorScheme = darkColorScheme(
    primary           = AppPrimary,
    onPrimary         = AppOnPrimary,
    secondary         = AppSecondary,
    onSecondary       = AppOnPrimary,
    error             = AppError,
    onError           = AppOnSurface,
    background        = AppBackground,
    onBackground      = AppOnSurface,
    surface           = AppSurface,
    onSurface         = AppOnSurface,
    surfaceVariant    = AppSurfaceVariant,
    onSurfaceVariant  = AppOnSurfaceVariant,
    outline           = AppOutline,
    surfaceTint       = AppPrimary.copy(alpha = 0.22f),
)

@Immutable
data class AppDialogDefaults(
    val containerColor: Color,
    val titleColor: Color,
    val textColor: Color,
    val dismissColor: Color,
    val shape: Shape,
    val tonalElevation: Dp
)

private val LocalDialogDefaults = staticCompositionLocalOf {
    AppDialogDefaults(
        containerColor = AppSurface,
        titleColor = AppOnSurface,
        textColor = AppOnSurfaceVariant,
        dismissColor = AppOnSurfaceVariant,
        shape = RoundedCornerShape(AppSpacing.cardCorner),
        tonalElevation = 8.dp
    )
}

object PDATheme {
    val dialogDefaults: AppDialogDefaults
        @Composable
        @ReadOnlyComposable
        get() = LocalDialogDefaults.current
}

@Composable
fun PDAAPPTheme(content: @Composable () -> Unit) {
    val dialogDefaults = AppDialogDefaults(
        containerColor = AppSurface,
        titleColor = AppOnSurface,
        textColor = AppOnSurfaceVariant,
        dismissColor = AppOnSurfaceVariant,
        shape = RoundedCornerShape(AppSpacing.cardCorner),
        tonalElevation = 8.dp
    )

    CompositionLocalProvider(
        LocalDialogDefaults provides dialogDefaults
    ) {
        MaterialTheme(
            colorScheme = AppColorScheme,
            typography = Typography,
            content = content
        )
    }
}
