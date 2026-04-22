# Inventory API Contract (Observed)

Base observable: `/api/v1/sheets/inventory`.

Nota: en handlers actuales no se observa dependencia de auth (`Depends(get_current_user)`), por lo que estos endpoints no exigen bearer token en codigo de ruta.

## `GET /get/{item}`
Retorna datos de item y listas de opciones.

Response 200:
- `Item_LookupResponse`

Errores observados:
- `404` item no encontrado.

## `GET /return_product/get_unknows`
Retorna items en `DEVOLUCIONES` con estado `Por revisar y asignar item`.

Response 200:
- `Returned_Item[]`

Errores observados:
- `500` si falla lectura de `DEVOLUCIONES`.

## `GET /return_product/get/{item}`
Busca item en `DEVOLUCIONES` por columna A.

Response 200:
- `Returned_Item`

Errores observados:
- `404` item no encontrado en devoluciones.

## `POST /new/{item}`
Agrega item a `INVENTARIO` consultando SQL Server.

Response 200:
- `{ "status": "OK" }`

Errores observados:
- `404` item no existe en origen o no hay servicio.
- `409` item ya existe en inventario/despachado.
- `500` error interno.

## `POST /return_product/{item}?new_item={optional}`
Reintegra item desde `DEVOLUCIONES` a `INVENTARIO`.

Regla observada:
- Si `item` inicia con `DESCONOCIDO`, `new_item` es obligatorio.

Response 200:
- `{ "status": "OK" }`

Errores observados:
- `422` falta `new_item` en caso `DESCONOCIDO`.
- `404` item no encontrado.
- `409` item destino duplicado en inventario.
- `500` error interno.

## `PATCH /location/{row}`
Body:
- `LocationItem { new_warehouse, new_row, referral? }`

Response 200:
- `{ "status": "OK" }`

Errores observados:
- `404` no hay servicio Google Sheets.
- `500` fallo de actualizacion.

## `PATCH /dispatch/{row}`
Body:
- `DispatchItem { dispatch_date, invoice, referral, conveyor }`

Response 200:
- `{ "status": "OK" }`

Errores observados:
- `404` no hay servicio Google Sheets.
- `500` fallo de actualizacion.

## TBD
- Contrato de idempotencia para `POST /new/{item}` y `POST /return_product/{item}`.
- Politica de autenticacion/autorizacion para estos endpoints.
