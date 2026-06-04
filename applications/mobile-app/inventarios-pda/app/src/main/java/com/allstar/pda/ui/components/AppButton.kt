package com.allstar.pda.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.allstar.pda.ui.theme.AppError
import com.allstar.pda.ui.theme.AppOnPrimary
import com.allstar.pda.ui.theme.AppOnSurface
import com.allstar.pda.ui.theme.AppPrimary
import com.allstar.pda.ui.theme.AppSecondary
import com.allstar.pda.ui.theme.AppSpacing
import com.allstar.pda.ui.theme.AppSurfaceVariant

@Composable
private fun AppBaseButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    enabled: Boolean = true,
    icon: ImageVector? = null,
    containerColor: Color,
    contentColor: Color,
    disabledContainerColor: Color,
    border: BorderStroke? = null,
    elevation: androidx.compose.material3.ButtonElevation? = ButtonDefaults.buttonElevation(defaultElevation = 2.dp)
) {
    Button(
        onClick = onClick,
        modifier = modifier.height(AppSpacing.buttonHeight),
        border = border,
        colors = ButtonDefaults.buttonColors(
            containerColor = containerColor,
            contentColor = contentColor,
            disabledContainerColor = disabledContainerColor,
            disabledContentColor = contentColor.copy(alpha = 0.7f)
        ),
        shape = MaterialTheme.shapes.medium,
        elevation = elevation,
        enabled = enabled && !isLoading
    ) {
        when {
            isLoading -> {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    color = contentColor,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(AppSpacing.sm))
            }

            icon != null -> {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = contentColor,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(AppSpacing.sm))
            }
        }

        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge
        )
    }
}

@Composable
fun AppPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    enabled: Boolean = true,
    icon: ImageVector? = null
) {
    AppBaseButton(
        text = text,
        onClick = onClick,
        modifier = modifier,
        isLoading = isLoading,
        enabled = enabled,
        icon = icon,
        containerColor = AppPrimary,
        contentColor = AppOnPrimary,
        disabledContainerColor = AppPrimary.copy(alpha = 0.5f)
    )
}

@Composable
fun AppSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    enabled: Boolean = true,
    icon: ImageVector? = null
) {
    AppBaseButton(
        text = text,
        onClick = onClick,
        modifier = modifier,
        isLoading = isLoading,
        enabled = enabled,
        icon = icon,
        containerColor = AppSecondary,
        contentColor = AppOnPrimary,
        disabledContainerColor = AppSecondary.copy(alpha = 0.5f)
    )
}

@Composable
fun AppDestructiveButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    enabled: Boolean = true,
    icon: ImageVector? = null
) {
    AppBaseButton(
        text = text,
        onClick = onClick,
        modifier = modifier,
        isLoading = isLoading,
        enabled = enabled,
        icon = icon,
        containerColor = AppError,
        contentColor = AppOnSurface,
        disabledContainerColor = AppError.copy(alpha = 0.5f)
    )
}

@Composable
fun AppReturnedProductsButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    enabled: Boolean = true,
    icon: ImageVector? = null
) {
    AppBaseButton(
        text = text,
        onClick = onClick,
        modifier = modifier,
        isLoading = isLoading,
        enabled = enabled,
        icon = icon,
        containerColor = AppSurfaceVariant,
        contentColor = AppOnSurface,
        disabledContainerColor = AppSurfaceVariant.copy(alpha = 0.5f),
        border = BorderStroke(1.5.dp, AppError.copy(alpha = 0.9f))
    )
}
