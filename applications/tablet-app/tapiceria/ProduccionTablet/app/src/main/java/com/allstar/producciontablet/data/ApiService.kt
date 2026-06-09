package com.allstar.producciontablet.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {

    @GET("api/empleados")
    suspend fun getEmpleados(): List<EmpleadoDto>

    @GET("api/procesos")
    suspend fun getProcesos(): List<ProcesoDto>

    @GET("api/materiales")
    suspend fun getMateriales(): List<MaterialDto>

    @GET("api/telas")
    suspend fun getTelas(): List<TelaDto>

    @GET("api/ordenes/pendientes/{procesoId}")
    suspend fun getPendientes(
        @Path("procesoId") procesoId: Int
    ): List<ItemDto>

    @GET("api/ordenes/en-proceso/{procesoId}")
    suspend fun getEnProceso(
        @Path("procesoId") procesoId: Int
    ): List<OrdenProcesoDto>

    @POST("api/proceso/asignar")
    suspend fun asignarProceso(
        @Body request: AsignarProcesoRequest
    ): ApiMessageResponse

    @POST("api/proceso/finalizar")
    suspend fun finalizarProceso(
        @Body request: FinalizarProcesoRequest
    ): ApiMessageResponse

    @POST("api/consumo-material/registrar")
    suspend fun registrarConsumoMaterial(
        @Body request: RegistrarConsumoMaterialRequest
    ): ApiMessageResponse

    @POST("api/consumo-tela/registrar")
    suspend fun registrarConsumoTela(
        @Body request: RegistrarConsumoTelaRequest
    ): ApiMessageResponse
}