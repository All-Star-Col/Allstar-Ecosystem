package com.allstar.producciontablet

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.allstar.producciontablet.data.EmpleadoDto
import com.allstar.producciontablet.data.ItemDto
import com.allstar.producciontablet.data.MaterialDto
import com.allstar.producciontablet.data.OrdenProcesoDto
import com.allstar.producciontablet.data.ProcesoDto
import com.allstar.producciontablet.data.TelaDto
import com.allstar.producciontablet.ui.EstacionViewModel
import com.allstar.producciontablet.ui.theme.ProduccionTabletTheme
import kotlin.math.max

private val AllStarBlue = Color(0xFF122337)
private val AllStarInk = Color(0xFF1E2935)
private val AllStarAnthracite = Color(0xFF2F3339)
private val AllStarBone = Color(0xFFF6F5F0)
private val AllStarBoneDark = Color(0xFFEDE9DD)
private val AllStarGold = Color(0xFFB69559)
private val AllStarGoldSoft = Color(0xFFE8D8B8)
private val AllStarTerracotta = Color(0xFFC7664C)
private val AllStarWhite = Color(0xFFFFFFFF)
private val AllStarMuted = Color(0xFF77736A)
private val AllStarSuccess = Color(0xFF647A58)

data class MaterialRegistradoUi(
    val nombre: String,
    val cantidad: Double
)

enum class TipoConsumo {
    MATERIAL,
    TELA
}

class MainActivity : ComponentActivity() {

    private val viewModel: EstacionViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            ProduccionTabletTheme {
                ProduccionApp(viewModel)
            }
        }
    }
}

@Composable
fun ProduccionApp(viewModel: EstacionViewModel) {
    val state by viewModel.uiState.collectAsState()

    Surface(
        modifier = Modifier
            .fillMaxSize()
            .background(AllStarBone),
        color = AllStarBone
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(14.dp)
        ) {
            Header(
                cargando = state.cargando,
                mensaje = state.mensaje,
                error = state.error,
                tabletId = state.tabletId,
                procesoId = state.procesoId,
                procesos = state.procesos,
                onTabletChange = { viewModel.cambiarTablet(it) },
                onProcesoChange = { viewModel.cambiarProceso(it) },
                onRefresh = { viewModel.cargarInicial() }
            )

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxSize(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                PanelPendientes(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight(),
                    procesoId = state.procesoId,
                    items = state.pendientes,
                    empleados = state.empleados,
                    onAsignar = { item, empleadoId ->
                        viewModel.asignarItem(
                            itemPendiente = item,
                            empleadoId = empleadoId
                        )
                    }
                )

                PanelEnProceso(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight(),
                    procesoId = state.procesoId,
                    ordenes = state.enProceso,
                    materiales = state.materiales,
                    telas = state.telas,
                    onRegistrarMaterial = { orden, materialId, cantidad ->
                        viewModel.registrarMaterial(
                            orden = orden,
                            materialId = materialId,
                            cantidad = cantidad
                        )
                    },
                    onRegistrarTela = { orden, telaId, cantidad ->
                        viewModel.registrarTela(
                            orden = orden,
                            telaId = telaId,
                            cantidad = cantidad
                        )
                    },
                    onFinalizar = { orden ->
                        viewModel.finalizarOrdenProceso(orden.id)
                    }
                )
            }
        }
    }
}

@Composable
fun Header(
    cargando: Boolean,
    mensaje: String?,
    error: String?,
    tabletId: String,
    procesoId: Int,
    procesos: List<ProcesoDto>,
    onTabletChange: (String) -> Unit,
    onProcesoChange: (Int) -> Unit,
    onRefresh: () -> Unit
) {
    val tablets = listOf(
        "TABLET_01",
        "TABLET_02",
        "TABLET_03",
        "TABLET_04",
        "TABLET_05",
        "TABLET_06"
    )

    val procesoActual = procesos.firstOrNull {
        it.id?.toInt() == procesoId
    }

    val procesoNombre = procesoActual?.nombre ?: "Proceso $procesoId"

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 1.dp,
                color = AllStarGold.copy(alpha = 0.45f),
                shape = RoundedCornerShape(24.dp)
            ),
        colors = CardDefaults.cardColors(containerColor = AllStarBlue),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 11.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Column(
                    modifier = Modifier.weight(0.9f)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .background(
                                    color = if (cargando) AllStarGold else AllStarSuccess,
                                    shape = CircleShape
                                )
                        )

                        Text(
                            text = "All Star Producción",
                            style = MaterialTheme.typography.titleMedium,
                            color = AllStarBone,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.height(3.dp))

                    Text(
                        text = procesoNombre,
                        style = MaterialTheme.typography.bodySmall,
                        color = AllStarGoldSoft,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                HeaderSelectorTextoCompacto(
                    modifier = Modifier.weight(1f),
                    label = "Tablet",
                    value = tabletId,
                    options = tablets,
                    optionText = { it },
                    onChange = onTabletChange
                )

                HeaderSelectorObjetoCompacto(
                    modifier = Modifier.weight(1.15f),
                    label = "Proceso",
                    value = procesoActual,
                    options = procesos,
                    optionText = { proceso ->
                        proceso.nombre ?: "Proceso ${proceso.id?.toInt() ?: ""}"
                    },
                    valueText = procesoNombre,
                    onChange = { proceso ->
                        proceso.id?.toInt()?.let { onProcesoChange(it) }
                    }
                )

                if (cargando) {
                    CircularProgressIndicator(
                        color = AllStarGold,
                        modifier = Modifier.size(26.dp),
                        strokeWidth = 3.dp
                    )
                }

                Button(
                    onClick = onRefresh,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AllStarGold,
                        contentColor = AllStarBlue
                    ),
                    shape = RoundedCornerShape(14.dp),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp)
                ) {
                    Text(
                        text = "Actualizar",
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            if (mensaje != null || error != null) {
                Spacer(modifier = Modifier.height(8.dp))

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = if (error != null) AllStarTerracotta else AllStarGoldSoft
                    ),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text(
                        text = error?.let { "Error: $it" } ?: mensaje.orEmpty(),
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                        color = if (error != null) AllStarWhite else AllStarBlue,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HeaderSelectorTextoCompacto(
    modifier: Modifier,
    label: String,
    value: String,
    options: List<String>,
    optionText: (String) -> String,
    onChange: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded },
        modifier = modifier
    ) {
        Card(
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
                .border(
                    width = 1.dp,
                    color = AllStarGold.copy(alpha = 0.55f),
                    shape = RoundedCornerShape(16.dp)
                ),
            colors = CardDefaults.cardColors(
                containerColor = AllStarInk
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 13.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = label.uppercase(),
                        color = AllStarGoldSoft,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(2.dp))

                    Text(
                        text = value,
                        color = AllStarBone,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Box(
                    modifier = Modifier
                        .background(
                            color = AllStarGold.copy(alpha = 0.18f),
                            shape = RoundedCornerShape(100.dp)
                        )
                        .padding(horizontal = 9.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Cambiar",
                        color = AllStarGoldSoft,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = optionText(option),
                            color = AllStarBlue
                        )
                    },
                    onClick = {
                        onChange(option)
                        expanded = false
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T> HeaderSelectorObjetoCompacto(
    modifier: Modifier,
    label: String,
    value: T?,
    options: List<T>,
    optionText: (T) -> String,
    valueText: String,
    onChange: (T) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    val textoVisible = value?.let { optionText(it) } ?: valueText

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded },
        modifier = modifier
    ) {
        Card(
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
                .border(
                    width = 1.dp,
                    color = AllStarGold.copy(alpha = 0.55f),
                    shape = RoundedCornerShape(16.dp)
                ),
            colors = CardDefaults.cardColors(
                containerColor = AllStarInk
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 13.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = label.uppercase(),
                        color = AllStarGoldSoft,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(2.dp))

                    Text(
                        text = textoVisible,
                        color = AllStarBone,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Box(
                    modifier = Modifier
                        .background(
                            color = AllStarGold.copy(alpha = 0.18f),
                            shape = RoundedCornerShape(100.dp)
                        )
                        .padding(horizontal = 9.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Cambiar",
                        color = AllStarGoldSoft,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = optionText(option),
                            color = AllStarBlue
                        )
                    },
                    onClick = {
                        onChange(option)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
fun selectorFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = AllStarBlue,
    unfocusedTextColor = AllStarBlue,
    disabledTextColor = AllStarBlue,
    focusedContainerColor = AllStarWhite,
    unfocusedContainerColor = AllStarWhite,
    disabledContainerColor = AllStarWhite,
    focusedLabelColor = AllStarGold,
    unfocusedLabelColor = AllStarMuted,
    disabledLabelColor = AllStarMuted,
    focusedBorderColor = AllStarGold,
    unfocusedBorderColor = AllStarBoneDark,
    disabledBorderColor = AllStarBoneDark,
    cursorColor = AllStarGold,
    focusedTrailingIconColor = AllStarBlue,
    unfocusedTrailingIconColor = AllStarBlue,
    disabledTrailingIconColor = AllStarBlue
)

@Composable
fun SectionHeader(
    title: String,
    subtitle: String,
    count: Int
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = AllStarBlue,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = AllStarMuted
            )
        }

        Box(
            modifier = Modifier
                .background(
                    color = AllStarBlue,
                    shape = RoundedCornerShape(100.dp)
                )
                .padding(horizontal = 12.dp, vertical = 5.dp)
        ) {
            Text(
                text = count.toString(),
                color = AllStarBone,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
fun PanelPendientes(
    modifier: Modifier,
    procesoId: Int,
    items: List<ItemDto>,
    empleados: List<EmpleadoDto>,
    onAsignar: (ItemDto, Int) -> Unit
) {
    val empleadosSeleccionados = remember {
        mutableStateMapOf<Int, Int>()
    }

    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = AllStarWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column(
            modifier = Modifier.padding(14.dp)
        ) {
            SectionHeader(
                title = "Órdenes pendientes",
                subtitle = "Proceso $procesoId · Por asignar",
                count = items.size
            )

            if (items.isEmpty()) {
                EmptyState("No hay órdenes pendientes para este proceso.")
            } else {
                val listState = rememberLazyListState()

                Box(modifier = Modifier.fillMaxSize()) {
                    LazyColumn(
                        state = listState,
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(end = 10.dp)
                    ) {
                        items(items) { item ->
                            val itemKey = item.item?.toInt()
                                ?: item.itemLegado?.toInt()
                                ?: 0

                            val empleadoId = empleadosSeleccionados[itemKey]

                            val empleadoSeleccionado = empleados.firstOrNull {
                                it.id?.toInt() == empleadoId
                            }

                            ItemPendienteCard(
                                item = item,
                                empleadoSeleccionado = empleadoSeleccionado,
                                empleados = empleados,
                                onEmpleadoChange = { nuevoEmpleado ->
                                    nuevoEmpleado.id?.toInt()?.let {
                                        empleadosSeleccionados[itemKey] = it
                                    }
                                },
                                onAsignar = {
                                    val empleadoFinal = empleadosSeleccionados[itemKey]

                                    if (empleadoFinal != null) {
                                        onAsignar(item, empleadoFinal)
                                    }
                                }
                            )
                        }
                    }

                    ScrollBarVertical(
                        listState = listState,
                        totalItems = items.size,
                        modifier = Modifier.align(Alignment.CenterEnd)
                    )
                }
            }
        }
    }
}

@Composable
fun EmptyState(text: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                color = AllStarBone,
                shape = RoundedCornerShape(18.dp)
            )
            .padding(18.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = AllStarMuted,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
fun ItemPendienteCard(
    item: ItemDto,
    empleadoSeleccionado: EmpleadoDto?,
    empleados: List<EmpleadoDto>,
    onEmpleadoChange: (EmpleadoDto) -> Unit,
    onAsignar: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = AllStarBone),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.border(
            width = 1.dp,
            color = AllStarBoneDark,
            shape = RoundedCornerShape(20.dp)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(13.dp)
        ) {
            val itemMostrado = item.item?.toInt()
                ?: item.itemLegado?.toInt()

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Item ${itemMostrado ?: "-"}",
                        color = AllStarBlue,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(3.dp))

                    Text(
                        text = "OC Cliente: ${item.ocCliente ?: "-"}",
                        color = AllStarAnthracite,
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                Box(
                    modifier = Modifier
                        .background(
                            color = AllStarGoldSoft,
                            shape = RoundedCornerShape(100.dp)
                        )
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Pendiente",
                        color = AllStarBlue,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Text("Cliente: ${item.clienteNombre ?: "-"}", color = AllStarAnthracite)
            Text("Detalle: ${item.detalle ?: "-"}", color = AllStarAnthracite)

            Spacer(modifier = Modifier.height(11.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                SelectorObjeto(
                    modifier = Modifier.weight(1f),
                    label = "Operario",
                    value = empleadoSeleccionado,
                    options = empleados,
                    optionText = { empleado ->
                        val id = empleado.id?.toInt() ?: 0
                        "${empleado.nombre ?: "Empleado"} ($id)"
                    },
                    onChange = onEmpleadoChange
                )

                Button(
                    onClick = onAsignar,
                    enabled = empleadoSeleccionado != null,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AllStarTerracotta,
                        contentColor = AllStarWhite,
                        disabledContainerColor = AllStarMuted.copy(alpha = 0.35f),
                        disabledContentColor = AllStarWhite
                    ),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text(
                        text = "Asignar",
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T> SelectorObjeto(
    modifier: Modifier,
    label: String,
    value: T?,
    options: List<T>,
    optionText: (T) -> String,
    onChange: (T) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    val texto = value?.let { optionText(it) } ?: ""

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded },
        modifier = modifier
    ) {
        OutlinedTextField(
            value = texto,
            onValueChange = {},
            readOnly = true,
            singleLine = true,
            label = { Text(label) },
            trailingIcon = {
                ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
            },
            colors = selectorFieldColors(),
            shape = RoundedCornerShape(15.dp),
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = optionText(option),
                            color = AllStarBlue
                        )
                    },
                    onClick = {
                        onChange(option)
                        expanded = false
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T> SelectorBuscableObjeto(
    modifier: Modifier,
    label: String,
    value: T?,
    options: List<T>,
    optionText: (T) -> String,
    onChange: (T) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    var textoBusqueda by remember { mutableStateOf("") }

    LaunchedEffect(value) {
        textoBusqueda = value?.let { optionText(it) } ?: ""
    }

    val opcionesFiltradas = remember(options, textoBusqueda) {
        if (textoBusqueda.isBlank()) {
            options.take(60)
        } else {
            options
                .filter { option ->
                    optionText(option).contains(textoBusqueda, ignoreCase = true)
                }
                .take(60)
        }
    }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded },
        modifier = modifier
    ) {
        OutlinedTextField(
            value = textoBusqueda,
            onValueChange = {
                textoBusqueda = it
                expanded = true
            },
            singleLine = true,
            label = { Text(label) },
            trailingIcon = {
                ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
            },
            colors = selectorFieldColors(),
            shape = RoundedCornerShape(15.dp),
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            if (opcionesFiltradas.isEmpty()) {
                DropdownMenuItem(
                    text = {
                        Text(
                            text = "Sin resultados",
                            color = AllStarMuted
                        )
                    },
                    onClick = {
                        expanded = false
                    }
                )
            } else {
                opcionesFiltradas.forEach { option ->
                    DropdownMenuItem(
                        text = {
                            Text(
                                text = optionText(option),
                                color = AllStarBlue
                            )
                        },
                        onClick = {
                            onChange(option)
                            textoBusqueda = optionText(option)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun PanelEnProceso(
    modifier: Modifier,
    procesoId: Int,
    ordenes: List<OrdenProcesoDto>,
    materiales: List<MaterialDto>,
    telas: List<TelaDto>,
    onRegistrarMaterial: (OrdenProcesoDto, Int, Double) -> Unit,
    onRegistrarTela: (OrdenProcesoDto, Int, Double) -> Unit,
    onFinalizar: (OrdenProcesoDto) -> Unit
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = AllStarWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column(
            modifier = Modifier.padding(14.dp)
        ) {
            SectionHeader(
                title = "Órdenes en proceso",
                subtitle = "Proceso $procesoId · En producción",
                count = ordenes.size
            )

            if (ordenes.isEmpty()) {
                EmptyState("No hay órdenes en proceso para este proceso.")
            } else {
                val listState = rememberLazyListState()

                Box(modifier = Modifier.fillMaxSize()) {
                    LazyColumn(
                        state = listState,
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(end = 10.dp)
                    ) {
                        items(ordenes) { orden ->
                            OrdenProcesoCard(
                                orden = orden,
                                materiales = materiales,
                                telas = telas,
                                onRegistrarMaterial = { materialId, cantidad ->
                                    onRegistrarMaterial(orden, materialId, cantidad)
                                },
                                onRegistrarTela = { telaId, cantidad ->
                                    onRegistrarTela(orden, telaId, cantidad)
                                },
                                onFinalizar = { onFinalizar(orden) }
                            )
                        }
                    }

                    ScrollBarVertical(
                        listState = listState,
                        totalItems = ordenes.size,
                        modifier = Modifier.align(Alignment.CenterEnd)
                    )
                }
            }
        }
    }
}

@Composable
fun OrdenProcesoCard(
    orden: OrdenProcesoDto,
    materiales: List<MaterialDto>,
    telas: List<TelaDto>,
    onRegistrarMaterial: (Int, Double) -> Unit,
    onRegistrarTela: (Int, Double) -> Unit,
    onFinalizar: () -> Unit
) {
    var tipoConsumo by remember { mutableStateOf(TipoConsumo.MATERIAL) }

    var cantidadMaterialTexto by remember { mutableStateOf("") }
    var materialSeleccionadoId by remember { mutableStateOf<Int?>(null) }

    var cantidadTelaTexto by remember { mutableStateOf("") }
    var telaSeleccionadaId by remember { mutableStateOf<Int?>(null) }

    val materialesAgregados = remember(orden.id) {
        mutableStateListOf<MaterialRegistradoUi>()
    }

    val telasAgregadas = remember(orden.id) {
        mutableStateListOf<MaterialRegistradoUi>()
    }

    val materialSeleccionado = materiales.firstOrNull {
        it.id?.toInt() == materialSeleccionadoId
    }

    val telaSeleccionada = telas.firstOrNull {
        it.id?.toInt() == telaSeleccionadaId
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = AllStarBone),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.border(
            width = 1.dp,
            color = AllStarBoneDark,
            shape = RoundedCornerShape(20.dp)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(13.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Item ${orden.item?.toInt() ?: "-"}",
                        color = AllStarBlue,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(3.dp))

                    Text(
                        text = "OC Cliente: ${orden.ocCliente ?: "-"}",
                        color = AllStarAnthracite,
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                Box(
                    modifier = Modifier
                        .background(
                            color = AllStarSuccess.copy(alpha = 0.18f),
                            shape = RoundedCornerShape(100.dp)
                        )
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Activo",
                        color = AllStarSuccess,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(7.dp))

            Text("Cliente: ${orden.clienteNombre ?: "-"}", color = AllStarAnthracite)
            Text("Detalle: ${orden.detalle ?: "-"}", color = AllStarAnthracite)
            Text("Empleado: ${orden.empleadoNombre ?: orden.empleado?.toInt()?.toString() ?: "-"}", color = AllStarAnthracite)
            Text("Inicio: ${orden.fechaInicio ?: "-"}", color = AllStarAnthracite)

            if (materialesAgregados.isNotEmpty()) {
                Spacer(modifier = Modifier.height(11.dp))

                Text(
                    text = "Materiales agregados",
                    color = AllStarBlue,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(5.dp))

                materialesAgregados.forEach { material ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                color = AllStarGoldSoft,
                                shape = RoundedCornerShape(14.dp)
                            )
                            .padding(horizontal = 10.dp, vertical = 7.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = material.nombre,
                            color = AllStarAnthracite,
                            modifier = Modifier.weight(1f)
                        )

                        Text(
                            text = "Cant. ${material.cantidad}",
                            color = AllStarBlue,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.height(5.dp))
                }
            }

            if (telasAgregadas.isNotEmpty()) {
                Spacer(modifier = Modifier.height(11.dp))

                Text(
                    text = "Telas agregadas",
                    color = AllStarBlue,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(5.dp))

                telasAgregadas.forEach { tela ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                color = AllStarGoldSoft,
                                shape = RoundedCornerShape(14.dp)
                            )
                            .padding(horizontal = 10.dp, vertical = 7.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = tela.nombre,
                            color = AllStarAnthracite,
                            modifier = Modifier.weight(1f)
                        )

                        Text(
                            text = "Cant. ${tela.cantidad}",
                            color = AllStarBlue,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.height(5.dp))
                }
            }

            Spacer(modifier = Modifier.height(13.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        color = AllStarWhite,
                        shape = RoundedCornerShape(16.dp)
                    )
                    .padding(5.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Button(
                    modifier = Modifier.weight(1f),
                    onClick = { tipoConsumo = TipoConsumo.MATERIAL },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (tipoConsumo == TipoConsumo.MATERIAL) AllStarBlue else AllStarWhite,
                        contentColor = if (tipoConsumo == TipoConsumo.MATERIAL) AllStarBone else AllStarBlue
                    ),
                    shape = RoundedCornerShape(13.dp),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
                ) {
                    Text(
                        text = "Material",
                        fontWeight = FontWeight.Bold
                    )
                }

                Button(
                    modifier = Modifier.weight(1f),
                    onClick = { tipoConsumo = TipoConsumo.TELA },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (tipoConsumo == TipoConsumo.TELA) AllStarBlue else AllStarWhite,
                        contentColor = if (tipoConsumo == TipoConsumo.TELA) AllStarBone else AllStarBlue
                    ),
                    shape = RoundedCornerShape(13.dp),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
                ) {
                    Text(
                        text = "Tela",
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(11.dp))

            if (tipoConsumo == TipoConsumo.MATERIAL) {
                SelectorBuscableObjeto(
                    modifier = Modifier.fillMaxWidth(),
                    label = "Buscar material",
                    value = materialSeleccionado,
                    options = materiales,
                    optionText = { material ->
                        listOfNotNull(
                            material.nombre,
                            material.referencia
                        ).joinToString(" - ")
                    },
                    onChange = { material ->
                        materialSeleccionadoId = material.id?.toInt()
                    }
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = cantidadMaterialTexto,
                    onValueChange = { cantidadMaterialTexto = it },
                    label = { Text("Cantidad material") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    colors = selectorFieldColors(),
                    shape = RoundedCornerShape(15.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(11.dp))

                Button(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        val material = materialSeleccionado
                        val materialId = materialSeleccionadoId
                        val cantidad = cantidadMaterialTexto.replace(",", ".").toDoubleOrNull()

                        if (material != null && materialId != null && cantidad != null && cantidad > 0) {
                            val nombreMaterial = listOfNotNull(
                                material.nombre,
                                material.referencia
                            ).joinToString(" - ")

                            materialesAgregados.add(
                                MaterialRegistradoUi(
                                    nombre = nombreMaterial,
                                    cantidad = cantidad
                                )
                            )

                            onRegistrarMaterial(materialId, cantidad)
                            cantidadMaterialTexto = ""
                        }
                    },
                    enabled = materialSeleccionadoId != null && cantidadMaterialTexto.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AllStarGold,
                        contentColor = AllStarBlue,
                        disabledContainerColor = AllStarMuted.copy(alpha = 0.25f),
                        disabledContentColor = AllStarWhite
                    ),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text(
                        text = "Agregar material",
                        fontWeight = FontWeight.Bold
                    )
                }
            } else {
                SelectorBuscableObjeto(
                    modifier = Modifier.fillMaxWidth(),
                    label = "Buscar tela",
                    value = telaSeleccionada,
                    options = telas,
                    optionText = { tela ->
                        tela.nombreReferencia
                            ?: listOfNotNull(tela.nombre, tela.referencia).joinToString(" - ")
                    },
                    onChange = { tela ->
                        telaSeleccionadaId = tela.id?.toInt()
                    }
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = cantidadTelaTexto,
                    onValueChange = { cantidadTelaTexto = it },
                    label = { Text("Cantidad tela") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    colors = selectorFieldColors(),
                    shape = RoundedCornerShape(15.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(11.dp))

                Button(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        val tela = telaSeleccionada
                        val telaId = telaSeleccionadaId
                        val cantidad = cantidadTelaTexto.replace(",", ".").toDoubleOrNull()

                        if (tela != null && telaId != null && cantidad != null && cantidad > 0) {
                            val nombreTela = tela.nombreReferencia
                                ?: listOfNotNull(tela.nombre, tela.referencia).joinToString(" - ")

                            telasAgregadas.add(
                                MaterialRegistradoUi(
                                    nombre = nombreTela,
                                    cantidad = cantidad
                                )
                            )

                            onRegistrarTela(telaId, cantidad)
                            cantidadTelaTexto = ""
                        }
                    },
                    enabled = telaSeleccionadaId != null && cantidadTelaTexto.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AllStarTerracotta,
                        contentColor = AllStarWhite,
                        disabledContainerColor = AllStarMuted.copy(alpha = 0.25f),
                        disabledContentColor = AllStarWhite
                    ),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text(
                        text = "Agregar tela",
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(11.dp))

            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = onFinalizar,
                colors = ButtonDefaults.buttonColors(
                    containerColor = AllStarBlue,
                    contentColor = AllStarBone
                ),
                shape = RoundedCornerShape(14.dp)
            ) {
                Text(
                    text = "Finalizar proceso",
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun ScrollBarVertical(
    listState: LazyListState,
    totalItems: Int,
    modifier: Modifier = Modifier
) {
    if (totalItems <= 3) return

    val density = LocalDensity.current

    BoxWithConstraints(
        modifier = modifier
            .fillMaxHeight()
            .width(6.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(AllStarBoneDark)
    ) {
        val containerHeightPx = with(density) { maxHeight.toPx() }
        val minThumbHeightPx = with(density) { 42.dp.toPx() }
        val thumbHeightPx = max(containerHeightPx * 0.22f, minThumbHeightPx)

        val maxIndex = max(totalItems - 1, 1)
        val progress = listState.firstVisibleItemIndex.toFloat() / maxIndex.toFloat()
        val offsetPx = (containerHeightPx - thumbHeightPx) * progress

        Box(
            modifier = Modifier
                .offset { IntOffset(0, offsetPx.toInt()) }
                .width(6.dp)
                .height(with(density) { thumbHeightPx.toDp() })
                .clip(RoundedCornerShape(20.dp))
                .background(AllStarGold)
        )
    }
}