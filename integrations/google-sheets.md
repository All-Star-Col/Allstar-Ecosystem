# Google Sheets Integration (Observed)

This document describes how `services/api-service` integrates with Google Sheets.

Scope note: this is documentation of what is visible in the repo today. If something is not in the inspected files, it is marked as TBD.

## Where it lives

- HTTP routes:
  - Trigger: `services/api-service/src/api/v1/routes/sheets/sheets.py`
  - Inventory endpoints: `services/api-service/src/api/v1/routes/sheets/inventory/inventory.py`
- Sheets client + business logic: `services/api-service/src/services/sheets.py`
- Config inputs (loaded from Bitwarden): `services/api-service/src/core/config.py`

## Configuration inputs (observed)

The integration depends on these runtime settings:

- `settings.SHEETS_INVENTARIO_ALLSTAR`: spreadsheet id (`spreadsheetId`).
- `settings.GOOGLE_CREDENTIALS_JSON`: service account credentials JSON as a string.

Both values are populated from Bitwarden when the API starts (see `services/api-service/src/core/config.py`).

## Authentication model (observed)

- The service uses service account credentials created from `settings.GOOGLE_CREDENTIALS_JSON` via `service_account.Credentials.from_service_account_info(...)` (see `services/api-service/src/services/sheets.py`).
- OAuth scope used: `https://www.googleapis.com/auth/spreadsheets` (see `services/api-service/src/services/sheets.py`).
- The Sheets API client is created via `googleapiclient.discovery.build("sheets", "v4", credentials=creds)`.

## Spreadsheet layout assumptions (observed)

The code references these sheet names (see `services/api-service/src/services/sheets.py`):

- Inventory: `Inv. All Star`
- Options: `Complementos`
- Base/access: `PRUEBA ACCESS`

Observed column/range usage:

- Inventory lookup reads column A for item id and then reads a single row range `A{row}:I{row}`.
- Inventory location updates write `H{row}:I{row}` (warehouse + row) and optionally writes referral to `M{row}`.
- Inventory dispatch updates write `M{row}:O{row}`.
- Options lists are read from `Complementos!A2:A` and `Complementos!C2:C`.
- Base/access synchronization reads and writes column A and row ranges `A{row}:P{row}`.

TBD:

- The exact meaning of each column in the sheets is not documented in this repo; only ranges used by code are observable.

## API surface (observed)

### Inventory operations

Routes are mounted under `/api/v1/sheets/inventory` (see `services/api-service/src/main.py`).

- `GET /api/v1/sheets/inventory/get/{item}`
  - Looks up an item in `Inv. All Star`.
  - If `opt_request=true` (default), also returns option lists from `Complementos`.
  - Returns `404` if the item is not found (see `services/api-service/src/api/v1/routes/sheets/inventory/inventory.py`).

- `POST /api/v1/sheets/inventory/new/{item}`
  - Adds a new item row into `Inv. All Star` if the item exists in the base/access sheet (`PRUEBA ACCESS`).
  - Returns `404` if the item does not exist in the base/access sheet.
  - Returns a conflict-like status from the service when the item already exists in inventory; the route currently maps that branch to an HTTP error (see `services/api-service/src/api/v1/routes/sheets/inventory/inventory.py`, `services/api-service/src/services/sheets.py`).

- `PATCH /api/v1/sheets/inventory/location/{row}`
  - Updates warehouse + row, and optionally referral, for a given sheet row index.

- `PATCH /api/v1/sheets/inventory/dispatch/{row}`
  - Updates dispatch fields (dispatch date, referral, invoice) for a given sheet row index.

### Production trigger / sync

Routes are mounted under `/api/v1/sheets` (see `services/api-service/src/main.py`).

- `POST /api/v1/sheets/trigger/production`
  - Runs `compare_coditems()` which reads items from SQL Server and upserts them into `PRUEBA ACCESS` (see `services/api-service/src/api/v1/routes/sheets/sheets.py`, `services/api-service/src/services/sheets.py`).

## Background scheduler (observed)

- An APScheduler job runs every 10 minutes and calls `POST http://localhost:8000/api/v1/sheets/trigger/production` (see `services/api-service/src/core/scheduler.py`).

## Failure modes (observed)

- If Google credentials are missing, the Sheets service logs an error and returns `None`, and downstream operations may return a `404`-like status (see `services/api-service/src/services/sheets.py`).
- HTTP errors from Google Sheets are caught and logged during item lookup (see `services/api-service/src/services/sheets.py`).
