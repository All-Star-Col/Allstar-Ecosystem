# Production Frontend Behavior (Observed)

## Products module (`/app/products`)

### Rutas
- `index` -> `DashboardPage` (`ProductionDashboard`).
- `/new` -> `NewRegistrationPage` (`ProductionFormWizard`).

Evidencia:
- `applications/web-app/src/apps/products/App.tsx`

### Flujo dashboard
- Carga correos desde `http://localhost:3000/api/emails`.
- Al seleccionar correo, consulta detalle en `http://localhost:3000/api/emails/{id}`.
- Muestra lista y estado por correo (nuevo, procesando IA, etc.).

### Flujo wizard
- Construye formulario de orden de produccion con datos de correo + inputs manuales.
- Consulta clientes/productos mediante `/api/clientes` y `/api/productos`.
- Envia orden a `/api/ordenes/produccion`.
- Actualiza estado de correo via `/api/emails/{id}/status`.

Evidencia:
- `applications/web-app/src/apps/products/components/ProductionDashboard.tsx`
- `applications/web-app/src/apps/products/components/ProductionFormWizard.tsx`

## Carpentry production page (`/app/carpentry/produccion`)
- Consume API de acciones:
  - `api.produccion.lotesDisponibles()`
  - `api.produccion.historial(...)`
  - `api.produccion.resumenDia(...)`
  - `api.produccion.registrar(...)`

Evidencia:
- `applications/web-app/src/apps/carpentry/api/client.js`
- `applications/web-app/src/apps/carpentry/pages/ProduccionPage.jsx`

## Relacion con trigger backend
- No se observa llamada frontend directa a `/api/v1/sheets/trigger/production`; su ejecucion principal es por scheduler/backend.

## TBD
- Definicion de UX final para conciliacion entre modulo `products` y backend oficial de la plataforma.
- Mecanismo de fallback cuando `localhost:3000` no esta disponible.
