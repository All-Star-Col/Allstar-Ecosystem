# Authentication & Access Data Model (Observed)

Scope note: modelo derivado de queries y schemas observables en `services/api-service` y uso de estado en frontend.

## Tablas PostgreSQL observadas

### `auth.users`
Campos observados por consultas/escrituras:
- `id`
- `email`
- `username`
- `full_name`
- `password_hash`
- `is_active`
- `is_email_verified`
- `last_login_at`
- `created_at`
- `updated_at`

Evidencia:
- `services/api-service/src/services/users.py`

### `auth.roles`
Campos observados:
- `id`
- `code`
- `name`
- `description`

Evidencia:
- `services/api-service/src/services/roles.py`

### `auth.user_roles`
Relacion observada:
- `user_id` <-> `role_id`

Evidencia:
- `services/api-service/src/services/roles.py`
- `services/api-service/src/services/apps.py`

### `workspace.apps` y `workspace.role_apps`
Usadas para resolver acceso por rol a apps del dashboard.

Campos observados de `workspace.apps` (respuesta API):
- `id`, `name`, `description`, `path`, `external_url`, `icon_key`, `icon_bg_color`, `badge_color`

Evidencia:
- `services/api-service/src/services/apps.py`
- `services/api-service/src/schemas/models.py` (`App`)

## Modelos API observados
- `Token { access_token, token_type }`
- `UserCreate { email?, username, full_name, password }`
- `UserUpdate { username?, full_name?, email?, is_active?, password?, password_hash? }`
- `UserAdminResponse { id, username, full_name?, email?, is_active, is_email_verified }`

Evidencia:
- `services/api-service/src/schemas/models.py`

## Estado de sesion en frontend
- Token JWT en `localStorage` o `sessionStorage` bajo `access_token`.
- Preferencia depende de "Recordar sesion" en login.

Evidencia:
- `applications/web-app/src/system/login/components/LoginCard.tsx`
- `applications/web-app/src/core/auth/auth.service.ts`

## TBD
- Restricciones de integridad (FK/indices) exactas en DDL.
- Modelo de auditoria de autenticacion (si existe).
- Modelo de sesiones revocadas o blacklist de tokens.
