package com.allstar.pda.network

import com.allstar.pda.model.ItemInfo
import com.allstar.pda.model.ReturnedItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import org.json.JSONObject

private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
private val EMPTY_BODY = "".toRequestBody()

private fun executeRequest(request: Request, retryGetOnConnectionFailure: Boolean = false): Response {
    return try {
        ApiClient.http.newCall(request).execute()
    } catch (ioException: IOException) {
        if (retryGetOnConnectionFailure && request.method == "GET") {
            ApiClient.http.newCall(request).execute()
        } else {
            throw ioException
        }
    }
}

private fun requireBody(response: Response): String = response.body?.string() ?: throw Exception("Respuesta vacía")

//__________________________________________________________________________________________________
//      API | Consultar item en inventario
//__________________________________________________________________________________________________

/*
  consultarItemAPI:
  Consulta la información completa de un item en el inventario mediante su código.
  Retorna un objeto ItemInfo con todos los datos del item incluyendo opciones de ubicación.
    - item:String | Código del item a consultar
*/
suspend fun consultarItemAPI(item: String): ItemInfo = withContext(Dispatchers.IO)
{
    val request = Request.Builder()
        .url("${ApiClient.BASE_URL}/api/v1/sheets/inventory/get/$item")
        .get()
        .build()

    executeRequest(request, retryGetOnConnectionFailure = true).use { response ->
        if (!response.isSuccessful) throw Exception("HTTP ${response.code}: ${response.message}")

        val jsonObject = JSONObject(requireBody(response))

        val hasOptions = jsonObject.has("opt_warehouse") && !jsonObject.isNull("opt_warehouse") &&
                jsonObject.has("opt_row") && !jsonObject.isNull("opt_row")

        val optWarehouses = mutableListOf<String>()
        val optRows = mutableListOf<String>()
        val optConveyors = mutableListOf<String>()

        if (hasOptions) {
            jsonObject.optJSONArray("opt_warehouse")?.let { arr ->
                for (i in 0 until arr.length()) optWarehouses.add(arr.getString(i))
            }
            jsonObject.optJSONArray("opt_row")?.let { arr ->
                for (i in 0 until arr.length()) optRows.add(arr.getString(i))
            }
            // opt_conveyor se parsea independiente de hasOptions, ya que es opcional por sí solo
            jsonObject.optJSONArray("opt_conveyor")?.let { arr ->
                for (i in 0 until arr.length()) optConveyors.add(arr.getString(i))
            }
        }

        ItemInfo(
            item = jsonObject.optString("item", "N/A"),
            excelRow = jsonObject.optInt("excel_row", -1),
            product = jsonObject.optString("product", "N/A"),
            fabric = jsonObject.optString("fabric", ""),
            warehouse = jsonObject.optString("warehouse", "N/A"),
            warehouseRow = jsonObject.optString("warehouse_row", "N/A"),
            hasOptions = hasOptions,
            optWarehouses = optWarehouses,
            optRows = optRows,
            optConveyors = optConveyors
        )
    }
}

//__________________________________________________________________________________________________
//      API | Traer item desde produccion
//__________________________________________________________________________________________________

/*
  traerDeProduccionAPI:
  Solicita al servidor que agregue un item proveniente de producción al inventario.
  Retorna el código HTTP de respuesta para determinar el resultado de la operación.
    - item:String | Código del item a incorporar desde producción
*/
suspend fun traerDeProduccionAPI(item: String): Int = withContext(Dispatchers.IO)
{
    val request = Request.Builder()
        .url("${ApiClient.BASE_URL}/api/v1/sheets/inventory/new/$item")
        .post(EMPTY_BODY)
        .build()

    executeRequest(request).use { response -> response.code }
}

//__________________________________________________________________________________________________
//      API | Consultar item en devoluciones
//__________________________________________________________________________________________________

/*
  getReturnItemAPI:
  Consulta la información de un item registrado en el proceso de devoluciones.
  Retorna un objeto ReturnedItem con los datos del item y el cliente asociado.
    - item:String | Código del item a consultar en devoluciones
*/
suspend fun getReturnItemAPI(item: String): ReturnedItem = withContext(Dispatchers.IO)
{
    val request = Request.Builder().url("${ApiClient.BASE_URL}/api/v1/sheets/inventory/return_product/get/$item").get().build()
    executeRequest(request, retryGetOnConnectionFailure = true).use { response ->
        if (!response.isSuccessful) throw Exception("HTTP ${response.code}: ${response.message}")
        val json = JSONObject(requireBody(response))
        ReturnedItem(
            item    = json.optString("item", "N/A"),
            product = json.optString("product", "N/A"),
            fabric  = json.optString("fabric", ""),
            client  = json.optString("client", "N/A")
        )
    }
}

//__________________________________________________________________________________________________
//      API | Obtener items desconocidos en devoluciones
//__________________________________________________________________________________________________

/*
  getReturnUnknownsAPI:
  Obtiene la lista de todos los items desconocidos pendientes de procesar en devoluciones.
  Retorna una lista de objetos ReturnedItem con los items sin identificar.
*/
suspend fun getReturnUnknownsAPI(): List<ReturnedItem> = withContext(Dispatchers.IO)
{
    val request = Request.Builder().url("${ApiClient.BASE_URL}/api/v1/sheets/inventory/return_product/get_unknows").get().build()
    executeRequest(request, retryGetOnConnectionFailure = true).use { response ->
        if (!response.isSuccessful) throw Exception("HTTP ${response.code}: ${response.message}")
        val arr = org.json.JSONArray(requireBody(response))
        (0 until arr.length()).map { i ->
            val obj = arr.getJSONObject(i)
            ReturnedItem(
                item    = obj.optString("item", "N/A"),
                product = obj.optString("product", "N/A"),
                fabric  = obj.optString("fabric", ""),
                client  = obj.optString("client", "N/A")
            )
        }
    }
}

//__________________________________________________________________________________________________
//      API | Procesar devolucion de item a inventario
//__________________________________________________________________________________________________

/*
  postReturnProductAPI:
  Procesa la devolución de un item al inventario. Permite reasignar un nuevo código de item
  si el original es desconocido o necesita ser reemplazado.
    - item:String | Código del item a devolver al inventario
    - newItem:String? | Nuevo código de item a asignar (opcional, para items desconocidos)
*/
suspend fun postReturnProductAPI(item: String, newItem: String?) = withContext(Dispatchers.IO)
{
    val url = if (!newItem.isNullOrBlank()) {
        "${ApiClient.BASE_URL}/api/v1/sheets/inventory/return_product/$item?new_item=$newItem"
    } else {
        "${ApiClient.BASE_URL}/api/v1/sheets/inventory/return_product/$item"
    }
    val request = Request.Builder().url(url).post(EMPTY_BODY).build()
    executeRequest(request).use { response ->
        if (!response.isSuccessful) throw Exception("HTTP ${response.code}: ${response.message}")
    }
}

//__________________________________________________________________________________________________
//      API | Actualizar ubicacion del item
//__________________________________________________________________________________________________

/*
  actualizarUbicacion:
  Actualiza la ubicación (bodega y fila) de un item en la hoja de inventario.
  Retorna el cuerpo de la respuesta del servidor como texto.
    - excelRow:Int | Fila en la hoja de cálculo del item a actualizar
    - newWarehouse:String | Nueva bodega donde se ubicará el item
    - newRow:String | Nueva fila de bodega donde se ubicará el item
    - referral:String | Número de remisión asociado al movimiento (opcional)
*/
suspend fun actualizarUbicacion(excelRow: Int, newWarehouse: String, newRow: String, referral: String = ""): String = withContext(Dispatchers.IO)
{
    val url = "${ApiClient.BASE_URL}/api/v1/sheets/inventory/location/$excelRow"

    val jsonBody = JSONObject().apply {
        put("new_warehouse", newWarehouse)
        put("new_row", newRow)
        if (referral.isNotEmpty()) put("referral", referral)
    }

    val requestBody = jsonBody.toString().toRequestBody(JSON_MEDIA_TYPE)

    val request = Request.Builder().url(url).patch(requestBody).build()

    executeRequest(request).use { response ->
        if (!response.isSuccessful) {
            throw Exception("HTTP ${response.code}: ${response.message}")
        }

        requireBody(response)
    }
}

//__________________________________________________________________________________________________
//      API | Actualizar despacho del item
//__________________________________________________________________________________________________

/*
  actualizarDespacho:
  Registra el despacho de un item en la hoja de inventario con la información
  de fecha, factura, remisión y transportadora. Retorna la respuesta del servidor.
    - excelRow:Int | Fila en la hoja de cálculo del item a despachar
    - dispatchDate:String | Fecha del despacho en formato dd-MM-yyyy
    - invoice:String | Número de factura del despacho
    - referral:String | Número de remisión del despacho
    - conveyor:String | Nombre de la transportadora encargada del despacho
*/
suspend fun actualizarDespacho(excelRow: Int, dispatchDate: String, invoice: String, referral: String, conveyor: String): String = withContext(Dispatchers.IO)
{
    val url = "${ApiClient.BASE_URL}/api/v1/sheets/inventory/dispatch/$excelRow"

    val jsonBody = JSONObject().apply {
        put("dispatch_date", dispatchDate)
        put("invoice", invoice)
        put("referral", referral)
        put("conveyor", conveyor)
    }

    val requestBody = jsonBody.toString().toRequestBody(JSON_MEDIA_TYPE)

    val request = Request.Builder().url(url).patch(requestBody).build()

    executeRequest(request).use { response ->
        if (!response.isSuccessful) {
            throw Exception("HTTP ${response.code}: ${response.message}")
        }

        requireBody(response)
    }
}
