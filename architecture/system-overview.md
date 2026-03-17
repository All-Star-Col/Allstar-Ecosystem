# System Overview

This repo documents an internal ecosystem composed of a web client and an API service.

## Components

### applications/web-app (React)

- React + TypeScript + Vite (see `applications/web-app/package.json`).
- Configures its API base URL via `VITE_API_SERVER` (see `applications/web-app/.env.development` and `applications/web-app/.env.production`).

### services/api-service (FastAPI)

- FastAPI app title: "AllStar Platform API" (see `services/api-service/src/main.py`).
- Routes are mounted under `/api/v1` (see `services/api-service/src/main.py`).
- CORS is configured with:
  - Explicit allowed origins for localhost dev ports (see `services/api-service/src/core/config.py`).
  - An origin regex that allows `http://100.x.x.x(:port)` style origins (see `services/api-service/src/main.py`).

## Data stores and external dependencies (observed)

### PostgreSQL (async)

- SQLAlchemy async engine created from `settings.POSTGRES_URL_DATABASE` (see `services/api-service/src/db/database.py`).
- Auth queries and writes target the `auth` schema (see `services/api-service/src/services/users.py`, `services/api-service/src/services/apps.py`, `services/api-service/src/services/roles.py`).
- Workspace configuration tables are queried under the `workspace` schema (see `services/api-service/src/services/forms.py`).
- Dynamic inserts target the `access` schema (see `services/api-service/src/services/forms.py`).

### SQL Server (pyodbc)

- Connection is created using `settings.SQLSERVER_URL_DATABASE` (see `services/api-service/src/services/sheets.py`).
- Used as an upstream source of item/order related rows for Sheets synchronization (see `services/api-service/src/services/sheets.py`).

### Google Sheets API

- Sheets client is built from a service account JSON loaded as a string (`settings.GOOGLE_CREDENTIALS_JSON`) (see `services/api-service/src/services/sheets.py`).
- The spreadsheet id is taken from `settings.SHEETS_INVENTARIO_ALLSTAR` (see `services/api-service/src/services/sheets.py`, `services/api-service/src/core/config.py`).

### Bitwarden

- Runtime secrets are loaded using the Bitwarden SDK and an access token provided via `BW_ACCESS_TOKEN` (see `services/api-service/src/core/config.py`).

## HTTP API surface (observed)

The following routers are included (see `services/api-service/src/main.py`):

- Auth: `/api/v1/login`, `/api/v1/register`
- Workspace: `/api/v1/workspace`
- Workspace Forms: `/api/v1/workspace/forms/categories`, `/api/v1/workspace/forms/tables`, `/api/v1/workspace/forms/submit`
- Public: `/api/v1/public`
- Sheets: `/api/v1/sheets/trigger/production`
- Sheets Inventory: `/api/v1/sheets/inventory/get/{item}`, `/api/v1/sheets/inventory/new/{item}`, `/api/v1/sheets/inventory/location/{row}`, `/api/v1/sheets/inventory/dispatch/{row}`

Note: An additional `orders` router is included under `/api/v1/workspace` (see `services/api-service/src/main.py`), but the endpoints are TBD (not inspected in this task).

## Authentication model (observed)

- OAuth2 password flow is used to obtain a JWT access token (see `services/api-service/src/api/v1/routes/login/login.py`, `services/api-service/src/core/auth.py`).
- JWT validation is performed in `services/api-service/src/api/deps.py`.
- Tokens include a `sub` claim containing the username (see `services/api-service/src/core/auth.py`, `services/api-service/src/api/deps.py`).

## Background scheduler (observed)

- On startup, an APScheduler job runs every 10 minutes and calls `POST http://localhost:8000/api/v1/sheets/trigger/production` (see `services/api-service/src/core/scheduler.py`, `services/api-service/src/main.py`).
