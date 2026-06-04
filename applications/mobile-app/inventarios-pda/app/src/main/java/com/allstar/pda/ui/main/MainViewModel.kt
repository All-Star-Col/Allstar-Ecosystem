package com.allstar.pda.ui.main

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.allstar.pda.isTailscaleActive
import com.allstar.pda.model.ItemInfo
import com.allstar.pda.model.ReturnedItem
import com.allstar.pda.network.consultarItemAPI
import com.allstar.pda.network.getReturnItemAPI
import com.allstar.pda.network.getReturnUnknownsAPI
import com.allstar.pda.network.postReturnProductAPI
import com.allstar.pda.network.traerDeProduccionAPI
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

//__________________________________________________________________________________________________
//      Estado de la UI principal
//__________________________________________________________________________________________________

/*
  MainUiState:
  Clase de datos que representa el estado completo de la interfaz de usuario de la pantalla
  principal, incluyendo estados de carga, mensajes, diálogos y datos de devoluciones.
    - isLoadingConsulta:Boolean | Indica si hay una consulta de item en curso
    - isLoadingProduccion:Boolean | Indica si hay una operación de traer de producción en curso
    - isLoadingDevolucion:Boolean | Indica si hay una operación de devolución en curso
    - isTailscaleOn:Boolean | Indica si la VPN Tailscale está activa
    - errorMessage:String? | Mensaje de error a mostrar (null si no hay error)
    - showErrorDialog:Boolean | Controla la visibilidad del diálogo de error
    - showConfirmDialog:Boolean | Controla la visibilidad del diálogo de confirmación
    - successMessage:String? | Mensaje de éxito a mostrar (null si no hay mensaje)
    - showSuccessDialog:Boolean | Controla la visibilidad del diálogo de éxito
    - returnedItem:ReturnedItem? | Item conocido seleccionado para devolución
    - returnedUnknownList:List<ReturnedItem> | Lista de items desconocidos pendientes de devolución
    - selectedUnknown:ReturnedItem? | Item desconocido seleccionado para procesar
    - showUnknownDropdown:Boolean | Controla la visibilidad del menú desplegable de desconocidos
    - newItemNumber:String | Nuevo número de item ingresado para reemplazar un desconocido
    - showReturnKnownDialog:Boolean | Controla la visibilidad del diálogo de devolución conocida
    - showReturnUnknownDialog:Boolean | Controla la visibilidad del diálogo de devolución desconocida
*/
data class MainUiState(
    val isLoadingConsulta: Boolean = false,
    val isLoadingProduccion: Boolean = false,
    val isLoadingDevolucion: Boolean = false,
    val isTailscaleOn: Boolean = false,
    val errorMessage: String? = null,
    val showErrorDialog: Boolean = false,
    val showConfirmDialog: Boolean = false,
    val successMessage: String? = null,
    val showSuccessDialog: Boolean = false,
    val returnedItem: ReturnedItem? = null,
    val returnedUnknownList: List<ReturnedItem> = emptyList(),
    val selectedUnknown: ReturnedItem? = null,
    val showUnknownDropdown: Boolean = false,
    val newItemNumber: String = "",
    val showReturnKnownDialog: Boolean = false,
    val showReturnUnknownDialog: Boolean = false
)

//__________________________________________________________________________________________________
//      Eventos de navegacion
//__________________________________________________________________________________________________

/*
  MainNavEvent:
  Clase sellada que define los eventos de navegación posibles desde la pantalla principal.
  Cada subclase representa una acción de navegación distinta con sus datos asociados.
*/
sealed class MainNavEvent
{
    data class GoToStock(val itemInfo: ItemInfo) : MainNavEvent()
}

//__________________________________________________________________________________________________
//      ViewModel | Pantalla principal
//__________________________________________________________________________________________________

/*
  MainViewModel:
  ViewModel de la pantalla principal que gestiona el estado de la UI y coordina las
  operaciones de consulta, producción y devolución de items del inventario.
  También monitorea el estado de la conexión VPN Tailscale de forma periódica.
    - application:Application | Instancia de la aplicación para acceso al contexto
*/
class MainViewModel(application: Application) : AndroidViewModel(application)
{

    private val _uiState = MutableStateFlow(MainUiState())
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    private val _navEvents = Channel<MainNavEvent>(Channel.BUFFERED)
    val navEvents = _navEvents.receiveAsFlow()

    init {
        viewModelScope.launch {
            while (true) {
                val result = withContext(Dispatchers.IO) { isTailscaleActive(getApplication()) }
                _uiState.update { it.copy(isTailscaleOn = result) }
                delay(2000)
            }
        }
    }

    /*
      dismissError:
      Cierra el diálogo de error y limpia el mensaje de error del estado de la UI.
    */
    fun dismissError()
    {
        _uiState.update { it.copy(showErrorDialog = false, errorMessage = null) }
    }

    /*
      dismissSuccess:
      Cierra el diálogo de éxito y limpia el mensaje de éxito del estado de la UI.
    */
    fun dismissSuccess()
    {
        _uiState.update { it.copy(showSuccessDialog = false, successMessage = null) }
    }

    /*
      dismissConfirm:
      Cierra el diálogo de confirmación sin ejecutar ninguna acción.
    */
    fun dismissConfirm()
    {
        _uiState.update { it.copy(showConfirmDialog = false) }
    }

    /*
      dismissReturnKnown:
      Cierra el diálogo de confirmación de devolución para items conocidos.
    */
    fun dismissReturnKnown()
    {
        _uiState.update { it.copy(showReturnKnownDialog = false) }
    }

    /*
      dismissReturnUnknown:
      Cierra el diálogo de devolución para items desconocidos y oculta el menú desplegable.
    */
    fun dismissReturnUnknown()
    {
        _uiState.update { it.copy(showReturnUnknownDialog = false, showUnknownDropdown = false) }
    }

    /*
      onUnknownDropdownChange:
      Actualiza el estado de visibilidad del menú desplegable de items desconocidos.
        - expanded:Boolean | Nuevo estado del menú (true = visible, false = oculto)
    */
    fun onUnknownDropdownChange(expanded: Boolean)
    {
        _uiState.update { it.copy(showUnknownDropdown = expanded) }
    }

    /*
      onUnknownSelected:
      Registra la selección de un item desconocido en el menú desplegable y limpia
      el campo de nuevo número de item.
        - item:ReturnedItem | Item desconocido seleccionado por el usuario
    */
    fun onUnknownSelected(item: ReturnedItem)
    {
        _uiState.update { it.copy(selectedUnknown = item, newItemNumber = "", showUnknownDropdown = false) }
    }

    /*
      onNewItemNumberChange:
      Actualiza el valor del campo de nuevo número de item ingresado por el usuario.
        - value:String | Nuevo valor del campo de número de item
    */
    fun onNewItemNumberChange(value: String)
    {
        _uiState.update { it.copy(newItemNumber = value) }
    }

    /*
      consultarItem:
      Consulta la información de un item en el inventario y navega a la pantalla de stock
      si la consulta es exitosa. Valida que el código de item no esté vacío antes de consultar.
        - item:String | Código del item a consultar en el inventario
    */
    fun consultarItem(item: String)
    {
        if (item.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Por favor ingrese un número de item", showErrorDialog = true) }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingConsulta = true, errorMessage = null) }
            try {
                val itemInfo = consultarItemAPI(item)
                _navEvents.send(MainNavEvent.GoToStock(itemInfo))
            } catch (e: Exception) {
                val msg = when {
                    e.message?.contains("HTTP") == true -> "Error en el servidor: ${e.message}"
                    e.message?.contains("timeout") == true -> "Tiempo de espera agotado. Verifique su conexión."
                    else -> "Error al consultar: ${e.message}"
                }
                _uiState.update { it.copy(errorMessage = msg, showErrorDialog = true) }
            } finally {
                _uiState.update { it.copy(isLoadingConsulta = false) }
            }
        }
    }

    /*
      traerDeProduccion:
      Valida que el código de item no esté vacío y muestra el diálogo de confirmación
      antes de ejecutar la operación de traer el item desde producción.
        - item:String | Código del item a incorporar desde producción
    */
    fun traerDeProduccion(item: String)
    {
        if (item.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Por favor ingrese un número de item", showErrorDialog = true) }
            return
        }
        _uiState.update { it.copy(showConfirmDialog = true) }
    }

    /*
      ejecutarTraerProduccion:
      Ejecuta la operación de agregar un item desde producción al inventario tras la
      confirmación del usuario. Maneja los distintos códigos de respuesta del servidor.
        - item:String | Código del item a incorporar desde producción
    */
    fun ejecutarTraerProduccion(item: String)
    {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingProduccion = true, errorMessage = null, showConfirmDialog = false) }
            try {
                val statusCode = traerDeProduccionAPI(item)
                when (statusCode) {
                    200 -> _uiState.update { it.copy(successMessage = "Item $item agregado exitosamente", showSuccessDialog = true) }
                    404 -> _uiState.update { it.copy(errorMessage = "Error: El item $item no existe en BASE ACCESS", showErrorDialog = true) }
                    409 -> _uiState.update { it.copy(errorMessage = "El item $item ya existe en el inventario", showErrorDialog = true) }
                    else -> _uiState.update { it.copy(errorMessage = "Error inesperado (código: $statusCode)", showErrorDialog = true) }
                }
            } catch (e: Exception) {
                val msg = when {
                    e.message?.contains("HTTP") == true -> "Error en el servidor: ${e.message}"
                    e.message?.contains("timeout") == true -> "Tiempo de espera agotado. Verifique su conexión."
                    else -> "Error al traer de producción: ${e.message}"
                }
                _uiState.update { it.copy(errorMessage = msg, showErrorDialog = true) }
            } finally {
                _uiState.update { it.copy(isLoadingProduccion = false) }
            }
        }
    }

    /*
      devolverAInventario:
      Gestiona el proceso de devolución de un item al inventario. Si el código está vacío,
      obtiene la lista de items desconocidos; de lo contrario, consulta el item específico.
        - item:String | Código del item a devolver (vacío para listar desconocidos)
    */
    fun devolverAInventario(item: String)
    {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingDevolucion = true, errorMessage = null) }
            try {
                if (item.isBlank()) {
                    val lista = getReturnUnknownsAPI()
                    if (lista.isEmpty()) {
                        _uiState.update { it.copy(errorMessage = "No hay items desconocidos pendientes", showErrorDialog = true) }
                    } else {
                        _uiState.update {
                            it.copy(
                                returnedUnknownList = lista,
                                selectedUnknown = null,
                                newItemNumber = "",
                                showUnknownDropdown = false,
                                showReturnUnknownDialog = true
                            )
                        }
                    }
                } else {
                    val ri = getReturnItemAPI(item)
                    _uiState.update { it.copy(returnedItem = ri, showReturnKnownDialog = true) }
                }
            } catch (e: Exception) {
                val msg = when {
                    e.message?.contains("HTTP 404") == true -> "Item no encontrado en devoluciones"
                    e.message?.contains("HTTP") == true -> "Error en el servidor: ${e.message}"
                    e.message?.contains("timeout") == true -> "Tiempo de espera agotado."
                    else -> "Error al consultar devolución: ${e.message}"
                }
                _uiState.update { it.copy(errorMessage = msg, showErrorDialog = true) }
            } finally {
                _uiState.update { it.copy(isLoadingDevolucion = false) }
            }
        }
    }

    /*
      ejecutarDevolucion:
      Ejecuta el registro de la devolución de un item al inventario tras la confirmación
      del usuario. Permite opcionalmente reasignar un nuevo código de item.
        - item:String | Código del item a devolver al inventario
        - newItem:String? | Nuevo código de item a asignar (null para items conocidos)
    */
    fun ejecutarDevolucion(item: String, newItem: String?)
    {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingDevolucion = true, showReturnKnownDialog = false, showReturnUnknownDialog = false, errorMessage = null) }
            try {
                postReturnProductAPI(item, newItem)
                _uiState.update { it.copy(successMessage = "Devolución registrada correctamente", showSuccessDialog = true) }
            } catch (e: Exception) {
                val msg = when {
                    e.message?.contains("HTTP 404") == true -> "Item no encontrado en DEVOLUCIONES"
                    e.message?.contains("HTTP 422") == true -> "Se requiere un nuevo número de item"
                    e.message?.contains("HTTP") == true -> "Error en el servidor: ${e.message}"
                    e.message?.contains("timeout") == true -> "Tiempo de espera agotado."
                    else -> "Error al procesar devolución: ${e.message}"
                }
                _uiState.update { it.copy(errorMessage = msg, showErrorDialog = true) }
            } finally {
                _uiState.update { it.copy(isLoadingDevolucion = false) }
            }
        }
    }
}
