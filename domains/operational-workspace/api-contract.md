# Operational Workspace API Contract (Observed)

Base observable: `/api/v1/workspace` (excepto endpoints de auth raiz).

## Workspace shell

### `GET /api/v1/workspace`
Requiere bearer token.

Response 200:
- `apps: App[]`
- `username`
- `full_name`
- `role_code`
- `is_admin`
- `message`

## Forms
Prefijo: `/api/v1/workspace/forms`

### `GET /categories`
- Response: `CategoriesForms[]` (con soporte ETag/If-None-Match por helper `build_etag_response`).

### `GET /tables`
- Response: `TableForms[]`.

### `GET /tables/{table_name}`
- Response: `TableForms`.

### `GET /lookups/{table_name}/{column_name}`
Query params:
- `q?`
- `limit` (1..200)
- `offset` (>=0)

Response:
- `{ items, total, has_more }`

### `POST /submit`
Body:
- `SubmitForm { table_name, data[] }`

Response:
- `{ status: "success", correlation_id }`

Errores observados en forms:
- `422` identificadores/paginacion invalida.
- `500` error DB/comunicacion.

## Data Viewer
Prefijo: `/api/v1/workspace/data-viewer`

### `GET /tables`
- Response: `DataViewerTable[]`
- Header respuesta: `X-Request-ID`

### `POST /query`
Body: `DataViewerQueryRequest`
- `table_id`
- `columns?`
- `filters?`
- `sort?`
- `q?`
- `limit` (<=200)
- `offset`
- `include_total`

Response: `DataViewerQueryResponse`.

### `POST /export`
Body: mismo contrato de query.

Response:
- CSV stream (`text/csv`)
- `Content-Disposition` con filename
- `X-Request-ID`

### `PATCH /rows`
Body: `DataViewerRowUpdateRequest { table_id, pk, changes }`

Response: `DataViewerRowUpdateResponse`.

Codigos/errores observados (segun servicio):
- `422`: `INVALID_IDENTIFIER`, `INVALID_FILTER`, `UNSUPPORTED_OPERATOR`, `TABLE_NOT_CONFIGURED`, `NO_STABLE_ORDER_COLUMN`, `NO_PK_DEFINED`, `TABLE_NOT_EDITABLE`, `COLUMN_NOT_EDITABLE`, `PK_REQUIRED`, etc.
- `404`: `ROW_NOT_FOUND`.
- `504`: `QUERY_TIMEOUT`.
- `500`: `INTERNAL_ERROR`.

## Carpentry action bus
Prefijo: `/api/v1/workspace/carpentry`

### `GET /actions`
- Response: `{ actions: string[] }`.

### `GET /ping`
- Ejecuta accion `sistema.ping`.

### `POST /invoke`
Body:
- `{ action: string, payload: object }`

Response:
- `{ action, data, request_ts }`

Errores observados:
- `404` accion no soportada.
- `4xx/5xx` mapeados por `AppError` y `map_database_error`.

## Orders
Prefijo registrado: `/api/v1/workspace/orders`.

### `POST /orders`
Path final observable: `/api/v1/workspace/orders/orders`.

Body:
- `Order`.

Response:
- eco del mismo payload.

## TBD
- Contratos de versionado para acciones de carpinteria.
- Normalizacion futura de path de orders (doble `/orders`).
