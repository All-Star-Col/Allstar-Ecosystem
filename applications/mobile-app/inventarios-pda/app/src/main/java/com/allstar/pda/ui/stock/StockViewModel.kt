package com.allstar.pda.ui.stock

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.allstar.pda.model.ItemInfo
import com.allstar.pda.network.actualizarDespacho
import com.allstar.pda.network.actualizarUbicacion
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

//__________________________________________________________________________________________________
//      Estado de la UI de Stock
//__________________________________________________________________________________________________

/*
  UpdateMode:
  Enumeración que define los modos de actualización disponibles para un item de inventario.
  Determina si se actualiza la ubicación, se registra un despacho, o no hay operación activa.
*/
enum class UpdateMode { NONE, LOCATION, DISPATCH }

/*
  StockUiState:
  Clase de datos que representa el estado completo de la interfaz de usuario de la pantalla
  de stock, incluyendo el modo seleccionado, campos de formulario y estados de diálogos.
    - selectedMode:UpdateMode | Modo de actualización actualmente seleccionado
    - selectedWarehouse:String | Bodega seleccionada para la actualización de ubicación
    - selectedRow:String | Fila seleccionada para la actualización de ubicación
    - selectedConveyor:String | Transportadora seleccionada para el despacho
    - remision:String | Número de remisión del despacho
    - factura:String | Número de factura del despacho (opcional)
    - remisionUbicacion:String | Número de remisión para el cambio de ubicación
    - isLoading:Boolean | Indica si hay una operación en curso
    - errorMessage:String? | Mensaje de error a mostrar (null si no hay error)
    - showErrorDialog:Boolean | Controla la visibilidad del diálogo de error
    - showSuccessDialog:Boolean | Controla la visibilidad del diálogo de éxito
    - showConfirmDialog:Boolean | Controla la visibilidad del diálogo de confirmación
*/
data class StockUiState(
    val selectedMode: UpdateMode = UpdateMode.NONE,
    val selectedWarehouse: String = "",
    val selectedRow: String = "",
    val selectedConveyor: String = "",
    val selectedLocationConveyor: String = "",
    val remision: String = "",
    val factura: String = "",
    val remisionUbicacion: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val showErrorDialog: Boolean = false,
    val showSuccessDialog: Boolean = false,
    val showConfirmDialog: Boolean = false
)

//__________________________________________________________________________________________________
//      ViewModel | Pantalla de stock
//__________________________________________________________________________________________________

/*
  StockViewModel:
  ViewModel de la pantalla de stock que gestiona el estado del formulario de actualización
  y coordina las operaciones de cambio de ubicación y registro de despacho de items.
*/
class StockViewModel : ViewModel()
{

    private val _uiState = MutableStateFlow(StockUiState())
    val uiState: StateFlow<StockUiState> = _uiState.asStateFlow()

    /*
      onModeSelected:
      Cambia el modo de actualización activo y reinicia todos los campos del formulario
      para evitar datos residuales de una operación anterior.
        - mode:UpdateMode | Nuevo modo de actualización a activar
    */
    fun onModeSelected(mode: UpdateMode)
    {
        _uiState.update {
            it.copy(
                selectedMode = mode,
                selectedWarehouse = "",
                selectedRow = "",
                remision = "",
                factura = "",
                remisionUbicacion = "",
                selectedConveyor = "",
                selectedLocationConveyor = ""
            )
        }
    }

    /*
      onWarehouseSelected:
      Registra la bodega seleccionada en el formulario y limpia el campo de remisión
      de ubicación al cambiar de bodega.
        - warehouse:String | Nombre de la bodega seleccionada
    */
    fun onWarehouseSelected(warehouse: String)
    {
        _uiState.update { it.copy(selectedWarehouse = warehouse, remisionUbicacion = "", selectedLocationConveyor = "") }
    }

    /*
      onRowSelected:
      Registra la fila de bodega seleccionada en el formulario de ubicación.
        - row:String | Nombre de la fila seleccionada
    */
    fun onRowSelected(row: String)
    {
        _uiState.update { it.copy(selectedRow = row) }
    }

    /*
      onConveyorSelected:
      Registra la transportadora seleccionada en el formulario de despacho.
        - conveyor:String | Nombre de la transportadora seleccionada
    */
    fun onConveyorSelected(conveyor: String)
    {
        _uiState.update { it.copy(selectedConveyor = conveyor) }
    }

    /*
      onLocationConveyorSelected:
      Registra la transportadora seleccionada para el cambio de ubicación a una ubicación
      externa (exhibición). Solo aplica cuando la nueva bodega es un punto externo.
        - conveyor:String | Nombre de la transportadora seleccionada
    */
    fun onLocationConveyorSelected(conveyor: String)
    {
        _uiState.update { it.copy(selectedLocationConveyor = conveyor) }
    }

    /*
      onRemisionChange:
      Actualiza el valor del campo de remisión de despacho ingresado por el usuario.
        - value:String | Nuevo valor del número de remisión
    */
    fun onRemisionChange(value: String)
    {
        _uiState.update { it.copy(remision = value) }
    }

    /*
      onFacturaChange:
      Actualiza el valor del campo de factura de despacho ingresado por el usuario.
        - value:String | Nuevo valor del número de factura
    */
    fun onFacturaChange(value: String)
    {
        _uiState.update { it.copy(factura = value) }
    }

    /*
      onRemisionUbicacionChange:
      Actualiza el valor del campo de remisión de ubicación ingresado por el usuario.
        - value:String | Nuevo valor del número de remisión para cambio de ubicación
    */
    fun onRemisionUbicacionChange(value: String)
    {
        _uiState.update { it.copy(remisionUbicacion = value) }
    }

    /*
      showConfirmDialog:
      Muestra el diálogo de confirmación antes de ejecutar la actualización del item.
    */
    fun showConfirmDialog()
    {
        _uiState.update { it.copy(showConfirmDialog = true) }
    }

    /*
      dismissConfirmDialog:
      Cierra el diálogo de confirmación sin ejecutar ninguna acción.
    */
    fun dismissConfirmDialog()
    {
        _uiState.update { it.copy(showConfirmDialog = false) }
    }

    /*
      dismissErrorDialog:
      Cierra el diálogo de error y limpia el mensaje de error del estado de la UI.
    */
    fun dismissErrorDialog()
    {
        _uiState.update { it.copy(showErrorDialog = false, errorMessage = null) }
    }

    /*
      confirmarCambios:
      Ejecuta la operación de actualización del item según el modo seleccionado (ubicación
      o despacho). Maneja los errores y actualiza el estado de la UI con el resultado.
        - itemInfo:ItemInfo | Información del item a actualizar en el inventario
    */
    fun confirmarCambios(itemInfo: ItemInfo)
    {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null, showConfirmDialog = false) }
            try {
                val state = _uiState.value
                when (state.selectedMode) {
                    UpdateMode.LOCATION -> {
                        val referral = if (state.selectedLocationConveyor.isNotEmpty()) {
                            "Remision/Salida: ${state.remisionUbicacion} - Trasportador:${state.selectedLocationConveyor}"
                        } else {
                            state.remisionUbicacion
                        }
                        actualizarUbicacion(
                            excelRow = itemInfo.excelRow,
                            newWarehouse = state.selectedWarehouse,
                            newRow = state.selectedRow,
                            referral = referral
                        )
                    }
                    UpdateMode.DISPATCH -> {
                        val apiDate = SimpleDateFormat("dd-MM-yyyy", Locale.getDefault()).format(Date())
                        actualizarDespacho(
                            excelRow = itemInfo.excelRow,
                            dispatchDate = apiDate,
                            invoice = state.factura,
                            referral = state.remision,
                            conveyor = state.selectedConveyor
                        )
                    }
                    UpdateMode.NONE -> {}
                }
                _uiState.update { it.copy(showSuccessDialog = true) }
            } catch (e: Exception) {
                val msg = when {
                    e.message?.contains("HTTP") == true -> "Error en el servidor: ${e.message}"
                    e.message?.contains("timeout") == true -> "Tiempo de espera agotado"
                    else -> "Error al actualizar: ${e.message}"
                }
                _uiState.update { it.copy(errorMessage = msg, showErrorDialog = true) }
            } finally {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }
}
