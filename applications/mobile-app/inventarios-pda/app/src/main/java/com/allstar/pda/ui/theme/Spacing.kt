package com.allstar.pda.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Immutable
data class AppSpacingScale(
    val xxs: Dp = 2.dp,
    val xs: Dp = 4.dp,
    val sm: Dp = 8.dp,
    val md: Dp = 12.dp,
    val lg: Dp = 16.dp,
    val xl: Dp = 20.dp,
    val xxl: Dp = 24.dp,
    val xxxl: Dp = 32.dp,
    val fieldHeight: Dp = 56.dp,
    val buttonHeight: Dp = 50.dp,
    val cardCorner: Dp = 14.dp,
    val chipCorner: Dp = 999.dp
)

val AppSpacing = AppSpacingScale()
