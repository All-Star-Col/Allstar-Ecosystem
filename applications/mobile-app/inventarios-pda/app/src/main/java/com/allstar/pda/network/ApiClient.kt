package com.allstar.pda.network

import okhttp3.ConnectionPool
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/*
  ApiClient:
  Objeto singleton que provee la configuración base del cliente HTTP para todas las
  peticiones a la API REST del inventario, incluyendo la URL base y el cliente OkHttp configurado.
*/
object ApiClient
{
    //const val BASE_URL = "http://100.89.244.92:8000" //Test IP
    const val BASE_URL = "https://api-vm.tail6cef8e.ts.net"

    val http: OkHttpClient = OkHttpClient.Builder()
        .connectionPool(ConnectionPool(5, 30, TimeUnit.SECONDS))
        .connectTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .callTimeout(90, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()
}
