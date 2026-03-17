# Backend Security Review (Observed)

Scope: `services/api-service` (FastAPI).

This document describes what is observable in the repository today (code + configuration). It is not a penetration test.

## Executive overview

Main strengths (observed):

- Passwords are hashed with `bcrypt` via `passlib` (`services/api-service/src/core/security.py`).
- JWT bearer authentication is implemented and enforced on workspace endpoints via `get_current_user` (`services/api-service/src/api/deps.py`).
- Dynamic form submissions validate table and column identifiers against Postgres metadata before constructing the insert (`services/api-service/src/services/forms.py`).

Main security gaps / risks (observed):

- Several high-impact endpoints are mounted without authentication dependencies (Sheets trigger/inventory routes; orders route). This enables unauthenticated calls that may affect data integrity and availability.
- Secrets are loaded at import time from Bitwarden (`services/api-service/src/core/config.py`), which makes runtime startup strict and makes local tooling/tests fragile.
- Error handling in some routes can leak internal exception strings to clients (fixed for the trigger route in this session).

## Security mechanisms (what exists)

### Authentication

- Login: OAuth2 Password flow (`POST /api/v1/login`) returns a JWT access token (`services/api-service/src/api/v1/routes/login/login.py`).
- Register: creates a user and returns a JWT access token (`services/api-service/src/api/v1/routes/register/register.py`).
- JWT creation: `src/core/auth.py:create_access_token` sets `exp` and uses `settings.SECRET_KEY` + `settings.ALGORITHM`.
- JWT validation: `src/api/deps.py:get_current_user` decodes JWT, reads `sub`, loads user record, rejects disabled users.

Observations:

- Token lifetime is configured as `ACCESS_TOKEN_EXPIRE_MINUTES = 600` (10 hours) in `services/api-service/src/core/config.py`.
- There is a minor documentation inconsistency around `OAuth2PasswordBearer(tokenUrl=...)` (docs-only behavior). Recommended to unify to `/api/v1/login` everywhere.

### Authorization

- Workspace endpoints enforce JWT via `Depends(get_current_user)` (`services/api-service/src/api/v1/routes/workspace/workspace.py`, `services/api-service/src/api/v1/routes/workspace/forms/forms.py`).
- App access is resolved using role mappings in Postgres (`src/api/deps.py:get_current_active_apps` -> `src/services/apps.py`).

### Secret management

- Secrets are fetched from Bitwarden using `BW_ACCESS_TOKEN` (`services/api-service/src/core/config.py`).
- Settings instantiate and fetch secrets at import time (`settings = Settings()` at module bottom).

Risks / implications:

- Any import of `src.core.config` will trigger a network call to Bitwarden and hard-fail when `BW_ACCESS_TOKEN` is missing.
- This can break unit tests, static analysis, local scripts, and any environment without Bitwarden connectivity.

### CORS

- CORS middleware is configured in `services/api-service/src/main.py`.
- Origins are explicitly allowed for localhost dev ports, plus an origin regex allowing `http://100.x.x.x(:port)`.

Notes:

- `allow_methods=['*']` and `allow_headers=['*']` is acceptable for internal apps but should be reviewed for production hardening.

### Dynamic SQL (forms)

- Form inserts are built dynamically as `INSERT INTO access.{table_name} ({columns}) VALUES ({placeholders})`.
- Table name and column identifiers are validated against allowed tables and `information_schema.columns` (`services/api-service/src/services/forms.py`).

Risks / recommendations:

- Even with validation, constructing identifier lists via string concatenation is brittle.
- Defense-in-depth: enforce an identifier regex (e.g. `^[a-zA-Z_][a-zA-Z0-9_]*$`) in addition to metadata validation.
- Consider using SQLAlchemy Table metadata for safer identifier handling.

### Scheduler

- APScheduler job calls `POST http://localhost:8000/api/v1/sheets/trigger/production` every 10 minutes (`services/api-service/src/core/scheduler.py`).

Risks / recommendations:

- If the trigger endpoint remains unauthenticated, any caller with network access to the API can force heavy work.
- Scheduler HTTP calls should use explicit timeouts (implemented).

### Logging

- Central logging setup exists (`services/api-service/src/core/logging_config.py`).

Risks / recommendations:

- Avoid logging secrets, tokens, or full headers.
- Prefer structured logs for request-id / correlation-id.

## Endpoint exposure (observed)

Protected (JWT required):

- `GET /api/v1/workspace`
- `GET /api/v1/workspace/forms/categories`
- `GET /api/v1/workspace/forms/tables`
- `POST /api/v1/workspace/forms/submit`

Unprotected (observed in code):

- `POST /api/v1/sheets/trigger/production` (`services/api-service/src/api/v1/routes/sheets/sheets.py`)
- `GET/POST/PATCH /api/v1/sheets/inventory/...` (`services/api-service/src/api/v1/routes/sheets/inventory/inventory.py`)

Note:

- `POST /api/v1/workspace/orders` now requires JWT (fixed in this session) (`services/api-service/src/api/v1/routes/workspace/orders/orders.py`).

Recommended hardening:

- Add `Depends(get_current_user)` (or a service-to-service auth mechanism) to all Sheets endpoints.

## Errors fixed in this session

Code-level issues fixed (compile-time + robustness):

- Fixed a syntax error and made ETag generation safe/consistent: `services/api-service/src/services/shared.py`.
- Fixed scheduler robustness by adding explicit HTTP timeouts: `services/api-service/src/core/scheduler.py`.
- Fixed broken `load_dotenv` invocation (local dev usability): `services/api-service/src/core/config.py`.
- Fixed Orders route signature and added auth dependency (now requires JWT): `services/api-service/src/api/v1/routes/workspace/orders/orders.py`.
- Avoid leaking internal exception strings in the Sheets trigger route by logging server-side and returning a generic error message: `services/api-service/src/api/v1/routes/sheets/sheets.py`.
- Fixed inventory duplicate item HTTP status code to `409 Conflict`: `services/api-service/src/api/v1/routes/sheets/inventory/inventory.py`.
- Corrected the runtime error message for missing Postgres URL: `services/api-service/src/db/database.py`.

Known remaining issues / followups:

- Sheets endpoints should be protected (JWT or internal auth) to prevent unauthenticated heavy operations.
- Consider refactoring Bitwarden secret loading to be lazy (or injectable) to improve testability and avoid import-time network calls.

## Prioritized recommendations

P0 (should do next):

- Protect all Sheets inventory and trigger endpoints with auth.

P1:

- Add defense-in-depth identifier validation regex for dynamic forms.
- Standardize OAuth2 `tokenUrl` values for consistent OpenAPI documentation.

P2:

- Add rate limiting / request size limits for heavy endpoints.
- Add audit logging for actions that mutate Google Sheets data.
