# Production Domain

Scope note: este dominio concentra comportamiento observable relacionado con produccion en tres frentes: sincronizacion backend, acciones de carpinteria y modulo frontend de registros de produccion.

## Objetivo del dominio
Soportar el ciclo operativo de produccion desde sincronizacion de datos y registro de actividad hasta carga manual/asistida de ordenes.

## Responsabilidades observadas
- Ejecutar trigger de sincronizacion de produccion hacia Google Sheets (`POST /api/v1/sheets/trigger/production`).
- Programar ejecucion periodica del trigger por APScheduler.
- Exponer acciones de produccion via carpentry action bus (`produccion.*`).
- Proveer interfaz frontend `products` para procesar correos y crear ordenes (con APIs externas al `api-service`).

## Componentes observados
- Backend sync:
  - `services/api-service/src/api/v1/routes/sheets/sheets.py`
  - `services/api-service/src/services/sheets.py`
  - `services/api-service/src/core/scheduler.py`
- Backend carpentry produccion:
  - `services/api-service/src/services/carpentry/produccion.py`
  - `services/api-service/src/services/carpentry/registry.py`
- Frontend products:
  - `applications/web-app/src/apps/products/*`

## Observacion importante
- El scheduler corre cada `240` minutos en codigo, aunque comentario/log menciona "cada 10 minutos".

Evidencia:
- `services/api-service/src/core/scheduler.py`
- `services/api-service/src/main.py`

## TBD
- Definicion de la fuente oficial del modulo `products` (hoy usa endpoints fuera de `api-service`).
- Alineacion entre intervalo real y documentado del scheduler.
