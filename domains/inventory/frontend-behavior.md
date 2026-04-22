# Inventory Frontend Behavior (Observed)

## Estado actual en web-app
No hay consumo directo observable de rutas `/api/v1/sheets/inventory/*` dentro de `applications/web-app/src`.

Evidencia:
- busqueda por `sheets/inventory` sin resultados en `applications/web-app/src`.

## Implicaciones
- Las operaciones de inventario documentadas hoy parecen estar pensadas para:
  - clientes externos,
  - scripts,
  - integraciones fuera del frontend principal.

## Relacion con otros modulos frontend
- El modulo `carpentry` usa su propio backend de acciones (`/workspace/carpentry/invoke`) y no consume este contrato de `sheets/inventory`.
- El modulo `products` consume endpoints `localhost:3000` y rutas `/api/*` distintas.

## TBD
- Si habra una vista oficial de inventario en `web-app` para estos endpoints.
- Reglas de UX (validaciones, estados, permisos) para un posible frontend de inventario.
