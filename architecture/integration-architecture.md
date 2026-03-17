# Integration Architecture

This document describes the observed integration points between components in this repository.

Scope note: this is documentation of what is visible in the repo today. If something is not in the inspected files, it is marked as TBD.

## Integration map (high level)

1. `applications/web-app` (React) calls `services/api-service` over HTTP.
2. `services/api-service` reads runtime secrets from Bitwarden via `BW_ACCESS_TOKEN`.
3. `services/api-service` uses:
   - PostgreSQL (async) for auth/workspace/forms metadata and dynamic inserts.
   - SQL Server (pyodbc) as an upstream source for inventory synchronization.
   - Google Sheets API as the inventory spreadsheet target.
4. GitHub Actions builds and deploys the API service container image to a VM over SSH via a Tailscale network.

## Web app -> API

- API base URL is configured via `VITE_API_SERVER` (see `applications/web-app/.env.development`, `applications/web-app/.env.production`).
- The API mounts endpoints under `/api/v1` (see `services/api-service/src/main.py`).

TBD:
- Web app route structure and which endpoints it calls are not documented here (not inspected in this task).

## API -> Bitwarden (secrets)

Observed behavior (see `services/api-service/src/core/config.py`):

- `Settings` defines Bitwarden secret IDs (UUID strings) for each required secret.
- At import time, `settings = Settings()` triggers `load_secrets_from_bw()`.
- `load_secrets_from_bw()` uses `BW_ACCESS_TOKEN` from the process environment and fetches secrets using `bitwarden_sdk`.
- Secrets populated into settings include:
  - `ALGORITHM`
  - `SECRET_KEY`
  - `POSTGRES_URL_DATABASE`
  - `SQLSERVER_URL_DATABASE`
  - `SHEETS_INVENTARIO_ALLSTAR`
  - `GOOGLE_CREDENTIALS_JSON`

Operational implication:
- The API process cannot start without `BW_ACCESS_TOKEN` (it raises on missing token).

## API -> PostgreSQL

Observed usage:

- Database URL is `settings.POSTGRES_URL_DATABASE` (see `services/api-service/src/db/database.py`).
- Auth domain tables:
  - `auth.users` (read by username; create user; update last_login_at) (see `services/api-service/src/services/users.py`).
  - `auth.user_roles` (maps users to roles) (see `services/api-service/src/services/apps.py`, `services/api-service/src/services/roles.py`).
  - `auth.roles` (role metadata) (see `services/api-service/src/services/roles.py`).
- Workspace apps:
  - `workspace.apps` and `workspace.role_apps` determine which apps are returned for a role (see `services/api-service/src/services/apps.py`).
- Workspace forms metadata:
  - `workspace.ui_categorias_tablas` supplies categories (see `services/api-service/src/services/forms.py`).
  - `workspace.ui_config_tablas` supplies visible tables (see `services/api-service/src/services/forms.py`).
- Dynamic form submission:
  - Inserts into `access.{table_name}` are constructed dynamically after validating table and column identifiers (see `services/api-service/src/services/forms.py`).

## API -> SQL Server

Observed usage (see `services/api-service/src/services/sheets.py`):

- Connection uses `pyodbc.connect(settings.SQLSERVER_URL_DATABASE)`.
- A synchronization routine queries an `Item` table joined to multiple dimension tables and produces rows for Google Sheets updates.

TBD:
- The upstream SQL Server schema is inferred from query text only; ownership and lifecycle are not documented here.

## API -> Google Sheets

Observed usage (see `services/api-service/src/services/sheets.py`):

- Credentials come from `settings.GOOGLE_CREDENTIALS_JSON` (JSON string) and are used via service account auth.
- Spreadsheet id comes from `settings.SHEETS_INVENTARIO_ALLSTAR`.
- The code uses these sheet names:
  - Inventory: `Inv. All Star`
  - Options: `Complementos`
  - Base/Access: `PRUEBA ACCESS`

There are two primary interaction patterns:

1. Inventory item operations (via `/api/v1/sheets/inventory/...`):
   - Lookup an item row and return a normalized response.
   - Add a new item to the inventory sheet (if present in the base/access sheet).
   - Update location (warehouse and row; optional referral).
   - Update dispatch info.
2. Production trigger and periodic sync (via `/api/v1/sheets/trigger/production` and scheduler):
   - Scheduler runs every 10 minutes and posts to the trigger endpoint (see `services/api-service/src/core/scheduler.py`).
   - The trigger runs `compare_coditems()` which reads from SQL Server and upserts rows into `PRUEBA ACCESS` (see `services/api-service/src/services/sheets.py`).

## CI/CD -> Deployment (GitHub Actions)

Observed workflow (see `services/api-service/.github/workflows/main.yml`):

- Trigger: push to `master`.
- Build job:
  - Builds and pushes a Docker image to Docker Hub: `starbotdocker/allstar-fastapi-repository`.
  - Pushes tags: `latest`, `prod`, and `${{ github.sha }}`.
- Deploy job:
  - Brings up Tailscale via OAuth.
  - SSHes to a VM on the Tailscale network and runs `/opt/allstar-api/deploy.sh`.
  - Passes `BW_ACCESS_TOKEN`, `DOCKERHUB_USERNAME`, and `DOCKERHUB_TOKEN` as environment variables to the remote script.

TBD:
- The exact behavior of `/opt/allstar-api/deploy.sh` is outside this repo.
