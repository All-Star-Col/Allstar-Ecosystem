# Operational Workspace Domain

Scope note: este dominio cubre el shell operativo posterior a autenticacion, incluyendo dashboard, modulos y APIs bajo `/api/v1/workspace/*`.

## Objetivo del dominio
Orquestar el espacio de trabajo del usuario autenticado, habilitando aplicaciones y operaciones por rol.

## Responsabilidades observadas
- Resolver apps disponibles para el usuario (`GET /workspace`).
- Presentar dashboard con buscador, favoritos y recientes.
- Soportar formularios dinamicos (`/workspace/forms/*`).
- Soportar consulta/edicion tabular avanzada (`/workspace/data-viewer/*`).
- Exponer bus de acciones de carpinteria (`/workspace/carpentry/invoke`).
- Exponer endpoint de ordenes de prueba (`/workspace/orders/orders`).

## Componentes observados
- Backend:
  - `services/api-service/src/api/v1/routes/workspace/workspace.py`
  - `services/api-service/src/api/v1/routes/workspace/forms/forms.py`
  - `services/api-service/src/api/v1/routes/workspace/data_viewer/data_viewer.py`
  - `services/api-service/src/api/v1/routes/workspace/carpentry/carpentry.py`
  - `services/api-service/src/api/v1/routes/workspace/orders/orders.py`
  - `services/api-service/src/services/forms.py`
  - `services/api-service/src/services/data_viewer.py`
  - `services/api-service/src/services/carpentry/*`
- Frontend:
  - `applications/web-app/src/system/dashboard/Dashboard.tsx`
  - `applications/web-app/src/core/modules.ts`
  - `applications/web-app/src/apps/forms/*`
  - `applications/web-app/src/apps/data-viewer/*`
  - `applications/web-app/src/apps/carpentry/*`

## Limites del dominio
- Gestion de login/token se documenta en `domains/authentication-access/`.
- Inventario via Google Sheets se documenta en `domains/inventory/`.
- Sincronizacion de produccion/scheduler se documenta en `domains/production/`.

## TBD
- Alcance real del endpoint de ordenes (hoy es echo de payload).
- Contrato funcional completo de acciones de carpinteria por modulo.
