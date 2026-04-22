# Operational Workspace Frontend Behavior (Observed)

## Dashboard
- Ruta: `/dashboard`.
- Hace `GET {API_SERVER}/workspace` para obtener `apps`.
- Funcionalidades visibles:
  - busqueda por nombre,
  - tabs `todas/favorites/recientes`,
  - persistencia de favoritos (`favorite-apps`) y recientes (`recent-apps`) en `localStorage`.

Evidencia:
- `applications/web-app/src/system/dashboard/Dashboard.tsx`

## Resolucion de modulos
Modulos registrados en runtime:
- `/app/forms`
- `/app/products`
- `/app/data-viewer`
- `/app/carpentry`

Evidencia:
- `applications/web-app/src/core/modules.ts`
- `applications/web-app/src/core/AppRoutes.tsx`

## Forms module
- Ruta base: `/app/forms`.
- Flujo:
  1. tabla/categoria (`TableSelection`)
  2. builder por tabla (`/app/forms/:tableId`)
  3. submit a `/workspace/forms/submit`
- Consume:
  - `/workspace/forms/categories`
  - `/workspace/forms/tables`
  - `/workspace/forms/tables/{table}`
  - `/workspace/forms/lookups/{table}/{column}`

Evidencia:
- `applications/web-app/src/apps/forms/*`

## Data Viewer module
- Ruta base: `/app/data-viewer`.
- Capacidades observadas:
  - listar tablas,
  - query paginada con filtros/sort,
  - exportar CSV,
  - editar fila (patch por PK),
  - manejo de `X-Request-ID` y codigos de error.

Evidencia:
- `applications/web-app/src/apps/data-viewer/components/DataViewerProModule.tsx`
- `applications/web-app/src/apps/data-viewer/api.ts`

## Carpentry module
- Ruta base: `/app/carpentry`.
- Subrutas internas:
  - `proyectos`, `lotes`, `bom`, `inventario`, `produccion`, `recursos`, `catalogo`, `reportes`.
- Cliente API usa `/workspace/carpentry/invoke` con acciones tipadas.

Evidencia:
- `applications/web-app/src/apps/carpentry/App.tsx`
- `applications/web-app/src/apps/carpentry/api/client.js`

## Orders frontend
No se observa una UI dedicada que consuma `/workspace/orders/orders`.

## TBD
- Estrategia de desacople entre `modules.ts` y configuracion de apps backend cuando no coinciden paths.
- UX de error/reintento para fallos prolongados de Data Viewer y Carpentry.
