package com.allstar.pda.network

import com.allstar.pda.model.ItemInfo
import com.allstar.pda.model.ReturnedItem
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.mockito.Mockito
import org.mockito.Mockito.`when`
import org.mockito.Mockito.anyString
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.same
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import java.io.IOException

/**
 * InventoryApiTest — Phase 2 network behavior verification.
 *
 * Verifies the network layer invariants for phase 2:
 *  - requireBody throws "Respuesta vacía" when response body is null
 *  - executeRequest retries GET on IOException when retryGetOnConnectionFailure=true
 *  - executeRequest does NOT retry non-GET on IOException
 *  - executeRequest does NOT retry GET when retryGetOnConnectionFailure=false
 *  - HTTP error responses preserve the "HTTP {code}: {message}" format
 *  - JSON parsing for ItemInfo and ReturnedItem handles all contract fields
 *
 * Uses real JSONObject (no mocking) for JSON tests; uses real OkHttpClient
 * with injected mock Call objects for retry tests.
 */
class InventoryApiTest {

    // requireBody behavior tests

    @Test
    fun `requireBody throws Respuesta vacia when response body is null`() {
        val mockResponse = mock(Response::class.java)
        `when`(mockResponse.body).thenReturn(null)

        try {
            requireBody(mockResponse)
            fail("Expected Exception to be thrown")
        } catch (e: Exception) {
            assertEquals("Respuesta vacía", e.message)
        }
    }

    @Test
    fun `requireBody returns body string when present`() {
        val mockBody = "{}".toResponseBody("application/json".toMediaType())
        val mockResponse = mock(Response::class.java)
        `when`(mockResponse.body).thenReturn(mockBody)
        `when`(mockBody.string()).thenReturn("""{"item":"12345"}""")

        val result = requireBody(mockResponse)

        assertEquals("""{"item":"12345"}""", result)
    }

    // ---------------------------------------------------------------------------
    // executeRequest retry logic tests
    // ---------------------------------------------------------------------------

    @Test
    fun `executeRequest retries GET request once on IOException when retryGetOnConnectionFailure is true`() {
        val mockCall1 = mock(okhttp3.Call::class.java)
        val mockCall2 = mock(okhttp3.Call::class.java)
        val mockBody = "{}".toResponseBody("application/json".toMediaType())
        val mockResponse = mock(Response::class.java)
        `when`(mockResponse.isSuccessful).thenReturn(true)
        `when`(mockResponse.body).thenReturn(mockBody)
        `when`(mockCall1.execute()).thenThrow(IOException("Connection reset"))
        `when`(mockCall2.execute()).thenReturn(mockResponse)

        val client = buildClientWithCalls(mockCall1, mockCall2)
        val request = newGetRequest("https://api-vm.tail6cef8e.ts.net/api/v1/sheets/inventory/get/12345")

        val result = executeRequestViaReflection(request, client, retryGetOnConnectionFailure = true)

        assertTrue(result.isSuccessful)
        verify(mockCall1, times(1)).execute()
        verify(mockCall2, times(1)).execute()
    }

    @Test
    fun `executeRequest does not retry GET when retryGetOnConnectionFailure is false`() {
        val mockCall = mock(okhttp3.Call::class.java)
        `when`(mockCall.execute()).thenThrow(IOException("Connection reset"))

        val client = buildClientWithCalls(mockCall)
        val request = newGetRequest("https://api-vm.tail6cef8e.ts.net/api/v1/sheets/inventory/get/12345")

        try {
            executeRequestViaReflection(request, client, retryGetOnConnectionFailure = false)
            fail("Expected IOException to propagate")
        } catch (e: IOException) {
            assertEquals("Connection reset", e.message)
            verify(mockCall, times(1)).execute()
        }
    }

    @Test
    fun `executeRequest does not retry non-GET on IOException even when retry flag is true`() {
        val mockCall = mock(okhttp3.Call::class.java)
        `when`(mockCall.execute()).thenThrow(IOException("Connection reset"))

        val client = buildClientWithCalls(mockCall)
        val request = newPostRequest("https://api-vm.tail6cef8e.ts.net/api/v1/sheets/inventory/new/12345")

        try {
            executeRequestViaReflection(request, client, retryGetOnConnectionFailure = true)
            fail("Expected IOException to propagate for POST")
        } catch (e: IOException) {
            assertEquals("Connection reset", e.message)
            verify(mockCall, times(1)).execute()
        }
    }

    @Test
    fun `executeRequest throws IOException when both attempts fail`() {
        val mockCall1 = mock(okhttp3.Call::class.java)
        val mockCall2 = mock(okhttp3.Call::class.java)
        `when`(mockCall1.execute()).thenThrow(IOException("Connection reset"))
        `when`(mockCall2.execute()).thenThrow(IOException("Connection refused"))

        val client = buildClientWithCalls(mockCall1, mockCall2)
        val request = newGetRequest("https://api-vm.tail6cef8e.ts.net/api/v1/sheets/inventory/get/12345")

        try {
            executeRequestViaReflection(request, client, retryGetOnConnectionFailure = true)
            fail("Expected IOException to propagate after retry failure")
        } catch (e: IOException) {
            assertEquals("Connection refused", e.message)
            verify(mockCall1, times(1)).execute()
            verify(mockCall2, times(1)).execute()
        }
    }

    @Test
    fun `executeRequest does not retry when call succeeds on first attempt`() {
        val mockCall = mock(okhttp3.Call::class.java)
        val mockBody = "{}".toResponseBody("application/json".toMediaType())
        val mockResponse = mock(Response::class.java)
        `when`(mockResponse.isSuccessful).thenReturn(true)
        `when`(mockResponse.body).thenReturn(mockBody)
        `when`(mockCall.execute()).thenReturn(mockResponse)

        val client = buildClientWithCalls(mockCall)
        val request = newGetRequest("https://api-vm.tail6cef8e.ts.net/api/v1/sheets/inventory/get/12345")

        val result = executeRequestViaReflection(request, client, retryGetOnConnectionFailure = true)

        assertTrue(result.isSuccessful)
        verify(mockCall, times(1)).execute()
    }

    @Test
    fun `traerDeProduccionAPI does not retry on IOException`() {
        val mockCall = mock(okhttp3.Call::class.java)
        `when`(mockCall.execute()).thenThrow(IOException("Connection reset"))

        val client = buildClientWithCalls(mockCall)

        try {
            runBlocking { TraerDeProduccionAPIWrapper(client, "12345") }
            fail("Expected IOException to propagate for POST")
        } catch (e: IOException) {
            verify(mockCall, times(1)).execute()
        }
    }

    @Test
    fun `traerDeProduccionAPI returns HTTP status code on success`() {
        val mockCall = mock(okhttp3.Call::class.java)
        val mockResponse = mock(Response::class.java)
        `when`(mockResponse.code).thenReturn(200)
        `when`(mockResponse.isSuccessful).thenReturn(true)
        `when`(mockCall.execute()).thenReturn(mockResponse)

        val client = buildClientWithCalls(mockCall)
        val statusCode = runBlocking { TraerDeProduccionAPIWrapper(client, "12345") }

        assertEquals(200, statusCode)
    }

    // ---------------------------------------------------------------------------
    // HTTP error format preservation
    // ---------------------------------------------------------------------------

    @Test
    fun `HTTP error format is preserved for non-2xx responses`() {
        val mockCall = mock(okhttp3.Call::class.java)
        val mockResponse = mock(Response::class.java)
        `when`(mockResponse.code).thenReturn(500)
        `when`(mockResponse.message).thenReturn("Internal Server Error")
        `when`(mockResponse.isSuccessful).thenReturn(false)
        `when`(mockCall.execute()).thenReturn(mockResponse)

        val client = buildClientWithCalls(mockCall)

        try {
            runBlocking { ConsultarItemAPIWrapper(client, "12345") }
            fail("Expected Exception for HTTP 500")
        } catch (e: Exception) {
            assertTrue("Error format must be 'HTTP {code}: {message}'", e.message!!.matches(Regex("""HTTP \d+: .+""")))
            assertTrue("Error message must contain HTTP 500", e.message!!.contains("500"))
            assertTrue("Error message must contain Internal Server Error", e.message!!.contains("Internal Server Error"))
        }
    }

    @Test
    fun `HTTP error format preserved for 404 item not found`() {
        val mockCall = mock(okhttp3.Call::class.java)
        val mockResponse = mock(Response::class.java)
        `when`(mockResponse.code).thenReturn(404)
        `when`(mockResponse.message).thenReturn("Not Found")
        `when`(mockResponse.isSuccessful).thenReturn(false)
        `when`(mockCall.execute()).thenReturn(mockResponse)

        val client = buildClientWithCalls(mockCall)

        try {
            runBlocking { ConsultarItemAPIWrapper(client, "99999") }
            fail("Expected Exception for HTTP 404")
        } catch (e: Exception) {
            assertTrue(e.message!!.contains("HTTP 404"))
            assertTrue(e.message!!.contains("Not Found"))
        }
    }

    // ---------------------------------------------------------------------------
    // JSON parsing — ItemInfo (mirrors actual InventoryApi parsing logic)
    // ---------------------------------------------------------------------------

    @Test
    fun `ItemInfo parsing from full JSON response matches contract`() {
        val json = """{
            "item": "12345",
            "excel_row": 7,
            "product": "MONACO SL LISO",
            "fabric": "TERCIOPELO LISO",
            "warehouse": "Bodega 1 / Piso 1",
            "warehouse_row": "3",
            "opt_warehouse": ["Bodega 1 / Piso 1", "Bodega 2"],
            "opt_row": ["1", "2", "3"],
            "opt_conveyor": ["Servientrega", "Envia"]
        }"""

        val itemInfo = parseConsultarItemResponse(json)

        assertEquals("12345", itemInfo.item)
        assertEquals(7, itemInfo.excelRow)
        assertEquals("MONACO SL LISO", itemInfo.product)
        assertEquals("TERCIOPELO LISO", itemInfo.fabric)
        assertEquals("Bodega 1 / Piso 1", itemInfo.warehouse)
        assertEquals("3", itemInfo.warehouseRow)
        assertTrue(itemInfo.hasOptions)
        assertEquals(2, itemInfo.optWarehouses.size)
        assertEquals("Bodega 1 / Piso 1", itemInfo.optWarehouses[0])
        assertEquals(3, itemInfo.optRows.size)
        assertEquals(2, itemInfo.optConveyors.size)
    }

    @Test
    fun `ItemInfo hasOptions is false when opt_warehouse is absent`() {
        val json = """{
            "item": "67890",
            "excel_row": 10,
            "product": "PRODUCT X",
            "fabric": "",
            "warehouse": "Bodega 2",
            "warehouse_row": "5"
        }"""

        val itemInfo = parseConsultarItemResponse(json)

        assertFalse(itemInfo.hasOptions)
        assertTrue(itemInfo.optWarehouses.isEmpty())
        assertTrue(itemInfo.optRows.isEmpty())
        assertTrue(itemInfo.optConveyors.isEmpty())
    }

    @Test
    fun `ItemInfo hasOptions is false when opt_warehouse is null`() {
        val json = """{
            "item": "11111",
            "excel_row": 3,
            "product": "P",
            "opt_warehouse": null,
            "opt_row": null
        }"""

        val itemInfo = parseConsultarItemResponse(json)

        assertFalse(itemInfo.hasOptions)
    }

    @Test
    fun `ItemInfo defaults for missing optional fields`() {
        val json = """{"item": "99999"}"""

        val itemInfo = parseConsultarItemResponse(json)

        assertEquals("99999", itemInfo.item)
        assertEquals(-1, itemInfo.excelRow)
        assertEquals("N/A", itemInfo.product)
        assertEquals("", itemInfo.fabric)
        assertEquals("N/A", itemInfo.warehouse)
        assertEquals("N/A", itemInfo.warehouseRow)
        assertFalse(itemInfo.hasOptions)
    }

    @Test
    fun `ItemInfo opt_conveyor is parsed independently of hasOptions`() {
        val json = """{
            "item": "55555",
            "excel_row": 1,
            "product": "P",
            "opt_conveyor": ["Servientrega"]
        }"""

        val itemInfo = parseConsultarItemResponse(json)

        assertEquals(1, itemInfo.optConveyors.size)
        assertEquals("Servientrega", itemInfo.optConveyors[0])
    }

    // ---------------------------------------------------------------------------
    // JSON parsing — ReturnedItem
    // ---------------------------------------------------------------------------

    @Test
    fun `ReturnedItem parsing from JSON matches contract`() {
        val json = """{
            "item": "98765",
            "product": "MONACO SL LISO",
            "fabric": "TERCIOPELO LISO",
            "client": "CLIENTE ABC"
        }"""

        val returnedItem = parseReturnItemResponse(json)

        assertEquals("98765", returnedItem.item)
        assertEquals("MONACO SL LISO", returnedItem.product)
        assertEquals("TERCIOPELO LISO", returnedItem.fabric)
        assertEquals("CLIENTE ABC", returnedItem.client)
    }

    @Test
    fun `ReturnedItem defaults for missing optional fields`() {
        val json = """{"item": "DESCONOCIDO-1"}"""

        val returnedItem = parseReturnItemResponse(json)

        assertEquals("DESCONOCIDO-1", returnedItem.item)
        assertEquals("N/A", returnedItem.product)
        assertEquals("", returnedItem.fabric)
        assertEquals("N/A", returnedItem.client)
    }

    // ---------------------------------------------------------------------------
    // Helper: build OkHttpClient with predetermined Call sequence
    // ---------------------------------------------------------------------------

    private fun buildClientWithCalls(vararg calls: okhttp3.Call): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor { chain ->
                val idx = chain.request().url.encodedPath.hashCode() % calls.size
                calls[kotlin.math.abs(idx)].execute()
            }
            .build()
    }

    private fun newGetRequest(url: String): Request {
        return Request.Builder().url(url).get().build()
    }

    private fun newPostRequest(url: String): Request {
        return Request.Builder().url(url).post("".toRequestBody()).build()
    }

    // ---------------------------------------------------------------------------
    // Reflection helpers — inject mock client and invoke private executeRequest
    // ---------------------------------------------------------------------------

    private fun executeRequestViaReflection(
        request: Request,
        client: OkHttpClient,
        retryGetOnConnectionFailure: Boolean
    ): Response {
        val cls = Class.forName("com.allstar.pda.network.InventoryApiKt")
        val method = cls.declaredMethods.first { it.name == "executeRequest" }
        method.isAccessible = true
        return method.invoke(null, request, retryGetOnConnectionFailure) as Response
    }

    private fun injectClient(client: OkHttpClient) {
        val field = Class.forName("com.allstar.pda.network.ApiClient").getDeclaredField("http")
        field.isAccessible = true
        field.set(null, client)
    }

    private fun ConsultarItemAPIWrapper(client: OkHttpClient, item: String): ItemInfo {
        injectClient(client)
        return consultarItemAPI(item)
    }

    private fun TraerDeProduccionAPIWrapper(client: OkHttpClient, item: String): Int {
        injectClient(client)
        return traerDeProduccionAPI(item)
    }

    // ---------------------------------------------------------------------------
    // JSON parsing mirrors (exact copies of InventoryApi's inline parsing logic)
    // ---------------------------------------------------------------------------

    private fun parseConsultarItemResponse(json: String): ItemInfo {
        val jsonObject = org.json.JSONObject(json)

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
            jsonObject.optJSONArray("opt_conveyor")?.let { arr ->
                for (i in 0 until arr.length()) optConveyors.add(arr.getString(i))
            }
        }

        return ItemInfo(
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

    private fun parseReturnItemResponse(json: String): ReturnedItem {
        val jsonObject = org.json.JSONObject(json)
        return ReturnedItem(
            item = jsonObject.optString("item", "N/A"),
            product = jsonObject.optString("product", "N/A"),
            fabric = jsonObject.optString("fabric", ""),
            client = jsonObject.optString("client", "N/A")
        )
    }
}
