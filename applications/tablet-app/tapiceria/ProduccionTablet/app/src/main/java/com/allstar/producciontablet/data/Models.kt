package com.allstar.producciontablet.data

import com.google.gson.annotations.SerializedName

data class ItemDto(
    @SerializedName("Item legado")
    val itemLegado: Double?,

    @SerializedName("Item")
    val item: Double?,

    @SerializedName("ID")
    val id: Double?,

    @SerializedName("Proceso")
    val proceso: Double?,

    @SerializedName("Orden compra")
    val ordenCompra: Double?,

    @SerializedName("OrdenCompra")
    val ordenCompraProceso: Double?,

    @SerializedName("Cliente")
    val cliente: Double?,

    @SerializedName("Detalle")
    val detalle: String?,

    @SerializedName("Valor unidad")
    val valorUnidad: Double?,

    @SerializedName("ValorUnidad")
    val valorUnidadProceso: Double?,

    @SerializedName("Fecha produccion")
    val fechaProduccion: String?,

    @SerializedName("FechaProduccion")
    val fechaProduccionProceso: String?,

    @SerializedName("Fecha entrega")
    val fechaEntrega: String?,

    @SerializedName("FechaEntrega")
    val fechaEntregaProceso: String?,

    @SerializedName("Notas")
    val notas: String?,

    @SerializedName("ClienteNombre")
    val clienteNombre: String?,

    @SerializedName("OcCliente")
    val ocCliente: String?,

    @SerializedName("Producto")
    val producto: String?,

    @SerializedName("ProductoSku")
    val productoSku: String?,

    @SerializedName("ProcesoNombre")
    val procesoNombre: String?,

    @SerializedName("Empleado")
    val empleado: Double?,

    @SerializedName("EmpleadoNombre")
    val empleadoNombre: String?,

    @SerializedName("Fecha inicio")
    val fechaInicio: String?,

    @SerializedName("Fecha finalizado")
    val fechaFinalizado: String?,

    @SerializedName("Comentario")
    val comentario: String?
)

data class OrdenProcesoDto(
    @SerializedName("ID")
    val id: Double?,

    @SerializedName("Proceso")
    val proceso: Double?,

    @SerializedName("Empleado")
    val empleado: Double?,

    @SerializedName("Item")
    val item: Double?,

    @SerializedName("Fecha inicio")
    val fechaInicio: String?,

    @SerializedName("Fecha finalizado")
    val fechaFinalizado: String?,

    @SerializedName("Comentario")
    val comentario: String?,

    @SerializedName("ProcesoNombre")
    val procesoNombre: String?,

    @SerializedName("EmpleadoNombre")
    val empleadoNombre: String?,

    @SerializedName("Detalle")
    val detalle: String?,

    @SerializedName("OrdenCompra")
    val ordenCompra: Double?,

    @SerializedName("OcCliente")
    val ocCliente: String?,

    @SerializedName("Producto")
    val producto: String?,

    @SerializedName("ProductoSku")
    val productoSku: String?,

    @SerializedName("Cliente")
    val cliente: Double?,

    @SerializedName("ClienteNombre")
    val clienteNombre: String?,

    @SerializedName("ValorUnidad")
    val valorUnidad: Double?,

    @SerializedName("FechaProduccion")
    val fechaProduccion: String?,

    @SerializedName("FechaEntrega")
    val fechaEntrega: String?,

    @SerializedName("Notas")
    val notas: String?
)

data class EmpleadoDto(
    @SerializedName("ID")
    val id: Double?,

    @SerializedName("Nombre")
    val nombre: String?,

    @SerializedName("Area")
    val area: String?,

    @SerializedName("Estado")
    val estado: String?
)

data class ProcesoDto(
    @SerializedName("ID")
    val id: Double?,

    @SerializedName("Nombre")
    val nombre: String?,

    @SerializedName("Area")
    val area: String?
)

data class MaterialDto(
    @SerializedName("ID")
    val id: Double?,

    @SerializedName("Nombre")
    val nombre: String?,

    @SerializedName("Referencia")
    val referencia: String?,

    @SerializedName("Propiedades")
    val propiedades: String?,

    @SerializedName("Unidad medida")
    val unidadMedida: Double?,

    @SerializedName("Costo")
    val costo: Double?
)

data class TelaDto(
    @SerializedName("ID")
    val id: Double?,

    @SerializedName("Nombre")
    val nombre: String?,

    @SerializedName("Referencia")
    val referencia: String?,

    @SerializedName("NombreReferencia")
    val nombreReferencia: String?,

    @SerializedName("Unidad medida")
    val unidadMedida: Double?,

    @SerializedName("Costo")
    val costo: Double?
)

data class AsignarProcesoRequest(
    val item: Int,
    val proceso: Int,
    val empleado: Int,
    val tablet_id: String,
    val comentario: String?
)

data class FinalizarProcesoRequest(
    val orden_proceso_id: Int,
    val comentario: String?
)

data class RegistrarConsumoMaterialRequest(
    val proceso: Int,
    val item: Int,
    val material: Int,
    val cantidad: Double
)

data class RegistrarConsumoTelaRequest(
    val proceso: Int,
    val item: Int,
    val tela: Int,
    val cantidad: Double
)

data class ApiMessageResponse(
    val message: String,
    val orden_proceso_id: Int? = null,
    val fecha_finalizado: String? = null,
    val siguiente_proceso: Int? = null,
    val siguiente_creado: Boolean? = null,
    val siguiente_orden_proceso_id: Int? = null
)
