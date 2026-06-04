package com.allstar.pda.model

import java.io.Serializable

//__________________________________________________________________________________________________
//      Struct | Informacion del Item
//__________________________________________________________________________________________________

/*
  ItemInfo:
  Representa la información completa de un item del inventario, incluyendo su ubicación actual
  y las opciones de ubicación disponibles para actualización.
    - item:String | Código identificador del item
    - excelRow:Int | Fila en la hoja de cálculo de inventario
    - product:String | Nombre del producto
    - fabric:String | Tipo de tela asociada al producto
    - warehouse:String | Bodega actual del item
    - warehouseRow:String | Fila de bodega actual del item
    - hasOptions:Boolean | Indica si el item tiene opciones de reubicación disponibles
    - optWarehouses:List<String> | Lista de bodegas disponibles para reubicar
    - optRows:List<String> | Lista de filas disponibles para reubicar
    - optConveyors:List<String> | Lista de transportadoras disponibles para despacho
*/
data class ItemInfo(
    val item: String,
    val excelRow: Int,
    val product: String,
    val fabric: String,
    val warehouse: String,
    val warehouseRow: String,
    val hasOptions: Boolean,
    val optWarehouses: List<String> = emptyList(),
    val optRows: List<String> = emptyList(),
    val optConveyors: List<String> = emptyList()
) : Serializable

/*
  ReturnedItem:
  Representa un item que se encuentra en el proceso de devolución al inventario,
  con la información del cliente y el producto asociado.
    - item:String | Código identificador del item devuelto
    - product:String | Nombre del producto devuelto
    - fabric:String | Tipo de tela del producto devuelto
    - client:String | Nombre del cliente que realiza la devolución
*/
data class ReturnedItem(
    val item: String,
    val product: String,
    val fabric: String,
    val client: String
)
