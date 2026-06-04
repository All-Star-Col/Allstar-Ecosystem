package com.allstar.pda

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.allstar.pda.BuildConfig
import com.allstar.pda.ui.components.AppConfirmDialog
import com.allstar.pda.ui.components.AppPrimaryButton
import com.allstar.pda.ui.components.AppReturnedProductsButton
import com.allstar.pda.ui.components.AppSecondaryButton
import com.allstar.pda.ui.components.AppUpdateDialog
import com.allstar.pda.ui.components.InfoRow
import com.allstar.pda.ui.components.SectionCard
import com.allstar.pda.ui.main.MainNavEvent
import com.allstar.pda.ui.main.MainUiState
import com.allstar.pda.ui.main.MainViewModel
import com.allstar.pda.ui.theme.AppBackground
import com.allstar.pda.ui.theme.AppError
import com.allstar.pda.ui.theme.AppGold
import com.allstar.pda.ui.theme.AppOnSurface
import com.allstar.pda.ui.theme.AppOnSurfaceVariant
import com.allstar.pda.ui.theme.AppOutline
import com.allstar.pda.ui.theme.AppPrimary
import com.allstar.pda.ui.theme.AppSpacing
import com.allstar.pda.ui.theme.AppSuccess
import com.allstar.pda.ui.theme.AppSurface
import com.allstar.pda.ui.theme.AppSurfaceVariant
import com.allstar.pda.ui.theme.PDAAPPTheme
import com.google.firebase.appdistribution.FirebaseAppDistribution

private const val FIREBASE_APP_DIST_TAG = "FirebaseAppDist"

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val viewModel: MainViewModel by viewModels()

        setContent {
            PDAAPPTheme {
                var showUpdateDialog by remember { mutableStateOf(false) }
                var updateReleaseNotes by remember { mutableStateOf("") }
                var isUpdating by remember { mutableStateOf(false) }

                LaunchedEffect(Unit) {
                    checkForUpdate(
                        activity = this@MainActivity,
                        onUpdateAvailable = { notes ->
                            updateReleaseNotes = notes
                            showUpdateDialog = true
                        }
                    )
                }

                if (showUpdateDialog) {
                    AppUpdateDialog(
                        releaseNotes = updateReleaseNotes,
                        isUpdating = isUpdating,
                        onConfirmUpdate = {
                            isUpdating = true
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
                                val intent = Intent(
                                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                    Uri.parse("package:$packageName")
                                )
                                startActivity(intent)
                                isUpdating = false
                                return@AppUpdateDialog
                            }

                            FirebaseAppDistribution.getInstance()
                                .updateApp()
                                .addOnFailureListener {
                                    logFirebaseFailure("update_failed", it)
                                    isUpdating = false
                                }
                        },
                        onDismiss = {
                            if (!isUpdating) showUpdateDialog = false
                        }
                    )
                }

                ScannerScreen(viewModel = viewModel)
            }
        }
    }
}

private fun logFirebaseFailure(event: String, throwable: Throwable?) {
    Log.e(FIREBASE_APP_DIST_TAG, event)
    if (BuildConfig.DEBUG && throwable != null) {
        Log.d(FIREBASE_APP_DIST_TAG, "$event debug_detail=${throwable.message}")
    }
}

fun checkForUpdate(activity: ComponentActivity, onUpdateAvailable: (releaseNotes: String) -> Unit) {
    val firebaseAppDistribution = FirebaseAppDistribution.getInstance()

    if (!firebaseAppDistribution.isTesterSignedIn) {
        firebaseAppDistribution.signInTester()
            .addOnSuccessListener {
                checkForNewRelease(firebaseAppDistribution, onUpdateAvailable)
            }
            .addOnFailureListener { exception ->
                logFirebaseFailure("sign_in_failed", exception)
            }
    } else {
        checkForNewRelease(firebaseAppDistribution, onUpdateAvailable)
    }
}

fun checkForNewRelease(
    firebaseAppDistribution: FirebaseAppDistribution,
    onUpdateAvailable: (releaseNotes: String) -> Unit
) {
    firebaseAppDistribution.checkForNewRelease()
        .addOnSuccessListener { release ->
            if (release != null) {
                onUpdateAvailable(release.releaseNotes ?: "")
            }
        }
        .addOnFailureListener { exception ->
            logFirebaseFailure("check_release_failed", exception)
        }
}

fun isTailscaleActive(context: Context): Boolean {
    val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val network = connectivityManager.activeNetwork
        val capabilities = connectivityManager.getNetworkCapabilities(network)
        capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true
    } else {
        @Suppress("DEPRECATION")
        connectivityManager.allNetworks.any { network ->
            val capabilities = connectivityManager.getNetworkCapabilities(network)
            capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScannerScreen(viewModel: MainViewModel) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    var itemNumber by rememberSaveable { mutableStateOf("") }
    var itemFieldHint by rememberSaveable { mutableStateOf<String?>(null) }

    val normalizedItem = remember(itemNumber) { itemNumber.filter(Char::isDigit) }
    val isBusy = uiState.isLoadingConsulta || uiState.isLoadingProduccion || uiState.isLoadingDevolucion
    val canRunPrimaryActions = normalizedItem.isNotBlank() && uiState.isTailscaleOn

    LaunchedEffect(Unit) {
        viewModel.navEvents.collect { event ->
            when (event) {
                is MainNavEvent.GoToStock -> {
                    val intent = Intent(context, StockActivity::class.java).apply {
                        putExtra("ITEM_INFO", event.itemInfo)
                    }
                    context.startActivity(intent)
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Escaneo / Consulta",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                actions = {
                    TailscaleStatusChip(isConnected = uiState.isTailscaleOn)
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AppSurfaceVariant,
                    titleContentColor = AppOnSurface
                )
            )
        },
        containerColor = AppBackground
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = AppSpacing.xxl)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(AppSpacing.xxl))

            ScannerHeroSection(
                isBusy = isBusy,
                isConnected = uiState.isTailscaleOn
            )

            Spacer(modifier = Modifier.height(AppSpacing.xxl))

            InputCard(
                itemNumber = itemNumber,
                itemHint = itemFieldHint,
                onItemNumberChange = { value ->
                    val normalized = value.filter(Char::isDigit)
                    itemFieldHint = if (value != normalized) {
                        "Solo se permiten números para el item."
                    } else {
                        null
                    }
                    itemNumber = normalized
                },
                isBusy = isBusy,
                canRunPrimaryActions = canRunPrimaryActions,
                isLoadingConsulta = uiState.isLoadingConsulta,
                isLoadingProduccion = uiState.isLoadingProduccion,
                onConsultar = { viewModel.consultarItem(normalizedItem) },
                onTraerProduccion = { viewModel.traerDeProduccion(normalizedItem) }
            )

            Spacer(modifier = Modifier.height(AppSpacing.lg))

            SectionCard(title = "Devoluciones") {
                Text(
                    text = "Reintegra artículos devueltos al inventario activo.",
                    style = MaterialTheme.typography.bodySmall,
                    color = AppOnSurfaceVariant
                )

                Spacer(modifier = Modifier.height(AppSpacing.md))

                AppReturnedProductsButton(
                    text = if (uiState.isLoadingDevolucion) "Cargando..." else "Devolución → Inventario",
                    onClick = { viewModel.devolverAInventario(normalizedItem) },
                    modifier = Modifier.fillMaxWidth(),
                    isLoading = uiState.isLoadingDevolucion,
                    enabled = !uiState.isLoadingDevolucion && uiState.isTailscaleOn
                )
            }

            Spacer(modifier = Modifier.height(AppSpacing.xxxl))
        }
    }

    if (uiState.showConfirmDialog) {
        AppConfirmDialog(
            title = "Confirmar",
            message = "¿Desea cargar el item $normalizedItem desde producción?",
            confirmText = "Aceptar",
            onConfirm = { viewModel.ejecutarTraerProduccion(normalizedItem) },
            onDismiss = { viewModel.dismissConfirm() },
            dismissText = "Cancelar"
        )
    }

    if (uiState.showSuccessDialog && uiState.successMessage != null) {
        AppConfirmDialog(
            title = "Éxito",
            message = uiState.successMessage ?: "Operación exitosa",
            confirmText = "Aceptar",
            onConfirm = { viewModel.dismissSuccess() },
            onDismiss = { viewModel.dismissSuccess() },
            confirmColor = AppSuccess
        )
    }

    if (uiState.showErrorDialog && uiState.errorMessage != null) {
        AppConfirmDialog(
            title = "Error",
            message = uiState.errorMessage ?: "Error desconocido",
            confirmText = "Aceptar",
            onConfirm = { viewModel.dismissError() },
            onDismiss = { viewModel.dismissError() },
            confirmColor = AppError
        )
    }

    if (uiState.showReturnKnownDialog && uiState.returnedItem != null) {
        AppConfirmDialog(
            title = "Confirmar devolución",
            confirmText = "Confirmar",
            onConfirm = {
                viewModel.ejecutarDevolucion(item = uiState.returnedItem!!.item, newItem = null)
            },
            onDismiss = { viewModel.dismissReturnKnown() },
            dismissText = "Cancelar",
            content = {
                Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                    InfoRow(label = "Item", value = uiState.returnedItem!!.item)
                    InfoRow(label = "Producto", value = uiState.returnedItem!!.product)
                    InfoRow(label = "Tela", value = uiState.returnedItem!!.fabric)
                    InfoRow(label = "Cliente", value = uiState.returnedItem!!.client)
                }
            }
        )
    }

    if (uiState.showReturnUnknownDialog) {
        val canConfirm = uiState.selectedUnknown != null && uiState.newItemNumber.isNotBlank()

        AppConfirmDialog(
            title = "Devolución → Inventario",
            confirmText = "Confirmar",
            onConfirm = {
                viewModel.ejecutarDevolucion(
                    item = uiState.selectedUnknown!!.item,
                    newItem = uiState.newItemNumber
                )
            },
            onDismiss = { viewModel.dismissReturnUnknown() },
            dismissText = "Cancelar",
            confirmEnabled = canConfirm,
            content = {
                ReturnUnknownDialogContent(
                    uiState = uiState,
                    onDropdownToggle = { expanded -> viewModel.onUnknownDropdownChange(expanded) },
                    onUnknownSelected = { unknown -> viewModel.onUnknownSelected(unknown) },
                    onNewItemValueChange = { value ->
                        viewModel.onNewItemNumberChange(value.filter(Char::isDigit))
                    }
                )
            }
        )
    }
}

@Composable
private fun TailscaleStatusChip(isConnected: Boolean) {
    val context = LocalContext.current
    val tailscalePackage = "com.tailscale.ipn"

    val chipColor by animateColorAsState(
        targetValue = if (isConnected) AppSuccess else AppError,
        animationSpec = tween(durationMillis = 350, easing = FastOutSlowInEasing),
        label = "tailscale_chip_color"
    )

    Surface(
        modifier = Modifier
            .padding(end = AppSpacing.md)
            .clickable {
                val launchIntent = context.packageManager.getLaunchIntentForPackage(tailscalePackage)
                if (launchIntent != null) {
                    context.startActivity(launchIntent)
                } else {
                    val playIntent = Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("market://details?id=$tailscalePackage")
                    )
                    context.startActivity(playIntent)
                }
            },
        shape = RoundedCornerShape(AppSpacing.chipCorner),
        color = chipColor.copy(alpha = 0.14f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = AppSpacing.md, vertical = AppSpacing.sm),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)
        ) {
            Box(
                modifier = Modifier
                    .size(AppSpacing.sm)
                    .background(chipColor, RoundedCornerShape(AppSpacing.chipCorner))
            )

            AnimatedContent(targetState = isConnected, label = "tailscale_status") { connected ->
                Text(
                    text = if (connected) "Conectado" else "Desconectado",
                    style = MaterialTheme.typography.labelMedium,
                    color = chipColor,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
private fun ScannerHeroSection(isBusy: Boolean, isConnected: Boolean) {
    val statusColor = when {
        isBusy -> AppGold
        isConnected -> AppSuccess
        else -> AppError
    }

    val statusText = when {
        isBusy -> "Procesando operación..."
        isConnected -> "Listo para escanear"
        else -> "Sin conexión de red"
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(AppSpacing.cardCorner),
        colors = CardDefaults.cardColors(containerColor = AppSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = AppSpacing.sm)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = AppSpacing.xl, horizontal = AppSpacing.lg),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md)
        ) {
            Text(
                text = "Escaner",
                style = MaterialTheme.typography.titleMedium,
                color = AppOnSurface,
                fontWeight = FontWeight.SemiBold
            )

            ScannerFrame(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 188.dp)
                    .sizeIn(minWidth = 132.dp, minHeight = 132.dp)
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)
            ) {
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .background(statusColor, RoundedCornerShape(AppSpacing.chipCorner))
                )

                Text(
                    text = statusText,
                    style = MaterialTheme.typography.labelLarge,
                    color = statusColor
                )
            }
        }
    }
}

@Composable
private fun ScannerFrame(modifier: Modifier = Modifier) {
    val infiniteTransition = rememberInfiniteTransition(label = "scanner")

    val sweepProgress by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2100, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scanner_sweep"
    )

    val glowPulse by infiniteTransition.animateFloat(
        initialValue = 0.25f,
        targetValue = 0.65f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scanner_glow"
    )

    Box(
        modifier = modifier
            .heightIn(min = 132.dp, max = 188.dp)
            .background(
                color = AppSurfaceVariant.copy(alpha = 0.75f),
                shape = RoundedCornerShape(AppSpacing.md)
            )
            .padding(AppSpacing.sm)
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val scannerColor = AppGold
            val cornerLength = size.minDimension * 0.15f
            val thickStroke = size.minDimension * 0.018f
            val thinStroke = size.minDimension * 0.008f
            val innerPadding = size.minDimension * 0.08f
            val lineY = size.height * sweepProgress

            drawRoundRect(
                color = scannerColor.copy(alpha = glowPulse * 0.35f),
                style = Stroke(width = thinStroke),
                cornerRadius = CornerRadius(16f, 16f)
            )

            drawRoundRect(
                color = scannerColor.copy(alpha = 0.2f),
                topLeft = Offset(innerPadding, innerPadding),
                size = androidx.compose.ui.geometry.Size(
                    width = size.width - (innerPadding * 2),
                    height = size.height - (innerPadding * 2)
                ),
                style = Stroke(width = thinStroke * 0.8f),
                cornerRadius = CornerRadius(12f, 12f)
            )

            drawLine(scannerColor, Offset(0f, cornerLength), Offset(0f, 0f), thickStroke)
            drawLine(scannerColor, Offset(0f, 0f), Offset(cornerLength, 0f), thickStroke)
            drawLine(scannerColor, Offset(size.width - cornerLength, 0f), Offset(size.width, 0f), thickStroke)
            drawLine(scannerColor, Offset(size.width, 0f), Offset(size.width, cornerLength), thickStroke)
            drawLine(scannerColor, Offset(0f, size.height - cornerLength), Offset(0f, size.height), thickStroke)
            drawLine(scannerColor, Offset(0f, size.height), Offset(cornerLength, size.height), thickStroke)
            drawLine(scannerColor, Offset(size.width - cornerLength, size.height), Offset(size.width, size.height), thickStroke)
            drawLine(scannerColor, Offset(size.width, size.height - cornerLength), Offset(size.width, size.height), thickStroke)

            drawLine(
                color = scannerColor.copy(alpha = glowPulse),
                start = Offset(innerPadding, lineY),
                end = Offset(size.width - innerPadding, lineY),
                strokeWidth = thickStroke * 0.8f,
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(14f, 8f))
            )

            drawLine(
                color = scannerColor.copy(alpha = glowPulse * 0.4f),
                start = Offset(innerPadding, lineY - (thickStroke * 1.1f)),
                end = Offset(size.width - innerPadding, lineY - (thickStroke * 1.1f)),
                strokeWidth = thinStroke
            )
        }
    }
}

@Composable
private fun InputCard(
    itemNumber: String,
    itemHint: String?,
    onItemNumberChange: (String) -> Unit,
    isBusy: Boolean,
    canRunPrimaryActions: Boolean,
    isLoadingConsulta: Boolean,
    isLoadingProduccion: Boolean,
    onConsultar: () -> Unit,
    onTraerProduccion: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(AppSpacing.cardCorner),
        colors = CardDefaults.cardColors(containerColor = AppSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = AppSpacing.sm)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(AppSpacing.xl),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.lg)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.xs)) {
                Text(
                    text = "Número de item",
                    style = MaterialTheme.typography.titleMedium,
                    color = AppOnSurface,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "Escanee o escriba solo números para consultar o traer de producción.",
                    style = MaterialTheme.typography.bodySmall,
                    color = AppOnSurfaceVariant
                )
            }

            OutlinedTextField(
                value = itemNumber,
                onValueChange = onItemNumberChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(AppSpacing.fieldHeight),
                placeholder = {
                    Text(
                        text = "192410",
                        style = MaterialTheme.typography.bodyMedium,
                        color = AppOnSurfaceVariant
                    )
                },
                textStyle = MaterialTheme.typography.bodyLarge,
                supportingText = if (itemHint != null) {
                    {
                        Text(
                            text = itemHint,
                            style = MaterialTheme.typography.bodySmall,
                            color = AppOnSurfaceVariant
                        )
                    }
                } else {
                    null
                },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = AppOnSurface,
                    unfocusedTextColor = AppOnSurface,
                    focusedContainerColor = AppBackground,
                    unfocusedContainerColor = AppBackground,
                    focusedBorderColor = AppPrimary,
                    unfocusedBorderColor = AppOutline,
                    disabledContainerColor = AppBackground,
                    disabledBorderColor = AppOutline,
                    disabledTextColor = AppOnSurfaceVariant,
                    cursorColor = AppPrimary
                ),
                shape = MaterialTheme.shapes.medium,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                enabled = !isBusy
            )

            ActionButtonGroup(
                isLoadingConsulta = isLoadingConsulta,
                isLoadingProduccion = isLoadingProduccion,
                canRunPrimaryActions = canRunPrimaryActions,
                onConsultar = onConsultar,
                onTraerProduccion = onTraerProduccion
            )
        }
    }
}

@Composable
private fun ActionButtonGroup(
    isLoadingConsulta: Boolean,
    isLoadingProduccion: Boolean,
    canRunPrimaryActions: Boolean,
    onConsultar: () -> Unit,
    onTraerProduccion: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(AppSpacing.md)
    ) {
        AppPrimaryButton(
            text = if (isLoadingConsulta) "Consultando..." else "Consultar",
            onClick = onConsultar,
            modifier = Modifier.fillMaxWidth(),
            isLoading = isLoadingConsulta,
            enabled = canRunPrimaryActions,
            icon = Icons.Default.Search
        )

        AppSecondaryButton(
            text = if (isLoadingProduccion) "Cargando..." else "Traer de Producción",
            onClick = onTraerProduccion,
            modifier = Modifier.fillMaxWidth(),
            isLoading = isLoadingProduccion,
            enabled = canRunPrimaryActions,
            icon = Icons.Default.ArrowUpward
        )
    }
}

@Composable
private fun ReturnUnknownDialogContent(
    uiState: MainUiState,
    onDropdownToggle: (Boolean) -> Unit,
    onUnknownSelected: (com.allstar.pda.model.ReturnedItem) -> Unit,
    onNewItemValueChange: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(AppSpacing.md)
    ) {
        Text(
            text = "Seleccione un item devuelto",
            style = MaterialTheme.typography.titleSmall,
            color = AppOnSurface,
            fontWeight = FontWeight.SemiBold
        )

        OutlinedButton(
            onClick = { onDropdownToggle(!uiState.showUnknownDropdown) },
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.medium
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = uiState.selectedUnknown?.item ?: "Seleccionar...",
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (uiState.selectedUnknown == null) AppOnSurfaceVariant else AppOnSurface
                )
                Icon(
                    imageVector = if (uiState.showUnknownDropdown) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                    contentDescription = null,
                    tint = AppOnSurface
                )
            }
        }

        AnimatedVisibility(
            visible = uiState.showUnknownDropdown,
            enter = fadeIn(tween(220)) + expandVertically(tween(220)),
            exit = fadeOut(tween(180)) + shrinkVertically(tween(180))
        ) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 220.dp),
                shape = RoundedCornerShape(AppSpacing.md),
                colors = CardDefaults.cardColors(containerColor = AppSurfaceVariant)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                ) {
                    uiState.returnedUnknownList.forEach { returnedItem ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onUnknownSelected(returnedItem) }
                                .padding(horizontal = AppSpacing.lg, vertical = AppSpacing.md),
                            verticalArrangement = Arrangement.spacedBy(AppSpacing.xs)
                        ) {
                            Text(
                                text = returnedItem.item,
                                style = MaterialTheme.typography.titleSmall,
                                color = AppOnSurface
                            )
                            Text(
                                text = "${returnedItem.product} ${returnedItem.fabric} | ${returnedItem.client}",
                                style = MaterialTheme.typography.bodySmall,
                                color = AppOnSurfaceVariant
                            )
                        }
                        HorizontalDivider(color = AppOutline.copy(alpha = 0.3f))
                    }
                }
            }
        }

        if (uiState.selectedUnknown != null) {
            Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs)
                ) {
                    Text(
                        text = "Nuevo item",
                        style = MaterialTheme.typography.titleSmall,
                        color = AppOnSurface,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "*",
                        color = AppError,
                        style = MaterialTheme.typography.titleSmall
                    )
                }

                OutlinedTextField(
                    value = uiState.newItemNumber,
                    onValueChange = onNewItemValueChange,
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = {
                        Text(
                            text = "Ingrese número de item",
                            style = MaterialTheme.typography.bodyMedium,
                            color = AppOnSurfaceVariant
                        )
                    },
                    textStyle = MaterialTheme.typography.bodyLarge,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = AppOnSurface,
                        unfocusedTextColor = AppOnSurface,
                        focusedContainerColor = AppSurfaceVariant,
                        unfocusedContainerColor = AppSurfaceVariant,
                        focusedBorderColor = AppPrimary,
                        unfocusedBorderColor = AppOutline,
                        cursorColor = AppPrimary
                    )
                )
            }
        }

        if (uiState.selectedUnknown != null && uiState.newItemNumber.isNotBlank()) {
            HorizontalDivider(color = AppOutline.copy(alpha = 0.4f))
            Text(
                text = "Resumen",
                style = MaterialTheme.typography.titleSmall,
                color = AppPrimary,
                fontWeight = FontWeight.SemiBold
            )
            InfoRow(label = "Item original", value = uiState.selectedUnknown!!.item)
            InfoRow(label = "Nuevo item", value = uiState.newItemNumber)
            InfoRow(
                label = "Producto",
                value = "${uiState.selectedUnknown!!.product} ${uiState.selectedUnknown!!.fabric}"
            )
            InfoRow(label = "Cliente", value = uiState.selectedUnknown!!.client)
        }
    }
}
