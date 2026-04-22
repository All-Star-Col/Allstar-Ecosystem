# Integration Architecture

Scope note: documenta integraciones observables en el repo a fecha 2026-04-22. Si falta evidencia en archivos versionados, se marca como `TBD`.

## Mapa de integracion (alto nivel)

1. `applications/web-app` consume HTTP del API FastAPI.
2. `services/api-service` carga secretos desde Bitwarden al iniciar.
3. El API usa PostgreSQL para auth/workspace/forms/carpentry.
4. El API usa SQL Server como fuente upstream para procesos de inventario.
5. El API usa Google Sheets para operaciones de inventario y sincronizacion.
6. GitHub Actions construye/despliega API y frontend por workflows separados.

## Web app -> API

## Configuracion

- `VITE_API_SERVER` define base URL (`applications/web-app/src/config/api.ts`).
- El frontend concatena rutas como `${API_SERVER}/workspace`, `${API_SERVER}/workspace/forms/*`, `${API_SERVER}/workspace/data-viewer/*`.

Implicacion observable:
- `VITE_API_SERVER` debe apuntar al prefijo esperado por las llamadas del frontend (por ejemplo, incluir `/api/v1` si el backend expone ese prefijo).

## Flujos usados por frontend

- Auth/sesion:
  - Login: `POST /login`
  - Validacion de sesion/dashboard: `GET /workspace`
- Forms:
  - `GET /workspace/forms/categories`
  - `GET /workspace/forms/tables`
  - `GET /workspace/forms/tables/{table_name}`
  - `GET /workspace/forms/lookups/{table_name}/{column_name}`
  - `POST /workspace/forms/submit`
- Data Viewer:
  - `GET /workspace/data-viewer/tables`
  - `POST /workspace/data-viewer/query`
  - `POST /workspace/data-viewer/export`
  - `PATCH /workspace/data-viewer/rows`
- Carpentry:
  - `GET /workspace/carpentry/ping`
  - `POST /workspace/carpentry/invoke`
  - `GET /workspace/carpentry/actions`

## API -> Bitwarden

- Carga en runtime desde `src/core/config.py` via `BitwardenClient`.
- Token requerido: `BW_ACCESS_TOKEN`.
- Si falta token, startup falla.

Secretos cargados:
- `ALGORITHM`
- `SECRET_KEY`
- `POSTGRES_URL_DATABASE`
- `SQLSERVER_URL_DATABASE`
- `SHEETS_INVENTARIO_ALLSTAR`
- `GOOGLE_CREDENTIALS_JSON`

## API -> PostgreSQL

Conexion:
- SQLAlchemy async engine con `POSTGRES_URL_DATABASE` (`src/db/database.py`).

Uso observable:
- `auth.users`, `auth.roles`, `auth.user_roles` para auth/permisos.
- `workspace.apps`, `workspace.role_apps` para apps por rol en `/workspace`.
- `workspace.ui_categorias_tablas` y `workspace.ui_config_tablas` para metadata de forms/data-viewer.
- Inserciones de forms en esquema `data` (no `access`) via SQL dinamico validado.
- Carpentry ejecuta SQL en esquema configurable `CARPENTRY_DB_SCHEMA` (default `carpentry`).

## API -> SQL Server

- Conexion `pyodbc.connect(settings.SQLSERVER_URL_DATABASE)`.
- Usado por `SheetsService` para enriquecer/validar operaciones de inventario y sincronizacion.

`TBD`:
- Ownership/contrato formal del esquema SQL Server (solo visible por queries embebidas).

## API -> Google Sheets

- Cliente con service account desde `GOOGLE_CREDENTIALS_JSON`.
- Spreadsheet target: `SHEETS_INVENTARIO_ALLSTAR`.
- Hojas usadas por codigo:
  - `INVENTARIO`
  - `Complementos`
  - `DESPACHADO`
  - `Logs`
  - `DEVOLUCIONES`

Patrones de integracion:
- Inventario transaccional (lookup, altas, movimientos, despacho, devoluciones).
- Trigger de sincronizacion de produccion (`/sheets/trigger/production`).

## Scheduler interno

- Job APScheduler cada `240` minutos (`src/core/scheduler.py`).
- Triggerea `POST http://localhost:8000/api/v1/sheets/trigger/production`.
- Comentarios en codigo aun indican "cada 10 minutos" (`TBD` de consistencia documental interna).

## CI/CD -> despliegue

## API

Workflow observable:
- `.github/workflows/deploy-api.yml`

Flujo:
1. Build/push de imagen Docker (`starbotdocker/allstar-fastapi-repository`).
2. Conexion a Tailscale.
3. SSH a VM y ejecucion de `/opt/allstar-api/deploy.sh`.

Trigger:
- Push a `main` con cambios en `services/api-service/**` o en el workflow.

## Frontend

Workflow observable:
- `.github/workflows/azure-static-web-apps-purple-water-03112dc0f.yml`

Flujo:
- Build y deploy a Azure Static Web Apps.

Observacion:
- El filtro `paths` dentro del workflow referencia `.github/workflows/deploy-frontend.yml`, archivo que no existe con ese nombre en el repo actual.

## Riesgos de acople observables

- Si `VITE_API_SERVER` no coincide con prefijo real, fallan auth/dashboard/modulos.
- Si falla Bitwarden, la API no inicia.
- La sincronizacion programada depende de que la API local responda en `localhost:8000`.
