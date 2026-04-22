# Integracion SQL Server (Observed)

Este documento describe la integracion observable entre `services/api-service` y SQL Server.

Nota de alcance: solo se documenta lo visible en el repo. Lo no verificable se marca como `TBD`.

## Donde vive

- Configuracion/secreto de conexion:
  - `services/api-service/src/core/config.py` (`SQLSERVER_URL_DATABASE`)
- Conexion SQL Server:
  - `services/api-service/src/services/sheets.py` (`pyodbc.connect(...)`)
  - `services/api-service/src/db/database.py` (`get_sqlserver_db`)
- Casos de uso activos:
  - sincronizacion e ingreso de inventario en `services/api-service/src/services/sheets.py`

## Contrato de conexion

- Connection string: `settings.SQLSERVER_URL_DATABASE` (cargado desde Bitwarden).
- Si falta este valor, `db/database.py` lanza `RuntimeError` al importar modulo.
- Cliente usado: `pyodbc`.

## Uso funcional observado

La integracion SQL Server se usa desde el dominio de Sheets/Inventario:

### Alta de item a inventario (`new_item_sync`)

- Endpoint origen: `POST /api/v1/sheets/inventory/new/{item}`
- Consulta `SELECT TOP 1 ... FROM Item ... JOIN ... WHERE Item.CodItem = ?`
- Tablas referenciadas en query:
  - `Item`
  - `Producto`
  - `Referencia`
  - `Clientes`
  - `Modelo`
  - `ReferenciaTela`
  - `Tela`
- Resultado se transforma para insertar fila en Google Sheets (`INVENTARIO`).

### Sincronizacion periodica (`compare_coditems_sync`)

- Endpoint origen: `POST /api/v1/sheets/trigger/production`
- Scheduler interno llama ese endpoint cada 240 minutos.
- Query principal: `SELECT ... FROM Item ... JOIN ... WHERE Item.FechaPedido >= DATEADD(MONTH, -2, GETDATE())`
- Salida de SQL Server se usa para actualizar/insertar filas en hoja base de Sheets.

## Dependencias async/sync

- `pyodbc` es sincronico.
- En `SheetsService`, las funciones sync se ejecutan desde wrappers async con `run_in_threadpool(...)`.
- `db/database.py` incluye `get_sqlserver_db()` con `run_in_threadpool(pyodbc.connect, ...)`, pero no se observaron rutas que lo usen directamente.

## Riesgos y notas observadas

- Si falla SQL Server, los endpoints Sheets dependientes devuelven error (`404`/`500` segun flujo).
- `compare_coditems_sync` depende de una hoja destino en Sheets (`SHEET_NAME_ACCES`) que no esta declarada en el servicio; eso puede causar fallo aun con SQL Server disponible.
- Comentarios del codigo sobre ventana temporal muestran inconsistencia:
  - comentario menciona "ultimos 3 meses"
  - query aplica `DATEADD(MONTH, -2, ...)`

## TBD

- Driver ODBC exacto, cifrado TLS, timeouts y politicas de reconexion (definidos dentro del secret, no visibles).
- Propiedad y gobernanza del esquema SQL Server fuente.
- SLA de disponibilidad de SQL Server para no afectar sincronizacion de inventario.
