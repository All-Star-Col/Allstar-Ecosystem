# Terminology

This glossary defines terms as they are used in this repository (based on observed code and configuration).

## Core product terms

- Allstar Platform: the ecosystem documented by this repo; at minimum it includes a web app and an API service.
- Web app: the frontend in `applications/web-app` (React + TypeScript + Vite).
- API service: the backend in `services/api-service` (FastAPI).
- Workspace: an API response that returns user identity and an `apps` list for the current user (see `services/api-service/src/api/v1/routes/workspace/workspace.py`).
- App (workspace app): a record returned from `workspace.apps` joined via `workspace.role_apps`, containing fields like `path`, optional `external_url`, and icon styling fields (see `services/api-service/src/services/apps.py`, `services/api-service/src/schemas/models.py`).
- Role: a record in `auth.roles` linked to users via `auth.user_roles` (see `services/api-service/src/services/roles.py`).

## Auth terms

- OAuth2 password flow: login uses the OAuth2 Password Request Form (username/password) and returns a bearer token (see `services/api-service/src/api/v1/routes/login/login.py`).
- JWT access token: the `access_token` returned by `/api/v1/login` and `/api/v1/register`; it includes a `sub` claim set to the username and an `exp` expiration (see `services/api-service/src/core/auth.py`).
- Bearer token: the `Authorization: Bearer <token>` header required for protected endpoints (enforced by `services/api-service/src/api/deps.py`).

## Data terms

- Postgres auth schema: tables under `auth.*` used for users and roles (see `services/api-service/src/services/users.py`, `services/api-service/src/services/roles.py`).
- Postgres workspace schema: tables under `workspace.*` used for workspace apps and forms configuration (see `services/api-service/src/services/apps.py`, `services/api-service/src/services/forms.py`).
- Postgres access schema: the schema targeted by dynamic form inserts into `access.{table_name}` (see `services/api-service/src/services/forms.py`).
- Information schema: `information_schema.columns` is used to validate submitted columns for dynamic inserts (see `services/api-service/src/services/forms.py`).

## Sheets / inventory terms

- Inventory spreadsheet id: stored in `settings.SHEETS_INVENTARIO_ALLSTAR` (loaded from Bitwarden) and used as the `spreadsheetId` for the Google Sheets API (see `services/api-service/src/services/sheets.py`, `services/api-service/src/core/config.py`).
- Inventory sheet: the sheet named `Inv. All Star` used for item lookup and updates (see `services/api-service/src/services/sheets.py`).
- Options sheet: the sheet named `Complementos` used to provide option lists for warehouses and rows (see `services/api-service/src/services/sheets.py`).
- Access/base sheet: the sheet named `PRUEBA ACCESS` used for synchronization from SQL Server and as a source to validate new inventory items (see `services/api-service/src/services/sheets.py`).
- SQL Server: a separate database accessed via `pyodbc` and used as the upstream source for synchronization to Google Sheets (see `services/api-service/src/services/sheets.py`).

## Configuration / ops terms

- BW_ACCESS_TOKEN: environment variable required to authenticate to Bitwarden and load runtime secrets (see `services/api-service/src/core/config.py`).
- Allowed origins: a list of development origins in settings and an origin regex permitting `http://100.x.x.x(:port)` (see `services/api-service/src/core/config.py`, `services/api-service/src/main.py`).
- Scheduler trigger: an internal APScheduler job that calls `POST http://localhost:8000/api/v1/sheets/trigger/production` every 10 minutes (see `services/api-service/src/core/scheduler.py`).
- Tailscale network: used in CI/CD to reach the deployment VM over SSH (see `services/api-service/.github/workflows/main.yml`), and also appears as a `.ts.net` base URL for the web app API config (see `applications/web-app/.env.*`).
