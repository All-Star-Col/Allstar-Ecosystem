package com.allstar.seguimientoproduccion.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val AllStarAzul = Color(0xFF122337)
val AllStarNegroAntracita = Color(0xFF2F3339)
val AllStarBlancoHueso = Color(0xFFF6F5F0)
val AllStarOroViejo = Color(0xFFB69559)
val AllStarTerracota = Color(0xFFC7664C)

val AllStarGrisClaro = Color(0xFFE9E6DD)
val AllStarBlancoTarjeta = Color(0xFFFFFCF5)

private val AllStarLightColorScheme: ColorScheme = lightColorScheme(
    primary = AllStarAzul,
    onPrimary = Color.White,

    secondary = AllStarOroViejo,
    onSecondary = Color.White,

    tertiary = AllStarTerracota,
    onTertiary = Color.White,

    background = AllStarBlancoHueso,
    onBackground = AllStarNegroAntracita,

    surface = AllStarBlancoTarjeta,
    onSurface = AllStarNegroAntracita,

    surfaceVariant = AllStarGrisClaro,
    onSurfaceVariant = AllStarNegroAntracita,

    outline = AllStarOroViejo,

    error = AllStarTerracota,
    onError = Color.White
)

@Composable
fun AllStarTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = AllStarLightColorScheme,
        typography = MaterialTheme.typography,
        content = content
    )
}

object AllStarComponentColors {

    @Composable
    fun primaryButton() = ButtonDefaults.buttonColors(
        containerColor = AllStarAzul,
        contentColor = Color.White,
        disabledContainerColor = AllStarGrisClaro,
        disabledContentColor = AllStarNegroAntracita.copy(alpha = 0.45f)
    )

    @Composable
    fun secondaryButton() = ButtonDefaults.buttonColors(
        containerColor = AllStarOroViejo,
        contentColor = Color.White,
        disabledContainerColor = AllStarGrisClaro,
        disabledContentColor = AllStarNegroAntracita.copy(alpha = 0.45f)
    )

    @Composable
    fun alertButton() = ButtonDefaults.buttonColors(
        containerColor = AllStarTerracota,
        contentColor = Color.White,
        disabledContainerColor = AllStarGrisClaro,
        disabledContentColor = AllStarNegroAntracita.copy(alpha = 0.45f)
    )

    @Composable
    fun mainCard() = CardDefaults.cardColors(
        containerColor = AllStarBlancoTarjeta,
        contentColor = AllStarNegroAntracita
    )

    @Composable
    fun softCard() = CardDefaults.cardColors(
        containerColor = AllStarGrisClaro,
        contentColor = AllStarNegroAntracita
    )

    @Composable
    fun textField() = TextFieldDefaults.colors(
        focusedIndicatorColor = AllStarOroViejo,
        unfocusedIndicatorColor = AllStarNegroAntracita.copy(alpha = 0.45f),
        focusedLabelColor = AllStarAzul,
        unfocusedLabelColor = AllStarNegroAntracita.copy(alpha = 0.75f),
        focusedContainerColor = Color.Transparent,
        unfocusedContainerColor = Color.Transparent,
        cursorColor = AllStarAzul
    )
}