# Inventory Data Model (Observed)

Scope note: modelo derivado de estructuras usadas por `SheetsService` y modelos Pydantic.

## Hojas de Google observadas

### `INVENTARIO`
Mapeo de columnas observado en codigo:
- `A`: item
- `B`: producto
- `C`: tela
- `D`: cliente
- `E`: orden
- `F`: ubicacion
- `G`: fila
- `H`: valor producto
- `I`: observaciones producto

Evidencia:
- `services/api-service/src/services/sheets.py`

### `Complementos`
Columnas consultadas para opciones:
- `A`: opciones de bodega (`opt_warehouse`)
- `C`: opciones de fila (`opt_row`)
- `I`: opciones de transportador (`opt_conveyor`)

### `DESPACHADO`
Mapeo de escritura observado:
- `A` item, `B` producto, `C` tela, `D` cliente, `E` orden,
- `F` salida/remision, `G` factura, `H` fecha despacho,
- `I` transportador, `J` valor producto, `K` observaciones entrega.

### `DEVOLUCIONES`
Campos leidos/actualizados por flujo de reintegro:
- `A` item
- `B` producto
- `C` tela
- `D` cliente
- `E` orden
- `N` estado
- Otras columnas intermedias usadas para reconstruir inventario.

### `Logs`
Append en rango `A:H` con:
- Macro
- Item
- Actividad
- Detalle
- Observaciones
- Usuario (service account)
- Fecha
- Hora

## Fuente SQL Server (alta de item)
Consulta observada usa tablas:
- `Item`
- `Producto`
- `Referencia`
- `Clientes`
- `Modelo`
- `ReferenciaTela`
- `Tela`

Evidencia:
- `services/api-service/src/services/sheets.py` (`new_item_sync`)

## Modelos API observados
- `Item_LookupResponse`
- `Returned_Item`
- `LocationItem`
- `DispatchItem`

Evidencia:
- `services/api-service/src/schemas/models.py`

## TBD
- Estructura completa (headers oficiales) de cada hoja fuera de columnas usadas en codigo.
- Reglas de calidad de datos (normalizacion de item, cliente, bodega).
- Politica de versionado de esquema en Sheets.
