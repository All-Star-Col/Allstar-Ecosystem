# Bitwarden Integration (Observed)

This document describes how `services/api-service` loads runtime secrets from Bitwarden.

Scope note: this is documentation of what is visible in the repo today. If something is not in the inspected files, it is marked as TBD.

## Where it lives

- Configuration and secret loading: `services/api-service/src/core/config.py`
- Settings usage (JWT, DB URLs, Sheets): referenced throughout `services/api-service/src/...`

## Runtime contract

- Required environment variable: `BW_ACCESS_TOKEN`.
- If `BW_ACCESS_TOKEN` is missing, the API raises during settings initialization (see `services/api-service/src/core/config.py`).

## How secrets are loaded

Observed behavior in `services/api-service/src/core/config.py`:

1. `Settings` defines Bitwarden secret IDs (UUID strings) such as `ID_SECRET_KEY`.
2. On instantiation, `Settings.__init__()` calls `self.load_secrets_from_bw()`.
3. `load_secrets_from_bw()`:
   - Creates a `BitwardenClient` configured with:
     - `identity_url="https://identity.bitwarden.com"`
     - `api_url="https://api.bitwarden.com"`
   - Reads `BW_ACCESS_TOKEN` from the process environment.
   - Logs in via `client.auth().login_access_token(access_token)`.
   - Fetches each secret via `client.secrets().get(secret_id)` and assigns `secret.data.value` into settings.

## Secrets pulled from Bitwarden

The following settings values are populated from Bitwarden (see `services/api-service/src/core/config.py` and `services/api-service/README.md`):

- `ALGORITHM` (JWT algorithm)
- `SECRET_KEY` (JWT secret)
- `POSTGRES_URL_DATABASE` (PostgreSQL connection string)
- `SQLSERVER_URL_DATABASE` (SQL Server connection string)
- `SHEETS_INVENTARIO_ALLSTAR` (Google Sheets spreadsheet id)
- `GOOGLE_CREDENTIALS_JSON` (service account JSON as a string)

## Notes / caveats (observed)

- Secret IDs are hard-coded as defaults in `Settings` (UUID strings). The actual secret values are fetched at runtime.
- `Settings.Config.env_file` is set to `keys.env` (see `services/api-service/src/core/config.py`). The presence and contents of that file are outside the scope of this doc (not inspected here).

## TBD

- Bitwarden organization/vault layout and how secret IDs are managed/rotated.
- Local developer workflow for obtaining `BW_ACCESS_TOKEN`.
