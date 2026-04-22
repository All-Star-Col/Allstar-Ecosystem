# Integracion n8n (Observed)

Este documento registra el estado observable de integracion con n8n en el codigo actual.

Nota de alcance: se documenta exclusivamente lo verificable en el repo. Lo no verificable se marca como `TBD`.

## Estado actual (observado)

No se encontro una integracion directa activa con n8n en `services/api-service`:

- No hay llamadas HTTP salientes hacia webhooks n8n.
- No hay configuracion (`N8N_*`) en `src/core/config.py`.
- No hay rutas dedicadas a n8n en `src/api/v1/routes`.

La unica llamada HTTP saliente observada en backend es el scheduler interno hacia:

- `POST http://localhost:8000/api/v1/sheets/trigger/production`

Esta llamada no involucra n8n; es trafico interno de la misma API.

## Puntos relacionados pero no conectados (observado)

- `POST /api/v1/workspace/orders/orders` existe, pero actualmente devuelve el payload y no invoca servicios externos.
- `services/api-service/src/services/external_db.py` incluye helpers para `email_data`, pero no se observaron rutas activas que los consuman.

## Contrato de integracion actual

- No existe contrato tecnico implementado con n8n dentro del codigo inspeccionado.
- Cualquier automatizacion n8n actualmente seria externa al repo o aun no implementada.

## TBD

- Si existe un flujo n8n activo fuera de este repositorio (por ejemplo, webhook -> API o API -> webhook).
- Esquema de autenticacion esperado para n8n (token, basic auth, signed webhook, etc.).
- Endpoints/eventos de negocio que deberian publicar o consumir workflows n8n.
