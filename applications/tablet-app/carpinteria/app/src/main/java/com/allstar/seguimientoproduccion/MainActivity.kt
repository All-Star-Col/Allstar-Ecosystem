package com.allstar.seguimientoproduccion

import android.os.Bundle
import androidx.activity.ComponentActivity
import com.allstar.seguimientoproduccion.data.api.InventarioCantoResponse
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Button
import androidx.compose.material3.Divider
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.allstar.seguimientoproduccion.data.api.AgregarPiezaMuebleRequest
import com.allstar.seguimientoproduccion.data.api.GenerarTareasProcesoRequest
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
import com.allstar.seguimientoproduccion.data.api.PlanoProyectoData
import kotlinx.coroutines.launch
import retrofit2.Response
import com.allstar.seguimientoproduccion.data.api.InventarioResponse
import com.allstar.seguimientoproduccion.data.api.FirmaInstalacionApartamentoData
enum class Pantalla {
    SELECCION,
    GESTION,
    DESPACHO,
    INSTALACION,

    DESARROLLO_PROYECTO
}


data class SeccionProduccion(
    val key: String,
    val titulo: String,
    val descripcion: String
)


class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            AllStarTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    ProduccionApp()
                }
            }
        }
    }
}


// ============================================================
// HELPERS GENERALES
// ============================================================

fun textoNormalizado(valor: String?): String {
    return valor
        ?.lowercase()
        ?.replace("á", "a")
        ?.replace("é", "e")
        ?.replace("í", "i")
        ?.replace("ó", "o")
        ?.replace("ú", "u")
        ?.replace("ñ", "n")
        ?.trim()
        ?: ""
}


fun apartamentoDeMueble(mueble: MuebleInstalacionResponse): String {
    val apartamento = mueble.apartamento?.trim()

    return if (apartamento.isNullOrBlank()) {
        "Sin apartamento"
    } else {
        apartamento
    }
}


fun apartamentoDeTarea(tarea: TareaProcesoResponse): String {
    val apartamento = tarea.item_apartamento?.trim()

    return if (apartamento.isNullOrBlank()) {
        "Sin apartamento"
    } else {
        apartamento
    }
}


fun textoToDoubleOrNull(valor: String): Double? {
    return valor.replace(",", ".").trim().toDoubleOrNull()
}

fun crearLoteSinLote(
    proyecto: ProyectoResponse,
    proceso: ProcesoResponse
): LoteResponse {
    return LoteResponse(
        lote_proceso_id = 0,
        lote_id = 0,
        id = 0,
        proyecto_id = proyecto.id,
        proceso_id = proceso.id,
        proceso_nombre = proceso.nombre,
        nombre = "Sin lote",
        descripcion = "Consumo manual sin lote definido",
        fecha_programada = null,
        estado = "manual",
        estado_proceso = "manual",
        modo_asignacion = "sin_lote"
    )
}

fun <T> Response<T>.bodySeguro(nombreApi: String): T {
    if (!isSuccessful) {
        throw IllegalStateException("$nombreApi respondió error HTTP ${code()}: ${errorText()}")
    }

    return body()
        ?: throw IllegalStateException("$nombreApi respondió vacío.")
}


// ============================================================
// APP PRINCIPAL
// ============================================================

@Composable
fun ProduccionApp() {
    var pantalla by remember { mutableStateOf(Pantalla.SELECCION) }

    var seccionSeleccionada by remember { mutableStateOf<SeccionProduccion?>(null) }
    var procesoSeleccionado by remember { mutableStateOf<ProcesoResponse?>(null) }
    var proyectoSeleccionado by remember { mutableStateOf<ProyectoResponse?>(null) }
    var loteSeleccionado by remember { mutableStateOf<LoteResponse?>(null) }

    Scaffold(
        topBar = {
            AppTopBar(
                titulo = when (pantalla) {
                    Pantalla.SELECCION -> "Seguimiento Producción"
                    Pantalla.GESTION -> "Gestión de Proceso"
                    Pantalla.DESPACHO -> "Despacho"
                    Pantalla.INSTALACION -> "Instalación"
                    Pantalla.DESARROLLO_PROYECTO -> "Desarrollo de Proyecto"
                }
            )
        }
    ) { padding ->
        when (pantalla) {
            Pantalla.SELECCION -> {
                SeleccionProduccionScreen(
                    modifier = Modifier.padding(padding),
                    onContinuar = { seccion, proceso, proyecto, lote ->
                        seccionSeleccionada = seccion
                        procesoSeleccionado = proceso
                        proyectoSeleccionado = proyecto
                        loteSeleccionado = lote

                        pantalla = when (seccion.key) {
                            "despacho" -> Pantalla.DESPACHO
                            "instalacion" -> Pantalla.INSTALACION
                            "desarrollo_proyecto" -> Pantalla.DESARROLLO_PROYECTO
                            else -> Pantalla.GESTION
                        }
                    }
                )
            }

            Pantalla.GESTION -> {
                GestionProcesoScreen(
                    modifier = Modifier.padding(padding),
                    seccion = seccionSeleccionada,
                    proceso = procesoSeleccionado,
                    proyecto = proyectoSeleccionado,
                    lote = loteSeleccionado,
                    onVolver = { pantalla = Pantalla.SELECCION }
                )
            }

            Pantalla.DESPACHO -> {
                DespachoScreen(
                    modifier = Modifier.padding(padding),
                    seccion = seccionSeleccionada,
                    proceso = procesoSeleccionado,
                    proyecto = proyectoSeleccionado,
                    lote = loteSeleccionado,
                    onVolver = { pantalla = Pantalla.SELECCION }
                )
            }

            Pantalla.INSTALACION -> {
                InstalacionScreen(
                    modifier = Modifier.padding(padding),
                    seccion = seccionSeleccionada,
                    proceso = procesoSeleccionado,
                    proyecto = proyectoSeleccionado,
                    lote = loteSeleccionado,
                    onVolver = { pantalla = Pantalla.SELECCION }
                )
            }

            Pantalla.DESARROLLO_PROYECTO -> {
                DesarrolloProyectoScreen(
                    modifier = Modifier.padding(padding),
                    seccion = seccionSeleccionada,
                    proceso = procesoSeleccionado,
                    proyecto = proyectoSeleccionado,
                    lote = loteSeleccionado,
                    onVolver = { pantalla = Pantalla.SELECCION }
                )
            }
        }
    }
}


// ============================================================
// SELECCIÓN
// ============================================================

@Composable
fun SeleccionProduccionScreen(
    modifier: Modifier = Modifier,
    onContinuar: (
        SeccionProduccion,
        ProcesoResponse,
        ProyectoResponse,
        LoteResponse
    ) -> Unit
) {
    val scope = rememberCoroutineScope()

    val secciones = remember {
        listOf(
            SeccionProduccion(
                key = "piso1",
                titulo = "Piso 1",
                descripcion = "Seccionado, Enchape y Mecanizado"
            ),
            SeccionProduccion(
                key = "piso2",
                titulo = "Piso 2",
                descripcion = "Armado"
            ),
            SeccionProduccion(
                key = "despacho",
                titulo = "Despacho",
                descripcion = "Registro de piezas por mueble"
            ),
            SeccionProduccion(
                key = "instalacion",
                titulo = "Instal.",
                descripcion = "Checklist de llegada de piezas y herrajes"
            ),

            SeccionProduccion(

                key = "desarrollo_proyecto",
                titulo = "Desarrollo",
                descripcion = "consulta de planos PDF por proyecto y lote"
            )

        )
    }

    var seccionSeleccionada by remember { mutableStateOf(secciones.first()) }
    var procesos by remember { mutableStateOf<List<ProcesoResponse>>(emptyList()) }
    var proyectos by remember { mutableStateOf<List<ProyectoResponse>>(emptyList()) }
    var lotes by remember { mutableStateOf<List<LoteResponse>>(emptyList()) }

    var procesoSeleccionado by remember { mutableStateOf<ProcesoResponse?>(null) }
    var proyectoSeleccionado by remember { mutableStateOf<ProyectoResponse?>(null) }
    var loteSeleccionado by remember { mutableStateOf<LoteResponse?>(null) }

    var cargando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var inventarioGeneral by remember { mutableStateOf<List<InventarioResponse>>(emptyList()) }
    var mostrarInventario by remember { mutableStateOf(false) }
    var cargandoInventario by remember { mutableStateOf(false) }
    var mensajePrincipal by remember { mutableStateOf<String?>(null) }

    fun limpiarDesdeProceso() {
        procesoSeleccionado = null
        proyectos = emptyList()
        proyectoSeleccionado = null
        lotes = emptyList()
        loteSeleccionado = null
    }
    fun cargarInventarioGeneral() {
        scope.launch {
            try {
                cargandoInventario = true
                error = null

                inventarioGeneral = RetrofitClient.api
                    .getInventario(null)
                    .bodySeguro("GET /inventario")

                mostrarInventario = true

            } catch (e: Exception) {
                error = "Error al cargar inventario: ${e.message}"
            } finally {
                cargandoInventario = false
            }
        }
    }

    fun cargarLotes(proyecto: ProyectoResponse, proceso: ProcesoResponse) {
        scope.launch {
            try {
                cargando = true
                error = null

                val responseLotes = RetrofitClient.api.getLotes(
                    proyectoId = proyecto.id,
                    procesoId = proceso.id
                )

                val lotesApi = responseLotes.bodySeguro("GET /lotes")
                val loteSinLote = crearLoteSinLote(proyecto, proceso)

                lotes = listOf(loteSinLote) + lotesApi
                loteSeleccionado = lotesApi.firstOrNull() ?: loteSinLote

            } catch (e: Exception) {
                lotes = emptyList()
                loteSeleccionado = null
                error = "Error al cargar lotes: ${e.message}"
            } finally {
                cargando = false
            }
        }
    }

    fun cargarProyectos(proceso: ProcesoResponse) {
        scope.launch {
            try {
                cargando = true
                error = null

                val responseProyectos = RetrofitClient.api.getProyectos(proceso.id)

                proyectos = responseProyectos.bodySeguro("GET /proyectos")
                proyectoSeleccionado = proyectos.firstOrNull()

                val proyecto = proyectoSeleccionado

                if (proyecto != null) {
                    val responseLotes = RetrofitClient.api.getLotes(
                        proyectoId = proyecto.id,
                        procesoId = proceso.id
                    )

                    val lotesApi = responseLotes.bodySeguro("GET /lotes")
                    val loteSinLote = crearLoteSinLote(proyecto, proceso)

                    lotes = listOf(loteSinLote) + lotesApi
                    loteSeleccionado = lotesApi.firstOrNull() ?: loteSinLote
                } else {
                    lotes = emptyList()
                    loteSeleccionado = null
                }

            } catch (e: Exception) {
                proyectos = emptyList()
                proyectoSeleccionado = null
                lotes = emptyList()
                loteSeleccionado = null
                error = "Error al cargar proyectos/lotes: ${e.message}"
            } finally {
                cargando = false
            }
        }
    }

    fun cargarProcesos(seccion: SeccionProduccion) {
        scope.launch {
            try {
                cargando = true
                error = null

                limpiarDesdeProceso()

                val responseProcesos = RetrofitClient.api.getProcesosSeccion(seccion.key)

                procesos = responseProcesos.bodySeguro("GET /procesos-seccion")
                procesoSeleccionado = procesos.firstOrNull()

                val proceso = procesoSeleccionado

                if (proceso != null) {
                    val responseProyectos = RetrofitClient.api.getProyectos(proceso.id)

                    proyectos = responseProyectos.bodySeguro("GET /proyectos")
                    proyectoSeleccionado = proyectos.firstOrNull()

                    val proyecto = proyectoSeleccionado

                    if (proyecto != null) {
                        val responseLotes = RetrofitClient.api.getLotes(
                            proyectoId = proyecto.id,
                            procesoId = proceso.id
                        )

                        val lotesApi = responseLotes.bodySeguro("GET /lotes")
                        val loteSinLote = crearLoteSinLote(proyecto, proceso)

                        lotes = listOf(loteSinLote) + lotesApi
                        loteSeleccionado = lotesApi.firstOrNull() ?: loteSinLote
                    }
                }

            } catch (e: Exception) {
                procesos = emptyList()
                limpiarDesdeProceso()
                error = "Error al cargar ${seccion.titulo}: ${e.message}"
            } finally {
                cargando = false
            }
        }
    }

    LaunchedEffect(Unit) {
        cargarProcesos(seccionSeleccionada)
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(
            text = "Seleccione la sección de trabajo",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        SeccionSelector(
            secciones = secciones,
            selected = seccionSeleccionada,
            onSelected = { seccion ->
                seccionSeleccionada = seccion
                cargarProcesos(seccion)
            }
        )
        BotonesAccionApiInventario(
            cargando = cargando || cargandoInventario,
            onVerInventario = {
                cargarInventarioGeneral()
            },
            onActualizarApi = {
                mensajePrincipal = null
                cargarProcesos(seccionSeleccionada)
                mensajePrincipal = "Información actualizada desde la API."
            }
        )

        if (cargando) {
            MensajeInfo("Cargando información...")
        }

        if (cargandoInventario) {
            MensajeInfo("Cargando inventario...")
        }

        mensajePrincipal?.let {
            MensajeInfo(it)
        }

        error?.let { MensajeError(it) }

        DropdownProceso(
            label = "Proceso",
            procesos = procesos,
            selected = procesoSeleccionado,
            onSelected = { proceso ->
                procesoSeleccionado = proceso
                proyectoSeleccionado = null
                loteSeleccionado = null
                proyectos = emptyList()
                lotes = emptyList()
                cargarProyectos(proceso)
            }
        )

        DropdownProyecto(
            label = "Proyecto",
            proyectos = proyectos,
            selected = proyectoSeleccionado,
            onSelected = { proyecto ->
                proyectoSeleccionado = proyecto
                loteSeleccionado = null
                lotes = emptyList()

                val proceso = procesoSeleccionado

                if (proceso != null) {
                    cargarLotes(proyecto, proceso)
                }
            }
        )

        DropdownLote(
            label = "Lote",
            lotes = lotes,
            selected = loteSeleccionado,
            onSelected = { loteSeleccionado = it }
        )

        ResumenSeleccion(
            seccion = seccionSeleccionada,
            proceso = procesoSeleccionado,
            proyecto = proyectoSeleccionado,
            lote = loteSeleccionado
        )

        Button(
            onClick = {
                val proceso = procesoSeleccionado
                val proyecto = proyectoSeleccionado
                val lote = loteSeleccionado

                if (proceso != null && proyecto != null && lote != null) {
                    onContinuar(seccionSeleccionada, proceso, proyecto, lote)
                }
            },
            enabled = procesoSeleccionado != null &&
                    proyectoSeleccionado != null &&
                    loteSeleccionado != null &&
                    !cargando,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Continuar")
        }

        if (mostrarInventario) {
            InventarioGeneralDialog(
                inventario = inventarioGeneral,
                cargando = cargandoInventario,
                onCerrar = {
                    mostrarInventario = false
                },
                onActualizar = {
                    cargarInventarioGeneral()
                }
            )
        }
    }
}


// ============================================================
// GESTIÓN PISO 1 / PISO 2
// ============================================================

@Composable
fun GestionProcesoScreen(
    modifier: Modifier = Modifier,
    seccion: SeccionProduccion?,
    proceso: ProcesoResponse?,
    proyecto: ProyectoResponse?,
    lote: LoteResponse?,
    onVolver: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    var loteProceso by remember { mutableStateOf<LoteProcesoResponse?>(null) }
    var responsables by remember { mutableStateOf<List<ResponsableResponse>>(emptyList()) }
    var maquinas by remember { mutableStateOf<List<MaquinaResponse>>(emptyList()) }
    var tareas by remember { mutableStateOf<List<TareaProcesoResponse>>(emptyList()) }
    var materiales by remember { mutableStateOf<List<MaterialConsumoDetalleResponse>>(emptyList()) }
    var inventarioCantos by remember { mutableStateOf<List<InventarioCantoResponse>>(emptyList()) }
    var inventarioGeneral by remember { mutableStateOf<List<InventarioResponse>>(emptyList()) }
    var mostrarInventario by remember { mutableStateOf(false) }
    var cargandoInventario by remember { mutableStateOf(false) }
    var apartamentoArmadoSeleccionado by remember { mutableStateOf<String?>(null) }

    var mensaje by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var cargando by remember { mutableStateOf(false) }

    val esArmado = textoNormalizado(proceso?.nombre) == "armado"
    val esEnchape = textoNormalizado(proceso?.nombre) == "enchape"
    val esSinLote = lote?.lote_id == 0 || lote?.lote_proceso_id == 0

    suspend fun cargarInventarioGeneral() {
        cargandoInventario = true

        try {
            inventarioGeneral = RetrofitClient.api
                .getInventario(null)
                .bodySeguro("GET /inventario")
        } finally {
            cargandoInventario = false
        }
    }

    suspend fun reload() {
        val loteProcesoId = lote?.lote_proceso_id ?: return
        val loteId = lote.lote_id
        val procesoId = proceso?.id ?: return

        cargando = true

        try {
            loteProceso = RetrofitClient.api
                .getLoteProceso(loteProcesoId)
                .bodySeguro("GET /lote-proceso")

            responsables = RetrofitClient.api
                .getResponsables(procesoId)
                .bodySeguro("GET /responsables")

            maquinas = RetrofitClient.api
                .getMaquinas(procesoId)
                .bodySeguro("GET /maquinas")

            /**
             * IMPORTANTE:
             * Primero intentamos traer tareas.
             * Solo si no existen, las generamos.
             * Así evitamos ejecutar generarTareasProceso en cada recarga,
             * porque eso puede volver lento el módulo de Armado.
             */
            var tareasCargadas = RetrofitClient.api
                .getTareasProceso(loteProcesoId)
                .bodySeguro("GET /tareas-proceso")

            if (tareasCargadas.isEmpty()) {
                val generarResponse = RetrofitClient.api.generarTareasProceso(
                    GenerarTareasProcesoRequest(lote_proceso_id = loteProcesoId)
                )

                if (!generarResponse.isSuccessful) {
                    error = "Advertencia al generar tareas: ${generarResponse.errorText()}"
                }

                tareasCargadas = RetrofitClient.api
                    .getTareasProceso(loteProcesoId)
                    .bodySeguro("GET /tareas-proceso")
            }

            tareas = tareasCargadas

            materiales = if (esArmado || esEnchape) {
                emptyList()
            } else {
                RetrofitClient.api
                    .getMaterialesConsumoDetalle(loteId, procesoId)
                    .bodySeguro("GET /materiales-consumo-detalle")
            }

            inventarioCantos = if (esEnchape) {
                RetrofitClient.api
                    .getInventarioCantos()
                    .bodySeguro("GET /inventario-cantos")
            } else {
                emptyList()
            }

        } finally {
            cargando = false
        }
    }

    LaunchedEffect(lote?.lote_proceso_id, lote?.lote_id) {
        try {
            error = null
            mensaje = null

            if (esSinLote) {
                cargarInventarioGeneral()
                mensaje = "Modo consumo sin lote activo."
            } else {
                reload()
            }

        } catch (e: Exception) {
            error = "Error al cargar gestión: ${e.message}"
        }
    }

    val apartamentosArmado = remember(tareas) {
        tareas
            .map { apartamentoDeTarea(it) }
            .distinct()
            .sortedWith(compareBy<String> { it == "Sin apartamento" }.thenBy { it })
    }

    LaunchedEffect(apartamentosArmado) {
        if (apartamentoArmadoSeleccionado == null && apartamentosArmado.isNotEmpty()) {
            apartamentoArmadoSeleccionado = apartamentosArmado.first()
        }

        if (
            apartamentoArmadoSeleccionado != null &&
            apartamentosArmado.isNotEmpty() &&
            apartamentoArmadoSeleccionado !in apartamentosArmado
        ) {
            apartamentoArmadoSeleccionado = apartamentosArmado.first()
        }
    }

    val tareasFiltradas = remember(esArmado, apartamentoArmadoSeleccionado, tareas) {
        if (!esArmado || apartamentoArmadoSeleccionado.isNullOrBlank()) {
            tareas
        } else {
            tareas.filter { tarea ->
                apartamentoDeTarea(tarea) == apartamentoArmadoSeleccionado
            }
        }
    }

    Box(
        modifier = modifier.fillMaxSize()
    ) {
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(
                top = 14.dp,
                bottom = 90.dp
            )
        ) {
            item {
                BotonVolver(onVolver)
            }

            item {
                ResumenSeleccion(seccion, proceso, proyecto, lote)
            }

            if (esSinLote) {
                item {
                    ConsumoSinLoteCard(
                        proyecto = proyecto,
                        inventario = inventarioGeneral,
                        cargandoInventario = cargandoInventario,
                        scope = scope,
                        onMensaje = { mensaje = it },
                        onError = { error = it },
                        onReloadInventario = {
                            try {
                                cargarInventarioGeneral()
                            } catch (e: Exception) {
                                error = "Error al recargar inventario: ${e.message}"
                            }
                        }
                    )
                }
            }

            item {
                BotonesAccionApiInventario(
                    cargando = cargando || cargandoInventario,
                    onVerInventario = {
                        scope.launch {
                            try {
                                error = null
                                cargarInventarioGeneral()
                                mostrarInventario = true
                            } catch (e: Exception) {
                                error = "Error al cargar inventario: ${e.message}"
                            }
                        }
                    },
                    onActualizarApi = {
                        scope.launch {
                            try {
                                error = null
                                mensaje = null
                                reload()
                                mensaje = "Información actualizada desde la API."
                            } catch (e: Exception) {
                                error = "Error al actualizar información: ${e.message}"
                            }
                        }
                    }
                )
            }

            if (cargando) {
                item {
                    MensajeInfo("Cargando proceso...")
                }
            }

            mensaje?.let {
                item {
                    MensajeInfo(it)
                }
            }

            error?.let {
                item {
                    MensajeError(it)
                }
            }

            if (!esSinLote) {
                loteProceso?.let { lp ->
                    item {
                        ControlProcesoGeneralCard(
                            loteProceso = lp,
                            responsables = responsables,
                            maquinas = maquinas,
                            scope = scope,
                            onMensaje = { mensaje = it },
                            onError = { error = it },
                            onReload = {
                                try {
                                    reload()
                                } catch (e: Exception) {
                                    error = "Error al recargar: ${e.message}"
                                }
                            }
                        )
                    }
                }

                if (esArmado) {
                    // Todo el bloque actual de armado
                }

                item {
                    Text(
                        text = "Tareas internas",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }

                // Todo el bloque actual de tareas internas

                if (!esArmado) {
                    // Todo el bloque actual de consumo con lote
                }
            }

            if (esArmado) {
                item {
                    Text(
                        text = "Armado por apartamento",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }

                item {
                    DropdownString(
                        label = "Apartamento",
                        values = apartamentosArmado,
                        selected = apartamentoArmadoSeleccionado ?: "",
                        onSelected = { apartamentoSeleccionado ->
                            apartamentoArmadoSeleccionado = apartamentoSeleccionado

                            scope.launch {
                                listState.animateScrollToItem(0)
                            }
                        }
                    )
                }

                item {
                    Text(
                        text = if (apartamentoArmadoSeleccionado.isNullOrBlank()) {
                            "Seleccione un apartamento."
                        } else {
                            "Apartamento: $apartamentoArmadoSeleccionado | Tareas: ${tareasFiltradas.size}"
                        },
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            item {
                Text(
                    text = "Tareas internas",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            if (tareasFiltradas.isEmpty() && !cargando) {
                item {
                    MensajeInfo("No hay tareas internas para mostrar.")
                }
            } else {
                items(
                    items = tareasFiltradas,
                    key = { tarea ->
                        tarea.id
                    }
                ) { tarea ->
                    TareaProcesoCard(
                        tarea = tarea,
                        responsables = responsables,
                        maquinas = maquinas,
                        scope = scope,
                        onMensaje = { mensaje = it },
                        onError = { error = it },
                        onReload = {
                            try {
                                reload()
                            } catch (e: Exception) {
                                error = "Error al recargar tareas: ${e.message}"
                            }
                        }
                    )
                }
            }

            if (!esArmado) {
                if (esEnchape) {
                    item {
                        Text(
                            text = "Consumo real de cantos",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }

                    item {
                        ConsumoCantosEnchapeCard(
                            cantos = inventarioCantos,
                            loteProcesoId = lote?.lote_proceso_id ?: 0,
                            scope = scope,
                            onMensaje = { mensaje = it },
                            onError = { error = it },
                            onReload = {
                                try {
                                    reload()
                                } catch (e: Exception) {
                                    error = "Error al recargar cantos: ${e.message}"
                                }
                            }
                        )
                    }
                } else {
                    item {
                        Text(
                            text = "Materiales requeridos",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }

                    if (materiales.isEmpty() && !cargando) {
                        item {
                            MensajeInfo("No hay materiales para mostrar.")
                        }
                    } else {
                        items(
                            items = materiales,
                            key = { material ->
                                material.material_id
                            }
                        ) { material ->
                            MaterialConsumoCard(
                                material = material,
                                loteProcesoId = lote?.lote_proceso_id ?: 0,
                                scope = scope,
                                onMensaje = { mensaje = it },
                                onError = { error = it },
                                onReload = {
                                    try {
                                        reload()
                                    } catch (e: Exception) {
                                        error = "Error al recargar materiales: ${e.message}"
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }


        if (mostrarInventario) {
            InventarioGeneralDialog(
                inventario = inventarioGeneral,
                cargando = cargandoInventario,
                onCerrar = { mostrarInventario = false },
                onActualizar = {
                    scope.launch {
                        try {
                            error = null
                            cargarInventarioGeneral()
                            mensaje = "Inventario actualizado desde la API."
                        } catch (e: Exception) {
                            error = "Error al actualizar inventario: ${e.message}"
                        }
                    }
                }
            )
        }

        FloatingActionButton(
            onClick = {
                scope.launch {
                    listState.animateScrollToItem(0)
                }
            },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp)
        ) {
            Text("Subir")
        }
    }
}


// ============================================================
// DESPACHO
// ============================================================

@Composable
fun DespachoScreen(
    modifier: Modifier = Modifier,
    seccion: SeccionProduccion?,
    proceso: ProcesoResponse?,
    proyecto: ProyectoResponse?,
    lote: LoteResponse?,
    onVolver: () -> Unit
) {
    val scope = rememberCoroutineScope()

    var loteProceso by remember { mutableStateOf<LoteProcesoResponse?>(null) }
    var responsables by remember { mutableStateOf<List<ResponsableResponse>>(emptyList()) }
    var maquinas by remember { mutableStateOf<List<MaquinaResponse>>(emptyList()) }
    var muebles by remember { mutableStateOf<List<MuebleLoteResponse>>(emptyList()) }
    var piezasCatalogo by remember { mutableStateOf<List<PiezaResponse>>(emptyList()) }
    var piezasMueble by remember { mutableStateOf<List<PiezaMuebleResponse>>(emptyList()) }

    var muebleSeleccionado by remember { mutableStateOf<MuebleLoteResponse?>(null) }
    var piezaSeleccionada by remember { mutableStateOf<PiezaResponse?>(null) }

    var cantidadTexto by remember { mutableStateOf("1") }
    var largoTexto by remember { mutableStateOf("") }
    var anchoTexto by remember { mutableStateOf("") }
    var espesorTexto by remember { mutableStateOf("") }
    var materialTexto by remember { mutableStateOf("") }
    var notasPiezaTexto by remember { mutableStateOf("") }

    var mensaje by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var cargando by remember { mutableStateOf(false) }

    suspend fun reload() {
        val loteProcesoId = lote?.lote_proceso_id ?: return
        val loteId = lote.lote_id
        val procesoId = proceso?.id ?: return

        cargando = true

        try {
            loteProceso = RetrofitClient.api
                .getLoteProceso(loteProcesoId)
                .bodySeguro("GET /lote-proceso")

            responsables = RetrofitClient.api
                .getResponsables(procesoId)
                .bodySeguro("GET /responsables")

            maquinas = RetrofitClient.api
                .getMaquinas(procesoId)
                .bodySeguro("GET /maquinas")

            muebles = RetrofitClient.api
                .getMueblesLote(loteId)
                .bodySeguro("GET /muebles-lote")

            piezasCatalogo = RetrofitClient.api
                .getPiezas()
                .bodySeguro("GET /piezas")

            piezasMueble = RetrofitClient.api
                .getPiezasMueble(loteId, null)
                .bodySeguro("GET /piezas-mueble")

            if (muebleSeleccionado == null) {
                muebleSeleccionado = muebles.firstOrNull()
            }

            if (piezaSeleccionada == null) {
                piezaSeleccionada = piezasCatalogo.firstOrNull()
            }

        } finally {
            cargando = false
        }
    }

    LaunchedEffect(lote?.lote_proceso_id) {
        try {
            error = null
            reload()
        } catch (e: Exception) {
            error = "Error al cargar despacho: ${e.message}"
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        BotonVolver(onVolver)

        ResumenSeleccion(seccion, proceso, proyecto, lote)

        if (cargando) {
            MensajeInfo("Cargando despacho...")
        }

        mensaje?.let { MensajeInfo(it) }
        error?.let { MensajeError(it) }

        loteProceso?.let { lp ->
            ControlProcesoGeneralCard(
                loteProceso = lp,
                responsables = responsables,
                maquinas = maquinas,
                scope = scope,
                onMensaje = { mensaje = it },
                onError = { error = it },
                onReload = {
                    try {
                        reload()
                    } catch (e: Exception) {
                        error = "Error al recargar despacho: ${e.message}"
                    }
                }
            )
        }

        Text(
            text = "Registro de piezas por mueble",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        DropdownMuebleLote(
            label = "Mueble",
            muebles = muebles,
            selected = muebleSeleccionado,
            onSelected = { muebleSeleccionado = it }
        )

        DropdownPieza(
            label = "Pieza",
            piezas = piezasCatalogo,
            selected = piezaSeleccionada,
            onSelected = { piezaSeleccionada = it }
        )

        OutlinedTextField(
            value = cantidadTexto,
            onValueChange = { cantidadTexto = it },
            label = { Text("Cantidad") },
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = largoTexto,
            onValueChange = { largoTexto = it },
            label = { Text("Largo mm") },
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = anchoTexto,
            onValueChange = { anchoTexto = it },
            label = { Text("Ancho mm") },
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = espesorTexto,
            onValueChange = { espesorTexto = it },
            label = { Text("Espesor mm") },
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = materialTexto,
            onValueChange = { materialTexto = it },
            label = { Text("Material") },
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = notasPiezaTexto,
            onValueChange = { notasPiezaTexto = it },
            label = { Text("Notas de pieza") },
            modifier = Modifier.fillMaxWidth()
        )

        Button(
            onClick = {
                val loteId = lote?.lote_id
                val mueble = muebleSeleccionado
                val pieza = piezaSeleccionada
                val cantidad = textoToDoubleOrNull(cantidadTexto)

                val largo = textoToDoubleOrNull(largoTexto)
                val ancho = textoToDoubleOrNull(anchoTexto)
                val espesor = textoToDoubleOrNull(espesorTexto)

                if (loteId == null || mueble == null || pieza == null || cantidad == null || cantidad <= 0) {
                    error = "Debe seleccionar mueble, pieza y una cantidad válida."
                    return@Button
                }

                scope.launch {
                    try {
                        val response = RetrofitClient.api.agregarPiezaMueble(
                            AgregarPiezaMuebleRequest(
                                lote_id = loteId,
                                items_proyecto_id = mueble.id,
                                pieza = pieza.pieza,
                                cantidad = cantidad,
                                llegada = false,
                                pieza_id = pieza.id,
                                largo_mm = largo,
                                ancho_mm = ancho,
                                espesor_mm = espesor,
                                material = materialTexto.ifBlank { null },
                                descripcion_original = pieza.pieza,
                                encabezado_mueble = mueble.label ?: mueble.nombre,
                                match_tipo = "pieza",
                                match_observacion = notasPiezaTexto.ifBlank { null },
                                notas = notasPiezaTexto.ifBlank { null }
                            )
                        )

                        if (response.isSuccessful) {
                            mensaje = response.body()?.mensaje ?: "Pieza registrada correctamente."

                            cantidadTexto = "1"
                            largoTexto = ""
                            anchoTexto = ""
                            espesorTexto = ""
                            materialTexto = ""
                            notasPiezaTexto = ""

                            reload()
                        } else {
                            error = "Error al agregar pieza: ${response.errorText()}"
                        }
                    } catch (e: Exception) {
                        error = "Error al agregar pieza: ${e.message}"
                    }
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Agregar pieza al mueble")
        }

        Divider()

        Text(
            text = "Piezas registradas",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        if (piezasMueble.isEmpty()) {
            MensajeInfo("Aún no hay piezas registradas para este lote.")
        } else {
            piezasMueble.groupBy { it.items_proyecto_id }.forEach { (_, piezas) ->
                PiezasRegistradasCard(piezas)
            }
        }
    }
}


// ============================================================
// INSTALACIÓN
// ============================================================

@Composable
fun InstalacionScreen(
    modifier: Modifier = Modifier,
    seccion: SeccionProduccion?,
    proceso: ProcesoResponse?,
    proyecto: ProyectoResponse?,
    lote: LoteResponse?,
    onVolver: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    var loteProceso by remember { mutableStateOf<LoteProcesoResponse?>(null) }
    var responsables by remember { mutableStateOf<List<ResponsableResponse>>(emptyList()) }
    var maquinas by remember { mutableStateOf<List<MaquinaResponse>>(emptyList()) }
    var mueblesInstalacion by remember { mutableStateOf<List<MuebleInstalacionResponse>>(emptyList()) }
    var firmasApartamentos by remember { mutableStateOf<List<FirmaInstalacionApartamentoData>>(emptyList()) }
    var apartamentoSeleccionado by remember { mutableStateOf<String?>(null) }
    var mostrarActaCliente by remember { mutableStateOf(false) }

    var mensaje by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var cargando by remember { mutableStateOf(false) }

    suspend fun reload() {
        val loteProcesoId = lote?.lote_proceso_id ?: return
        val procesoId = proceso?.id ?: return

        cargando = true

        try {
            loteProceso = RetrofitClient.api
                .getLoteProceso(loteProcesoId)
                .bodySeguro("GET /lote-proceso")

            responsables = RetrofitClient.api
                .getResponsables(procesoId)
                .bodySeguro("GET /responsables")

            maquinas = RetrofitClient.api
                .getMaquinas(procesoId)
                .bodySeguro("GET /maquinas")

            mueblesInstalacion = RetrofitClient.api
                .getMueblesInstalacion(loteProcesoId)
                .bodySeguro("GET /muebles-instalacion")

            firmasApartamentos = RetrofitClient.api
                .getFirmasInstalacionApartamentos(loteProcesoId)
                .bodySeguro("GET /firmas-instalacion-apartamentos")
                .firmas

            val apartamentosDetectados = mueblesInstalacion
                .map { apartamentoDeMueble(it) }
                .distinct()
                .sortedWith(compareBy<String> { it == "Sin apartamento" }.thenBy { it })

            if (apartamentoSeleccionado == null && apartamentosDetectados.isNotEmpty()) {
                apartamentoSeleccionado = apartamentosDetectados.first()
            }

            if (
                apartamentoSeleccionado != null &&
                apartamentosDetectados.isNotEmpty() &&
                apartamentoSeleccionado !in apartamentosDetectados
            ) {
                apartamentoSeleccionado = apartamentosDetectados.first()
            }

        } finally {
            cargando = false
        }
    }

    fun actualizarPiezaLocal(piezaId: Int, llegada: Boolean) {
        mueblesInstalacion = mueblesInstalacion.map { mueble ->
            val piezasActualizadas = mueble.piezas.map { pieza ->
                if (pieza.id == piezaId) {
                    pieza.copy(llegada = llegada)
                } else {
                    pieza
                }
            }

            val piezasRecibidas = piezasActualizadas.count { it.llegada }

            mueble.copy(
                piezas = piezasActualizadas,
                piezas_recibidas = piezasRecibidas,
                piezas_total = piezasActualizadas.size,
                completo = piezasActualizadas.isNotEmpty() && piezasRecibidas == piezasActualizadas.size
            )
        }
    }

    fun completarMuebleLocal(itemId: Int) {
        mueblesInstalacion = mueblesInstalacion.map { mueble ->
            if (mueble.item_id == itemId) {
                val piezasCompletadas = mueble.piezas.map { pieza ->
                    pieza.copy(llegada = true)
                }

                mueble.copy(
                    piezas = piezasCompletadas,
                    piezas_recibidas = piezasCompletadas.size,
                    piezas_total = piezasCompletadas.size,
                    completo = piezasCompletadas.isNotEmpty()
                )
            } else {
                mueble
            }
        }
    }

    LaunchedEffect(lote?.lote_proceso_id) {
        try {
            error = null
            reload()
        } catch (e: Exception) {
            error = "Error al cargar instalación: ${e.message}"
        }
    }

    val apartamentos = remember(mueblesInstalacion) {
        mueblesInstalacion
            .map { apartamentoDeMueble(it) }
            .distinct()
            .sortedWith(compareBy<String> { it == "Sin apartamento" }.thenBy { it })
    }

    val mueblesFiltrados = remember(apartamentoSeleccionado, mueblesInstalacion) {
        val apartamento = apartamentoSeleccionado

        if (apartamento.isNullOrBlank()) {
            emptyList()
        } else {
            mueblesInstalacion.filter { mueble ->
                apartamentoDeMueble(mueble) == apartamento
            }
        }
    }

    val firmaApartamentoSeleccionado = remember(
        apartamentoSeleccionado,
        firmasApartamentos
    ) {
        firmasApartamentos.firstOrNull { firma ->
            firma.apartamento?.trim() == apartamentoSeleccionado?.trim()
        }
    }

    Box(
        modifier = modifier.fillMaxSize()
    ) {
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(
                top = 14.dp,
                bottom = 90.dp
            )
        ) {
            item {
                BotonVolver(onVolver)
            }

            item {
                ResumenSeleccion(seccion, proceso, proyecto, lote)
            }

            if (cargando) {
                item {
                    MensajeInfo("Cargando instalación...")
                }
            }

            mensaje?.let {
                item {
                    MensajeInfo(it)
                }
            }

            error?.let {
                item {
                    MensajeError(it)
                }
            }

            loteProceso?.let { lp ->
                item {
                    ControlProcesoGeneralCard(
                        loteProceso = lp,
                        responsables = responsables,
                        maquinas = maquinas,
                        scope = scope,
                        onMensaje = { mensaje = it },
                        onError = { error = it },
                        onReload = {
                            try {
                                reload()
                            } catch (e: Exception) {
                                error = "Error al recargar instalación: ${e.message}"
                            }
                        }
                    )
                }
            }

            item {
                Text(
                    text = "Checklist de instalación",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            item {
                Button(
                    onClick = { mostrarActaCliente = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Acta cliente")
                }
            }


            item {
                DropdownString(
                    label = "Apartamento",
                    values = apartamentos,
                    selected = apartamentoSeleccionado ?: "",
                    onSelected = { seleccionado ->
                        apartamentoSeleccionado = seleccionado

                        scope.launch {
                            listState.animateScrollToItem(0)
                        }
                    }
                )
            }

            item {
                Text(
                    text = if (apartamentoSeleccionado.isNullOrBlank()) {
                        "Seleccione un apartamento para cargar el checklist."
                    } else {
                        "Apartamento: ${apartamentoSeleccionado} | Muebles: ${mueblesFiltrados.size}"
                    },
                    style = MaterialTheme.typography.bodySmall
                )
            }

            if (apartamentos.isEmpty() && !cargando) {
                item {
                    MensajeInfo("No hay apartamentos detectados para este lote.")
                }
            } else if (mueblesFiltrados.isEmpty() && !cargando) {
                item {
                    MensajeInfo("No hay muebles para el apartamento seleccionado.")
                }
            } else {
                item {
                    ApartamentoInstalacionCard(
                        apartamento = apartamentoSeleccionado ?: "Sin apartamento",
                        muebles = mueblesFiltrados,
                        loteId = lote?.lote_id ?: 0,
                        loteProcesoId = lote?.lote_proceso_id ?: 0,
                        cliente = proyecto?.cliente,
                        firmaApartamento = firmaApartamentoSeleccionado,
                        responsables = responsables,
                        scope = scope,
                        onMensaje = { mensaje = it },
                        onError = { error = it },
                        onReload = {
                            try {
                                reload()
                            } catch (e: Exception) {
                                error = "Error al recargar apartamento: ${e.message}"
                            }
                        }
                    )
                }
            }
        }
        if (mostrarActaCliente) {
            ActaClienteDialog(
                cliente = proyecto?.cliente,
                loteNombre = lote?.nombre ?: lote?.descripcion ?: "Lote ${lote?.lote_id ?: ""}",
                loteProcesoId = lote?.lote_proceso_id ?: 0,
                loteId = lote?.lote_id,
                firmasApartamentos = firmasApartamentos,
                scope = scope,
                onCerrar = { mostrarActaCliente = false },
                onMensaje = { mensaje = it },
                onError = { error = it }
            )
        }

        FloatingActionButton(
            onClick = {
                scope.launch {
                    listState.animateScrollToItem(0)
                }
            },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp)
        ) {
            Text("Subir")
        }
    }
}

@Composable
fun DesarrolloProyectoScreen(
    modifier: Modifier = Modifier,
    seccion: SeccionProduccion?,
    proceso: ProcesoResponse?,
    proyecto: ProyectoResponse?,
    lote: LoteResponse?,
    onVolver: () -> Unit
) {
    val scope = rememberCoroutineScope()

    var planos by remember { mutableStateOf<List<PlanoProyectoData>>(emptyList()) }
    var planoSeleccionado by remember { mutableStateOf<PlanoProyectoData?>(null) }

    var mensaje by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var cargando by remember { mutableStateOf(false) }

    suspend fun cargarPlanos() {
        val proyectoId = proyecto?.id

        if (proyectoId == null) {
            error = "Debe seleccionar un proyecto."
            return
        }

        val loteId = lote?.lote_id?.takeIf { it != 0 }

        cargando = true

        try {
            val response = RetrofitClient.api.getPlanosProyecto(
                proyectoId = proyectoId,
                loteId = loteId
            )

            if (response.isSuccessful) {
                planos = response.body()?.planos ?: emptyList()
                planoSeleccionado = planos.firstOrNull()
            } else {
                error = "Error al cargar planos: ${response.errorText()}"
            }
        } finally {
            cargando = false
        }
    }

    LaunchedEffect(proyecto?.id, lote?.lote_id) {
        try {
            error = null
            mensaje = null
            cargarPlanos()
        } catch (e: Exception) {
            error = "Error al cargar desarrollo de proyecto: ${e.message}"
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        BotonVolver(onVolver)

        ResumenSeleccion(
            seccion = seccion,
            proceso = proceso,
            proyecto = proyecto,
            lote = lote
        )

        Text(
            text = "Planos PDF del proyecto",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        if (cargando) {
            MensajeInfo("Cargando planos PDF...")
        }

        mensaje?.let { MensajeInfo(it) }
        error?.let { MensajeError(it) }

        if (!cargando && planos.isEmpty()) {
            MensajeInfo("No hay planos PDF cargados para este proyecto/lote.")
        }

        if (planos.isNotEmpty()) {
            DropdownBase(
                label = "Seleccione un plano",
                value = planoSeleccionado?.let { plano ->
                    plano.nombre_plano
                        ?: plano.nombre_archivo
                        ?: "Plano ${plano.id ?: ""}"
                } ?: "",
                items = planos,
                itemLabel = { plano ->
                    val nombre = plano.nombre_plano
                        ?: plano.nombre_archivo
                        ?: "Plano ${plano.id ?: ""}"

                    val fecha = plano.created_at ?: "-"

                    "$nombre | $fecha"
                },
                onSelected = { seleccionado ->
                    planoSeleccionado = seleccionado
                }
            )

            val plano = planoSeleccionado

            if (plano != null) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                    colors = androidx.compose.material3.CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = plano.nombre_plano ?: "Plano sin nombre",
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )

                        InfoLine("ID", plano.id?.toString() ?: "-")
                        InfoLine("Archivo", plano.nombre_archivo ?: "-")
                        InfoLine("Proyecto", plano.proyecto_nombre ?: proyecto?.nombre ?: "-")
                        InfoLine("Lote", plano.lote_nombre ?: lote?.nombre ?: lote?.descripcion ?: "-")
                        InfoLine("Cliente", plano.cliente ?: proyecto?.cliente ?: "-")
                        InfoLine("Fecha", plano.created_at ?: "-")

                        if (!plano.descripcion.isNullOrBlank()) {
                            Text(
                                text = plano.descripcion,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }

                        if (!plano.azure_blob_url.isNullOrBlank()) {
                            Text(
                                text = "Plano respaldado en Azure.",
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.SemiBold,
                                color = OroViejoAllStar
                            )
                        }

                        Button(
                            onClick = {
                                mensaje = "El plano está listado correctamente. En el siguiente paso conectamos la descarga PDF."
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = OroViejoAllStar,
                                contentColor = AzulAllStar
                            )
                        ) {
                            Text("Verificar plano seleccionado")
                        }
                    }
                }
            }
        }

        Button(
            onClick = {
                scope.launch {
                    try {
                        error = null
                        cargarPlanos()
                        mensaje = "Planos actualizados desde la API."
                    } catch (e: Exception) {
                        error = "Error al actualizar planos: ${e.message}"
                    }
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Actualizar planos")
        }
    }
}