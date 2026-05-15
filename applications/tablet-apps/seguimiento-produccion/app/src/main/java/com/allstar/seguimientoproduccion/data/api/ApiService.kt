package com.allstar.seguimientoproduccion.data.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query


// ============================================================
// RESPUESTAS GENERALES
// ============================================================

data class HealthResponse(
    val ok: Boolean = false,
    val mensaje: String? = null,
    val status: String? = null,
    val db_ok: Boolean? = null,
    val database: String? = null,
    val schema: String? = null,
    val current_schema: String? = null,
    val now: String? = null,
    val tablas: List<String> = emptyList(),
    val error: String? = null
)

data class GenericResponse(
    val ok: Boolean = false,
    val mensaje: String? = null,
    val error: String? = null
)

data class GenerarTareasResponse(
    val ok: Boolean = false,
    val mensaje: String? = null,
    val creadas: Int = 0,
    val modo_asignacion: String? = null
)

data class AgregarPiezaMuebleResponse(
    val ok: Boolean = false,
    val mensaje: String? = null,
    val id: Int? = null
)

data class CompletarPiezasMuebleResponse(
    val ok: Boolean = false,
    val mensaje: String? = null,
    val lote_id: Int? = null,
    val items_proyecto_id: Int? = null,
    val piezas_total: Int? = null,
    val piezas_actualizadas: Int? = null
)


// ============================================================
// PROCESOS / PROYECTOS / LOTES
// ============================================================

data class ProcesoResponse(
    val id: Int = 0,
    val nombre: String = "",
    val nombre_excel: String? = null,
    val piso: Int? = null,
    val seccion: String? = null,
    val modo_asignacion: String? = null,
    val requiere_consumo: Boolean = false,
    val categoria_consumo: String? = null
)

data class ProyectoResponse(
    val id: Int = 0,
    val nombre: String = "",
    val cliente: String? = null
)

data class LoteResponse(
    val lote_proceso_id: Int = 0,
    val lote_id: Int = 0,
    val id: Int? = null,
    val proyecto_id: Int? = null,
    val proceso_id: Int = 0,
    val proceso_nombre: String? = null,
    val nombre: String? = null,
    val descripcion: String? = null,
    val fecha_programada: String? = null,
    val estado: String? = null,
    val estado_proceso: String? = null,
    val modo_asignacion: String? = null
)

data class LoteProcesoResponse(
    val lote_proceso_id: Int = 0,
    val id: Int? = null,
    val lote_id: Int = 0,
    val lote_nombre: String? = null,
    val proyecto_id: Int? = null,
    val proyecto_nombre: String? = null,
    val cliente: String? = null,
    val proceso_id: Int = 0,
    val proceso_nombre: String? = null,
    val proceso_seccion: String? = null,
    val modo_asignacion: String? = null,
    val fecha_programada: String? = null,
    val fecha_inicio_real: String? = null,
    val fecha_fin_real: String? = null,
    val responsable_id: Int? = null,
    val maquina_id: Int? = null,
    val estado: String? = null,
    val motivos_bloqueo: String? = null,
    val motivo_bloqueo: String? = null,
    val notas: String? = null
)

data class ModoProcesoResponse(
    val lote_proceso_id: Int = 0,
    val lote_id: Int? = null,
    val proceso_id: Int? = null,
    val proceso_nombre: String? = null,
    val modo_asignacion: String? = null
)


// ============================================================
// RESPONSABLES Y MÁQUINAS
// ============================================================

data class ResponsableResponse(
    val id: Int = 0,
    val nombre: String = "",
    val proceso_id: Int? = null,
    val area_id: Int? = null,
    val activo: Boolean? = null
)

data class MaquinaResponse(
    val id: Int = 0,
    val nombre: String = "",
    val proceso_id: Int? = null,
    val activo: Boolean? = null,
    val horas_dia_disponible: Double? = null,
    val horas_dia_disponibles: Double? = null
)


// ============================================================
// MUEBLES
// ============================================================

data class MuebleLoteResponse(
    val id: Int = 0,
    val lote_id: Int = 0,
    val nombre: String? = null,
    val descripcion: String? = null,
    val estado: String? = null,
    val piso: Int? = null,
    val apartamento: String? = null,
    val label: String? = null
)


// ============================================================
// MATERIALES E INVENTARIO
// ============================================================

data class MaterialConsumoResponse(
    val material_id: Int = 0,
    val material_nombre: String? = null,
    val categoria: String? = null,
    val unidad_medida: String? = null,
    val cantidad_programada: Double? = null,
    val cantidad_disponible: Double? = null,
    val cantidad_faltante: Double? = null,
    val existe_catalogo: Boolean = true,
    val advertencia_catalogo: String? = null
)

data class MuebleMaterialDetalleResponse(
    val item_id: Int = 0,
    val item_nombre: String? = null,
    val piso: Int? = null,
    val apartamento: String? = null,
    val cantidad_programada: Double? = null
)

data class MaterialConsumoDetalleResponse(
    val material_id: Int = 0,
    val material_nombre: String? = null,
    val categoria: String? = null,
    val unidad_medida: String? = null,
    val cantidad_programada: Double? = null,
    val cantidad_disponible: Double? = null,
    val cantidad_faltante: Double? = null,
    val existe_catalogo: Boolean = true,
    val advertencia_catalogo: String? = null,
    val muebles: List<MuebleMaterialDetalleResponse> = emptyList()
)

data class InventarioResponse(
    val id: Int? = null,
    val material_id: Int = 0,
    val material_nombre: String? = null,
    val material_categoria: String? = null,
    val categoria: String? = null,
    val unidad_medida: String? = null,
    val cantidad_disponible: Double? = null,
    val cantidad_actual: Double? = null,
    val cantidad: Double? = null,
    val stock: Double? = null,
    val ultima_actualizacion: String? = null,
    val existe_catalogo: Boolean = true,
    val advertencia_catalogo: String? = null
)

data class ConsumoAcumuladoResponse(
    val lote_proceso_id: Int? = null,
    val material_id: Int = 0,
    val material_nombre: String? = null,
    val categoria_material: String? = null,
    val cantidad_programada: Double? = null,
    val cantidad_real_acumulada: Double? = null,
    val unidad_medida: String? = null,
    val fecha_registro: String? = null,
    val notas: String? = null
)

data class ConsumoParcialResponse(
    val ok: Boolean = false,
    val mensaje: String? = null,
    val material_id: Int? = null,
    val material_nombre: String? = null,
    val cantidad_agregada: Double? = null,
    val cantidad_real_acumulada: Double? = null,
    val cantidad_disponible: Double? = null,
    val existe_catalogo: Boolean = true,
    val advertencia_catalogo: String? = null
)


// ============================================================
// TAREAS
// ============================================================

data class TareaProcesoResponse(
    val id: Int = 0,
    val tarea_id: Int? = null,
    val lote_proceso_id: Int = 0,
    val lote_id: Int = 0,
    val proceso_id: Int = 0,

    val item_id: Int? = null,
    val items_proyecto_id: Int? = null,
    val item_nombre: String? = null,
    val mueble_nombre: String? = null,
    val nombre: String? = null,

    val item_piso: Int? = null,
    val piso: Int? = null,
    val item_apartamento: String? = null,
    val apartamento: String? = null,
    val item_label: String? = null,

    val tipo_tarea: String? = null,
    val grupo_pieza: String? = null,
    val responsable_id: Int? = null,
    val responsable_nombre: String? = null,
    val maquina_id: Int? = null,
    val estado: String? = null,
    val fecha_inicio_real: String? = null,
    val fecha_fin_real: String? = null,
    val cantidad_programada: Double? = null,
    val cantidad_real: Double? = null,
    val notas: String? = null,
    val notas_bloqueo: String? = null
)


// ============================================================
// PIEZAS
// ============================================================

data class PiezaResponse(
    val id: Int = 0,
    val pieza: String = "",
    val nombre: String? = null
)

data class PiezaMuebleResponse(
    val id: Int = 0,
    val lote_id: Int = 0,

    val items_proyecto_id: Int = 0,
    val itms_proyecto_id: Int? = null,
    val item_id: Int? = null,

    val item_nombre: String? = null,
    val mueble_nombre: String? = null,
    val item_piso: Int? = null,
    val item_apartamento: String? = null,
    val apartamento: String? = null,
    val item_label: String? = null,

    val pieza: String = "",
    val cantidad: Double = 0.0,
    val llegada: Boolean = false,

    val fecha_registro: String? = null,
    val fecha_llegada: String? = null,
    val notas: String? = null,
    val created_at: String? = null,
    val updated_at: String? = null,

    val pieza_id: Int? = null,
    val largo_mm: Double? = null,
    val ancho_mm: Double? = null,
    val espesor_mm: Double? = null,
    val material: String? = null,
    val descripcion_original: String? = null,

    val archivo_origen: String? = null,
    val hoja_origen: String? = null,
    val fila_excel: Int? = null,
    val encabezado_mueble: String? = null,
    val match_tipo: String? = null,
    val match_observacion: String? = null,

    val tipo_checklist: String? = null,
    val editable_llegada: Boolean? = true
)


// ============================================================
// INSTALACIÓN
// ============================================================

data class MuebleInstalacionResponse(
    val item_id: Int = 0,
    val items_proyecto_id: Int? = null,
    val item_nombre: String? = null,
    val mueble_nombre: String? = null,
    val nombre: String? = null,

    val piso: Int? = null,
    val apartamento: String? = null,

    val tarea_id: Int? = null,
    val responsable_id: Int? = null,
    val responsable_nombre: String? = null,
    val estado: String? = null,
    val label: String? = null,

    val piezas: List<PiezaMuebleResponse> = emptyList(),
    val herrajes: List<HerrajeInstalacionResponse> = emptyList(),

    val piezas_total: Int? = null,
    val piezas_recibidas: Int? = null,
    val herrajes_total: Int? = null,
    val completo: Boolean? = null,

    val checklist_secciones: List<ChecklistSeccionResponse> = emptyList()
)

data class ChecklistSeccionResponse(
    val titulo: String? = null,
    val tipo: String? = null,
    val items: List<Any> = emptyList()
)

data class HerrajeInstalacionResponse(
    val id: String? = null,
    val herraje_llegada_id: Int? = null,
    val tipo_checklist: String? = null,

    val items_proyecto_id: Int? = null,
    val item_id: Int? = null,
    val material_id: Int? = null,

    val pieza: String? = null,
    val herraje_nombre: String? = null,
    val nombre: String? = null,
    val categoria: String? = null,

    val cantidad: Double? = null,
    val cantidad_requerida: Double? = null,
    val unidad_medida: String? = null,

    val llegada: Boolean? = false,
    val fecha_llegada: String? = null,
    val editable_llegada: Boolean? = true,
    val notas: String? = null
)


// ============================================================
// REQUESTS
// ============================================================

data class ActualizarProcesoRequest(
    val lote_proceso_id: Int,
    val responsable_id: Int? = null,
    val maquina_id: Int? = null,
    val estado: String,
    val fecha_inicio_real: String? = null,
    val fecha_fin_real: String? = null,
    val motivos_bloqueo: String? = null,
    val motivo_bloqueo: String? = null,
    val notas: String? = null
)

data class ConsumoMaterialInput(
    val material_id: Int,
    val cantidad_real: Double,
    val notas: String? = null
)

data class FinalizarProcesoRequest(
    val lote_proceso_id: Int,
    val responsable_id: Int,
    val maquina_id: Int? = null,
    val estado: String = "completado",
    val fecha_fin_real: String? = null,
    val motivos_bloqueo: String? = null,
    val motivo_bloqueo: String? = null,
    val notas: String? = null,
    val consumos: List<ConsumoMaterialInput>? = null
)

data class ConsumoParcialRequest(
    val lote_proceso_id: Int,
    val material_id: Int,
    val cantidad_real: Double,
    val notas: String? = null
)

data class GenerarTareasProcesoRequest(
    val lote_proceso_id: Int
)

data class ActualizarTareaProcesoRequest(
    val tarea_id: Int,
    val responsable_id: Int? = null,
    val maquina_id: Int? = null,
    val estado: String? = null,
    val fecha_inicio_real: String? = null,
    val fecha_fin_real: String? = null,
    val cantidad_programada: Double? = null,
    val cantidad_real: Double? = null,
    val notas: String? = null
)

data class AsignarResponsableMuebleRequest(
    val lote_proceso_id: Int,
    val item_id: Int,
    val responsable_id: Int,
    val maquina_id: Int? = null,
    val notas: String? = null
)

data class AgregarPiezaMuebleRequest(
    val lote_id: Int,
    val items_proyecto_id: Int,
    val pieza: String,
    val cantidad: Double,
    val llegada: Boolean = false,

    val pieza_id: Int? = null,
    val largo_mm: Double? = null,
    val ancho_mm: Double? = null,
    val espesor_mm: Double? = null,
    val material: String? = null,
    val descripcion_original: String? = null,
    val archivo_origen: String? = null,
    val hoja_origen: String? = null,
    val fila_excel: Int? = null,
    val encabezado_mueble: String? = null,
    val match_tipo: String? = null,
    val match_observacion: String? = null,
    val notas: String? = null
)

data class ActualizarLlegadaPiezaRequest(
    val piezas_mueble_id: Int,
    val llegada: Boolean
)

data class ActualizarLlegadaHerrajeRequest(
    val lote_proceso_id: Int,
    val item_id: Int,
    val material_id: Int,
    val llegada: Boolean,
    val notas: String? = null
)

data class SincronizarHerrajesRequest(
    val lote_proceso_id: Int? = null
)

data class CompletarPiezasMuebleRequest(
    val lote_id: Int,
    val items_proyecto_id: Int
)

data class ActualizarPiezaMuebleRequest(
    val piezas_mueble_id: Int,
    val pieza: String? = null,
    val cantidad: Double? = null,
    val llegada: Boolean? = null,

    val pieza_id: Int? = null,
    val largo_mm: Double? = null,
    val ancho_mm: Double? = null,
    val espesor_mm: Double? = null,
    val material: String? = null,
    val descripcion_original: String? = null,
    val archivo_origen: String? = null,
    val hoja_origen: String? = null,
    val fila_excel: Int? = null,
    val encabezado_mueble: String? = null,
    val match_tipo: String? = null,
    val match_observacion: String? = null,
    val notas: String? = null
)

data class EliminarPiezaMuebleRequest(
    val piezas_mueble_id: Int
)


// ============================================================
// API SERVICE
// ============================================================

interface ApiService {

    @GET("/")
    suspend fun root(): Response<GenericResponse>

    @GET("health")
    suspend fun health(): Response<HealthResponse>

    @GET("procesos")
    suspend fun getProcesos(
        @Query("piso") piso: Int
    ): Response<List<ProcesoResponse>>

    @GET("procesos-seccion")
    suspend fun getProcesosSeccion(
        @Query("seccion") seccion: String
    ): Response<List<ProcesoResponse>>

    @GET("modo-proceso")
    suspend fun getModoProceso(
        @Query("lote_proceso_id") loteProcesoId: Int
    ): Response<ModoProcesoResponse>

    @GET("proyectos")
    suspend fun getProyectos(
        @Query("proceso_id") procesoId: Int
    ): Response<List<ProyectoResponse>>

    @GET("lotes")
    suspend fun getLotes(
        @Query("proyecto_id") proyectoId: Int,
        @Query("proceso_id") procesoId: Int
    ): Response<List<LoteResponse>>

    @GET("lote-proceso/{lote_proceso_id}")
    suspend fun getLoteProceso(
        @Path("lote_proceso_id") loteProcesoId: Int
    ): Response<LoteProcesoResponse>

    @GET("muebles-lote")
    suspend fun getMueblesLote(
        @Query("lote_id") loteId: Int
    ): Response<List<MuebleLoteResponse>>

    @GET("responsables")
    suspend fun getResponsables(
        @Query("proceso_id") procesoId: Int
    ): Response<List<ResponsableResponse>>

    @GET("maquinas")
    suspend fun getMaquinas(
        @Query("proceso_id") procesoId: Int
    ): Response<List<MaquinaResponse>>

    @GET("inventario")
    suspend fun getInventario(
        @Query("categoria") categoria: String? = null
    ): Response<List<InventarioResponse>>

    @GET("materiales-consumo")
    suspend fun getMaterialesConsumo(
        @Query("lote_id") loteId: Int,
        @Query("proceso_id") procesoId: Int
    ): Response<List<MaterialConsumoResponse>>

    @GET("materiales-consumo-detalle")
    suspend fun getMaterialesConsumoDetalle(
        @Query("lote_id") loteId: Int,
        @Query("proceso_id") procesoId: Int
    ): Response<List<MaterialConsumoDetalleResponse>>

    @GET("consumos-acumulados")
    suspend fun getConsumosAcumulados(
        @Query("lote_proceso_id") loteProcesoId: Int
    ): Response<List<ConsumoAcumuladoResponse>>

    @POST("consumo-parcial")
    suspend fun registrarConsumoParcial(
        @Body request: ConsumoParcialRequest
    ): Response<ConsumoParcialResponse>

    @POST("actualizar-proceso")
    suspend fun actualizarProceso(
        @Body request: ActualizarProcesoRequest
    ): Response<GenericResponse>

    @POST("finalizar-proceso")
    suspend fun finalizarProceso(
        @Body request: FinalizarProcesoRequest
    ): Response<GenericResponse>

    @GET("tareas-proceso")
    suspend fun getTareasProceso(
        @Query("lote_proceso_id") loteProcesoId: Int
    ): Response<List<TareaProcesoResponse>>

    @POST("generar-tareas-proceso")
    suspend fun generarTareasProceso(
        @Body request: GenerarTareasProcesoRequest
    ): Response<GenerarTareasResponse>

    @POST("actualizar-tarea-proceso")
    suspend fun actualizarTareaProceso(
        @Body request: ActualizarTareaProcesoRequest
    ): Response<GenericResponse>

    @POST("asignar-responsable-mueble")
    suspend fun asignarResponsableMueble(
        @Body request: AsignarResponsableMuebleRequest
    ): Response<GenericResponse>

    @GET("piezas")
    suspend fun getPiezas(): Response<List<PiezaResponse>>

    @GET("piezas-mueble")
    suspend fun getPiezasMueble(
        @Query("lote_id") loteId: Int? = null,
        @Query("item_id") itemId: Int? = null
    ): Response<List<PiezaMuebleResponse>>

    @POST("agregar-pieza-mueble")
    suspend fun agregarPiezaMueble(
        @Body request: AgregarPiezaMuebleRequest
    ): Response<AgregarPiezaMuebleResponse>

    @POST("actualizar-llegada-pieza")
    suspend fun actualizarLlegadaPieza(
        @Body request: ActualizarLlegadaPiezaRequest
    ): Response<GenericResponse>

    @POST("actualizar-llegada-herraje")
    suspend fun actualizarLlegadaHerraje(
        @Body request: ActualizarLlegadaHerrajeRequest
    ): Response<GenericResponse>

    @POST("sincronizar-herrajes-instalacion")
    suspend fun sincronizarHerrajesInstalacion(
        @Body request: SincronizarHerrajesRequest
    ): Response<GenericResponse>

    @POST("completar-piezas-mueble")
    suspend fun completarPiezasMueble(
        @Body request: CompletarPiezasMuebleRequest
    ): Response<CompletarPiezasMuebleResponse>

    @POST("actualizar-pieza-mueble")
    suspend fun actualizarPiezaMueble(
        @Body request: ActualizarPiezaMuebleRequest
    ): Response<GenericResponse>

    @POST("eliminar-pieza-mueble")
    suspend fun eliminarPiezaMueble(
        @Body request: EliminarPiezaMuebleRequest
    ): Response<GenericResponse>

    @GET("muebles-instalacion")
    suspend fun getMueblesInstalacion(
        @Query("lote_proceso_id") loteProcesoId: Int
    ): Response<List<MuebleInstalacionResponse>>
}