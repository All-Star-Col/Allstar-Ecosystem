# Authentication & Access API Contract (Observed)

Base observable: `/api/v1`.

## `POST /api/v1/login`
Autentica con OAuth2 Password Form.

Request:
- `Content-Type: application/x-www-form-urlencoded`
- Campos:
  - `username`
  - `password`

Response 200:
- `{ "access_token": "<jwt>", "token_type": "bearer" }`

Errores observados:
- `401` credenciales invalidas.

Evidencia:
- `services/api-service/src/api/v1/routes/login/login.py`

## `POST /api/v1/register`
Crea usuario y devuelve token.

Request JSON (`UserCreate`):
- `email` (opcional)
- `username`
- `full_name`
- `password`

Response 200:
- `{ "access_token": "<jwt>", "token_type": "bearer" }`

Errores observados:
- `409` username existente.

Evidencia:
- `services/api-service/src/api/v1/routes/register/register.py`
- `services/api-service/src/services/users.py`

## `GET /api/v1/workspace`
Requiere bearer token valido.

Response 200 (shape observado):
- `apps: App[]`
- `username: string`
- `full_name: string | null`
- `role_code: string | null`
- `is_admin: boolean`
- `message: string`

Errores observados (dependencias auth):
- `401` token faltante/invalido/expirado.
- `400` usuario inactivo.

Evidencia:
- `services/api-service/src/api/v1/routes/workspace/workspace.py`
- `services/api-service/src/api/deps.py`

## Endpoints administrativos de usuarios
Prefijo: `/api/v1/workspace/users`

### `GET /`
Query params: `limit`, `offset`.

Comportamiento observado:
- Si usuario es admin: retorna `{ list_users, limit, offset, total }`.
- Si no es admin: retorna `null` (sin `403` explicito en handler).

### `GET /{user_id}`
- Admin: `{ user: UserAdminResponse | null }`
- No admin: `null`

### `POST /`
- Body: `UserCreate`
- Admin: crea usuario.
- No admin: no-op (handler no retorna payload).

### `PATCH /{user_id}`
- Body: `UserUpdate`
- Admin: actualiza campos permitidos.

### `DELETE /{user_id}?hard={bool}`
- `hard=true`: delete fisico.
- `hard=false`: soft delete (`is_active=false`).

Evidencia:
- `services/api-service/src/api/v1/routes/workspace/users/users.py`
- `services/api-service/src/services/users.py`

## TBD
- Contrato OpenAPI formal para codigos de error de `/workspace/users`.
- Endpoint de refresh/renew de token.
- Endpoint de logout server-side.
