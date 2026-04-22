# Integracion Google Sheets (Observed)

Este documento describe la integracion observable de `services/api-service` con Google Sheets.

Nota de alcance: se documenta solo lo visible en el repo hoy. Lo no verificable se marca como `TBD`.

## Donde vive

- Rutas HTTP:
  - Trigger de sincronizacion: `services/api-service/src/api/v1/routes/sheets/sheets.py`
  - Inventario y devoluciones: `services/api-service/src/api/v1/routes/sheets/inventory/inventory.py`
- Servicio de integracion: `services/api-service/src/services/sheets.py`
- Scheduler que dispara el trigger: `services/api-service/src/core/scheduler.py`
- Configuracion/secretos: `services/api-service/src/core/config.py`

## Contrato de configuracion

Valores requeridos en runtime (cargados via Bitwarden):

- `settings.SHEETS_INVENTARIO_ALLSTAR` (spreadsheet id)
- `settings.GOOGLE_CREDENTIALS_JSON` (JSON de service account serializado como string)

## Autenticacion y cliente Google (observado)

- Credenciales: `service_account.Credentials.from_service_account_info(...)`
- Scope: `https://www.googleapis.com/auth/spreadsheets`
- Cliente API: `build("sheets", "v4", credentials=creds)`

Si no hay credenciales o hay error al construir cliente, `get_google_service()` retorna `None`.

## Hojas y rangos usados (observado)

Nombres de hojas declarados en `SheetsService.__init__`:

- `INVENTARIO`
- `Complementos`
- `DESPACHADO`
- `Logs`
- `DEVOLUCIONES`

Rangos observados:

- Inventario:
  - Busqueda por item: `INVENTARIO!A:A`
  - Lectura de fila: `INVENTARIO!A{row}:I{row}`
  - Actualizacion de ubicacion/fila: `INVENTARIO!F{row}:G{row}`
  - Actualizacion de observaciones/referral: `INVENTARIO!I{row}`
  - Insercion de item nuevo: append en `INVENTARIO!A:I`
- Complementos:
  - Bodegas: `Complementos!A2:A`
  - Filas: `Complementos!C2:C`
  - Transportadora: `Complementos!I2:I`
- Despachado:
  - Insercion de despachos: append en `DESPACHADO!A:K`
- Logs:
  - Insercion de eventos: append en `Logs!A:H`
- Devoluciones:
  - Consulta item: `DEVOLUCIONES!A:D`
  - Listado pendientes de asignacion: `DEVOLUCIONES!A:N`
  - Lectura y actualizacion de estado/item: `A{row}` y `N{row}`

## Contrato API observable

Prefijos:

- `/api/v1/sheets`
- `/api/v1/sheets/inventory`

Endpoints implementados:

- `POST /api/v1/sheets/trigger/production`
- `GET /api/v1/sheets/inventory/get/{item}`
- `POST /api/v1/sheets/inventory/new/{item}`
- `PATCH /api/v1/sheets/inventory/location/{row}`
- `PATCH /api/v1/sheets/inventory/dispatch/{row}`
- `GET /api/v1/sheets/inventory/return_product/get_unknows`
- `GET /api/v1/sheets/inventory/return_product/get/{item}`
- `POST /api/v1/sheets/inventory/return_product/{item}?new_item=...`

## Dependencia con SQL Server (observado)

Parte de la logica Sheets consulta SQL Server via `pyodbc`:

- `new_item_sync(item)` consulta metadata del item para alta en `INVENTARIO`.
- `compare_coditems_sync()` consulta items recientes y sincroniza hoja de base.

## Scheduler (observado)

- Job APScheduler en `scheduler.py`:
  - frecuencia real: `interval`, `minutes=240` (cada 4 horas)
  - accion: `POST http://localhost:8000/api/v1/sheets/trigger/production`

Nota: comentarios/logs del codigo aun mencionan "cada 10 minutos", pero la configuracion efectiva es 240 minutos.

## Riesgos/observaciones de implementacion

- `compare_coditems_sync()` usa `self.SHEET_NAME_ACCES`, pero ese atributo no se define en `SheetsService.__init__`. Esto puede provocar error en runtime y retorno `500` del trigger.
- Si `get_google_service()` retorna `None`, varias operaciones devuelven codigo de error mapeado por la ruta (`404` o `500` segun endpoint).
- `ship_product_sync()` elimina filas en `INVENTARIO`; la indexacion depende del estado actual de la hoja.

## TBD

- Definicion funcional de columnas por hoja (el repo no incluye un data dictionary formal).
- Politicas de permisos/comparticion del spreadsheet para cuentas de servicio.
- Estrategia de reconciliacion/rollback cuando hay fallos parciales entre SQL Server y Sheets.
