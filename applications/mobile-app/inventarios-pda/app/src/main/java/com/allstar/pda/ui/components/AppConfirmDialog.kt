package com.allstar.pda.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.allstar.pda.ui.theme.AppPrimary
import com.allstar.pda.ui.theme.AppSpacing
import com.allstar.pda.ui.theme.PDATheme

@Composable
fun AppConfirmDialog(
    title: String,
    message: String = "",
    confirmText: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    dismissText: String? = null,
    icon: ImageVector? = null,
    confirmColor: Color = AppPrimary,
    confirmEnabled: Boolean = true,
    isConfirmLoading: Boolean = false,
    content: (@Composable () -> Unit)? = null
) {
    val dialogDefaults = PDATheme.dialogDefaults

    AlertDialog(
        onDismissRequest = onDismiss,
        shape = dialogDefaults.shape,
        tonalElevation = dialogDefaults.tonalElevation,
        icon = if (icon != null) {
            {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = confirmColor
                )
            }
        } else {
            null
        },
        title = {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold
            )
        },
        text = content ?: if (message.isNotEmpty()) {
            {
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        } else {
            null
        },
        confirmButton = {
            TextButton(
                onClick = onConfirm,
                enabled = confirmEnabled && !isConfirmLoading
            ) {
                if (isConfirmLoading) {
                    Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            strokeWidth = 2.dp,
                            color = confirmColor
                        )
                        Text(
                            text = confirmText,
                            color = confirmColor,
                            style = MaterialTheme.typography.labelLarge
                        )
                    }
                } else {
                    Text(
                        text = confirmText,
                        color = if (confirmEnabled) confirmColor else confirmColor.copy(alpha = 0.5f),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        },
        dismissButton = if (dismissText != null) {
            {
                TextButton(onClick = onDismiss, enabled = !isConfirmLoading) {
                    Text(
                        text = dismissText,
                        color = dialogDefaults.dismissColor,
                        style = MaterialTheme.typography.labelLarge
                    )
                }
            }
        } else {
            null
        },
        containerColor = dialogDefaults.containerColor,
        titleContentColor = dialogDefaults.titleColor,
        textContentColor = dialogDefaults.textColor
    )
}
