# Authentication & Access API Contract (Observed)

Scope: endpoints related to authentication (token issuance) and access-controlled workspace resolution, as implemented in `services/api-service`.

Base path: `/api/v1` (see `services/api-service/src/main.py`).

## Authentication

### `POST /api/v1/login`

Purpose: exchange username/password for a JWT bearer token.

Observed implementation:

- Handler: `services/api-service/src/api/v1/routes/login/login.py`
- Request: OAuth2 Password Request Form (`application/x-www-form-urlencoded`) via `OAuth2PasswordRequestForm`.
- Response model: `Token` (see `services/api-service/src/schemas/models.py`).

Request fields (form):

- `username` (string)
- `password` (string)

Successful response (200):

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

Failure cases (observed):

- `401 Unauthorized` when credentials are incorrect.

### `POST /api/v1/register`

Purpose: create a user record and issue a JWT bearer token.

Observed implementation:

- Handler: `services/api-service/src/api/v1/routes/register/register.py`
- Request model: `UserCreate` (see `services/api-service/src/schemas/models.py`).
- Response model: `Token`.

Request body (JSON):

```json
{
  "email": "<optional>",
  "username": "<string>",
  "full_name": "<string>",
  "password": "<string>"
}
```

Successful response (200):

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

Failure cases (observed):

- `409 Conflict` when the username already exists (raised by `services/api-service/src/services/users.py`).

## Authorization

Protected endpoints use a bearer token.

- Header: `Authorization: Bearer <access_token>`
- Token decoding: `services/api-service/src/api/deps.py` uses `settings.SECRET_KEY` and `settings.ALGORITHM` (loaded from Bitwarden; see `services/api-service/src/core/config.py`).
- Claim expectations: `sub` contains the username (see `services/api-service/src/core/auth.py`).

Failure cases (observed):

- `401 Unauthorized` when the token is missing/invalid/expired.
- `400 Bad Request` when the user is inactive/disabled.

## Workspace

### `GET /api/v1/workspace`

Purpose: return current user identity and the list of apps the user can access.

Observed implementation:

- Handler: `services/api-service/src/api/v1/routes/workspace/workspace.py`
- Auth dependency: `get_current_user` (see `services/api-service/src/api/deps.py`).
- Apps dependency: `get_current_active_apps` (see `services/api-service/src/api/deps.py`).
- App shape: `App` model (see `services/api-service/src/schemas/models.py`).

Successful response (200) shape (observed keys):

```json
{
  "apps": [
    {
      "id": "<string>",
      "name": "<string>",
      "description": "<optional>",
      "path": "<string>",
      "external_url": "<optional>",
      "icon_key": "<string>",
      "icon_bg_color": "<string>",
      "badge_color": "<string>"
    }
  ],
  "username": "<string>",
  "full_name": "<optional>",
  "message": "<string>"
}
```

Notes:

- App access is computed via Postgres joins across `auth.user_roles`, `workspace.role_apps`, and `workspace.apps` (see `services/api-service/src/services/apps.py`).
- `services/api-service/src/main.py` includes an additional `orders` router under `/api/v1/workspace`; its endpoints are TBD (router not inspected in this task).
