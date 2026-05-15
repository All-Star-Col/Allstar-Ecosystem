package com.allstar.seguimientoproduccion

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Divider
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.allstar.seguimientoproduccion.data.api.ActualizarLlegadaHerrajeRequest
import com.allstar.seguimientoproduccion.data.api.ActualizarLlegadaPiezaRequest
import com.allstar.seguimientoproduccion.data.api.ActualizarProcesoRequest
import com.allstar.seguimientoproduccion.data.api.ActualizarTareaProcesoRequest
import com.allstar.seguimientoproduccion.data.api.AsignarResponsableMuebleRequest
import com.allstar.seguimientoproduccion.data.api.CompletarPiezasMuebleRequest
import com.allstar.seguimientoproduccion.data.api.ConsumoParcialRequest
import com.allstar.seguimientoproduccion.data.api.FinalizarProcesoRequest
import com.allstar.seguimientoproduccion.data.api.HerrajeInstalacionResponse
import com.allstar.seguimientoproduccion.data.api.LoteProcesoResponse
import com.allstar.seguimientoproduccion.data.api.LoteResponse
import com.allstar.seguimientoproduccion.data.api.MaquinaResponse
import com.allstar.seguimientoproduccion.data.api.MaterialConsumoDetalleResponse
import com.allstar.seguimientoproduccion.data.api.MuebleInstalacionResponse
import com.allstar.seguimientoproduccion.data.api.MuebleLoteResponse
import com.allstar.seguimientoproduccion.data.api.PiezaMuebleResponse
import com.allstar.seguimientoproduccion.data.api.PiezaResponse
import com.allstar.seguimientoproduccion.data.api.ProcesoResponse
import com.allstar.seguimientoproduccion.data.api.ProyectoResponse
import com.allstar.seguimientoproduccion.data.api.ResponsableResponse
import com.allstar.seguimientoproduccion.data.api.RetrofitClient
import com.allstar.seguimientoproduccion.data.api.TareaProcesoResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import retrofit2.Response
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter


// ============================================================
// TEMA CORPORATIVO ALL STAR
// ============================================================

val AzulAllStar = Color(0xFF122337)
val NegroAntracitaAllStar = Color(0xFF2F3339)
val BlancoHuesoAllStar = Color(0xFFF6F5F0)
val OroViejoAllStar = Color(0xFFB69559)
val TerracotaAllStar = Color(0xFFC7664C)

private val AllStarColorScheme = lightColorScheme(
    primary = AzulAllStar,
    onPrimary = BlancoHuesoAllStar,

    secondary = OroViejoAllStar,
    onSecondary = AzulAllStar,

    tertiary = TerracotaAllStar,
    onTertiary = BlancoHuesoAllStar,

    background = BlancoHuesoAllStar,
    onBackground = NegroAntracitaAllStar,

    surface = Color.White,
    onSurface = NegroAntracitaAllStar,

    surfaceVariant = Color(0xFFEAE7DE),
    onSurfaceVariant = NegroAntracitaAllStar,

    primaryContainer = AzulAllStar,
    onPrimaryContainer = BlancoHuesoAllStar,

    secondaryContainer = Color(0xFFE8DCC7),
    onSecondaryContainer = NegroAntracitaAllStar,

    tertiaryContainer = Color(0xFFF3D5CB),
    onTertiaryContainer = NegroAntracitaAllStar,

    error = TerracotaAllStar,
    onError = BlancoHuesoAllStar,

    errorContainer = Color(0xFFFFE2D8),
    onErrorContainer = NegroAntracitaAllStar
)

@Composable
fun AllStarTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = AllStarColorScheme,
        content = content
    )
}


// ============================================================
// BARRA SUPERIOR
// ============================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppTopBar(titulo: String) {
    TopAppBar(
        title = {
            Text(
                text = titulo,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimary
            )
        },
        colors = androidx.compose.material3.TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.primary,
            titleContentColor = MaterialTheme.colorScheme.onPrimary
        )
    )
}


// ============================================================
// SELECTOR DE SECCIÓN
// ============================================================

@Composable
fun SeccionSelector(
    secciones: List<SeccionProduccion>,
    selected: SeccionProduccion,
    onSelected: (SeccionProduccion) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        secciones.forEach { seccion ->
            val isSelected = seccion.key == selected.key

            Button(
                onClick = { onSelected(seccion) },
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 8.dp),
                colors = if (isSelected) {
                    ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.primary
                    )
                }
            ) {
                Text(
                    text = seccion.titulo,
                    style = MaterialTheme.typography.labelMedium
                )
            }
        }
    }
}


// ============================================================
// CARD CONTROL GENERAL DEL PROCESO
// ============================================================

@Composable
fun ControlProcesoGeneralCard(
    loteProceso: LoteProcesoResponse,
    responsables: List<ResponsableResponse>,
    maquinas: List<MaquinaResponse>,
    scope: CoroutineScope,
    onMensaje: (String) -> Unit,
    onError: (String) -> Unit,
    onReload: suspend () -> Unit
) {
    var responsableId by remember(loteProceso.lote_proceso_id, loteProceso.responsable_id) {
        mutableStateOf(loteProceso.responsable_id)
    }

    var maquinaId by remember(loteProceso.lote_proceso_id, loteProceso.maquina_id) {
        mutableStateOf(loteProceso.maquina_id)
    }

    var estado by remember(loteProceso.lote_proceso_id, loteProceso.estado) {
        mutableStateOf(loteProceso.estado ?: "pendiente")
    }

    var notas by remember(loteProceso.lote_proceso_id, loteProceso.notas) {
        mutableStateOf(loteProceso.notas ?: "")
    }

    var motivosBloqueo by remember(loteProceso.lote_proceso_id, loteProceso.motivos_bloqueo) {
        mutableStateOf(loteProceso.motivos_bloqueo ?: "")
    }

    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.elevatedCardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "Control general del proceso",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            InfoLine("Estado actual", loteProceso.estado ?: "Sin estado")
            InfoLine("Inicio real", loteProceso.fecha_inicio_real ?: "Sin iniciar")
            InfoLine("Fin real", loteProceso.fecha_fin_real ?: "Sin finalizar")

            DropdownResponsable(
                label = "Encargado principal",
                responsables = responsables,
                selectedId = responsableId,
                onSelected = { responsableId = it }
            )

            DropdownMaquina(
                label = "Máquina / estación",
                maquinas = maquinas,
                selectedId = maquinaId,
                onSelected = { maquinaId = it }
            )

            DropdownString(
                label = "Estado",
                values = listOf("pendiente", "en_proceso", "completado", "bloqueado", "omitido"),
                selected = estado,
                onSelected = { estado = it }
            )

            OutlinedTextField(
                value = motivosBloqueo,
                onValueChange = { motivosBloqueo = it },
                label = { Text("Motivo de bloqueo") },
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = notas,
                onValueChange = { notas = it },
                label = { Text("Notas") },
                modifier = Modifier.fillMaxWidth()
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = {
                        if (responsableId == null) {
                            onError("Debe seleccionar un responsable principal.")
                            return@Button
                        }

                        scope.launch {
                            try {
                                val response = RetrofitClient.api.actualizarProceso(
                                    ActualizarProcesoRequest(
                                        lote_proceso_id = loteProceso.lote_proceso_id,
                                        responsable_id = responsableId,
                                        maquina_id = maquinaId,
                                        estado = "en_proceso",
                                        fecha_inicio_real = loteProceso.fecha_inicio_real ?: nowText(),
                                        motivos_bloqueo = motivosBloqueo.ifBlank { null },
                                        notas = notas.ifBlank { null }
                                    )
                                )

                                if (response.isSuccessful) {
                                    onMensaje(response.body()?.mensaje ?: "Proceso iniciado.")
                                    onReload()
                                } else {
                                    onError("Error al iniciar proceso: ${response.errorText()}")
                                }
                            } catch (e: Exception) {
                                onError("Error al iniciar proceso: ${e.message}")
                            }
                        }
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Iniciar")
                }

                OutlinedButton(
                    onClick = {
                        scope.launch {
                            try {
                                val response = RetrofitClient.api.actualizarProceso(
                                    ActualizarProcesoRequest(
                                        lote_proceso_id = loteProceso.lote_proceso_id,
                                        responsable_id = responsableId,
                                        maquina_id = maquinaId,
                                        estado = estado,
                                        fecha_inicio_real = loteProceso.fecha_inicio_real,
                                        motivos_bloqueo = motivosBloqueo.ifBlank { null },
                                        notas = notas.ifBlank { null }
                                    )
                                )

                                if (response.isSuccessful) {
                                    onMensaje(response.body()?.mensaje ?: "Proceso guardado.")
                                    onReload()
                                } else {
                                    onError("Error al guardar proceso: ${response.errorText()}")
                                }
                            } catch (e: Exception) {
                                onError("Error al guardar proceso: ${e.message}")
                            }
                        }
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Guardar")
                }
            }

            Button(
                onClick = {
                    val responsable = responsableId

                    if (responsable == null) {
                        onError("Debe seleccionar un responsable principal.")
                        return@Button
                    }

                    scope.launch {
                        try {
                            val response = RetrofitClient.api.finalizarProceso(
                                FinalizarProcesoRequest(
                                    lote_proceso_id = loteProceso.lote_proceso_id,
                                    responsable_id = responsable,
                                    maquina_id = maquinaId,
                                    estado = "completado",
                                    fecha_fin_real = nowText(),
                                    motivos_bloqueo = motivosBloqueo.ifBlank { null },
                                    notas = notas.ifBlank { null }
                                )
                            )

                            if (response.isSuccessful) {
                                onMensaje(response.body()?.mensaje ?: "Proceso finalizado.")
                                onReload()
                            } else {
                                onError("Error al finalizar proceso: ${response.errorText()}")
                            }
                        } catch (e: Exception) {
                            onError("Error al finalizar proceso: ${e.message}")
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = TerracotaAllStar,
                    contentColor = BlancoHuesoAllStar
                )
            ) {
                Text("Finalizar proceso")
            }
        }
    }
}


// ============================================================
// CARD TAREA DE PROCESO
// ============================================================

@Composable
fun TareaProcesoCard(
    tarea: TareaProcesoResponse,
    responsables: List<ResponsableResponse>,
    maquinas: List<MaquinaResponse>,
    scope: CoroutineScope,
    onMensaje: (String) -> Unit,
    onError: (String) -> Unit,
    onReload: suspend () -> Unit
) {
    var responsableId by remember(tarea.id, tarea.responsable_id) {
        mutableStateOf(tarea.responsable_id)
    }

    var maquinaId by remember(tarea.id, tarea.maquina_id) {
        mutableStateOf(tarea.maquina_id)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = tarea.item_label ?: tarea.item_nombre ?: tarea.grupo_pieza ?: "Tarea general",
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            InfoLine("Apartamento", tarea.item_apartamento ?: "-")
            InfoLine("Tipo", tarea.tipo_tarea ?: "-")
            InfoLine("Estado", tarea.estado ?: "-")

            DropdownResponsable(
                label = "Responsable",
                responsables = responsables,
                selectedId = responsableId,
                onSelected = { responsableId = it }
            )

            DropdownMaquina(
                label = "Máquina",
                maquinas = maquinas,
                selectedId = maquinaId,
                onSelected = { maquinaId = it }
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                val response = RetrofitClient.api.actualizarTareaProceso(
                                    ActualizarTareaProcesoRequest(
                                        tarea_id = tarea.id,
                                        responsable_id = responsableId,
                                        maquina_id = maquinaId,
                                        estado = "en_proceso",
                                        fecha_inicio_real = tarea.fecha_inicio_real ?: nowText()
                                    )
                                )

                                if (response.isSuccessful) {
                                    onMensaje(response.body()?.mensaje ?: "Tarea iniciada.")
                                    onReload()
                                } else {
                                    onError("Error al iniciar tarea: ${response.errorText()}")
                                }
                            } catch (e: Exception) {
                                onError("Error al iniciar tarea: ${e.message}")
                            }
                        }
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Iniciar")
                }

                Button(
                    onClick = {
                        scope.launch {
                            try {
                                val response = RetrofitClient.api.actualizarTareaProceso(
                                    ActualizarTareaProcesoRequest(
                                        tarea_id = tarea.id,
                                        responsable_id = responsableId,
                                        maquina_id = maquinaId,
                                        estado = "completado",
                                        fecha_inicio_real = tarea.fecha_inicio_real ?: nowText(),
                                        fecha_fin_real = nowText()
                                    )
                                )

                                if (response.isSuccessful) {
                                    onMensaje(response.body()?.mensaje ?: "Tarea finalizada.")
                                    onReload()
                                } else {
                                    onError("Error al finalizar tarea: ${response.errorText()}")
                                }
                            } catch (e: Exception) {
                                onError("Error al finalizar tarea: ${e.message}")
                            }
                        }
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = TerracotaAllStar,
                        contentColor = BlancoHuesoAllStar
                    )
                ) {
                    Text("Finalizar")
                }
            }
        }
    }
}


// ============================================================
// CARD MATERIAL CONSUMO
// ============================================================

@Composable
fun MaterialConsumoCard(
    material: MaterialConsumoDetalleResponse,
    loteProcesoId: Int,
    scope: CoroutineScope,
    onMensaje: (String) -> Unit,
    onError: (String) -> Unit,
    onReload: suspend () -> Unit
) {
    var cantidadTexto by remember(material.material_id) { mutableStateOf("") }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = material.material_nombre ?: "Material ${material.material_id}",
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            InfoLine("Categoría", material.categoria ?: "-")
            InfoLine("Programado", "${material.cantidad_programada ?: 0.0} ${material.unidad_medida ?: ""}")
            InfoLine("Disponible", "${material.cantidad_disponible ?: 0.0} ${material.unidad_medida ?: ""}")

            if (material.muebles.isNotEmpty()) {
                Text(
                    text = "Muebles asociados: ${material.muebles.size}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            material.advertencia_catalogo?.let {
                MensajeError(it)
            }

            OutlinedTextField(
                value = cantidadTexto,
                onValueChange = { cantidadTexto = it },
                label = { Text("Consumo parcial") },
                modifier = Modifier.fillMaxWidth()
            )

            Button(
                onClick = {
                    val cantidad = cantidadTexto.replace(",", ".").toDoubleOrNull()

                    if (cantidad == null || cantidad <= 0) {
                        onError("Ingrese una cantidad válida.")
                        return@Button
                    }

                    scope.launch {
                        try {
                            val response = RetrofitClient.api.registrarConsumoParcial(
                                ConsumoParcialRequest(
                                    lote_proceso_id = loteProcesoId,
                                    material_id = material.material_id,
                                    cantidad_real = cantidad,
                                    notas = "Consumo registrado desde tablet"
                                )
                            )

                            if (response.isSuccessful) {
                                onMensaje(response.body()?.mensaje ?: "Consumo registrado.")
                                cantidadTexto = ""
                                onReload()
                            } else {
                                onError("Error al registrar consumo: ${response.errorText()}")
                            }
                        } catch (e: Exception) {
                            onError("Error al registrar consumo: ${e.message}")
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = OroViejoAllStar,
                    contentColor = AzulAllStar
                )
            ) {
                Text("Registrar consumo")
            }
        }
    }
}


// ============================================================
// CARD MUEBLE INSTALACIÓN
// ============================================================

@Composable
fun InstalacionMuebleCard(
    mueble: MuebleInstalacionResponse,
    loteId: Int,
    loteProcesoId: Int,
    responsables: List<ResponsableResponse>,
    scope: CoroutineScope,
    onMensaje: (String) -> Unit,
    onError: (String) -> Unit,
    onReload: suspend () -> Unit,
    onPiezaLocalUpdated: (piezaId: Int, llegada: Boolean) -> Unit,
    onMuebleLocalCompletado: (itemId: Int) -> Unit
) {
    var responsableSeleccionado by remember(mueble.item_id, mueble.responsable_id) {
        mutableStateOf(mueble.responsable_id)
    }

    var mostrarChecklist by remember(mueble.item_id) {
        mutableStateOf(false)
    }

    val piezas = mueble.piezas
    val herrajes = mueble.herrajes

    val totalPiezas = mueble.piezas_total ?: piezas.size
    val piezasLlegadas = mueble.piezas_recibidas ?: piezas.count { it.llegada }
    val piezasPendientes = piezas.any { !it.llegada }
    val muebleCompleto = totalPiezas > 0 && piezasLlegadas == totalPiezas
    val totalHerrajes = mueble.herrajes_total ?: herrajes.size
    val herrajesLlegados = herrajes.count { it.llegada == true }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        shape = RoundedCornerShape(18.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = mueble.label ?: mueble.item_nombre ?: "Mueble sin nombre",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            Text(
                text = "Apartamento: ${mueble.apartamento ?: "Sin apartamento"}",
                style = MaterialTheme.typography.bodySmall
            )

            Text(
                text = "Piezas recibidas: $piezasLlegadas / $totalPiezas",
                style = MaterialTheme.typography.bodyMedium
            )

            Text(
                text = "Herrajes recibidos: $herrajesLlegados / $totalHerrajes",
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.SemiBold,
                color = TerracotaAllStar
            )

            if (muebleCompleto) {
                AssistChip(
                    onClick = {},
                    label = { Text("Mueble completo") }
                )
            }

            DropdownResponsable(
                label = "Responsable del mueble",
                responsables = responsables,
                selectedId = responsableSeleccionado,
                onSelected = { responsableSeleccionado = it }
            )

            Button(
                onClick = {
                    val responsableId = responsableSeleccionado

                    if (responsableId == null) {
                        onError("Debe seleccionar un responsable para el mueble.")
                        return@Button
                    }

                    scope.launch {
                        try {
                            val response = RetrofitClient.api.asignarResponsableMueble(
                                AsignarResponsableMuebleRequest(
                                    lote_proceso_id = loteProcesoId,
                                    item_id = mueble.item_id,
                                    responsable_id = responsableId,
                                    notas = "Responsable asignado desde instalación."
                                )
                            )

                            if (response.isSuccessful) {
                                onMensaje(response.body()?.mensaje ?: "Responsable asignado correctamente.")
                            } else {
                                onError("Error al asignar responsable: ${response.errorText()}")
                            }
                        } catch (e: Exception) {
                            onError("Error al asignar responsable: ${e.message}")
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Guardar responsable")
            }

            if (piezas.isEmpty() && herrajes.isEmpty()) {
                Text(
                    text = "Este mueble todavía no tiene piezas ni herrajes registrados.",
                    style = MaterialTheme.typography.bodyMedium
                )
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { mostrarChecklist = !mostrarChecklist },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(if (mostrarChecklist) "Ocultar checklist" else "Ver checklist")
                    }

                    if (piezasPendientes) {
                        Button(
                            onClick = {
                                scope.launch {
                                    try {
                                        val response = RetrofitClient.api.completarPiezasMueble(
                                            CompletarPiezasMuebleRequest(
                                                lote_id = loteId,
                                                items_proyecto_id = mueble.item_id
                                            )
                                        )

                                        if (response.isSuccessful) {
                                            onMuebleLocalCompletado(mueble.item_id)
                                            onMensaje(
                                                response.body()?.mensaje
                                                    ?: "Mueble marcado como completo."
                                            )
                                        } else {
                                            onError("Error al completar mueble: ${response.errorText()}")
                                        }
                                    } catch (e: Exception) {
                                        onError("Error al completar mueble: ${e.message}")
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = TerracotaAllStar,
                                contentColor = BlancoHuesoAllStar
                            )
                        ) {
                            Text("Completar piezas")
                        }
                    }
                }

                if (mostrarChecklist) {
                    Divider()

                    Text(
                        text = "Piezas",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )

                    if (piezas.isEmpty()) {
                        MensajeInfo("Sin piezas registradas.")
                    } else {
                        piezas.forEach { pieza ->
                            PiezaLlegadaRow(
                                pieza = pieza,
                                scope = scope,
                                onMensaje = onMensaje,
                                onError = onError,
                                onReload = onReload,
                                onPiezaLocalUpdated = onPiezaLocalUpdated
                            )
                        }
                    }

                    Divider()

                    Text(
                        text = "Herrajes",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = TerracotaAllStar
                    )

                    if (herrajes.isEmpty()) {
                        MensajeInfo("Sin herrajes registrados en BOM para este mueble.")
                    } else {
                        herrajes.forEach { herraje ->
                            HerrajeInstalacionRow(
                                herraje = herraje,
                                loteProcesoId = loteProcesoId,
                                itemId = mueble.item_id,
                                scope = scope,
                                onMensaje = onMensaje,
                                onError = onError,
                                onReload = onReload
                            )
                        }
                    }
                }
            }
        }
    }
}


// ============================================================
// ROW HERRAJE EN INSTALACIÓN
// ============================================================

@Composable
fun HerrajeInstalacionRow(
    herraje: HerrajeInstalacionResponse,
    loteProcesoId: Int,
    itemId: Int,
    scope: CoroutineScope,
    onMensaje: (String) -> Unit,
    onError: (String) -> Unit,
    onReload: suspend () -> Unit
) {
    var llegadaLocal by remember(herraje.id, herraje.llegada) {
        mutableStateOf(herraje.llegada == true)
    }

    val nombre = herraje.herraje_nombre
        ?: herraje.pieza
        ?: "Herraje sin nombre"

    val cantidad = herraje.cantidad
        ?: herraje.cantidad_requerida

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalAlignment = Alignment.Top
        ) {
            Checkbox(
                checked = llegadaLocal,
                enabled = herraje.editable_llegada != false && herraje.material_id != null,
                onCheckedChange = { checked ->
                    val materialId = herraje.material_id

                    if (materialId == null) {
                        onError("El herraje no tiene material_id y no se puede actualizar.")
                    } else {
                        llegadaLocal = checked

                        scope.launch {
                            try {
                                val response = RetrofitClient.api.actualizarLlegadaHerraje(
                                    ActualizarLlegadaHerrajeRequest(
                                        lote_proceso_id = loteProcesoId,
                                        item_id = itemId,
                                        material_id = materialId,
                                        llegada = checked,
                                        notas = "Actualizado desde instalación Android"
                                    )
                                )

                                if (response.isSuccessful) {
                                    onMensaje(
                                        response.body()?.mensaje
                                            ?: "Llegada de herraje actualizada."
                                    )
                                    onReload()
                                } else {
                                    llegadaLocal = !checked
                                    onError("Error al actualizar herraje: ${response.errorText()}")
                                }
                            } catch (e: Exception) {
                                llegadaLocal = !checked
                                onError("Error al actualizar herraje: ${e.message}")
                            }
                        }
                    }
                }
            )

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                Text(
                    text = nombre,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = TerracotaAllStar
                )

                if (cantidad != null) {
                    Text(
                        text = "Cantidad requerida: $cantidad ${herraje.unidad_medida ?: ""}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                }

                if (!herraje.categoria.isNullOrBlank()) {
                    Text(
                        text = "Categoría: ${herraje.categoria}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                }

                if (!herraje.fecha_llegada.isNullOrBlank()) {
                    Text(
                        text = "Fecha llegada: ${herraje.fecha_llegada}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                }

                if (!herraje.notas.isNullOrBlank()) {
                    Text(
                        text = herraje.notas,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                }

                Text(
                    text = if (llegadaLocal) {
                        "Herraje recibido"
                    } else {
                        "Herraje pendiente según BOM"
                    },
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                    color = AzulAllStar
                )
            }
        }
    }
}


// ============================================================
// ROW PIEZA EN INSTALACIÓN
// ============================================================

@Composable
fun PiezaLlegadaRow(
    pieza: PiezaMuebleResponse,
    scope: CoroutineScope,
    onMensaje: (String) -> Unit,
    onError: (String) -> Unit,
    onReload: suspend () -> Unit,
    onPiezaLocalUpdated: (piezaId: Int, llegada: Boolean) -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            verticalAlignment = Alignment.Top
        ) {
            Checkbox(
                checked = pieza.llegada,
                onCheckedChange = { checked ->
                    onPiezaLocalUpdated(pieza.id, checked)

                    scope.launch {
                        try {
                            val response = RetrofitClient.api.actualizarLlegadaPieza(
                                ActualizarLlegadaPiezaRequest(
                                    piezas_mueble_id = pieza.id,
                                    llegada = checked
                                )
                            )

                            if (response.isSuccessful) {
                                onMensaje(response.body()?.mensaje ?: "Llegada actualizada.")
                            } else {
                                onPiezaLocalUpdated(pieza.id, !checked)
                                onError("Error al actualizar pieza: ${response.errorText()}")
                            }
                        } catch (e: Exception) {
                            onPiezaLocalUpdated(pieza.id, !checked)
                            onError("Error al actualizar pieza: ${e.message}")
                        }
                    }
                }
            )

            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = pieza.pieza,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Text(
                    text = "Cantidad: ${pieza.cantidad}",
                    style = MaterialTheme.typography.bodySmall
                )

                val medidas = listOfNotNull(
                    pieza.largo_mm?.let { "L: ${formatMedida(it)} mm" },
                    pieza.ancho_mm?.let { "A: ${formatMedida(it)} mm" },
                    pieza.espesor_mm?.let { "E: ${formatMedida(it)} mm" }
                ).joinToString(" | ")

                if (medidas.isNotBlank()) {
                    Text(
                        text = medidas,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                if (!pieza.material.isNullOrBlank()) {
                    Text(
                        text = "Material: ${pieza.material}",
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                if (!pieza.descripcion_original.isNullOrBlank()) {
                    Text(
                        text = "Descripción: ${pieza.descripcion_original}",
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                if (!pieza.encabezado_mueble.isNullOrBlank()) {
                    Text(
                        text = "Mueble origen: ${pieza.encabezado_mueble}",
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                if (!pieza.match_observacion.isNullOrBlank()) {
                    Text(
                        text = "Obs: ${pieza.match_observacion}",
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                if (!pieza.notas.isNullOrBlank()) {
                    Text(
                        text = "Notas: ${pieza.notas}",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}


// ============================================================
// PIEZAS REGISTRADAS EN DESPACHO
// ============================================================

@Composable
fun PiezasRegistradasCard(piezas: List<PiezaMuebleResponse>) {
    val primera = piezas.firstOrNull()

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = primera?.item_label ?: primera?.item_nombre ?: "Mueble",
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            piezas.forEach { pieza ->
                val medidas = listOfNotNull(
                    pieza.largo_mm?.let { "L:${formatMedida(it)}" },
                    pieza.ancho_mm?.let { "A:${formatMedida(it)}" },
                    pieza.espesor_mm?.let { "E:${formatMedida(it)}" }
                ).joinToString(" / ")

                Text(
                    text = "• ${pieza.pieza} - Cant: ${pieza.cantidad}" +
                            if (medidas.isNotBlank()) " - $medidas mm" else "" +
                                    if (!pieza.material.isNullOrBlank()) " - ${pieza.material}" else "",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}


// ============================================================
// RESUMEN E INFORMACIÓN
// ============================================================

@Composable
fun ResumenSeleccion(
    seccion: SeccionProduccion?,
    proceso: ProcesoResponse?,
    proyecto: ProyectoResponse?,
    lote: LoteResponse?
) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.elevatedCardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = "Resumen",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            InfoLine("Sección", seccion?.descripcion ?: "-")
            InfoLine("Proceso", proceso?.nombre ?: "-")
            InfoLine("Proyecto", proyecto?.nombre ?: "-")
            InfoLine("Cliente", proyecto?.cliente ?: "-")
            InfoLine("Lote", lote?.nombre ?: lote?.descripcion ?: "-")
        }
    }
}


@Composable
fun InfoLine(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = "$label:",
            fontWeight = FontWeight.SemiBold,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface
        )

        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}


@Composable
fun MensajeInfo(texto: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Text(
            text = texto,
            modifier = Modifier.padding(12.dp),
            color = MaterialTheme.colorScheme.onSecondaryContainer,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}


@Composable
fun MensajeError(texto: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer
        )
    ) {
        Text(
            text = texto,
            modifier = Modifier.padding(12.dp),
            color = MaterialTheme.colorScheme.onErrorContainer,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}


@Composable
fun BotonVolver(onVolver: () -> Unit) {
    TextButton(onClick = onVolver) {
        Text(
            text = "← Volver",
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.SemiBold
        )
    }
}


// ============================================================
// DROPDOWNS
// ============================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownProceso(
    label: String,
    procesos: List<ProcesoResponse>,
    selected: ProcesoResponse?,
    onSelected: (ProcesoResponse) -> Unit
) {
    DropdownBase(
        label = label,
        value = selected?.nombre ?: "",
        items = procesos,
        itemLabel = { it.nombre },
        onSelected = onSelected
    )
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownProyecto(
    label: String,
    proyectos: List<ProyectoResponse>,
    selected: ProyectoResponse?,
    onSelected: (ProyectoResponse) -> Unit
) {
    DropdownBase(
        label = label,
        value = selected?.nombre ?: "",
        items = proyectos,
        itemLabel = { "${it.nombre}${it.cliente?.let { c -> " - $c" } ?: ""}" },
        onSelected = onSelected
    )
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownLote(
    label: String,
    lotes: List<LoteResponse>,
    selected: LoteResponse?,
    onSelected: (LoteResponse) -> Unit
) {
    DropdownBase(
        label = label,
        value = selected?.nombre ?: selected?.descripcion ?: "",
        items = lotes,
        itemLabel = { it.nombre ?: it.descripcion ?: "Lote ${it.lote_id}" },
        onSelected = onSelected
    )
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownMuebleLote(
    label: String,
    muebles: List<MuebleLoteResponse>,
    selected: MuebleLoteResponse?,
    onSelected: (MuebleLoteResponse) -> Unit
) {
    DropdownBase(
        label = label,
        value = selected?.label ?: selected?.nombre ?: "",
        items = muebles,
        itemLabel = {
            listOfNotNull(
                it.apartamento,
                it.label ?: it.nombre ?: "Mueble ${it.id}"
            ).joinToString(" - ")
        },
        onSelected = onSelected
    )
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownPieza(
    label: String,
    piezas: List<PiezaResponse>,
    selected: PiezaResponse?,
    onSelected: (PiezaResponse) -> Unit
) {
    DropdownBase(
        label = label,
        value = selected?.pieza ?: "",
        items = piezas,
        itemLabel = { it.pieza },
        onSelected = onSelected
    )
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownResponsable(
    label: String,
    responsables: List<ResponsableResponse>,
    selectedId: Int?,
    onSelected: (Int) -> Unit
) {
    val selected = responsables.firstOrNull { it.id == selectedId }

    DropdownBase(
        label = label,
        value = selected?.nombre ?: "",
        items = responsables,
        itemLabel = { it.nombre },
        onSelected = { onSelected(it.id) }
    )
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownMaquina(
    label: String,
    maquinas: List<MaquinaResponse>,
    selectedId: Int?,
    onSelected: (Int?) -> Unit
) {
    val items: List<MaquinaResponse?> = listOf(null) + maquinas
    val selected = maquinas.firstOrNull { it.id == selectedId }

    DropdownBase(
        label = label,
        value = selected?.nombre ?: "Sin máquina",
        items = items,
        itemLabel = { it?.nombre ?: "Sin máquina" },
        onSelected = { onSelected(it?.id) }
    )
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownString(
    label: String,
    values: List<String>,
    selected: String,
    onSelected: (String) -> Unit
) {
    DropdownBase(
        label = label,
        value = selected,
        items = values,
        itemLabel = { it },
        onSelected = onSelected
    )
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T> DropdownBase(
    label: String,
    value: String,
    items: List<T>,
    itemLabel: (T) -> String,
    onSelected: (T) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    var textoBusqueda by remember(value, items.size) { mutableStateOf(value) }

    fun normalizar(valor: String): String {
        return valor
            .lowercase()
            .replace("á", "a")
            .replace("é", "e")
            .replace("í", "i")
            .replace("ó", "o")
            .replace("ú", "u")
            .replace("ñ", "n")
            .trim()
    }

    val itemsFiltrados = if (textoBusqueda.isBlank() || textoBusqueda == value) {
        items
    } else {
        val filtro = normalizar(textoBusqueda)

        items.filter { item ->
            normalizar(itemLabel(item)).contains(filtro)
        }
    }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = {
            expanded = !expanded

            if (expanded && textoBusqueda == value) {
                textoBusqueda = ""
            }
        },
        modifier = Modifier.fillMaxWidth()
    ) {
        OutlinedTextField(
            value = textoBusqueda,
            onValueChange = { nuevoTexto ->
                textoBusqueda = nuevoTexto
                expanded = true
            },
            readOnly = false,
            label = { Text(label) },
            placeholder = { Text("Escriba para filtrar...") },
            trailingIcon = {
                ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
            },
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = {
                expanded = false

                if (textoBusqueda.isBlank()) {
                    textoBusqueda = value
                }
            }
        ) {
            if (itemsFiltrados.isEmpty()) {
                DropdownMenuItem(
                    text = { Text("Sin resultados") },
                    onClick = {}
                )
            } else {
                itemsFiltrados.forEach { item ->
                    val labelItem = itemLabel(item)

                    DropdownMenuItem(
                        text = { Text(labelItem) },
                        onClick = {
                            onSelected(item)
                            textoBusqueda = labelItem
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}


// ============================================================
// HELPERS
// ============================================================

fun nowText(): String {
    return LocalDateTime.now().format(
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
    )
}


fun <T> Response<T>.errorText(): String {
    return try {
        this.errorBody()?.string() ?: "Error desconocido"
    } catch (e: Exception) {
        e.message ?: "Error desconocido"
    }
}


fun formatMedida(valor: Double): String {
    return if (valor % 1.0 == 0.0) {
        valor.toInt().toString()
    } else {
        "%.1f".format(valor)
    }
}