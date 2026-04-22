# System Overview

Scope note: este documento describe solo comportamiento observable en el repo a fecha 2026-04-22. Si algo no se pudo verificar en archivos del repositorio, se marca como `TBD`.

## Componentes principales

## 1) Frontend: `applications/web-app`

- Stack: React + TypeScript + Vite.
- Router principal en `src/core/AppRoutes.tsx`.
- Rutas base del shell:
  - `/login`
  - `/dashboard`
  - `/dashboard/profile`
- Modulos registrados en `src/core/modules.ts`:
  - `forms` -> `/app/forms`
  - `products` -> `/app/products`
  - `data-viewer` -> `/app/data-viewer`
  - `carpentry` -> `/app/carpentry`
- La URL base de API viene de `VITE_API_SERVER` (`src/config/api.ts`).

## 2) Backend: `services/api-service`

- Stack: FastAPI + SQLAlchemy Async + `asyncpg` + `pyodbc`.
- App creada en `src/main.py` con prefijo base `/api/v1`.
- Routers incluidos hoy:
  - Auth: `POST /login`, `POST /register`
  - Public: `GET /public`
  - Workspace: `GET /workspace`
  - Workspace Forms: `/workspace/forms/*`
  - Workspace Data Viewer: `/workspace/data-viewer/*`
  - Workspace Users: `/workspace/users/*`
  - Workspace Orders: `POST /workspace/orders/orders` (stub)
  - Workspace Carpentry: `/workspace/carpentry/actions`, `/ping`, `/invoke`
  - Sheets trigger: `POST /sheets/trigger/production`
  - Sheets inventory: `/sheets/inventory/*`

## 3) Integraciones y stores

## Bitwarden

- `settings = Settings()` carga secretos en startup desde Bitwarden (`src/core/config.py`).
- Requiere `BW_ACCESS_TOKEN` en entorno para iniciar la API.
- Secretos cargados: `ALGORITHM`, `SECRET_KEY`, `POSTGRES_URL_DATABASE`, `SQLSERVER_URL_DATABASE`, `SHEETS_INVENTARIO_ALLSTAR`, `GOOGLE_CREDENTIALS_JSON`.

## PostgreSQL (async)

- Engine desde `settings.POSTGRES_URL_DATABASE` (`src/db/database.py`).
- Uso observable por esquemas:
  - `auth`: usuarios, roles, relacion usuario-rol.
  - `workspace`: apps por rol y configuracion de tablas UI.
  - `data`: metadata/forms y `INSERT` dinamico de formularios.
  - `carpentry`: acciones SQL del modulo carpinteria (via `search_path`).

## SQL Server (`pyodbc`)

- Conexion con `settings.SQLSERVER_URL_DATABASE`.
- Usado por `SheetsService` para leer items/upstream de inventario.

## Google Sheets API

- Cliente construido con `GOOGLE_CREDENTIALS_JSON`.
- Spreadsheet desde `SHEETS_INVENTARIO_ALLSTAR`.
- Hojas observables usadas por codigo: `INVENTARIO`, `Complementos`, `DESPACHADO`, `Logs`, `DEVOLUCIONES`.

## 4) Autenticacion y autorizacion

- Login usa OAuth2 Password Flow y devuelve JWT (`src/api/v1/routes/login/login.py`).
- Token se valida en `src/api/deps.py`.
- Dependencias comunes:
  - `get_current_user`
  - `get_current_active_apps`
  - `require_admin`
- `require_admin` retorna `None` si no es admin (no siempre responde 403 directamente); comportamiento endpoint-a-endpoint.

## 5) Scheduler interno

- APScheduler configurado en `src/core/scheduler.py`.
- Job programado con `interval` de `minutes=240`.
- El job hace `POST http://localhost:8000/api/v1/sheets/trigger/production`.
- Nota: comentarios/logs todavia dicen "cada 10 minutos"; el valor efectivo en codigo es 240 minutos.

## 6) Flujo funcional resumido

1. Usuario inicia sesion en frontend.
2. Frontend guarda token y valida sesion consultando `/workspace`.
3. Dashboard renderiza apps segun respuesta de `/workspace`.
4. Cada modulo consume endpoints de su dominio (`forms`, `products`, `data-viewer`, `carpentry`, `sheets`).
5. API combina PostgreSQL, SQL Server y Google Sheets segun endpoint.
6. Scheduler dispara sincronizacion periodica de inventario.

## 7) Estado y gaps

- Existe `applications/mobile-app/`, pero su implementacion ejecutable actual es `TBD` (fuera del alcance de este documento).
- Dependencias exactas por modulo frontend hacia cada endpoint estan parcialmente visibles; matriz completa request/response: `TBD`.
