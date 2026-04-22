# Production API Contract (Observed)

## Trigger de sincronizacion

### `POST /api/v1/sheets/trigger/production`
Ejecuta `compare_coditems()`.

Response 200:
- `{ "status": "success", "message": "Sincronizacion completada" }`

Errores observados:
- `404` recurso/hoja no encontrado.
- `500` error interno en sincronizacion.

Evidencia:
- `services/api-service/src/api/v1/routes/sheets/sheets.py`

## Scheduler asociado
- Job programado llama `POST http://localhost:8000/api/v1/sheets/trigger/production`.
- Intervalo observado: `240` minutos.

Evidencia:
- `services/api-service/src/core/scheduler.py`

## Carpentry production via action bus
Base: `POST /api/v1/workspace/carpentry/invoke`

Acciones de produccion observadas:
- `produccion.lotesDisponibles`
- `produccion.registrar`
- `produccion.historial`
- `produccion.resumenDia`

Request general:
- `{ "action": "<accion>", "payload": { ... } }`

Response general:
- `{ "action", "data", "request_ts" }`

Evidencia:
- `services/api-service/src/services/carpentry/registry.py`
- `services/api-service/src/api/v1/routes/workspace/carpentry/carpentry.py`

## Contratos frontend products (fuera de api-service)
El modulo `products` consume rutas que no estan implementadas en `services/api-service`:
- `http://localhost:3000/api/emails`
- `http://localhost:3000/api/emails/{id}`
- `/api/clientes`
- `/api/productos`
- `/api/ordenes/produccion`
- `/api/emails/{id}/status`

Evidencia:
- `applications/web-app/src/apps/products/components/ProductionDashboard.tsx`
- `applications/web-app/src/apps/products/components/ProductionFormWizard.tsx`

## TBD
- Especificacion formal de los endpoints externos usados por `products`.
- Politica de autenticacion de esos endpoints externos.
