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
import com.allstar.seguimientoproduccion.data.api.ConsumoSinLoteRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import retrofit2.Response
import com.allstar.seguimientoproduccion.data.api.ConsumoCantoRequest
import com.allstar.seguimientoproduccion.data.api.InventarioCantoResponse
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedButton
import com.allstar.seguimientoproduccion.data.api.InventarioResponse
import android.graphics.Bitmap
import android.graphics.Canvas as AndroidCanvas
import android.graphics.Paint
import android.graphics.Path
import android.util.Base64
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.height
import androidx.compose.material3.AlertDialog
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.Path as ComposePath
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.sp
import com.allstar.seguimientoproduccion.data.api.FirmaInstalacionMuebleRequest
import java.io.ByteArrayOutputStream
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.graphics.asImageBitmap
import com.allstar.seguimientoproduccion.data.api.FirmaInstalacionMuebleData
import com.allstar.seguimientoproduccion.data.api.CompletarPiezasApartamentoRequest
import com.allstar.seguimientoproduccion.data.api.FirmaInstalacionApartamentoRequest
import com.allstar.seguimientoproduccion.data.api.FirmaInstalacionApartamentoData
import android.content.ContentValues
import android.content.Context
import android.graphics.pdf.PdfDocument
import android.os.Environment
import android.provider.MediaStore
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.ui.platform.LocalContext
import android.os.Build
import java.io.File
import java.io.FileOutputStream
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import com.allstar.seguimientoproduccion.data.api.ActaEntregaClienteResponse
import com.allstar.seguimientoproduccion.data.api.ActaEntregaClienteData
import com.allstar.seguimientoproduccion.data.api.ActualizarComentarioActaClienteRequest
import kotlin.math.max

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

@Composable
fun ConsumoCantosEnchapeCard(
    cantos: List<InventarioCantoResponse>,
    loteProcesoId: Int,
    scope: CoroutineScope,
    onMensaje: (String) -> Unit,
    onError: (String) -> Unit,
    onReload: suspend () -> Unit
) {
    var cantoSeleccionado by remember(cantos) {
        mutableStateOf(cantos.firstOrNull())
    }

    var cantidadTexto by remember(cantoSeleccionado?.inventario_id) {
        mutableStateOf("")
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
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "Registrar consumo real de canto",
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            Text(
                text = "Seleccione el canto usado desde inventario y registre la cantidad consumida en unidades.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (cantos.isEmpty()) {
                MensajeInfo("No hay cantos disponibles en inventario.")
            } else {
                DropdownBase(
                    label = "Canto / ubicación",
                    value = cantoSeleccionado?.let { canto ->
                        "${canto.material_nombre ?: "Material ${canto.material_id}"} | ${canto.ubicacion ?: "SIN UBICACION"}"
                    } ?: "",
                    items = cantos,
                    itemLabel = { canto ->
                        "${canto.material_nombre ?: "Material ${canto.material_id}"} | ${canto.ubicacion ?: "SIN UBICACION"} | Disponible: ${formatMedida(canto.cantidad_disponible ?: 0.0)} und"
                    },
                    onSelected = { seleccionado ->
                        cantoSeleccionado = seleccionado
                        cantidadTexto = ""
                    }
                )

                val canto = cantoSeleccionado

                if (canto != null) {
                    InfoLine(
                        label = "Material",
                        value = canto.material_nombre ?: "Material ${canto.material_id}"
                    )

                    InfoLine(
                        label = "Ubicación",
                        value = canto.ubicacion ?: "SIN UBICACION"
                    )

                    InfoLine(
                        label = "Disponible",
                        value = "${formatMedida(canto.cantidad_disponible ?: 0.0)} unidades"
                    )

                    OutlinedTextField(
                        value = cantidadTexto,
                        onValueChange = { cantidadTexto = it },
                        label = { Text("Cantidad utilizada") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        onClick = {
                            val cantidad = cantidadTexto.replace(",", ".").toDoubleOrNull()
                            val disponible = canto.cantidad_disponible ?: 0.0

                            if (cantidad == null || cantidad <= 0) {
                                onError("Ingrese una cantidad válida.")
                                return@Button
                            }

                            if (cantidad > disponible) {
                                onError("La cantidad utilizada no puede ser mayor al disponible.")
                                return@Button
                            }

                            scope.launch {
                                try {
                                    val response = RetrofitClient.api.registrarConsumoCanto(
                                        ConsumoCantoRequest(
                                            lote_proceso_id = loteProcesoId,
                                            material_id = canto.material_id,
                                            ubicacion = canto.ubicacion ?: "SIN UBICACION",
                                            cantidad_real = cantidad,
                                            notas = "Consumo real de canto registrado desde tablet"
                                        )
                                    )

                                    if (response.isSuccessful) {
                                        onMensaje(
                                            response.body()?.mensaje
                                                ?: "Consumo de canto registrado correctamente."
                                        )
                                        cantidadTexto = ""
                                        onReload()
                                    } else {
                                        onError("Error al registrar consumo de canto: ${response.errorText()}")
                                    }
                                } catch (e: Exception) {
                                    onError("Error al registrar consumo de canto: ${e.message}")
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = OroViejoAllStar,
                            contentColor = AzulAllStar
                        )
                    ) {
                        Text("Registrar consumo de canto")
                    }
                } else {
                    MensajeInfo("Seleccione un canto para registrar consumo.")
                }
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
                selectedNameFallback = mueble.responsable_nombre,
                onSelected = { responsableSeleccionado = it }
            )

            Button(
                onClick = {
                    val responsableId = responsableSeleccionado

                    val responsableNombre = responsables
                        .firstOrNull { it.id == responsableId }
                        ?.nombre
                        ?: mueble.responsable_nombre

                    if (responsableId == null) {
                        onError("Debe seleccionar un responsable para el mueble antes de guardar.")
                        return@Button
                    }

                    onMensaje("Guardando responsable: ${responsableNombre ?: responsableId}...")

                    scope.launch {
                        try {
                            val response = RetrofitClient.api.asignarResponsableMueble(
                                AsignarResponsableMuebleRequest(
                                    lote_proceso_id = loteProcesoId,
                                    item_id = mueble.item_id,
                                    responsable_id = responsableId,
                                    maquina_id = null,
                                    notas = "Responsable asignado desde instalación Android."
                                )
                            )

                            if (response.isSuccessful) {
                                onMensaje(
                                    response.body()?.mensaje
                                        ?: "Responsable asignado correctamente."
                                )
                                onReload()
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

@Composable
fun ApartamentoInstalacionCard(
    apartamento: String,
    muebles: List<MuebleInstalacionResponse>,
    loteId: Int,
    loteProcesoId: Int,
    cliente: String?,
    firmaApartamento: FirmaInstalacionApartamentoData?,
    responsables: List<ResponsableResponse>,
    scope: CoroutineScope,
    onMensaje: (String) -> Unit,
    onError: (String) -> Unit,
    onReload: suspend () -> Unit
){
    val piezasTotalApartamento = muebles.sumOf {
        it.piezas_total ?: it.piezas.size
    }

    val piezasRecibidasApartamento = muebles.sumOf {
        it.piezas_recibidas ?: it.piezas.count { pieza -> pieza.llegada }
    }

    val apartamentoCompleto = piezasTotalApartamento > 0 &&
            piezasTotalApartamento == piezasRecibidasApartamento

    var mostrarFirmaApartamento by remember(apartamento) {
        mutableStateOf(false)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "Apartamento $apartamento",
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            InfoLine(
                "Piezas recibidas",
                "$piezasRecibidasApartamento / $piezasTotalApartamento"
            )

            if (firmaApartamento != null) {
                CertificadoApartamentoCard(
                    apartamento = apartamento,
                    firma = firmaApartamento
                )
            }

            Button(
                onClick = {
                    scope.launch {
                        try {
                            val response = RetrofitClient.api.completarPiezasApartamento(
                                CompletarPiezasApartamentoRequest(
                                    lote_id = loteId,
                                    apartamento = apartamento
                                )
                            )

                            if (response.isSuccessful) {
                                onMensaje(
                                    response.body()?.mensaje
                                        ?: "Apartamento marcado como recibido."
                                )
                                onReload()
                            } else {
                                onError("Error al marcar apartamento: ${response.errorText()}")
                            }
                        } catch (e: Exception) {
                            onError("Error al marcar apartamento: ${e.message}")
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = OroViejoAllStar,
                    contentColor = AzulAllStar
                )
            ) {
                Text("Marcar todas las piezas del apartamento")
            }

            if (apartamentoCompleto) {
                Button(
                    onClick = { mostrarFirmaApartamento = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        if (firmaApartamento == null) {
                            "Firmar recibido apartamento"
                        } else {
                            "Reemplazar firma de apartamento"
                        }
                    )
                }
            } else {
                MensajeInfo("Para firmar el apartamento, primero deben estar recibidas todas sus piezas.")
            }

            muebles.forEach { mueble ->
                InstalacionMuebleCard(
                    mueble = mueble,
                    loteId = loteId,
                    loteProcesoId = loteProcesoId,
                    responsables = responsables,
                    scope = scope,
                    onMensaje = onMensaje,
                    onError = onError,
                    onReload = onReload,
                    onPiezaLocalUpdated = { _, _ -> },
                    onMuebleLocalCompletado = { _ -> }
                )
            }

            if (mostrarFirmaApartamento) {
                FirmaApartamentoDialog(
                    loteProcesoId = loteProcesoId,
                    loteId = loteId,
                    apartamento = apartamento,
                    cliente = cliente,
                    onCerrar = { mostrarFirmaApartamento = false },
                    scope = scope,
                    onMensaje = onMensaje,
                    onError = onError,
                    onReload = onReload
                )
            }
        }
    }
}

@Composable
fun FirmaApartamentoDialog(
    loteProcesoId: Int,
    loteId: Int,
    apartamento: String,
    cliente: String?,
    onCerrar: () -> Unit,
    scope: CoroutineScope,
    onMensaje: (String) -> Unit,
    onError: (String) -> Unit,
    onReload: suspend () -> Unit
) {
    var nombreResponsable by remember { mutableStateOf("") }
    var observacion by remember { mutableStateOf("") }
    var paths by remember { mutableStateOf<List<ComposePath>>(emptyList()) }
    var currentPath by remember { mutableStateOf<ComposePath?>(null) }

    AlertDialog(
        onDismissRequest = onCerrar,
        title = {
            Text(
                text = "Firma recibido apartamento $apartamento",
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "Esta firma certifica el recibido completo del apartamento $apartamento.",
                    style = MaterialTheme.typography.bodyMedium
                )

                OutlinedTextField(
                    value = nombreResponsable,
                    onValueChange = { nombreResponsable = it },
                    label = { Text("Nombre de quien recibe") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = observacion,
                    onValueChange = { observacion = it },
                    label = { Text("Observación opcional") },
                    modifier = Modifier.fillMaxWidth()
                )

                Text(
                    text = "Firme dentro del recuadro:",
                    style = MaterialTheme.typography.bodySmall
                )

                Canvas(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp)
                        .background(Color.White, RoundedCornerShape(12.dp))
                        .pointerInput(Unit) {
                            detectDragGestures(
                                onDragStart = { offset ->
                                    currentPath = ComposePath().apply {
                                        moveTo(offset.x, offset.y)
                                    }
                                },
                                onDrag = { change, _ ->
                                    val path = currentPath ?: ComposePath().apply {
                                        moveTo(change.position.x, change.position.y)
                                    }

                                    path.lineTo(change.position.x, change.position.y)
                                    currentPath = path
                                },
                                onDragEnd = {
                                    currentPath?.let { path ->
                                        paths = paths + path
                                    }
                                    currentPath = null
                                },
                                onDragCancel = {
                                    currentPath = null
                                }
                            )
                        }
                ) {
                    paths.forEach { path ->
                        drawPath(
                            path = path,
                            color = androidx.compose.ui.graphics.Color.Black,
                            style = androidx.compose.ui.graphics.drawscope.Stroke(width = 4f)
                        )
                    }

                    currentPath?.let { path ->
                        drawPath(
                            path = path,
                            color = androidx.compose.ui.graphics.Color.Black,
                            style = androidx.compose.ui.graphics.drawscope.Stroke(width = 4f)
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            paths = emptyList()
                            currentPath = null
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Limpiar")
                    }

                    Button(
                        onClick = {
                            val pathsParaGuardar = currentPath?.let { paths + it } ?: paths

                            if (nombreResponsable.isBlank()) {
                                onError("Debe escribir el nombre de quien recibe.")
                                return@Button
                            }

                            if (pathsParaGuardar.isEmpty()) {
                                onError("Debe registrar la firma antes de guardar.")
                                return@Button
                            }

                            val firmaBase64 = firmaPathsToBase64(pathsParaGuardar)

                            scope.launch {
                                try {
                                    val response = RetrofitClient.api.firmarInstalacionApartamento(
                                        FirmaInstalacionApartamentoRequest(
                                            lote_proceso_id = loteProcesoId,
                                            lote_id = loteId,
                                            apartamento = apartamento,
                                            cliente = cliente,
                                            responsable_id = null,
                                            nombre_responsable = nombreResponsable,
                                            firma_base64 = firmaBase64,
                                            observacion = observacion.ifBlank { null }
                                        )
                                    )

                                    if (response.isSuccessful) {
                                        onMensaje(
                                            response.body()?.mensaje
                                                ?: "Firma de apartamento registrada correctamente."
                                        )
                                        onCerrar()
                                        onReload()
                                    } else {
                                        onError("Error al guardar firma de apartamento: ${response.errorText()}")
                                    }
                                } catch (e: Exception) {
                                    onError("Error al guardar firma de apartamento: ${e.message}")
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = OroViejoAllStar,
                            contentColor = AzulAllStar
                        )
                    ) {
                        Text("Guardar")
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onCerrar) {
                Text("Cerrar")
            }
        }
    )
}

@Composable
fun CertificadoApartamentoCard(
    apartamento: String,
    firma: FirmaInstalacionApartamentoData
) {
    val nombreResponsable = firma.nombre_responsable ?: "Responsable"
    val fechaFirma = firma.fecha_firma ?: "fecha no registrada"

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Apartamento recibido",
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            Text(
                text = "Se certifica que \"$nombreResponsable\" recibió el apartamento \"$apartamento\" el \"$fechaFirma\".",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )

            firma.firma_base64?.let { base64 ->
                FirmaImagenBase64(base64)
            }

            if (!firma.observacion.isNullOrBlank()) {
                Text(
                    text = "Observación: ${firma.observacion}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSecondaryContainer
                )
            }
        }
    }
}

@Composable
fun ConsumoSinLoteCard(
    proyecto: ProyectoResponse?,
    inventario: List<InventarioResponse>,
    cargandoInventario: Boolean,
    scope: CoroutineScope,
    onMensaje: (String) -> Unit,
    onError: (String) -> Unit,
    onReloadInventario: suspend () -> Unit
) {
    var procesoSeleccionado by remember { mutableStateOf("Seccionado") }
    var nombreProduccion by remember { mutableStateOf("") }
    var cantidadTexto by remember { mutableStateOf("") }
    var observacion by remember { mutableStateOf("") }
    var guardando by remember { mutableStateOf(false) }

    val tipoMaterial = when (procesoSeleccionado) {
        "Seccionado" -> "tablero"
        "Enchape" -> "canto"
        "Armado" -> "herraje"
        else -> "material"
    }

    val inventarioFiltrado = remember(inventario, procesoSeleccionado) {
        inventario
            .filter { item ->
                val disponible = item.cantidad_disponible
                    ?: item.cantidad_actual
                    ?: item.cantidad
                    ?: item.stock
                    ?: 0.0

                val coincideTipo = when (procesoSeleccionado) {
                    "Seccionado" -> esTableroInventario(item)
                    "Enchape" -> esCantoInventario(item)
                    "Armado" -> esHerrajeInventario(item)
                    else -> true
                }

                coincideTipo && disponible > 0.0
            }
            .sortedWith(
                compareBy<InventarioResponse> {
                    it.material_nombre ?: "Material ${it.material_id}"
                }.thenBy {
                    it.ubicacion ?: "SIN UBICACION"
                }
            )
    }

    var materialSeleccionado by remember(inventarioFiltrado, procesoSeleccionado) {
        mutableStateOf(inventarioFiltrado.firstOrNull())
    }

    val cantidadDisponible = materialSeleccionado?.let { item ->
        item.cantidad_disponible
            ?: item.cantidad_actual
            ?: item.cantidad
            ?: item.stock
            ?: 0.0
    } ?: 0.0

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "Consumo de materia prima sin lote",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            Text(
                text = "Use esta opción cuando se esté produciendo algo asociado al proyecto, pero todavía no exista un lote definido.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            InfoLine("Proyecto", proyecto?.nombre ?: "Sin proyecto seleccionado")
            InfoLine("Cliente", proyecto?.cliente ?: "-")

            DropdownString(
                label = "Proceso",
                values = listOf("Seccionado", "Enchape", "Armado"),
                selected = procesoSeleccionado,
                onSelected = { nuevoProceso ->
                    procesoSeleccionado = nuevoProceso
                    materialSeleccionado = null
                    cantidadTexto = ""
                }
            )

            InfoLine("Tipo de material", tipoMaterial)

            OutlinedTextField(
                value = nombreProduccion,
                onValueChange = { nombreProduccion = it },
                label = { Text("Nombre de lo que se está produciendo") },
                placeholder = { Text("Ej: Mueble adicional cocina apto 601") },
                modifier = Modifier.fillMaxWidth()
            )

            if (cargandoInventario) {
                MensajeInfo("Cargando inventario...")
            }

            if (!cargandoInventario && inventarioFiltrado.isEmpty()) {
                MensajeInfo(
                    "No hay inventario disponible para $tipoMaterial en el proceso $procesoSeleccionado."
                )
            }

            if (inventarioFiltrado.isNotEmpty()) {
                DropdownBase(
                    label = "Material / ubicación",
                    value = materialSeleccionado?.let { item ->
                        val nombre = item.material_nombre ?: "Material ${item.material_id}"
                        val ubicacion = item.ubicacion ?: "SIN UBICACION"
                        val disponible = item.cantidad_disponible
                            ?: item.cantidad_actual
                            ?: item.cantidad
                            ?: item.stock
                            ?: 0.0

                        "$nombre | $ubicacion | Disponible: ${formatMedida(disponible)} ${item.unidad_medida ?: ""}"
                    } ?: "",
                    items = inventarioFiltrado,
                    itemLabel = { item ->
                        val nombre = item.material_nombre ?: "Material ${item.material_id}"
                        val categoria = item.categoria ?: item.material_categoria ?: "-"
                        val ubicacion = item.ubicacion ?: "SIN UBICACION"
                        val disponible = item.cantidad_disponible
                            ?: item.cantidad_actual
                            ?: item.cantidad
                            ?: item.stock
                            ?: 0.0

                        "$nombre | $categoria | $ubicacion | Disponible: ${formatMedida(disponible)} ${item.unidad_medida ?: ""}"
                    },
                    onSelected = { item ->
                        materialSeleccionado = item
                        cantidadTexto = ""
                    }
                )

                val material = materialSeleccionado

                if (material != null) {
                    InfoLine(
                        "Material",
                        material.material_nombre ?: "Material ${material.material_id}"
                    )

                    InfoLine(
                        "Categoría",
                        material.categoria ?: material.material_categoria ?: "-"
                    )

                    InfoLine(
                        "Ubicación",
                        material.ubicacion ?: "SIN UBICACION"
                    )

                    InfoLine(
                        "Disponible",
                        "${formatMedida(cantidadDisponible)} ${material.unidad_medida ?: ""}"
                    )
                }
            }

            OutlinedTextField(
                value = cantidadTexto,
                onValueChange = { cantidadTexto = it },
                label = { Text("Cantidad consumida") },
                placeholder = { Text("Ej: 1, 2.5, 10") },
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = observacion,
                onValueChange = { observacion = it },
                label = { Text("Observación") },
                placeholder = { Text("Observación opcional del consumo") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2
            )

            Button(
                onClick = {
                    val proyectoActual = proyecto

                    if (proyectoActual == null) {
                        onError("Debe seleccionar un proyecto antes de registrar consumo sin lote.")
                        return@Button
                    }

                    if (nombreProduccion.isBlank()) {
                        onError("Debe escribir el nombre de lo que se está produciendo.")
                        return@Button
                    }

                    val material = materialSeleccionado

                    if (material == null) {
                        onError("Debe seleccionar un material.")
                        return@Button
                    }

                    val cantidad = cantidadTexto.replace(",", ".").toDoubleOrNull()

                    if (cantidad == null || cantidad <= 0.0) {
                        onError("Ingrese una cantidad consumida válida.")
                        return@Button
                    }

                    if (cantidad > cantidadDisponible) {
                        onError("La cantidad consumida no puede ser mayor al disponible.")
                        return@Button
                    }

                    scope.launch {
                        guardando = true

                        try {
                            val response = RetrofitClient.api.registrarConsumoSinLote(
                                ConsumoSinLoteRequest(
                                    proyecto_id = proyectoActual.id,
                                    proyecto_nombre = proyectoActual.nombre,
                                    cliente = proyectoActual.cliente,
                                    proceso_nombre = procesoSeleccionado,
                                    tipo_material = tipoMaterial,
                                    nombre_produccion = nombreProduccion.trim(),
                                    material_id = material.material_id,
                                    material_nombre = material.material_nombre,
                                    unidad_medida = material.unidad_medida,
                                    cantidad_consumida = cantidad,
                                    ubicacion = material.ubicacion,
                                    observacion = observacion.ifBlank { null },
                                    usuario = "tablet"
                                )
                            )

                            if (response.isSuccessful) {
                                val body = response.body()

                                if (body?.ok == true) {
                                    onMensaje(
                                        body.mensaje
                                            ?: "Consumo sin lote registrado correctamente."
                                    )

                                    cantidadTexto = ""
                                    observacion = ""
                                    nombreProduccion = ""

                                    onReloadInventario()
                                } else {
                                    onError(
                                        body?.mensaje
                                            ?: "No se pudo registrar el consumo sin lote."
                                    )
                                }
                            } else {
                                onError("Error al registrar consumo sin lote: ${response.errorText()}")
                            }

                        } catch (e: Exception) {
                            onError(
                                "Error al registrar consumo sin lote: ${e::class.java.simpleName} - ${e.message ?: "sin detalle"}"
                            )
                        } finally {
                            guardando = false
                        }
                    }
                },
                enabled = !guardando && !cargandoInventario,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = OroViejoAllStar,
                    contentColor = AzulAllStar
                )
            ) {
                Text(
                    if (guardando) {
                        "Registrando consumo..."
                    } else {
                        "Registrar consumo sin lote"
                    }
                )
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
    selectedNameFallback: String? = null,
    onSelected: (Int) -> Unit
) {
    val selected = responsables.firstOrNull { it.id == selectedId }

    DropdownBase(
        label = label,
        value = selected?.nombre ?: selectedNameFallback ?: "",
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
@Composable
fun BotonesAccionApiInventario(
    cargando: Boolean,
    onVerInventario: () -> Unit,
    onActualizarApi: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        OutlinedButton(
            onClick = onVerInventario,
            enabled = !cargando,
            modifier = Modifier.weight(1f)
        ) {
            Text("Ver inventario")
        }

        Button(
            onClick = onActualizarApi,
            enabled = !cargando,
            modifier = Modifier.weight(1f),
            colors = ButtonDefaults.buttonColors(
                containerColor = OroViejoAllStar,
                contentColor = AzulAllStar
            )
        ) {
            Text("Actualizar API")
        }
    }
}


@Composable
fun InventarioGeneralDialog(
    inventario: List<InventarioResponse>,
    cargando: Boolean,
    onCerrar: () -> Unit,
    onActualizar: () -> Unit
) {
    var filtro by remember { mutableStateOf("Todos") }

    val opcionesFiltro = listOf(
        "Todos",
        "Herrajes",
        "Cantos",
        "Tableros"
    )

    val inventarioFiltrado = remember(inventario, filtro) {
        inventario.filter { item ->
            when (filtro) {
                "Herrajes" -> esHerrajeInventario(item)
                "Cantos" -> esCantoInventario(item)
                "Tableros" -> esTableroInventario(item)
                else -> true
            }
        }
    }

    AlertDialog(
        onDismissRequest = onCerrar,
        title = {
            Text(
                text = "Inventario",
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                DropdownString(
                    label = "Filtrar por tipo",
                    values = opcionesFiltro,
                    selected = filtro,
                    onSelected = { filtro = it }
                )

                InfoLine("Registros", inventarioFiltrado.size.toString())

                if (cargando) {
                    MensajeInfo("Actualizando inventario...")
                }

                if (inventarioFiltrado.isEmpty() && !cargando) {
                    MensajeInfo("No hay registros para el filtro seleccionado.")
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 480.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(
                            items = inventarioFiltrado,
                            key = { item ->
                                "${item.id ?: item.material_id}-${item.ubicacion ?: "SIN UBICACION"}"
                            }
                        ) { item ->
                            InventarioRowCard(item)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onActualizar,
                enabled = !cargando
            ) {
                Text("Actualizar")
            }
        },
        dismissButton = {
            TextButton(onClick = onCerrar) {
                Text("Cerrar")
            }
        }
    )
}


@Composable
fun InventarioRowCard(
    item: InventarioResponse
) {
    val nombre = item.material_nombre ?: "Material ${item.material_id}"
    val categoria = item.categoria ?: item.material_categoria ?: "-"
    val cantidad = item.cantidad_disponible
        ?: item.cantidad_actual
        ?: item.cantidad
        ?: item.stock
        ?: 0.0

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = nombre,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            InfoLine("Categoría", categoria)
            InfoLine("Cantidad", "${formatMedida(cantidad)} ${item.unidad_medida ?: "unidad"}")
            InfoLine("Ubicación", item.ubicacion ?: "SIN UBICACION")

            if (!item.ultima_actualizacion.isNullOrBlank()) {
                InfoLine("Actualizado", item.ultima_actualizacion)
            }
        }
    }
}


fun textoInventarioNormalizado(item: InventarioResponse): String {
    return textoNormalizado(
        listOfNotNull(
            item.material_nombre,
            item.categoria,
            item.material_categoria
        ).joinToString(" ")
    )
}


fun esCantoInventario(item: InventarioResponse): Boolean {
    val texto = textoInventarioNormalizado(item)

    return texto.contains("canto") ||
            texto.contains("tapacanto") ||
            texto.contains("flexible") ||
            texto.contains("rigido") ||
            texto.contains("semirigido") ||
            texto.contains("semi rigido")
}


fun esHerrajeInventario(item: InventarioResponse): Boolean {
    val texto = textoInventarioNormalizado(item)

    return texto.contains("herraje") ||
            texto.contains("bisagra") ||
            texto.contains("riel") ||
            texto.contains("corredera") ||
            texto.contains("tornillo") ||
            texto.contains("manija") ||
            texto.contains("pata") ||
            texto.contains("soporte") ||
            texto.contains("tarugo") ||
            texto.contains("minifix") ||
            texto.contains("perno")
}


fun esTableroInventario(item: InventarioResponse): Boolean {
    val texto = textoInventarioNormalizado(item)

    return !esCantoInventario(item) &&
            (
                    texto.contains("tablero") ||
                            texto.contains("lamina") ||
                            texto.contains("lámina") ||
                            texto.contains("melamina") ||
                            texto.contains("mdf") ||
                            texto.contains("aglomerado") ||
                            texto.contains("rh") ||
                            texto.contains("st") ||
                            texto.contains("estandar") ||
                            texto.contains("15 mm") ||
                            texto.contains("18 mm") ||
                            texto.contains("-15") ||
                            texto.contains("-18")
                    )
}

// ============================================================
// HELPERS
// ============================================================
@Composable
fun CertificadoRecibidoCard(
    mueble: MuebleInstalacionResponse,
    firma: FirmaInstalacionMuebleData
) {
    val nombreResponsable = firma.nombre_responsable
        ?: mueble.responsable_nombre
        ?: "Responsable del mueble"

    val nombreMueble = mueble.label
        ?: mueble.item_nombre
        ?: mueble.mueble_nombre
        ?: "Mueble ${mueble.item_id}"

    val fechaFirma = firma.fecha_firma ?: "fecha no registrada"

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Certificado de recibido",
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            Text(
                text = "Se certifica que \"$nombreResponsable\" recibió por completo las piezas del mueble \"$nombreMueble\" el \"$fechaFirma\".",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )

            firma.firma_base64?.let { base64 ->
                FirmaImagenBase64(base64)
            }

            if (!firma.observacion.isNullOrBlank()) {
                Text(
                    text = "Observación: ${firma.observacion}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSecondaryContainer
                )
            }
        }
    }
}

@Composable
fun FirmaImagenBase64(
    firmaBase64: String
) {
    val bitmap = remember(firmaBase64) {
        try {
            val limpio = firmaBase64.substringAfter("base64,", firmaBase64)
            val bytes = Base64.decode(limpio, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (_: Exception) {
            null
        }
    }

    if (bitmap != null) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color.White
            )
        ) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "Firma de recibido",
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp)
                    .padding(8.dp)
            )
        }
    } else {
        MensajeError("No se pudo cargar la imagen de la firma.")
    }
}
fun firmaPathsToBase64(paths: List<ComposePath>): String {
    val width = 900
    val height = 360

    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = AndroidCanvas(bitmap)

    canvas.drawColor(android.graphics.Color.WHITE)

    val paint = Paint().apply {
        color = android.graphics.Color.BLACK
        strokeWidth = 6f
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        isAntiAlias = true
    }

    paths.forEach { composePath ->
        canvas.drawPath(composePath.asAndroidPath(), paint)
    }

    val outputStream = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)

    val bytes = outputStream.toByteArray()

    return Base64.encodeToString(bytes, Base64.NO_WRAP)
}
fun nowText(): String {
    return SimpleDateFormat(
        "yyyy-MM-dd HH:mm:ss",
        Locale.getDefault()
    ).format(Date())
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

@Composable
fun FirmaInstalacionDialog(
    mueble: MuebleInstalacionResponse,
    loteProcesoId: Int,
    responsableId: Int?,
    nombreResponsable: String?,
    onCerrar: () -> Unit,
    onFirmaGuardada: (FirmaInstalacionMuebleData?) -> Unit,
    scope: CoroutineScope,
    onMensaje: (String) -> Unit,
    onError: (String) -> Unit,
    onReload: suspend () -> Unit
) {
    var observacion by remember { mutableStateOf("") }
    var paths by remember { mutableStateOf<List<ComposePath>>(emptyList()) }
    var currentPath by remember { mutableStateOf<ComposePath?>(null) }

    AlertDialog(
        onDismissRequest = onCerrar,
        title = {
            Text(
                text = "Firma de recibido",
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = mueble.label ?: mueble.item_nombre ?: "Mueble ${mueble.item_id}",
                    fontWeight = FontWeight.SemiBold
                )

                OutlinedTextField(
                    value = observacion,
                    onValueChange = { observacion = it },
                    label = { Text("Observación opcional") },
                    modifier = Modifier.fillMaxWidth()
                )

                Text(
                    text = "Firme dentro del recuadro:",
                    style = MaterialTheme.typography.bodySmall
                )

                Canvas(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp)
                        .background(Color.White, RoundedCornerShape(12.dp))
                        .pointerInput(Unit) {
                            detectDragGestures(
                                onDragStart = { offset ->
                                    currentPath = ComposePath().apply {
                                        moveTo(offset.x, offset.y)
                                    }
                                },
                                onDrag = { change, _ ->
                                    val path = currentPath ?: ComposePath().apply {
                                        moveTo(change.position.x, change.position.y)
                                    }

                                    path.lineTo(change.position.x, change.position.y)
                                    currentPath = path
                                },
                                onDragEnd = {
                                    currentPath?.let { path ->
                                        paths = paths + path
                                    }
                                    currentPath = null
                                },
                                onDragCancel = {
                                    currentPath = null
                                }
                            )
                        }
                ) {
                    paths.forEach { path ->
                        drawPath(
                            path = path,
                            color = androidx.compose.ui.graphics.Color.Black,
                            style = androidx.compose.ui.graphics.drawscope.Stroke(width = 4f)
                        )
                    }

                    currentPath?.let { path ->
                        drawPath(
                            path = path,
                            color = androidx.compose.ui.graphics.Color.Black,
                            style = androidx.compose.ui.graphics.drawscope.Stroke(width = 4f)
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            paths = emptyList()
                            currentPath = null
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Limpiar")
                    }

                    Button(
                        onClick = {
                            if (paths.isEmpty() && currentPath == null) {
                                onError("Debe registrar la firma antes de guardar.")
                                return@Button
                            }

                            val firmaBase64 = firmaPathsToBase64(paths)

                            scope.launch {
                                try {
                                    val response = RetrofitClient.api.firmarInstalacionMueble(
                                        FirmaInstalacionMuebleRequest(
                                            lote_proceso_id = loteProcesoId,
                                            item_id = mueble.item_id,
                                            responsable_id = responsableId,
                                            nombre_responsable = nombreResponsable ?: mueble.responsable_nombre,
                                            firma_base64 = firmaBase64,
                                            observacion = observacion.ifBlank { null }
                                        )
                                    )

                                    if (response.isSuccessful) {
                                        val firmaResponse = RetrofitClient.api.getFirmaInstalacionMueble(
                                            loteProcesoId = loteProcesoId,
                                            itemId = mueble.item_id
                                        )

                                        val firmaGuardada = if (firmaResponse.isSuccessful) {
                                            firmaResponse.body()?.firma
                                        } else {
                                            null
                                        }

                                        onMensaje(
                                            response.body()?.mensaje
                                                ?: "Firma registrada correctamente."
                                        )

                                        onFirmaGuardada(firmaGuardada)
                                        onReload()
                                    } else {
                                        onError("Error al guardar firma: ${response.errorText()}")
                                    }
                                } catch (e: Exception) {
                                    onError("Error al guardar firma: ${e.message}")
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = OroViejoAllStar,
                            contentColor = AzulAllStar
                        )
                    ) {
                        Text("Guardar")
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onCerrar) {
                Text("Cerrar")
            }

        }


    )

}

@Composable
fun ActaClienteDialog(
    cliente: String?,
    loteNombre: String?,
    loteProcesoId: Int,
    loteId: Int?,
    firmasApartamentos: List<FirmaInstalacionApartamentoData>,
    scope: CoroutineScope,
    onCerrar: () -> Unit,
    onMensaje: (String) -> Unit,
    onError: (String) -> Unit
){
    val context = LocalContext.current


    val apartamentosFirmados = firmasApartamentos
        .filter { !it.apartamento.isNullOrBlank() && !it.firma_base64.isNullOrBlank() }

    var apartamentosSeleccionados by remember {
        mutableStateOf<Set<String>>(emptySet())
    }

    var obra1Nombre by remember { mutableStateOf("") }
    var obra1Cargo by remember { mutableStateOf("") }

    var obra2Nombre by remember { mutableStateOf("") }
    var obra2Cargo by remember { mutableStateOf("") }

    var allStarNombre by remember { mutableStateOf("") }
    var allStarCargo by remember { mutableStateOf("") }

    var comentarioActa by remember { mutableStateOf("") }

    var obra1Paths by remember { mutableStateOf<List<ComposePath>>(emptyList()) }
    var obra1CurrentPath by remember { mutableStateOf<ComposePath?>(null) }


    var obra2Paths by remember { mutableStateOf<List<ComposePath>>(emptyList()) }
    var obra2CurrentPath by remember { mutableStateOf<ComposePath?>(null) }

    var allStarPaths by remember { mutableStateOf<List<ComposePath>>(emptyList()) }
    var allStarCurrentPath by remember { mutableStateOf<ComposePath?>(null) }

    var mostrarActasGeneradas by remember { mutableStateOf(false) }
    val launcherGuardarPdf = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/pdf")
    ) { uri: Uri? ->
        if (uri == null) {
            onError("No se seleccionó ubicación para guardar el PDF.")
            return@rememberLauncherForActivityResult
        }

        val obra1FirmaPaths = obra1CurrentPath?.let { obra1Paths + it } ?: obra1Paths
        val obra2FirmaPaths = obra2CurrentPath?.let { obra2Paths + it } ?: obra2Paths
        val allStarFirmaPaths = allStarCurrentPath?.let { allStarPaths + it } ?: allStarPaths
        val obra1FirmaBase64 = firmaPathsToBase64(obra1FirmaPaths)
        val obra2FirmaBase64 = firmaPathsToBase64(obra2FirmaPaths)
        val allStarFirmaBase64 = firmaPathsToBase64(allStarFirmaPaths)
        try {
            val nombreArchivo = "acta_cliente_${System.currentTimeMillis()}.pdf"

            val pdfBytes = generarPdfActaClienteEnUri(
                context = context,
                uri = uri,
                cliente = cliente ?: "Cliente no registrado",
                loteNombre = loteNombre ?: "Lote no registrado",
                apartamentos = apartamentosSeleccionados.toList().sorted(),
                obra1Nombre = obra1Nombre,
                obra1Cargo = obra1Cargo,
                obra1FirmaBase64 = obra1FirmaBase64,
                obra2Nombre = obra2Nombre,
                obra2Cargo = obra2Cargo,
                obra2FirmaBase64 = obra2FirmaBase64,
                allStarNombre = allStarNombre,
                allStarCargo = allStarCargo,
                allStarFirmaBase64 = allStarFirmaBase64,
                comentario = comentarioActa
            )

            onMensaje("PDF guardado localmente. Respaldando en Azure...")

            scope.launch {
                try {
                    subirActaClienteAzure(
                        pdfBytes = pdfBytes,
                        nombreArchivo = nombreArchivo,
                        loteProcesoId = loteProcesoId,
                        loteId = loteId,
                        cliente = cliente ?: "Cliente no registrado",
                        loteNombre = loteNombre,
                        apartamentos = apartamentosSeleccionados.toList().sorted(),

                        obra1Nombre = obra1Nombre,
                        obra1Cargo = obra1Cargo,
                        obra1FirmaBase64 = obra1FirmaBase64,

                        obra2Nombre = obra2Nombre,
                        obra2Cargo = obra2Cargo,
                        obra2FirmaBase64 = obra2FirmaBase64,

                        allStarNombre = allStarNombre,
                        allStarCargo = allStarCargo,
                        allStarFirmaBase64 = allStarFirmaBase64,
                        comentario = comentarioActa
                    )

                    onMensaje("Acta guardada localmente y respaldada en Azure correctamente.")
                    onCerrar()
                } catch (e: Exception) {
                    onError("El PDF se guardó localmente, pero no se pudo respaldar en Azure/SQL: ${e.message}")
                }
            }
        } catch (e: Exception) {
            onError("Error al guardar el PDF: ${e.message}")
        }
    }



    AlertDialog(
        onDismissRequest = onCerrar,
        title = {
            Text(
                text = "Acta cliente",
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 620.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "Seleccione los apartamentos firmados que se entregarán al cliente.",
                    style = MaterialTheme.typography.bodyMedium
                )

                if (apartamentosFirmados.isEmpty()) {
                    MensajeInfo("Todavía no hay apartamentos firmados para generar el acta.")
                } else {
                    apartamentosFirmados.forEach { firma ->
                        val apto = firma.apartamento ?: return@forEach
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = apartamentosSeleccionados.contains(apto),
                                onCheckedChange = { checked ->
                                    apartamentosSeleccionados = if (checked) {
                                        apartamentosSeleccionados + apto
                                    } else {
                                        apartamentosSeleccionados - apto
                                    }
                                }
                            )

                            Text(
                                text = "Apartamento $apto",
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }

                Divider()

                Text(
                    text = "Persona encargada de obra 1",
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )

                OutlinedTextField(
                    value = obra1Nombre,
                    onValueChange = { obra1Nombre = it },
                    label = { Text("Nombre") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = obra1Cargo,
                    onValueChange = { obra1Cargo = it },
                    label = { Text("Cargo") },
                    modifier = Modifier.fillMaxWidth()
                )

                FirmaActaBox(
                    titulo = "Firma obra 1",
                    paths = obra1Paths,
                    currentPath = obra1CurrentPath,
                    onPathsChange = { obra1Paths = it },
                    onCurrentPathChange = { obra1CurrentPath = it }
                )

                Divider()

                Text(
                    text = "Persona encargada de obra 2",
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )

                OutlinedTextField(
                    value = obra2Nombre,
                    onValueChange = { obra2Nombre = it },
                    label = { Text("Nombre") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = obra2Cargo,
                    onValueChange = { obra2Cargo = it },
                    label = { Text("Cargo") },
                    modifier = Modifier.fillMaxWidth()
                )

                FirmaActaBox(
                    titulo = "Firma obra 2",
                    paths = obra2Paths,
                    currentPath = obra2CurrentPath,
                    onPathsChange = { obra2Paths = it },
                    onCurrentPathChange = { obra2CurrentPath = it }
                )

                Divider()

                Text(
                    text = "Persona All Star",
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )

                OutlinedTextField(
                    value = allStarNombre,
                    onValueChange = { allStarNombre = it },
                    label = { Text("Nombre") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = allStarCargo,
                    onValueChange = { allStarCargo = it },
                    label = { Text("Cargo") },
                    modifier = Modifier.fillMaxWidth()
                )

                FirmaActaBox(
                    titulo = "Firma All Star",
                    paths = allStarPaths,
                    currentPath = allStarCurrentPath,
                    onPathsChange = { allStarPaths = it },
                    onCurrentPathChange = { allStarCurrentPath = it }
                )

                Divider()

                Text(
                    text = "Comentario general del acta",
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )

                OutlinedTextField(
                    value = comentarioActa,
                    onValueChange = { comentarioActa = it },
                    label = { Text("Comentario que quedará en el PDF") },
                    placeholder = { Text("Escriba aquí el comentario general de la entrega...") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 110.dp),
                    minLines = 4,
                    maxLines = 6
                )

                Button(
                    onClick = {
                        mostrarActasGeneradas = true
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = OroViejoAllStar,
                        contentColor = AzulAllStar
                    )
                ) {
                    Text("Visualizar actas")
                }



                Button(
                    onClick = {
                        val obra1FirmaPaths = obra1CurrentPath?.let { obra1Paths + it } ?: obra1Paths
                        val obra2FirmaPaths = obra2CurrentPath?.let { obra2Paths + it } ?: obra2Paths
                        val allStarFirmaPaths = allStarCurrentPath?.let { allStarPaths + it } ?: allStarPaths

                        if (apartamentosSeleccionados.isEmpty()) {
                            onError("Debe seleccionar al menos un apartamento firmado.")
                            return@Button
                        }

                        if (obra1Nombre.isBlank() || obra1Cargo.isBlank()) {
                            onError("Debe escribir nombre y cargo de la persona de obra 1.")
                            return@Button
                        }

                        if (obra2Nombre.isBlank() || obra2Cargo.isBlank()) {
                            onError("Debe escribir nombre y cargo de la persona de obra 2.")
                            return@Button
                        }

                        if (allStarNombre.isBlank() || allStarCargo.isBlank()) {
                            onError("Debe escribir nombre y cargo de la persona de All Star.")
                            return@Button
                        }

                        if (obra1FirmaPaths.isEmpty()) {
                            onError("Debe registrar la firma de la persona de obra 1.")
                            return@Button
                        }

                        if (obra2FirmaPaths.isEmpty()) {
                            onError("Debe registrar la firma de la persona de obra 2.")
                            return@Button
                        }

                        if (allStarFirmaPaths.isEmpty()) {
                            onError("Debe registrar la firma de la persona de All Star.")
                            return@Button
                        }

                        val nombreArchivo = "acta_cliente_${System.currentTimeMillis()}.pdf"
                        launcherGuardarPdf.launch(nombreArchivo)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = TerracotaAllStar,
                        contentColor = BlancoHuesoAllStar
                    )
                ) {
                    Text("Generar y descargar PDF")
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onCerrar) {
                Text("Cerrar")
            }
        }
    )
    if (mostrarActasGeneradas) {
        VisualizarActasClienteDialog(
            loteProcesoId = loteProcesoId,
            loteId = loteId,
            scope = scope,
            onCerrar = {
                mostrarActasGeneradas = false
            },
            onVolverAInstalar = {
                mostrarActasGeneradas = false
                onCerrar()
            },
            onMensaje = onMensaje,
            onError = onError
        )
    }
}


@Composable
fun FirmaActaBox(
    titulo: String,
    paths: List<ComposePath>,
    currentPath: ComposePath?,
    onPathsChange: (List<ComposePath>) -> Unit,
    onCurrentPathChange: (ComposePath?) -> Unit
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            text = titulo,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.SemiBold
        )

        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(180.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White)
                .pointerInput(paths) {
                    var activePath: ComposePath? = null
                    var lastPoint: Offset? = null

                    detectDragGestures(
                        onDragStart = { offset ->
                            activePath = ComposePath().apply {
                                moveTo(offset.x, offset.y)
                            }

                            lastPoint = offset
                            onCurrentPathChange(activePath)
                        },
                        onDrag = { change, _ ->
                            val currentPoint = change.position
                            val previousPoint = lastPoint

                            val path = activePath ?: ComposePath().apply {
                                moveTo(currentPoint.x, currentPoint.y)
                            }

                            if (previousPoint != null) {
                                val midPoint = Offset(
                                    x = (previousPoint.x + currentPoint.x) / 2f,
                                    y = (previousPoint.y + currentPoint.y) / 2f
                                )

                                path.quadraticBezierTo(
                                    previousPoint.x,
                                    previousPoint.y,
                                    midPoint.x,
                                    midPoint.y
                                )
                            } else {
                                path.lineTo(currentPoint.x, currentPoint.y)
                            }

                            activePath = path
                            lastPoint = currentPoint
                            onCurrentPathChange(path)
                        },
                        onDragEnd = {
                            val pathFinal = activePath

                            if (pathFinal != null) {
                                onPathsChange(paths + pathFinal)
                            }

                            activePath = null
                            lastPoint = null
                            onCurrentPathChange(null)
                        },
                        onDragCancel = {
                            activePath = null
                            lastPoint = null
                            onCurrentPathChange(null)
                        }
                    )
                }
        ) {
            paths.forEach { path ->
                drawPath(
                    path = path,
                    color = androidx.compose.ui.graphics.Color.Black,
                    style = androidx.compose.ui.graphics.drawscope.Stroke(width = 4f)
                )
            }

            currentPath?.let { path ->
                drawPath(
                    path = path,
                    color = androidx.compose.ui.graphics.Color.Black,
                    style = androidx.compose.ui.graphics.drawscope.Stroke(width = 4f)
                )
            }
        }

        OutlinedButton(
            onClick = {
                onPathsChange(emptyList())
                onCurrentPathChange(null)
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Limpiar firma")
        }
    }
}

fun generarPdfActaCliente(
    context: Context,
    cliente: String,
    apartamentos: List<String>,
    obra1Nombre: String,
    obra1Cargo: String,
    obra1FirmaBase64: String,
    obra2Nombre: String,
    obra2Cargo: String,
    obra2FirmaBase64: String,
    allStarNombre: String,
    allStarCargo: String,
    allStarFirmaBase64: String
): String {
    val fecha = nowText()
    val apartamentosTexto = apartamentos.joinToString(", ")

    val mensaje =
        "Esta acta certifica que se le entregaron los apartamentos $apartamentosTexto al cliente $cliente en la fecha de $fecha."

    val pdfDocument = PdfDocument()
    val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create()
    val page = pdfDocument.startPage(pageInfo)
    val canvas = page.canvas

    val paintTitulo = Paint().apply {
        color = android.graphics.Color.BLACK
        textSize = 20f
        isFakeBoldText = true
    }

    val paintNormal = Paint().apply {
        color = android.graphics.Color.BLACK
        textSize = 12f
    }

    val paintBold = Paint().apply {
        color = android.graphics.Color.BLACK
        textSize = 12f
        isFakeBoldText = true
    }

    var y = 60f

    canvas.drawText("ACTA DE ENTREGA AL CLIENTE", 60f, y, paintTitulo)
    y += 40f

    drawMultilineText(
        canvas = canvas,
        text = mensaje,
        x = 60f,
        yStart = y,
        paint = paintNormal,
        maxChars = 80,
        lineHeight = 18f
    )

    y += 80f

    canvas.drawText("Personas encargadas de la obra", 60f, y, paintBold)
    y += 25f

    canvas.drawText("1. $obra1Nombre - $obra1Cargo", 60f, y, paintNormal)
    y += 15f
    drawFirmaBase64Pdf(canvas, obra1FirmaBase64, 60f, y, 180, 70)
    y += 95f

    canvas.drawText("2. $obra2Nombre - $obra2Cargo", 60f, y, paintNormal)
    y += 15f
    drawFirmaBase64Pdf(canvas, obra2FirmaBase64, 60f, y, 180, 70)
    y += 95f

    canvas.drawText("Persona All Star", 60f, y, paintBold)
    y += 25f

    canvas.drawText("$allStarNombre - $allStarCargo", 60f, y, paintNormal)
    y += 15f
    drawFirmaBase64Pdf(canvas, allStarFirmaBase64, 60f, y, 180, 70)

    pdfDocument.finishPage(page)

    val fileName = "acta_cliente_${System.currentTimeMillis()}.pdf"

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, fileName)
            put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        }

        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: throw IllegalStateException("No se pudo crear el archivo PDF.")

        resolver.openOutputStream(uri)?.use { output ->
            pdfDocument.writeTo(output)
        } ?: throw IllegalStateException("No se pudo escribir el archivo PDF.")
    } else {
        val downloadsDir = Environment.getExternalStoragePublicDirectory(
            Environment.DIRECTORY_DOWNLOADS
        )

        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs()
        }

        val file = File(downloadsDir, fileName)

        FileOutputStream(file).use { output ->
            pdfDocument.writeTo(output)
        }
    }

    pdfDocument.close()

    return fileName
}


fun drawMultilineText(
    canvas: android.graphics.Canvas,
    text: String,
    x: Float,
    yStart: Float,
    paint: Paint,
    maxChars: Int,
    lineHeight: Float
) {
    var y = yStart

    text.chunked(maxChars).forEach { line ->
        canvas.drawText(line, x, y, paint)
        y += lineHeight
    }
}


fun drawFirmaBase64Pdf(
    canvas: android.graphics.Canvas,
    firmaBase64: String,
    x: Float,
    y: Float,
    width: Int,
    height: Int
) {
    val limpio = firmaBase64.substringAfter("base64,", firmaBase64)
    val bytes = Base64.decode(limpio, Base64.DEFAULT)
    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)

    if (bitmap != null) {
        val scaled = Bitmap.createScaledBitmap(bitmap, width, height, true)
        canvas.drawBitmap(scaled, x, y, null)
    }
}

fun generarPdfActaClienteEnUri(
    context: Context,
    uri: Uri,
    cliente: String,
    loteNombre: String,
    apartamentos: List<String>,
    obra1Nombre: String,
    obra1Cargo: String,
    obra1FirmaBase64: String,
    obra2Nombre: String,
    obra2Cargo: String,
    obra2FirmaBase64: String,
    allStarNombre: String,
    allStarCargo: String,
    allStarFirmaBase64: String,
    comentario : String
): ByteArray {
    val fecha = nowText()
    val apartamentosTexto = apartamentos.joinToString(", ")

    val titulo = "ACTA DE ENTREGA A ${cliente.uppercase()}"

    val mensajeEntrega =
        "ALL STAR COLOMBIA S.A.S. certifica mediante la presente acta que, en la fecha $fecha, se realizó la entrega material de las partes correspondientes a los apartamentos $apartamentosTexto, pertenecientes al lote $loteNombre, al cliente $cliente."

    val mensajeResponsabilidad =
        "Con la firma de este documento, las partes dejan constancia de que los elementos relacionados fueron puestos a disposición del cliente u obra receptora en las condiciones verificadas al momento de la entrega. En consecuencia, esta acta constituye evidencia documental de la entrega realizada y de la recepción de las partes descritas. A partir de dicha recepción, cualquier pérdida, deterioro, daño derivado de manipulación inadecuada, descuido en obra, almacenamiento indebido, traslado interno, intervención de terceros o cambio posterior no es atribuible a ALL STAR COLOMBIA S.A.S. y será asumido por el cliente u obra receptora, incluyendo los costos que implique la reposición de los mismos."

    val mensajeLegal =
        "Esta constancia se emite como soporte de trazabilidad, control operativo y evidencia de entrega. Su firma tiene efectos de aceptación del recibido material por parte de quienes intervienen, conforme a los principios generales de buena fe, responsabilidad contractual y deber de conservación de los bienes recibidos."

    val pdfDocument = PdfDocument()

    return try {
        val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create()
        val page = pdfDocument.startPage(pageInfo)
        val canvas = page.canvas

        val paintHeader = Paint().apply {
            color = android.graphics.Color.BLACK
            textSize = 10f
            isFakeBoldText = true
            isAntiAlias = true
        }

        val paintTitulo = Paint().apply {
            color = android.graphics.Color.BLACK
            textSize = 17f
            isFakeBoldText = true
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
        }

        val paintSubtitulo = Paint().apply {
            color = android.graphics.Color.BLACK
            textSize = 12f
            isFakeBoldText = true
            isAntiAlias = true
        }

        val paintNormal = Paint().apply {
            color = android.graphics.Color.BLACK
            textSize = 11f
            isAntiAlias = true
        }

        val paintSmall = Paint().apply {
            color = android.graphics.Color.BLACK
            textSize = 9.5f
            isAntiAlias = true
        }

        val paintLine = Paint().apply {
            color = android.graphics.Color.BLACK
            strokeWidth = 1.2f
            isAntiAlias = true
        }

        val marginLeft = 45f
        val marginRight = 45f
        val pageWidth = 595f
        val contentWidth = pageWidth - marginLeft - marginRight

        var y = 42f

        canvas.drawText("ALL STAR COLOMBIA S.A.S.", marginLeft, y, paintHeader)
        canvas.drawText("ACTA DE ENTREGA", pageWidth - marginRight - 95f, y, paintHeader)

        y += 14f
        canvas.drawLine(marginLeft, y, pageWidth - marginRight, y, paintLine)

        y += 28f

        canvas.drawText(titulo, pageWidth / 2f, y, paintTitulo)

        y += 32f

        canvas.drawText("Fecha de firma:", marginLeft, y, paintSubtitulo)
        canvas.drawText(fecha, marginLeft + 95f, y, paintNormal)

        y += 18f

        canvas.drawText("Cliente:", marginLeft, y, paintSubtitulo)
        canvas.drawText(cliente, marginLeft + 95f, y, paintNormal)

        y += 18f

        canvas.drawText("Lote:", marginLeft, y, paintSubtitulo)
        canvas.drawText(loteNombre, marginLeft + 95f, y, paintNormal)

        y += 18f

        canvas.drawText("Apartamentos:", marginLeft, y, paintSubtitulo)

        y = drawWrappedText(
            canvas = canvas,
            text = apartamentosTexto,
            x = marginLeft + 95f,
            yStart = y,
            maxWidth = contentWidth - 95f,
            paint = paintNormal,
            lineHeight = 15f
        )

        y += 20f

        canvas.drawText("CONSTANCIA DE ENTREGA", marginLeft, y, paintSubtitulo)
        y += 20f

        y = drawWrappedText(
            canvas = canvas,
            text = mensajeEntrega,
            x = marginLeft,
            yStart = y,
            maxWidth = contentWidth,
            paint = paintNormal,
            lineHeight = 16f
        )

        y += 14f

        canvas.drawText("ALCANCE Y RESPONSABILIDAD", marginLeft, y, paintSubtitulo)
        y += 20f

        y = drawWrappedText(
            canvas = canvas,
            text = mensajeResponsabilidad,
            x = marginLeft,
            yStart = y,
            maxWidth = contentWidth,
            paint = paintNormal,
            lineHeight = 16f
        )

        y += 14f

        canvas.drawText("VALIDEZ DOCUMENTAL", marginLeft, y, paintSubtitulo)
        y += 20f

        y = drawWrappedText(
            canvas = canvas,
            text = mensajeLegal,
            x = marginLeft,
            yStart = y,
            maxWidth = contentWidth,
            paint = paintNormal,
            lineHeight = 16f
        )

        val comentarioLimpio = comentario.trim()

        if (comentarioLimpio.isNotBlank()) {
            y += 14f

            canvas.drawText("COMENTARIO GENERAL", marginLeft, y, paintSubtitulo)
            y += 18f

            y = drawWrappedText(
                canvas = canvas,
                text = comentarioLimpio,
                x = marginLeft,
                yStart = y,
                maxWidth = contentWidth,
                paint = paintNormal,
                lineHeight = 16f
            )
        }

        val firmasTituloY = maxOf(590f, y + 24f)

        canvas.drawLine(marginLeft, firmasTituloY - 18f, pageWidth - marginRight, firmasTituloY - 18f, paintLine)
        canvas.drawText("FIRMAS", marginLeft, firmasTituloY, paintSubtitulo)

        val firmaY = 615f
        val columnWidth = 155f

        drawFirmaFormalPdf(
            canvas = canvas,
            firmaBase64 = obra1FirmaBase64,
            x = marginLeft,
            y = firmaY,
            columnWidth = columnWidth,
            nombre = obra1Nombre,
            cargo = obra1Cargo,
            titulo = "OBRA 1",
            paintNormal = paintNormal,
            paintSmall = paintSmall,
            paintLine = paintLine
        )

        drawFirmaFormalPdf(
            canvas = canvas,
            firmaBase64 = obra2FirmaBase64,
            x = marginLeft + 175f,
            y = firmaY,
            columnWidth = columnWidth,
            nombre = obra2Nombre,
            cargo = obra2Cargo,
            titulo = "OBRA 2",
            paintNormal = paintNormal,
            paintSmall = paintSmall,
            paintLine = paintLine
        )

        drawFirmaFormalPdf(
            canvas = canvas,
            firmaBase64 = allStarFirmaBase64,
            x = marginLeft + 350f,
            y = firmaY,
            columnWidth = columnWidth,
            nombre = allStarNombre,
            cargo = allStarCargo,
            titulo = "ALL STAR",
            paintNormal = paintNormal,
            paintSmall = paintSmall,
            paintLine = paintLine
        )

        val footerY = 815f
        canvas.drawLine(marginLeft, footerY - 14f, pageWidth - marginRight, footerY - 14f, paintLine)
        canvas.drawText(
            "Documento generado digitalmente desde el sistema de seguimiento de producción e instalación de All Star Colombia S.A.S.",
            marginLeft,
            footerY,
            paintSmall
        )

        pdfDocument.finishPage(page)

        val outputStream = ByteArrayOutputStream()
        pdfDocument.writeTo(outputStream)

        val pdfBytes = outputStream.toByteArray()

        context.contentResolver.openOutputStream(uri)?.use { output ->
            output.write(pdfBytes)
        } ?: throw IllegalStateException("No se pudo abrir la ubicación seleccionada.")

        pdfBytes

    } finally {
        pdfDocument.close()
    }
}

fun drawWrappedText(
    canvas: android.graphics.Canvas,
    text: String,
    x: Float,
    yStart: Float,
    maxWidth: Float,
    paint: Paint,
    lineHeight: Float
): Float {
    val words = text.split(" ")
    var line = ""
    var y = yStart

    for (word in words) {
        val testLine = if (line.isBlank()) word else "$line $word"

        if (paint.measureText(testLine) <= maxWidth) {
            line = testLine
        } else {
            canvas.drawText(line, x, y, paint)
            y += lineHeight
            line = word
        }
    }

    if (line.isNotBlank()) {
        canvas.drawText(line, x, y, paint)
        y += lineHeight
    }

    return y
}

fun drawFirmaFormalPdf(
    canvas: android.graphics.Canvas,
    firmaBase64: String,
    x: Float,
    y: Float,
    columnWidth: Float,
    nombre: String,
    cargo: String,
    titulo: String,
    paintNormal: Paint,
    paintSmall: Paint,
    paintLine: Paint
) {
    val tituloPaint = Paint(paintSmall).apply {
        isFakeBoldText = true
        textAlign = Paint.Align.CENTER
    }

    canvas.drawText(
        titulo,
        x + columnWidth / 2f,
        y,
        tituloPaint
    )

    drawFirmaBase64Pdf(
        canvas = canvas,
        firmaBase64 = firmaBase64,
        x = x + 10f,
        y = y + 12f,
        width = 130,
        height = 52
    )

    val yLinea = y + 72f

    canvas.drawLine(
        x,
        yLinea,
        x + columnWidth,
        yLinea,
        paintLine
    )

    drawWrappedText(
        canvas = canvas,
        text = "Nombre: $nombre",
        x = x,
        yStart = yLinea + 16f,
        maxWidth = columnWidth,
        paint = paintSmall,
        lineHeight = 12f
    )

    drawWrappedText(
        canvas = canvas,
        text = "Cargo: $cargo",
        x = x,
        yStart = yLinea + 42f,
        maxWidth = columnWidth,
        paint = paintSmall,
        lineHeight = 12f
    )
}

suspend fun subirActaClienteAzure(
    pdfBytes: ByteArray,
    nombreArchivo: String,
    loteProcesoId: Int,
    loteId: Int?,
    cliente: String,
    loteNombre: String?,
    apartamentos: List<String>,
    obra1Nombre: String,
    obra1Cargo: String,
    obra1FirmaBase64: String,
    obra2Nombre: String,
    obra2Cargo: String,
    obra2FirmaBase64: String,
    allStarNombre: String,
    allStarCargo: String,
    allStarFirmaBase64: String,
    comentario: String
): ActaEntregaClienteResponse? {

    fun textBody(valor: String): RequestBody {
        return valor.toRequestBody("text/plain".toMediaTypeOrNull())
    }

    fun nullableTextBody(valor: String?): RequestBody? {
        return valor?.toRequestBody("text/plain".toMediaTypeOrNull())
    }

    val pdfRequestBody = pdfBytes.toRequestBody("application/pdf".toMediaTypeOrNull())

    val archivoPart = MultipartBody.Part.createFormData(
        name = "archivo",
        filename = nombreArchivo,
        body = pdfRequestBody
    )

    val response = RetrofitClient.api.subirActaEntregaCliente(
        loteProcesoId = textBody(loteProcesoId.toString()),
        loteId = loteId?.let { textBody(it.toString()) },
        cliente = textBody(cliente),
        loteNombre = nullableTextBody(loteNombre),
        apartamentos = textBody(apartamentos.joinToString(", ")),

        obra1Nombre = nullableTextBody(obra1Nombre),
        obra1Cargo = nullableTextBody(obra1Cargo),
        obra1FirmaBase64 = nullableTextBody(obra1FirmaBase64),

        obra2Nombre = nullableTextBody(obra2Nombre),
        obra2Cargo = nullableTextBody(obra2Cargo),
        obra2FirmaBase64 = nullableTextBody(obra2FirmaBase64),

        allstarNombre = nullableTextBody(allStarNombre),
        allstarCargo = nullableTextBody(allStarCargo),
        allstarFirmaBase64 = nullableTextBody(allStarFirmaBase64),
        comentario = nullableTextBody(comentario.trim().takeIf { it.isNotBlank() }),

        archivo = archivoPart
    )

    if (!response.isSuccessful) {
        throw IllegalStateException(
            "Error al respaldar acta: ${response.errorText()}"
        )
    }

    return response.body()
}

@Composable
fun VisualizarActasClienteDialog(
    loteProcesoId: Int,
    loteId: Int?,
    scope: CoroutineScope,
    onCerrar: () -> Unit,
    onVolverAInstalar: () -> Unit,
    onMensaje: (String) -> Unit,
    onError: (String) -> Unit
) {
    val context = LocalContext.current

    var cargando by remember { mutableStateOf(false) }
    var descargando by remember { mutableStateOf(false) }
    var guardandoComentario by remember { mutableStateOf(false) }

    var eliminandoActa by remember { mutableStateOf(false) }
    var mostrarConfirmacionEliminar by remember { mutableStateOf(false) }

    var actas by remember { mutableStateOf<List<ActaEntregaClienteData>>(emptyList()) }
    var actaSeleccionada by remember { mutableStateOf<ActaEntregaClienteData?>(null) }

    var comentarioTexto by remember { mutableStateOf("") }

    var pdfPendienteGuardar by remember { mutableStateOf<ByteArray?>(null) }
    var nombreArchivoPendiente by remember { mutableStateOf("acta_cliente.pdf") }

    val launcherGuardarActaDescargada = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/pdf")
    ) { uri: Uri? ->
        if (uri == null) {
            onError("No se seleccionó ubicación para guardar el acta.")
            return@rememberLauncherForActivityResult
        }

        val pdfBytes = pdfPendienteGuardar

        if (pdfBytes == null || pdfBytes.isEmpty()) {
            onError("El PDF descargado llegó vacío y no se guardará.")
            return@rememberLauncherForActivityResult
        }

        try {
            context.contentResolver.openOutputStream(uri, "w")?.use { output ->
                output.write(pdfBytes)
                output.flush()
            } ?: throw IllegalStateException("No se pudo abrir la ubicación seleccionada.")

            onMensaje("Acta guardada correctamente: $nombreArchivoPendiente")

            pdfPendienteGuardar = null
            nombreArchivoPendiente = "acta_cliente.pdf"

        } catch (e: Exception) {
            onError("No se pudo guardar el acta: ${e::class.java.simpleName} - ${e.message ?: "sin detalle"}")
        }
    }

    LaunchedEffect(actaSeleccionada?.id, actaSeleccionada?.comentario) {
        comentarioTexto = actaSeleccionada?.comentario ?: ""
    }

    LaunchedEffect(loteProcesoId, loteId) {
        cargando = true

        try {
            val response = RetrofitClient.api.getActasEntregaCliente(
                loteProcesoId = loteProcesoId,
                loteId = loteId
            )

            if (response.isSuccessful) {
                val lista = response.body()?.actas ?: emptyList()
                actas = lista
                actaSeleccionada = lista.firstOrNull()
            } else {
                onError("Error al consultar actas: ${response.errorText()}")
            }
        } catch (e: Exception) {
            onError("Error al consultar actas: ${e.message}")
        } finally {
            cargando = false
        }
    }

    LaunchedEffect(loteProcesoId, loteId) {
        cargando = true

        try {
            val response = RetrofitClient.api.getActasEntregaCliente(
                loteProcesoId = loteProcesoId,
                loteId = loteId
            )

            if (response.isSuccessful) {
                val lista = response.body()?.actas ?: emptyList()
                actas = lista
                actaSeleccionada = lista.firstOrNull()
            } else {
                onError("Error al consultar actas: ${response.errorText()}")
            }
        } catch (e: Exception) {
            onError("Error al consultar actas: ${e.message}")
        } finally {
            cargando = false
        }
    }

    AlertDialog(
        onDismissRequest = onCerrar,
        title = {
            Text(
                text = "Actas generadas",
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 620.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (cargando) {
                    MensajeInfo("Consultando actas generadas...")
                }

                if (!cargando && actas.isEmpty()) {
                    MensajeInfo("No hay actas generadas para este lote.")
                }

                if (descargando) {
                    MensajeInfo("Descargando acta seleccionada...")
                }

                if (actas.isNotEmpty()) {
                    DropdownBase(
                        label = "Seleccione el acta a descargar",
                        value = actaSeleccionada?.let { acta ->
                            "ID ${acta.id ?: "-"} | ${acta.nombre_archivo ?: "Acta"} | Aptos: ${acta.apartamentos ?: "-"}"
                        } ?: "",
                        items = actas,
                        itemLabel = { acta ->
                            "ID ${acta.id ?: "-"} | ${acta.nombre_archivo ?: "Acta"} | Aptos: ${acta.apartamentos ?: "-"} | ${acta.fecha_firma ?: acta.created_at ?: "-"}"
                        },
                        onSelected = { seleccionada ->
                            actaSeleccionada = seleccionada
                        }
                    )

                    val acta = actaSeleccionada

                    if (acta != null) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = "Acta seleccionada",
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary
                                )

                                InfoLine("ID", acta.id?.toString() ?: "-")
                                InfoLine("Cliente", acta.cliente ?: "-")
                                InfoLine("Lote", acta.lote_nombre ?: "-")
                                InfoLine("Apartamentos", acta.apartamentos ?: "-")
                                InfoLine("Fecha firma", acta.fecha_firma ?: "-")
                                InfoLine("Creado", acta.created_at ?: "-")
                                InfoLine("Archivo", acta.nombre_archivo ?: "-")

                                Divider()

                                Text(
                                    text = "Comentario del acta",
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary
                                )

                                OutlinedTextField(
                                    value = comentarioTexto,
                                    onValueChange = { comentarioTexto = it },
                                    label = { Text("Comentario u observación") },
                                    modifier = Modifier.fillMaxWidth(),
                                    minLines = 3
                                )

                                Button(
                                    onClick = {
                                        val actaId = acta.id

                                        if (actaId == null) {
                                            onError("No se pudo identificar el acta seleccionada.")
                                            return@Button
                                        }

                                        scope.launch {
                                            guardandoComentario = true

                                            try {
                                                val response = RetrofitClient.api.actualizarComentarioActaCliente(
                                                    actaId = actaId,
                                                    request = ActualizarComentarioActaClienteRequest(
                                                        comentario = comentarioTexto.trim().ifBlank { null }
                                                    )
                                                )

                                                if (response.isSuccessful) {
                                                    val actaActualizada = response.body()?.acta

                                                    onMensaje(
                                                        response.body()?.mensaje
                                                            ?: "Comentario actualizado correctamente."
                                                    )

                                                    if (actaActualizada != null) {
                                                        actaSeleccionada = actaActualizada

                                                        actas = actas.map { item ->
                                                            if (item.id == actaActualizada.id) {
                                                                actaActualizada
                                                            } else {
                                                                item
                                                            }
                                                        }
                                                    }

                                                } else {
                                                    onError("Error al guardar comentario: ${response.errorText()}")
                                                }

                                            } catch (e: Exception) {
                                                onError(
                                                    "Error al guardar comentario: ${e::class.java.simpleName} - ${e.message ?: "sin detalle"}"
                                                )
                                            } finally {
                                                guardandoComentario = false
                                            }
                                        }
                                    },
                                    enabled = !guardandoComentario,
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = OroViejoAllStar,
                                        contentColor = AzulAllStar
                                    )
                                ) {
                                    Text(
                                        if (guardandoComentario) {
                                            "Guardando comentario..."
                                        } else {
                                            "Guardar comentario"
                                        }
                                    )
                                }

                                if (!acta.azure_blob_url.isNullOrBlank()) {
                                    Text(
                                        text = "Respaldo Azure registrado.",
                                        fontWeight = FontWeight.SemiBold,
                                        color = OroViejoAllStar,
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }

                                Button(
                                    onClick = {
                                        val actaParaDescargar = actaSeleccionada

                                        if (actaParaDescargar?.id == null) {
                                            onError("Debe seleccionar un acta válida para descargar.")
                                            return@Button
                                        }

                                        scope.launch {
                                            descargando = true

                                            try {
                                                onMensaje("Descargando acta ID ${actaParaDescargar.id}...")

                                                val pdfBytes = descargarActaClientePdfBytes(
                                                    actaParaDescargar.id
                                                )

                                                if (pdfBytes.isEmpty()) {
                                                    throw IllegalStateException("El PDF descargado llegó vacío.")
                                                }

                                                val inicio = pdfBytes.take(5).toByteArray().toString(Charsets.UTF_8)

                                                if (!inicio.startsWith("%PDF-")) {
                                                    throw IllegalStateException("El archivo descargado no parece ser PDF. Inicio: $inicio")
                                                }

                                                val nombreArchivo = actaParaDescargar.nombre_archivo
                                                    ?: "acta_cliente_${actaParaDescargar.id}.pdf"

                                                pdfPendienteGuardar = pdfBytes
                                                nombreArchivoPendiente = nombreArchivo

                                                launcherGuardarActaDescargada.launch(nombreArchivo)

                                            } catch (e: Exception) {
                                                onError(
                                                    "No se pudo descargar el acta ID ${actaParaDescargar.id}: " +
                                                            "${e::class.java.simpleName} - ${e.message ?: "sin detalle"}"
                                                )
                                            } finally {
                                                descargando = false
                                            }
                                        }
                                    },
                                    enabled = !descargando,
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = OroViejoAllStar,
                                        contentColor = AzulAllStar
                                    )
                                ) {
                                    Text(
                                        if (descargando) {
                                            "Descargando..."
                                        } else {
                                            "Descargar acta seleccionada"
                                        }
                                    )
                                }

                                Button(
                                    onClick = {
                                        mostrarConfirmacionEliminar = true
                                    },
                                    enabled = !eliminandoActa,
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = TerracotaAllStar,
                                        contentColor = BlancoHuesoAllStar
                                    )
                                ) {
                                    Text(
                                        if (eliminandoActa) {
                                            "Eliminando acta..."
                                        } else {
                                            "Eliminar acta seleccionada"
                                        }
                                    )
                                }



                                if (!acta.mensaje.isNullOrBlank()) {
                                    Divider()

                                    Text(
                                        text = "Mensaje del acta",
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary
                                    )

                                    Text(
                                        text = acta.mensaje,
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                            }
                        }
                    }
                }

                Button(
                    onClick = onVolverAInstalar,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = TerracotaAllStar,
                        contentColor = BlancoHuesoAllStar
                    )
                ) {
                    Text("Volver a instalar")
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onCerrar) {
                Text("Cerrar")
            }
        }
    )

    if (mostrarConfirmacionEliminar) {
        val acta = actaSeleccionada

        AlertDialog(
            onDismissRequest = {
                mostrarConfirmacionEliminar = false
            },
            title = {
                Text(
                    text = "Eliminar acta",
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            },
            text = {
                Text(
                    text = "¿Está seguro de eliminar el acta seleccionada? Esta acción eliminará el registro de la base de datos, pero no borrará todavía el archivo en Azure."
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val actaId = acta?.id

                        if (actaId == null) {
                            onError("No se pudo identificar el acta seleccionada.")
                            mostrarConfirmacionEliminar = false
                            return@Button
                        }

                        scope.launch {
                            eliminandoActa = true

                            try {
                                val response = RetrofitClient.api.eliminarActaEntregaCliente(
                                    actaId = actaId
                                )

                                if (response.isSuccessful) {
                                    onMensaje(
                                        response.body()?.mensaje
                                            ?: "Acta eliminada correctamente."
                                    )

                                    actas = actas.filter { item ->
                                        item.id != actaId
                                    }

                                    actaSeleccionada = actas.firstOrNull()
                                    comentarioTexto = actaSeleccionada?.comentario ?: ""
                                    mostrarConfirmacionEliminar = false
                                } else {
                                    onError("Error al eliminar acta: ${response.errorText()}")
                                }

                            } catch (e: Exception) {
                                onError(
                                    "Error al eliminar acta: ${e::class.java.simpleName} - ${e.message ?: "sin detalle"}"
                                )
                            } finally {
                                eliminandoActa = false
                            }
                        }
                    },
                    enabled = !eliminandoActa,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = TerracotaAllStar,
                        contentColor = BlancoHuesoAllStar
                    )
                ) {
                    Text("Eliminar")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        mostrarConfirmacionEliminar = false
                    }
                ) {
                    Text("Cancelar")
                }
            }
        )
    }
}

suspend fun descargarActaClientePdfBytes(
    actaId: Int
): ByteArray = withContext(Dispatchers.IO) {
    val response = RetrofitClient.api.descargarActaEntregaClientePdf(actaId)

    if (!response.isSuccessful) {
        throw IllegalStateException(
            "Error al descargar acta ID $actaId: ${response.code()} - ${response.errorText()}"
        )
    }

    val body = response.body()
        ?: throw IllegalStateException("La respuesta del PDF llegó vacía para el acta ID $actaId.")

    val bytes = body.bytes()

    if (bytes.isEmpty()) {
        throw IllegalStateException("El PDF del acta ID $actaId llegó con 0 bytes.")
    }

    val inicio = bytes.take(5).toByteArray().toString(Charsets.UTF_8)

    if (!inicio.startsWith("%PDF-")) {
        throw IllegalStateException(
            "La respuesta descargada no parece ser un PDF válido. Inicio recibido: $inicio"
        )
    }

    bytes
}

suspend fun guardarPdfEnDescargas(
    context: Context,
    nombreArchivo: String,
    pdfBytes: ByteArray
): String = withContext(Dispatchers.IO) {
    if (pdfBytes.isEmpty()) {
        throw IllegalStateException("El PDF llegó vacío.")
    }

    val inicio = pdfBytes.take(5).toByteArray().toString(Charsets.UTF_8)

    if (!inicio.startsWith("%PDF-")) {
        throw IllegalStateException("El archivo recibido no es un PDF válido.")
    }

    val nombreLimpio = if (nombreArchivo.lowercase().endsWith(".pdf")) {
        nombreArchivo
    } else {
        "$nombreArchivo.pdf"
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, nombreLimpio)
            put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        }

        val resolver = context.contentResolver

        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: throw IllegalStateException("No se pudo crear el archivo en Descargas.")

        resolver.openOutputStream(uri, "w")?.use { output ->
            output.write(pdfBytes)
            output.flush()
        } ?: throw IllegalStateException("No se pudo escribir el archivo PDF.")

        nombreLimpio
    } else {
        val downloadsDir = Environment.getExternalStoragePublicDirectory(
            Environment.DIRECTORY_DOWNLOADS
        )

        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs()
        }

        val file = File(downloadsDir, nombreLimpio)

        FileOutputStream(file).use { output ->
            output.write(pdfBytes)
            output.flush()
        }

        file.absolutePath
    }
}