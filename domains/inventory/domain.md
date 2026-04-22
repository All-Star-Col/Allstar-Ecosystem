# Inventory Domain

Scope note: documenta el flujo de inventario basado en Google Sheets y su integracion con SQL Server segun el codigo actual.

## Objetivo del dominio
Gestionar consulta, alta, ubicacion, despacho y reintegro de items de inventario usando hojas de Google como sistema operativo.

## Responsabilidades observadas
- Consultar un item en hoja `INVENTARIO` con opciones auxiliares (`Complementos`).
- Agregar item nuevo a inventario usando datos fuente de SQL Server.
- Actualizar ubicacion interna/externa de un item.
- Despachar item moviendolo de `INVENTARIO` a `DESPACHADO`.
- Reintegrar item desde `DEVOLUCIONES` a `INVENTARIO`.
- Registrar logs operativos en hoja `Logs`.

## Componentes observados
- API routes:
  - `services/api-service/src/api/v1/routes/sheets/inventory/inventory.py`
- Servicio:
  - `services/api-service/src/services/sheets.py`
- Modelos:
  - `services/api-service/src/schemas/models.py` (`Item_LookupResponse`, `LocationItem`, `DispatchItem`, `Returned_Item`)

## Dependencias externas del dominio
- Google Sheets API (service account).
- SQL Server (consulta de datos de item para altas y sincronizacion).
- Secretos cargados desde Bitwarden (`SHEETS_INVENTARIO_ALLSTAR`, `GOOGLE_CREDENTIALS_JSON`, `SQLSERVER_URL_DATABASE`).

## Limites del dominio
- No hay consumidor directo observable en `applications/web-app` para endpoints `/api/v1/sheets/inventory/*`.
- El dominio expone endpoints sin dependencia de autenticacion en handlers actuales.

## TBD
- Definicion de permisos de negocio para operaciones de inventario.
- UI oficial de inventario dentro del web-app principal.
- SLA/consistencia esperada entre SQL Server y Google Sheets.
