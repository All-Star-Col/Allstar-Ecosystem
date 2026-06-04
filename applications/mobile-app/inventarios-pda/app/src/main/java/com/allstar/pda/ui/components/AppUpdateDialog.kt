package com.allstar.pda.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import com.allstar.pda.ui.theme.AppGold
import com.allstar.pda.ui.theme.AppSpacing

@Composable
fun AppUpdateDialog(
    releaseNotes: String,
    isUpdating: Boolean,
    onConfirmUpdate: () -> Unit,
    onDismiss: () -> Unit
) {
    AppConfirmDialog(
        title = "Nueva actualización disponible",
        confirmText = if (isUpdating) "Actualizando..." else "Actualizar ahora",
        onConfirm = onConfirmUpdate,
        onDismiss = onDismiss,
        dismissText = if (isUpdating) null else "Ahora no",
        icon = Icons.Default.SystemUpdate,
        confirmColor = AppGold,
        isConfirmLoading = isUpdating,
        content = {
            Column {
                if (releaseNotes.isNotBlank()) {
                    Text(
                        text = "Novedades",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = AppGold
                    )
                    Spacer(modifier = Modifier.height(AppSpacing.xs))
                    Text(
                        text = releaseNotes,
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(modifier = Modifier.height(AppSpacing.md))
                }

                Text(
                    text = "¿Desea instalar la nueva versión ahora?",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    )
}
