package com.allstar.producciontablet.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.allstar.producciontablet.data.ApiClient
import com.allstar.producciontablet.data.AsignarProcesoRequest
import com.allstar.producciontablet.data.EmpleadoDto
import com.allstar.producciontablet.data.FinalizarProcesoRequest
import com.allstar.producciontablet.data.ItemDto
import com.allstar.producciontablet.data.MaterialDto
import com.allstar.producciontablet.data.OrdenProcesoDto
import com.allstar.producciontablet.data.ProcesoDto
import com.allstar.producciontablet.data.RegistrarConsumoMaterialRequest
import com.allstar.producciontablet.data.RegistrarConsumoTelaRequest
import com.allstar.producciontablet.data.TelaDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException

data class EstacionUiState(
    val cargando: Boolean = false,
    val error: String? = null,
    val mensaje: String? = null,

    val tabletId: String = "TABLET_01",
    val procesoId: Int = 1,

    val pendientes: List<ItemDto> = emptyList(),
    val enProceso: List<OrdenProcesoDto> = emptyList(),
    val empleados: List<EmpleadoDto> = emptyList(),
    val procesos: List<ProcesoDto> = emptyList(),
    val materiales: List<MaterialDto> = emptyList(),
    val telas: List<TelaDto> = emptyList()
)

class EstacionViewModel : ViewModel() {

    private val api = ApiClient.api

    private val _uiState = MutableStateFlow(EstacionUiState())
    val uiState: StateFlow<EstacionUiState> = _uiState

    init {
        cargarInicial()
    }

    private fun errorLegible(e: Exception): String {
        return if (e is HttpException) {
            val body = e.response()?.errorBody()?.string()
            "HTTP ${e.code()}: ${body ?: e.message()}"
        } else {
            e.message ?: "Error desconocido"
        }
    }

    private fun itemIdFromPendiente(item: ItemDto): Int? {
        return item.item?.toInt()
            ?: item.itemLegado?.toInt()
    }

    fun cargarInicial() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                cargando = true,
                error = null,
                mensaje = null
            )

            try {
                val empleados = api.getEmpleados()
                val procesos = api.getProcesos()
                val materiales = api.getMateriales()
                val telas = api.getTelas()

                _uiState.value = _uiState.value.copy(
                    empleados = empleados,
                    procesos = procesos,
                    materiales = materiales,
                    telas = telas
                )

                cargarDatosInterno(null)

            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    cargando = false,
                    error = errorLegible(e)
                )
            }
        }
    }

    fun cambiarTablet(tabletId: String) {
        _uiState.value = _uiState.value.copy(
            tabletId = tabletId,
            mensaje = null,
            error = null
        )
    }

    fun cambiarProceso(procesoId: Int) {
        _uiState.value = _uiState.value.copy(
            procesoId = procesoId,
            mensaje = null,
            error = null,
            pendientes = emptyList(),
            enProceso = emptyList()
        )

        cargarDatos()
    }

    fun cargarDatos() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                cargando = true,
                error = null,
                mensaje = null
            )

            cargarDatosInterno(null)
        }
    }

    private suspend fun cargarDatosInterno(mensajeExito: String?) {
        val procesoActual = _uiState.value.procesoId

        try {
            val pendientes = api.getPendientes(procesoActual)
            val enProceso = api.getEnProceso(procesoActual)

            _uiState.value = _uiState.value.copy(
                cargando = false,
                pendientes = pendientes,
                enProceso = enProceso,
                mensaje = mensajeExito,
                error = null
            )

        } catch (e: Exception) {
            _uiState.value = _uiState.value.copy(
                cargando = false,
                mensaje = mensajeExito,
                error = "Error refrescando datos: ${errorLegible(e)}"
            )
        }
    }

    fun asignarItem(itemPendiente: ItemDto, empleadoId: Int) {
        val itemInt = itemIdFromPendiente(itemPendiente)

        if (itemInt == null) {
            _uiState.value = _uiState.value.copy(
                error = "No se pudo identificar el item pendiente."
            )
            return
        }

        val estadoActual = _uiState.value
        val procesoActual = estadoActual.procesoId
        val tabletActual = estadoActual.tabletId

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                cargando = true,
                error = null,
                mensaje = null
            )

            try {
                val response = api.asignarProceso(
                    AsignarProcesoRequest(
                        item = itemInt,
                        proceso = procesoActual,
                        empleado = empleadoId,
                        tablet_id = tabletActual,
                        comentario = "Asignado desde $tabletActual"
                    )
                )

                cargarDatosInterno(response.message)

            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    cargando = false,
                    error = "Error asignando operario: ${errorLegible(e)}"
                )
            }
        }
    }

    fun registrarMaterial(
        orden: OrdenProcesoDto,
        materialId: Int,
        cantidad: Double
    ) {
        val item = orden.item?.toInt() ?: return
        val proceso = orden.proceso?.toInt() ?: _uiState.value.procesoId

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                cargando = true,
                error = null,
                mensaje = null
            )

            try {
                val response = api.registrarConsumoMaterial(
                    RegistrarConsumoMaterialRequest(
                        proceso = proceso,
                        item = item,
                        material = materialId,
                        cantidad = cantidad
                    )
                )

                _uiState.value = _uiState.value.copy(
                    cargando = false,
                    mensaje = response.message,
                    error = null
                )

            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    cargando = false,
                    error = "Error registrando material: ${errorLegible(e)}"
                )
            }
        }
    }

    fun registrarTela(
        orden: OrdenProcesoDto,
        telaId: Int,
        cantidad: Double
    ) {
        val item = orden.item?.toInt() ?: return
        val proceso = orden.proceso?.toInt() ?: _uiState.value.procesoId

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                cargando = true,
                error = null,
                mensaje = null
            )

            try {
                val response = api.registrarConsumoTela(
                    RegistrarConsumoTelaRequest(
                        proceso = proceso,
                        item = item,
                        tela = telaId,
                        cantidad = cantidad
                    )
                )

                _uiState.value = _uiState.value.copy(
                    cargando = false,
                    mensaje = response.message,
                    error = null
                )

            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    cargando = false,
                    error = "Error registrando tela: ${errorLegible(e)}"
                )
            }
        }
    }

    fun finalizarOrdenProceso(ordenProcesoId: Double?) {
        val idInt = ordenProcesoId?.toInt() ?: return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                cargando = true,
                error = null,
                mensaje = null
            )

            try {
                val response = api.finalizarProceso(
                    FinalizarProcesoRequest(
                        orden_proceso_id = idInt,
                        comentario = "Finalizado desde ${_uiState.value.tabletId}"
                    )
                )

                cargarDatosInterno(response.message)

            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    cargando = false,
                    error = "Error finalizando proceso: ${errorLegible(e)}"
                )
            }
        }
    }
}