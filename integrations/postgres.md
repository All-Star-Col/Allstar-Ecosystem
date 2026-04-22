# Integracion PostgreSQL (Observed)

Este documento describe el uso observable de PostgreSQL desde `services/api-service`.

Nota de alcance: se documenta solo lo verificable en codigo del repo. Lo no verificable se marca como `TBD`.

## Donde vive

- Conexion y sesiones async: `services/api-service/src/db/database.py`
- Servicios que consultan/escriben Postgres:
  - Auth/usuarios/apps/roles:
    - `services/api-service/src/services/users.py`
    - `services/api-service/src/services/apps.py`
    - `services/api-service/src/services/roles.py`
  - Forms dinamicos:
    - `services/api-service/src/services/forms.py`
  - Data Viewer:
    - `services/api-service/src/services/data_viewer.py`
  - Helper adicional:
    - `services/api-service/src/services/external_db.py`

## Contrato de conexion

- URL de conexion: `settings.POSTGRES_URL_DATABASE`
- Driver async esperado por SQLAlchemy: definido en runtime por el secret de conexion.
- `database.py` crea:
  - `engine = create_async_engine(settings.POSTGRES_URL_DATABASE, echo=False)`
  - `SessionLocal = async_sessionmaker(..., class_=AsyncSession)`
- Falla de arranque:
  - Si `POSTGRES_URL_DATABASE` falta, la app lanza `RuntimeError` al importar `database.py`.
  - `database.py` tambien exige `SQLSERVER_URL_DATABASE` aunque la request no use SQL Server.

## Esquemas y tablas observadas

### Esquema `auth`

- `auth.users`
  - consulta por username
  - alta de usuario
  - update de `last_login_at`
  - listado/edicion/desactivacion
- `auth.user_roles`
  - resolucion de rol por usuario
- `auth.roles`
  - metadata de rol para workspace

### Esquema `workspace`

- `workspace.apps`
- `workspace.role_apps`
- `workspace.ui_categorias_tablas`
- `workspace.ui_config_tablas`

Uso principal:

- resolver apps por rol
- resolver categorias/tablas visibles de forms
- allowlist de Data Viewer y flags de edicion (`can_update`, `can_insert`, `can_delete`)

### Esquema `data` (forms)

- `services/forms.py` fija `FORMS_SCHEMA = "data"`.
- `POST /workspace/forms/submit` inserta dinamicamente en tablas de `data`.
- Antes de insertar:
  - valida identificadores SQL (regex + quoting)
  - valida tabla visible en `workspace.ui_config_tablas`
  - valida columnas permitidas con `information_schema.columns`

### Metadatos de sistema PostgreSQL

Forms y Data Viewer leen:

- `information_schema.columns`
- `information_schema.table_constraints`
- `information_schema.key_column_usage`
- `information_schema.constraint_column_usage`
- `pg_type`, `pg_enum` (enums)
- `pg_constraint` (check constraints para enum-like)

### Tabla `email_data` (uso parcial)

- `services/external_db.py` define insercion/consulta de `email_data`.
- No se observaron rutas activas que llamen `save_email` o `all_missing` en el codigo inspeccionado.

## Endpoints relacionados (observado)

Dependen de Postgres via `get_db`:

- Auth:
  - `POST /api/v1/login`
  - `POST /api/v1/register`
- Workspace:
  - `GET /api/v1/workspace`
  - `POST /api/v1/workspace/orders/orders` (actualmente echo del payload)
  - `/api/v1/workspace/users/*`
  - `/api/v1/workspace/forms/*`
  - `/api/v1/workspace/data-viewer/*`

## Patrones de transaccion y errores

- Operaciones de escritura usan `commit()` explicito y `rollback()` en fallos.
- Forms:
  - `IdentifierValidationError` para identificadores invalidos (422 en rutas).
  - `DBCommunicationError` para errores de DB (500 en rutas).
- Data Viewer:
  - errores tipados con `code` y `status_code` (`DataViewerError`).

## TBD

- DDL oficial (migraciones/versionado de schema) no visible en este repo.
- Politica de indices, particionamiento y tuning de consultas.
- Ciclo de vida de `email_data` (si vive en `public` o esquema dedicado, y quien lo consume en produccion).
