# Authentication & Access Domain

This domain describes the observed authentication, authorization, and access-control surface for the Allstar Platform.

Scope note: this is documentation of what is visible in the repo today. If something is not in the inspected files, it is marked as TBD.

## Responsibilities (observed)

- Authenticate users with username/password and issue a JWT access token.
- Register new users and issue a JWT access token.
- Authorize requests to protected endpoints by validating JWTs.
- Resolve which "workspace apps" the current user can access via role mappings.

## Data model (observed)

The API service queries the following Postgres tables/schemas:

- `auth.users`
  - Fields referenced in code include `id`, `username`, `full_name`, `password_hash`, `is_active`, `last_login_at` (see `services/api-service/src/services/users.py`).
- `auth.roles`
  - Fields referenced in code include `id`, `name`, `description` (see `services/api-service/src/services/roles.py`).
- `auth.user_roles`
  - Maps `user_id` to `role_id` (see `services/api-service/src/services/apps.py`, `services/api-service/src/services/roles.py`).
- `workspace.apps` and `workspace.role_apps`
  - Used to build the `apps` list returned from the workspace endpoint (see `services/api-service/src/services/apps.py`).

## API surface (observed)

- `POST /api/v1/login` issues a token for valid credentials (see `services/api-service/src/api/v1/routes/login/login.py`).
- `POST /api/v1/register` creates a user and issues a token (see `services/api-service/src/api/v1/routes/register/register.py`).
- `GET /api/v1/workspace` returns the current user identity plus allowed apps (see `services/api-service/src/api/v1/routes/workspace/workspace.py`).

Note: `services/api-service/src/main.py` includes an additional `orders` router under `/api/v1/workspace`. Endpoints are TBD (not inspected in this task).

## Authentication and authorization mechanics (observed)

- Credentials validation:
  - `authenticate_user()` loads `auth.users` by username and verifies the provided password against `password_hash` (see `services/api-service/src/core/auth.py`, `services/api-service/src/services/users.py`).
- Token creation:
  - JWT tokens are created using `settings.SECRET_KEY` and `settings.ALGORITHM`, and include an `exp` claim; login/register set `sub` to the username (see `services/api-service/src/core/auth.py`, `services/api-service/src/api/v1/routes/login/login.py`, `services/api-service/src/api/v1/routes/register/register.py`).
  - Expiration in minutes is configured by `settings.ACCESS_TOKEN_EXPIRE_MINUTES` (see `services/api-service/src/core/config.py`).
- Token validation:
  - `get_current_user()` decodes the JWT, reads `sub` as the username, loads the user record, and rejects disabled users (see `services/api-service/src/api/deps.py`).
- App access resolution:
  - `get_current_active_apps()` returns apps based on the current user's role via `auth.user_roles` and `workspace.role_apps` (see `services/api-service/src/api/deps.py`, `services/api-service/src/services/apps.py`).

## Operational dependencies (observed)

- Secrets for JWT and database connectivity are loaded from Bitwarden at startup and require `BW_ACCESS_TOKEN` (see `services/api-service/src/core/config.py`).

## TBD / questions

- Password reset / email verification flows are not documented in inspected files.
- User provisioning, default roles, and role assignment lifecycle are not documented in inspected files.
