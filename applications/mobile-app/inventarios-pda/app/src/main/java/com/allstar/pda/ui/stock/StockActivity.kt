package com.allstar.pda

//__________________________________________________________________________________________________
//      IMPORTACION DE LIBRERIAS
//__________________________________________________________________________________________________

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.activity.viewModels
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.allstar.pda.model.ItemInfo
import com.allstar.pda.ui.components.AppConfirmDialog
import com.allstar.pda.ui.components.AppDestructiveButton
import com.allstar.pda.ui.components.AppPrimaryButton
import com.allstar.pda.ui.components.InfoRow
import com.allstar.pda.ui.components.SectionCard
import com.allstar.pda.ui.stock.StockViewModel
import com.allstar.pda.ui.stock.UpdateMode
import com.allstar.pda.ui.theme.AppBackground
import com.allstar.pda.ui.theme.AppError
import com.allstar.pda.ui.theme.AppOnSurface
import com.allstar.pda.ui.theme.AppOnSurfaceVariant
import com.allstar.pda.ui.theme.AppOutline
import com.allstar.pda.ui.theme.AppPrimary
import com.allstar.pda.ui.theme.AppSuccess
import com.allstar.pda.ui.theme.AppSurface
import com.allstar.pda.ui.theme.AppSurfaceVariant
import com.allstar.pda.ui.theme.PDAAPPTheme
import java.text.SimpleDateFormat
import java.util.*

//__________________________________________________________________________________________________
//      VENTANA PRINCIPAL
//__________________________________________________________________________________________________

/*
  StockActivity:
  Actividad de actualización de stock que recibe los datos del item desde el Intent,
  inicializa el ViewModel y muestra la pantalla de actualización de ubicación o despacho.
*/
class StockActivity : ComponentActivity()
{
    override fun onCreate(savedInstanceState: Bundle?)
    {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val itemInfo = androidx.core.content.IntentCompat.getSerializableExtra(intent, "ITEM_INFO", ItemInfo::class.java)
        val viewModel: StockViewModel by viewModels()

        setContent {
            PDAAPPTheme {
                StockUpdateScreen(
                    itemInfo = itemInfo,
                    onBackPressed = { finish() },
                    viewModel = viewModel
                )
            }
        }
    }
}

//__________________________________________________________________________________________________
//      Dibujo | Pantalla principal
//__________________________________________________________________________________________________

/*
  StockUpdateScreen:
  Pantalla principal de actualización de stock que muestra la información del item,
  los botones de selección de modo (ubicación/despacho) y el formulario correspondiente.
  También gestiona los diálogos de confirmación, error y éxito.
    - itemInfo:ItemInfo? | Información del item a actualizar (null si no se recibieron datos)
    - onBackPressed:()->Unit | Callback para regresar a la pantalla anterior
    - viewModel:StockViewModel | ViewModel que gestiona el estado y las acciones de la pantalla
*/
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StockUpdateScreen(itemInfo: ItemInfo?, onBackPressed: () -> Unit, viewModel: StockViewModel)
{
    // --------------------------------------------------------------
    //      Creacion de variables

    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    // Menu desplegables — estado visual local (no necesita sobrevivir a cambios de config)
    var showWarehouseMenu by remember { mutableStateOf(false) }
    var showRowMenu by remember { mutableStateOf(false) }
    var showConveyorMenu by remember { mutableStateOf(false) }
    var showLocationConveyorMenu by remember { mutableStateOf(false) }

    // Fechas
    val currentDate = remember {
        val dateFormat = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
        dateFormat.format(Date())
    }

    // FE-14: Detecta si el producto viene de una ubicacion externa (exhibicion)
    // "Zona de revision" es interna — excluirla evita el ciclo de auto-seleccion al re-ubicar
    val isFromExternalLocation = remember {
        itemInfo != null &&
        !itemInfo.warehouse.contains("Bodega", ignoreCase = true) &&
        !itemInfo.warehouse.contains("Piso", ignoreCase = true) &&
        !itemInfo.warehouse.contains("Zona de revision", ignoreCase = true) &&
        itemInfo.warehouse.isNotEmpty()
    }

    // FE-14: Auto-selecciona "Zona de revision" / "1" cuando el producto viene de exhibicion
    LaunchedEffect(uiState.selectedMode) {
        if (uiState.selectedMode == UpdateMode.LOCATION && isFromExternalLocation) {
            viewModel.onWarehouseSelected("Zona de revision")
            viewModel.onRowSelected("1")
        }
    }

    // Condicional para requerir la remision y transportista (Seccion 'Ubicacion')
    // Solo aplica cuando el producto NO viene de una ubicacion externa (FE-15, no FE-14)
    val requiresRemision = uiState.selectedMode == UpdateMode.LOCATION &&
            !isFromExternalLocation &&
            !uiState.selectedWarehouse.contains("Bodega", ignoreCase = true) &&
            !uiState.selectedWarehouse.contains("Piso", ignoreCase = true) &&
            uiState.selectedWarehouse.isNotEmpty()

    // Condicional | Confirma si los valores requeridos fueron diligenciados.
    val confirmEnabled = when (uiState.selectedMode)
    {
        UpdateMode.LOCATION -> uiState.selectedWarehouse.isNotEmpty() && uiState.selectedRow.isNotEmpty() && (!requiresRemision || (uiState.remisionUbicacion.isNotEmpty() && uiState.selectedLocationConveyor.isNotEmpty()))
        UpdateMode.DISPATCH -> uiState.remision.isNotEmpty() && uiState.selectedConveyor.isNotEmpty()
        UpdateMode.NONE -> false
    }

    // Confirma la recepcion de informacion del item
    if(itemInfo == null)
    {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = "Error",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onBackPressed) {
                            Icon(
                                imageVector = Icons.Default.ArrowBack,
                                contentDescription = "Volver",
                                tint = Color.White
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = AppSurfaceVariant
                    )
                )
            },
            containerColor = AppBackground
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No se recibieron datos del item",
                    color = Color.White,
                    fontSize = 16.sp
                )
            }
        }
        return
    }

    // Dibujo | Ventana visual
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Actualización",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackPressed) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Volver",
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AppSurfaceVariant
                )
            )
        },
        containerColor = AppBackground
    )
    { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 20.dp)
                    .verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(20.dp))

                ProductInfoCard(
                    itemCode = itemInfo.item,
                    product = itemInfo.product,
                    fabric = itemInfo.fabric,
                    warehouse = itemInfo.warehouse,
                    warehouseRow = itemInfo.warehouseRow,
                    hasOptions = itemInfo.hasOptions
                )

                Spacer(modifier = Modifier.height(20.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    ToggleButton(
                        text = "Ubicación",
                        icon = Icons.Default.LocationOn,
                        isSelected = uiState.selectedMode == UpdateMode.LOCATION,
                        onClick = {
                            viewModel.onModeSelected(
                                if (uiState.selectedMode == UpdateMode.LOCATION) UpdateMode.NONE else UpdateMode.LOCATION
                            )
                        },
                        modifier = Modifier.weight(1f),
                        enabled = !uiState.isLoading
                    )

                    ToggleButton(
                        text = "Despacho",
                        icon = Icons.Default.CheckCircle,
                        isSelected = uiState.selectedMode == UpdateMode.DISPATCH,
                        onClick = {
                            viewModel.onModeSelected(
                                if (uiState.selectedMode == UpdateMode.DISPATCH) UpdateMode.NONE else UpdateMode.DISPATCH
                            )
                        },
                        modifier = Modifier.weight(1f),
                        backgroundColor = Color(0xFFD46A6A),
                        enabled = !uiState.isLoading
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                AnimatedVisibility(
                    visible = uiState.selectedMode != UpdateMode.NONE,
                    enter = fadeIn(animationSpec = tween(300)) +
                            expandVertically(animationSpec = tween(300)),
                    exit = fadeOut(animationSpec = tween(300)) +
                            shrinkVertically(animationSpec = tween(300))
                ) {
                    when (uiState.selectedMode) {
                        UpdateMode.LOCATION -> {
                            LocationOptionsCard(
                                warehouses = itemInfo.optWarehouses,
                                rows = itemInfo.optRows,
                                selectedWarehouse = uiState.selectedWarehouse,
                                selectedRow = uiState.selectedRow,
                                showWarehouseMenu = showWarehouseMenu,
                                showRowMenu = showRowMenu,
                                onWarehouseMenuChange = { showWarehouseMenu = it },
                                onRowMenuChange = { showRowMenu = it },
                                onWarehouseSelected = { viewModel.onWarehouseSelected(it) },
                                onRowSelected = { viewModel.onRowSelected(it) },
                                enabled = !uiState.isLoading,
                                remisionUbicacion = uiState.remisionUbicacion,
                                onRemisionUbicacionChange = { viewModel.onRemisionUbicacionChange(it) },
                                requiresRemision = requiresRemision,
                                isFromExternalLocation = isFromExternalLocation,
                                conveyors = itemInfo.optConveyors,
                                selectedLocationConveyor = uiState.selectedLocationConveyor,
                                showLocationConveyorMenu = showLocationConveyorMenu,
                                onLocationConveyorMenuChange = { showLocationConveyorMenu = it },
                                onLocationConveyorSelected = { viewModel.onLocationConveyorSelected(it) }
                            )
                        }
                        UpdateMode.DISPATCH -> {
                            DispatchFormCard(
                                date = currentDate,
                                remision = uiState.remision,
                                factura = uiState.factura,
                                conveyors = itemInfo.optConveyors,
                                selectedConveyor = uiState.selectedConveyor,
                                showConveyorMenu = showConveyorMenu,
                                onConveyorMenuChange = { showConveyorMenu = it },
                                onConveyorSelected = { viewModel.onConveyorSelected(it) },
                                onRemisionChange = { viewModel.onRemisionChange(it) },
                                onFacturaChange = { viewModel.onFacturaChange(it) },
                                enabled = !uiState.isLoading
                            )
                        }
                        UpdateMode.NONE -> {}
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                if (uiState.selectedMode == UpdateMode.DISPATCH) {
                    AppDestructiveButton(
                        text = if (uiState.isLoading) "Actualizando..." else "Confirmar despacho",
                        onClick = { viewModel.showConfirmDialog() },
                        modifier = Modifier.fillMaxWidth(),
                        isLoading = uiState.isLoading,
                        enabled = confirmEnabled
                    )
                } else {
                    AppPrimaryButton(
                        text = if (uiState.isLoading) "Actualizando..." else "Confirmar cambios",
                        onClick = { viewModel.showConfirmDialog() },
                        modifier = Modifier.fillMaxWidth(),
                        isLoading = uiState.isLoading,
                        enabled = confirmEnabled
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))
            }

            if (uiState.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.3f)),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        color = Color(0xFFD4AF37),
                        strokeWidth = 4.dp,
                        modifier = Modifier.size(48.dp)
                    )
                }
            }
        }
    }

    // Dibujo | Dialogo de confirmacion
    if(uiState.showConfirmDialog)
    {
        AppConfirmDialog(
            title = "Confirmar cambios",
            confirmText = "Confirmar",
            onConfirm = { viewModel.confirmarCambios(itemInfo) },
            onDismiss = { viewModel.dismissConfirmDialog() },
            dismissText = "Cancelar",
            content = {
                Column {
                    Text("Se actualizará el item:", fontWeight = FontWeight.Bold, color = AppOnSurface)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Item: ${itemInfo.item}", color = AppOnSurface)
                    Spacer(modifier = Modifier.height(8.dp))
                    when (uiState.selectedMode) {
                        UpdateMode.LOCATION -> {
                            Text("Tipo: Cambio de ubicación", color = AppOnSurface)
                            Text("Nueva bodega: ${uiState.selectedWarehouse}", color = AppOnSurface)
                            Text("Nueva fila: ${uiState.selectedRow}", color = AppOnSurface)
                            if (uiState.selectedLocationConveyor.isNotEmpty()) {
                                Text("Transportadora: ${uiState.selectedLocationConveyor}", color = AppOnSurface)
                            }
                            if (uiState.remisionUbicacion.isNotEmpty()) {
                                Text("Remisión: ${uiState.remisionUbicacion}", color = AppOnSurface)
                            }
                        }
                        UpdateMode.DISPATCH -> {
                            Text("Tipo: Despacho", color = AppOnSurface)
                            Text("Fecha: $currentDate", color = AppOnSurface)
                            Text("Transportadora: ${uiState.selectedConveyor}", color = AppOnSurface)
                            Text("Remisión: ${uiState.remision}", color = AppOnSurface)
                            if (uiState.factura.isNotEmpty()) {
                                Text("Factura: ${uiState.factura}", color = AppOnSurface)
                            }
                        }
                        UpdateMode.NONE -> {}
                    }
                }
            }
        )
    }

    // Dibujo | Dialogo de error
    if(uiState.showErrorDialog && uiState.errorMessage != null)
    {
        AppConfirmDialog(
            title = "Error",
            message = uiState.errorMessage ?: "Error desconocido",
            confirmText = "Aceptar",
            onConfirm = { viewModel.dismissErrorDialog() },
            onDismiss = { viewModel.dismissErrorDialog() },
            confirmColor = AppError
        )
    }

    // Dibujo | Cambios completados
    if (uiState.showSuccessDialog)
    {
        AppConfirmDialog(
            title = "¡Éxito!",
            message = when (uiState.selectedMode) {
                UpdateMode.LOCATION -> "La ubicación se actualizó correctamente"
                UpdateMode.DISPATCH -> "El despacho se registró correctamente"
                UpdateMode.NONE -> "Actualización exitosa"
            },
            confirmText = "Aceptar",
            onConfirm = { onBackPressed() },
            onDismiss = { onBackPressed() },
            confirmColor = AppSuccess
        )
    }
}

//__________________________________________________________________________________________________
//      Animacion | Boton seleccionado
//__________________________________________________________________________________________________

/*
  ToggleButton:
  Botón composable con estado de selección visual que muestra un ícono y texto.
  Cambia de color según si está seleccionado o no, con elevación diferenciada.
    - text:String | Texto a mostrar en el botón
    - icon:ImageVector | Ícono a mostrar encima del texto
    - isSelected:Boolean | Indica si el botón está actualmente seleccionado
    - onClick:()->Unit | Callback ejecutado al presionar el botón
    - modifier:Modifier | Modificador de composición opcional
    - backgroundColor:Color | Color de fondo cuando el botón está seleccionado
    - enabled:Boolean | Indica si el botón está habilitado para interacción
*/
@Composable
fun ToggleButton(text: String, icon: ImageVector, isSelected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, backgroundColor: Color = Color(0xFFD4AF37), enabled: Boolean = true)
{
    Button(
        onClick = onClick,
        modifier = modifier.height(56.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (isSelected) backgroundColor else Color(0xFF1A3A52),
            contentColor = if (isSelected) Color(0xFF1A252F) else Color.White,
            disabledContainerColor = Color(0xFF1A3A52).copy(alpha = 0.5f)
        ),
        shape = RoundedCornerShape(8.dp),
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = if (isSelected) 4.dp else 2.dp
        ),
        enabled = enabled
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = text,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = text,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

//__________________________________________________________________________________________________
//      Card | Seccion 'Ubicacion'
//__________________________________________________________________________________________________

/*
  LocationOptionsCard:
  Card composable que muestra el formulario de selección de nueva ubicación para un item,
  con menús desplegables para bodega y fila, y un campo opcional de remisión.
    - warehouses:List<String> | Lista de bodegas disponibles para seleccionar
    - rows:List<String> | Lista de filas disponibles para seleccionar
    - selectedWarehouse:String | Bodega actualmente seleccionada
    - selectedRow:String | Fila actualmente seleccionada
    - showWarehouseMenu:Boolean | Estado de visibilidad del menú de bodegas
    - showRowMenu:Boolean | Estado de visibilidad del menú de filas
    - onWarehouseMenuChange:(Boolean)->Unit | Callback para cambiar visibilidad del menú de bodegas
    - onRowMenuChange:(Boolean)->Unit | Callback para cambiar visibilidad del menú de filas
    - onWarehouseSelected:(String)->Unit | Callback ejecutado al seleccionar una bodega
    - onRowSelected:(String)->Unit | Callback ejecutado al seleccionar una fila
    - enabled:Boolean | Indica si los controles están habilitados para interacción
    - remisionUbicacion:String | Valor actual del campo de remisión de ubicación
    - onRemisionUbicacionChange:(String)->Unit | Callback para actualizar el campo de remisión
    - requiresRemision:Boolean | Indica si se requiere ingresar remisión y transportista (ubicacion externa, FE-15)
    - isFromExternalLocation:Boolean | Indica si el item viene de una ubicacion externa (exhibicion, FE-14)
    - conveyors:List<String> | Lista de transportadoras disponibles (para FE-15)
    - selectedLocationConveyor:String | Transportadora seleccionada para salida a exhibicion
    - showLocationConveyorMenu:Boolean | Estado de visibilidad del menú de transportadoras en ubicacion
    - onLocationConveyorMenuChange:(Boolean)->Unit | Callback para cambiar visibilidad del menú de transportadoras
    - onLocationConveyorSelected:(String)->Unit | Callback ejecutado al seleccionar una transportadora
*/
@Composable
fun LocationOptionsCard(warehouses: List<String>, rows: List<String>, selectedWarehouse: String, selectedRow: String, showWarehouseMenu: Boolean, showRowMenu: Boolean, onWarehouseMenuChange: (Boolean) -> Unit, onRowMenuChange: (Boolean) -> Unit, onWarehouseSelected: (String) -> Unit, onRowSelected: (String) -> Unit, enabled: Boolean = true, remisionUbicacion: String = "", onRemisionUbicacionChange: (String) -> Unit = {}, requiresRemision: Boolean = false, isFromExternalLocation: Boolean = false, conveyors: List<String> = emptyList(), selectedLocationConveyor: String = "", showLocationConveyorMenu: Boolean = false, onLocationConveyorMenuChange: (Boolean) -> Unit = {}, onLocationConveyorSelected: (String) -> Unit = {})
{

    // Dibujo | Card
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = AppSurface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    )
    {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            // FE-14: aviso visual cuando el item regresa de exhibicion y la ubicacion se fuerza
            if (isFromExternalLocation) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(AppPrimary.copy(alpha = 0.12f))
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    Text(
                        text = "El item regresa del exterior. Se enviará automáticamente a Zona de revisión / 1.",
                        color = AppPrimary,
                        fontSize = 12.sp
                    )
                }
            }

            Text(
                text = "Bodega",
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            // FE-14: dropdowns deshabilitados cuando viene de ubicacion externa
            DropdownField(
                selectedValue = selectedWarehouse,
                placeholder = "Seleccionar bodega",
                expanded = showWarehouseMenu,
                onExpandChange = onWarehouseMenuChange,
                items = warehouses,
                onItemSelected = onWarehouseSelected,
                enabled = enabled && !isFromExternalLocation
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Fila",
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            DropdownField(
                selectedValue = selectedRow,
                placeholder = "Seleccionar fila",
                expanded = showRowMenu,
                onExpandChange = onRowMenuChange,
                items = rows,
                onItemSelected = onRowSelected,
                enabled = enabled && !isFromExternalLocation
            )

            // FE-15: Transportista + Remision — aparece solo si la nueva bodega es externa
            AnimatedVisibility(
                visible = requiresRemision,
                enter = fadeIn(animationSpec = tween(300)) +
                        expandVertically(animationSpec = tween(300)),
                exit = fadeOut(animationSpec = tween(300)) +
                        shrinkVertically(animationSpec = tween(300))
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Spacer(modifier = Modifier.height(16.dp))

                    // Dropdown Transportadora (obligatorio para salidas a exhibicion)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(bottom = 8.dp)
                    ) {
                        Text(
                            text = "Transportadora",
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "*",
                            color = Color(0xFFD46A6A),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    DropdownField(
                        selectedValue = selectedLocationConveyor,
                        placeholder = "Seleccionar transportadora",
                        expanded = showLocationConveyorMenu,
                        onExpandChange = onLocationConveyorMenuChange,
                        items = conveyors,
                        onItemSelected = onLocationConveyorSelected,
                        enabled = enabled
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Campo Remisión (obligatorio para salidas a exhibicion)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(bottom = 8.dp)
                    ) {
                        Text(
                            text = "Remisión",
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "*",
                            color = Color(0xFFD46A6A),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    OutlinedTextField(
                        value = remisionUbicacion,
                        onValueChange = onRemisionUbicacionChange,
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = {
                            Text(
                                text = "Ingrese número de remisión",
                                color = AppOnSurfaceVariant,
                                fontSize = 14.sp
                            )
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            disabledTextColor = Color.White.copy(alpha = 0.5f),
                            focusedContainerColor = AppBackground,
                            unfocusedContainerColor = AppBackground,
                            disabledContainerColor = AppBackground.copy(alpha = 0.5f),
                            focusedBorderColor = AppPrimary,
                            unfocusedBorderColor = AppOutline,
                            disabledBorderColor = AppOutline.copy(alpha = 0.5f),
                            cursorColor = AppPrimary
                        ),
                        shape = RoundedCornerShape(8.dp),
                        singleLine = true,
                        enabled = enabled,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)
                    )
                }
            }
        }
    }
}

//__________________________________________________________________________________________________
//      Card | Seccion 'Despacho'
//__________________________________________________________________________________________________

/*
  DispatchFormCard:
  Card composable que muestra el formulario de registro de despacho de un item,
  con la fecha actual, selector de transportadora y campos de remisión y factura.
    - date:String | Fecha actual formateada para mostrar en el formulario
    - remision:String | Valor actual del campo de remisión
    - factura:String | Valor actual del campo de factura (opcional)
    - conveyors:List<String> | Lista de transportadoras disponibles para seleccionar
    - selectedConveyor:String | Transportadora actualmente seleccionada
    - showConveyorMenu:Boolean | Estado de visibilidad del menú de transportadoras
    - onConveyorMenuChange:(Boolean)->Unit | Callback para cambiar visibilidad del menú de transportadoras
    - onConveyorSelected:(String)->Unit | Callback ejecutado al seleccionar una transportadora
    - onRemisionChange:(String)->Unit | Callback para actualizar el campo de remisión
    - onFacturaChange:(String)->Unit | Callback para actualizar el campo de factura
    - enabled:Boolean | Indica si los controles están habilitados para interacción
*/
@Composable
fun DispatchFormCard(date: String, remision: String, factura: String, conveyors: List<String>, selectedConveyor: String, showConveyorMenu: Boolean, onConveyorMenuChange: (Boolean) -> Unit, onConveyorSelected: (String) -> Unit, onRemisionChange: (String) -> Unit, onFacturaChange: (String) -> Unit, enabled: Boolean = true)
{
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = AppSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            // Fecha de despacho
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFD46A6A)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Despacho",
                        tint = Color.White,
                        modifier = Modifier.size(24.dp)
                    )
                }
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text(
                        text = "Fecha de despacho",
                        color = Color(0xFF95A5A6),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = date,
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            HorizontalDivider(
                color = Color(0xFF4A5F7F).copy(alpha = 0.3f),
                thickness = 1.dp,
                modifier = Modifier.padding(vertical = 16.dp)
            )

            // Campo Transportadora (Obligatorio) — dropdown
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(bottom = 8.dp)
            ) {
                Text(
                    text = "Transportadora",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "*",
                    color = Color(0xFFD46A6A),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            DropdownField(
                selectedValue = selectedConveyor,
                placeholder = "Seleccionar transportadora",
                expanded = showConveyorMenu,
                onExpandChange = onConveyorMenuChange,
                items = conveyors,
                onItemSelected = onConveyorSelected,
                enabled = enabled
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Campo Remisión (Obligatorio)
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(bottom = 8.dp)
                ) {
                    Text(
                        text = "Remisión",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "*",
                        color = Color(0xFFD46A6A),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                OutlinedTextField(
                    value = remision,
                    onValueChange = onRemisionChange,
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = {
                        Text(text = "Ingrese número de remisión", color = AppOnSurfaceVariant, fontSize = 14.sp)
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        disabledTextColor = Color.White.copy(alpha = 0.5f),
                        focusedContainerColor = AppBackground,
                        unfocusedContainerColor = AppBackground,
                        disabledContainerColor = AppBackground.copy(alpha = 0.5f),
                        focusedBorderColor = AppPrimary,
                        unfocusedBorderColor = AppOutline,
                        disabledBorderColor = AppOutline.copy(alpha = 0.5f),
                        cursorColor = AppPrimary
                    ),
                    shape = RoundedCornerShape(8.dp),
                    singleLine = true,
                    enabled = enabled,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Campo Factura (Opcional)
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(bottom = 8.dp)
                ) {
                    Text(
                        text = "Factura",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "(Opcional)",
                        color = Color(0xFF95A5A6),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Normal
                    )
                }
                OutlinedTextField(
                    value = factura,
                    onValueChange = onFacturaChange,
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = {
                        Text(text = "Ingrese número de factura", color = AppOnSurfaceVariant, fontSize = 14.sp)
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        disabledTextColor = Color.White.copy(alpha = 0.5f),
                        focusedContainerColor = AppBackground,
                        unfocusedContainerColor = AppBackground,
                        disabledContainerColor = AppBackground.copy(alpha = 0.5f),
                        focusedBorderColor = AppPrimary,
                        unfocusedBorderColor = AppOutline,
                        disabledBorderColor = AppOutline.copy(alpha = 0.5f),
                        cursorColor = AppPrimary
                    ),
                    shape = RoundedCornerShape(8.dp),
                    singleLine = true,
                    enabled = enabled,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)
                )
            }
        }
    }
}

//__________________________________________________________________________________________________
//      Menu desplegable
//__________________________________________________________________________________________________

/*
  DropdownField:
  Campo composable de menú desplegable con animación de expansión y rotación del ícono.
  Muestra una lista de opciones seleccionables con separadores entre cada elemento.
    - selectedValue:String | Valor actualmente seleccionado (vacío si no hay selección)
    - placeholder:String | Texto a mostrar cuando no hay ningún valor seleccionado
    - expanded:Boolean | Estado de expansión actual del menú
    - onExpandChange:(Boolean)->Unit | Callback para cambiar el estado de expansión
    - items:List<String> | Lista de opciones disponibles para seleccionar
    - onItemSelected:(String)->Unit | Callback ejecutado al seleccionar una opción
    - enabled:Boolean | Indica si el campo está habilitado para interacción
*/
@Composable
fun DropdownField(selectedValue: String, placeholder: String, expanded: Boolean, onExpandChange: (Boolean) -> Unit, items: List<String>, onItemSelected: (String) -> Unit, enabled: Boolean = true)
{
    // Animacion
    val rotationAngle by animateFloatAsState(
        targetValue = if (expanded) 180f else 0f,
        animationSpec = tween(durationMillis = 300),
        label = "rotation"
    )

    // Dibujo
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(if (enabled) AppBackground else AppBackground.copy(alpha = 0.5f))
                .border(
                    width = 1.dp,
                    color = AppOutline,
                    shape = RoundedCornerShape(8.dp)
                )
                .clickable(enabled = enabled) { onExpandChange(!expanded) }
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = if (selectedValue.isEmpty()) placeholder else selectedValue,
                color = if (selectedValue.isEmpty()) AppOnSurfaceVariant else Color.White,
                fontSize = 14.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            Icon(
                imageVector = Icons.Default.KeyboardArrowDown,
                contentDescription = "Expandir",
                tint = Color.White,
                modifier = Modifier
                    .size(20.dp)
                    .rotate(rotationAngle)
            )
        }

        AnimatedVisibility(
            visible = expanded,
            enter = fadeIn(animationSpec = tween(300)) +
                    expandVertically(animationSpec = tween(300)),
            exit = fadeOut(animationSpec = tween(300)) +
                    shrinkVertically(animationSpec = tween(300))
        ) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                shape = RoundedCornerShape(8.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color(0xFF1A252F)
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 200.dp)
                        .verticalScroll(rememberScrollState())
                        .padding(vertical = 8.dp)
                ) {
                    items.forEachIndexed { index, item ->
                        DropdownMenuItem(
                            text = {
                                Text(
                                    text = item,
                                    color = Color.White,
                                    fontSize = 14.sp
                                )
                            },
                            onClick = {
                                onItemSelected(item)
                                onExpandChange(false)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 8.dp),
                            colors = MenuDefaults.itemColors(
                                textColor = Color.White
                            )
                        )
                        if (index < items.size - 1) {
                            HorizontalDivider(
                                color = Color(0xFF4A5F7F).copy(alpha = 0.3f),
                                thickness = 1.dp,
                                modifier = Modifier.padding(horizontal = 16.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

//__________________________________________________________________________________________________
//      Card | Informacion del producto
//__________________________________________________________________________________________________

/*
  ProductInfoCard:
  Card composable que muestra la información actual del item incluyendo su código,
  nombre del producto con tela, y la ubicación actual en bodega y fila.
    - itemCode:String | Código identificador del item
    - product:String | Nombre del producto
    - fabric:String | Tipo de tela del producto (vacío si no aplica)
    - warehouse:String | Bodega actual del item
    - warehouseRow:String | Fila de bodega actual del item
    - hasOptions:Boolean | Indica si el item tiene opciones de actualización disponibles
*/
@Composable
fun ProductInfoCard(itemCode: String, product: String, fabric: String, warehouse: String, warehouseRow: String, hasOptions: Boolean)
{
    val productText = if (fabric.isNotEmpty()) "$product - $fabric" else product
    val locationText = if (warehouseRow.isNotEmpty()) "$warehouse / $warehouseRow" else warehouse

    SectionCard(title = "DETALLE DEL ITEM") {
        InfoRow(label = "Item", value = itemCode)
        InfoRow(label = "Producto", value = productText)
        InfoRow(label = "Ubicación", value = locationText)
        if (hasOptions) {
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(AppPrimary.copy(alpha = 0.2f))
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = "Check",
                    tint = AppPrimary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "Opciones recibidas",
                    color = AppPrimary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}
