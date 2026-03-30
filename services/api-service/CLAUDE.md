# CLAUDE.md — api-service

Guía de referencia rápida para trabajar en este proyecto con Claude Code.

---

## Stack y versiones exactas

| Tecnología | Versión | Rol |
|---|---|---|
| Python | 3.12 | Runtime |
| FastAPI | 0.129.0 | Framework web ASGI |
| Uvicorn | 0.41.0 | Servidor ASGI |
| Starlette | 0.52.1 | Base HTTP de FastAPI |
| SQLAlchemy | 2.0.46 | ORM async (PostgreSQL) |
| asyncpg | 0.31.0 | Driver async PostgreSQL |
| pyodbc | 5.3.0 | Driver sync SQL Server |
| Pydantic | 2.12.5 | Validación de datos y settings |
| pydantic-settings | 2.13.1 | Configuración via env vars |
| python-jose | 3.5.0 | JWT (HS256) |
| passlib | 1.7.4 | Hashing bcrypt |
| bitwarden_sdk | 2.0.0 | Gestión de secretos en runtime |
| google-api-python-client | 2.190.0 | Google Sheets API v4 |
| google-auth | 2.48.0 | Auth service account Google |
| APScheduler | 3.11.2 | Jobs programados async |
| httpx | 0.28.1 | HTTP client async (scheduler) |
| sentry-sdk | 2.53.0 | Error tracking (instalado, ver §Incompleto) |
| python-dotenv | 1.2.1 | Carga de .env |
| email-validator | 2.3.0 | Validación de emails |
| beautifulsoup4 | 4.14.3 | Parsing HTML (emails) |
| requests | 2.32.5 | HTTP sync (Bitwarden SDK) |

---

## Estructura de carpetas

```
api-service/
├── src/
│   ├── main.py                        # Entry point: app FastAPI, CORS, routers, lifespan
│   ├── api/
│   │   ├── deps.py                    # Dependencias de auth (get_current_user, get_current_active_apps)
│   │   └── v1/
│   │       ├── common/
│   │       │   └── http_helpers.py    # request_id, build_error_response, log_operation
│   │       └── routes/
│   │           ├── login/login.py     # POST /api/v1/login
│   │           ├── register/register.py # POST /api/v1/register
│   │           ├── public/public.py   # GET /api/v1/public (sin auth)
│   │           ├── workspace/
│   │           │   ├── workspace.py   # GET /api/v1/workspace
│   │           │   ├── forms/forms.py # /api/v1/workspace/forms/*
│   │           │   ├── data_viewer/   # /api/v1/workspace/data-viewer/*
│   │           │   └── orders/orders.py # POST /api/v1/workspace/orders (STUB)
│   │           └── sheets/
│   │               ├── sheets.py      # POST /api/v1/sheets/trigger/production
│   │               └── inventory/inventory.py # /api/v1/sheets/inventory/*
│   ├── core/
│   │   ├── config.py                  # Settings + carga de secretos desde Bitwarden
│   │   ├── auth.py                    # authenticate_user, create_access_token, verify_password
│   │   ├── security.py                # get_password_hash (bcrypt)
│   │   ├── scheduler.py               # APScheduler — job de sync cada 240 min
│   │   └── logging_config.py          # Logger con colores, filtros por namespace
│   ├── db/
│   │   └── database.py                # engine async (PostgreSQL), get_db(), get_sqlserver_db()
│   ├── services/
│   │   ├── users.py                   # CRUD de usuarios
│   │   ├── apps.py                    # Apps autorizadas por rol de usuario
│   │   ├── roles.py                   # Consulta de roles
│   │   ├── forms.py                   # Lógica de formularios dinámicos
│   │   ├── data_viewer.py             # Consulta/exportación/edición de tablas (1150 líneas)
│   │   ├── sheets.py                  # Sync SQL Server ↔ Google Sheets (600+ líneas)
│   │   ├── shared.py                  # build_etag_response (ETag caching)
│   │   └── external_db.py             # Guardado/consulta de datos de emails
│   └── schemas/
│       └── models.py                  # Todos los modelos Pydantic (322 líneas)
├── tests/
│   ├── api/test_workspace_forms_auth_and_validation.py
│   └── services/test_forms_identifier_validation.py
├── scripts/
│   └── ensure_module_loggers.py       # Script de utilidad para verificar loggers
├── Dockerfile                         # Imagen de producción
├── Dockerfile.dev                     # Imagen de desarrollo con hot-reload
├── docker-compose.yml
├── run-dev.sh                         # Script de arranque local
├── requirements.txt                   # Dependencias pinneadas
├── keys.dev.env                       # Variables de entorno dev (no commitear secretos)
├── AGENTS.md                          # Guía de contexto para agentes IA
└── README.md                          # Documentación general
```

---

## Cómo correr el proyecto localmente

### Requisitos previos

- Python 3.12
- `BW_ACCESS_TOKEN` con acceso al vault de Bitwarden del proyecto
- Acceso a PostgreSQL y SQL Server (vía red o Tailscale)

### Setup

```bash
# 1. Crear entorno virtual
python -m venv .venv
source .venv/bin/activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Configurar variable de entorno de Bitwarden
export BW_ACCESS_TOKEN="tu_token_aqui"

# 4. Arrancar en modo dev (hot-reload)
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
# o directamente:
./run-dev.sh
```

### Con Docker

```bash
# Desarrollo
docker compose up --build

# Producción
docker build -f Dockerfile -t api-service .
docker run -e BW_ACCESS_TOKEN=xxx -p 8000:8000 api-service
```

### Verificación

- Docs interactivos: `http://localhost:8000/docs`
- Health check: `GET http://localhost:8000/api/v1/public` → `{"message": "Anyone can see this"}`

---

## Módulos y responsabilidades

### `src/core/config.py` — Configuración central

Carga la aplicación con `pydantic_settings.BaseSettings`. En startup, se conecta a Bitwarden y resuelve estos secretos por UUID:

- `SECRET_KEY` — clave para firmar JWT
- `ALGORITHM` — algoritmo JWT (HS256)
- `POSTGRES_URL_DATABASE` — conexión async a PostgreSQL
- `SQLSERVER_URL_DATABASE` — conexión pyodbc a SQL Server
- `SHEETS_INVENTARIO_ALLSTAR` — ID del spreadsheet de Google
- `GOOGLE_CREDENTIALS_JSON` — JSON de service account de Google

Si `BW_ACCESS_TOKEN` no está presente en el entorno, la app falla al arrancar (fail-fast).

---

### `src/api/v1/routes/` — Capa de handlers HTTP

Handlers delgados: validan la request, llaman al servicio, devuelven la response. No deben contener lógica de negocio.

| Módulo | Endpoints | Auth |
|---|---|---|
| `login` | `POST /api/v1/login` | No |
| `register` | `POST /api/v1/register` | No |
| `public` | `GET /api/v1/public` | No |
| `workspace` | `GET /api/v1/workspace` | JWT |
| `forms` | `GET .../forms/categories`, `GET .../forms/tables`, `POST .../forms/submit` | JWT |
| `data_viewer` | `GET .../data-viewer/tables`, `POST .../data-viewer/query`, `POST .../data-viewer/export`, `PATCH .../data-viewer/rows` | JWT |
| `orders` | `POST /api/v1/workspace/orders` | JWT |
| `sheets` | `POST /api/v1/sheets/trigger/production` | No |
| `inventory` | `GET/POST/PATCH /api/v1/sheets/inventory/*` | No |

---

### `src/services/forms.py` — Formularios dinámicos

Permite insertar filas en tablas configuradas en `workspace.ui_config_tablas` sin hardcodear el esquema.

Flujo principal (`submit_form`):
1. Valida que `table_name` y todas las columnas en `data[]` están en la whitelist de `workspace.ui_config_tablas`
2. Construye un `INSERT` parametrizado dinámico en `access.{table_name}`
3. Devuelve `correlation_id` (UUID) para trazabilidad

Excepciones propias: `IdentifierValidationError`, `DBCommunicationError`.

---

### `src/services/data_viewer.py` — Visor de datos (módulo principal)

El módulo más grande (1153 líneas). Permite consultar, filtrar, paginar, exportar en CSV y editar filas de tablas configuradas en PostgreSQL.

**Flujo de `query()`:**
1. Resuelve tabla en `workspace.ui_config_tablas` (allowlist)
2. Valida todos los identificadores con regex `^[A-Za-z_][A-Za-z0-9_]{0,62}$`
3. Construye `WHERE` con operadores: `eq | contains | gt | lt | in | between`
4. Si `q` presente, añade `ILIKE` sobre todas las columnas texto
5. Ejecuta con `statement_timeout` de 8s; devuelve filas paginadas + `total_count` opcional

**Flujo de `export_csv()`:**
- Streaming en chunks de 1000 filas, max 10 000 rows
- `statement_timeout` de 12s
- Nombre de archivo: `data_viewer_{table_id}_{timestamp}.csv`

**Flujo de `patch_row()`:**
- Valida que la tabla tiene PK, es editable y la columna es editable
- `UPDATE ... WHERE pk_col = $1` con columnas parametrizadas
- Devuelve la fila completa actualizada + lista de columnas modificadas

Todas las queries usan parámetros posicionales (`$1, $2, ...`), nunca interpolación directa.

---

### `src/services/sheets.py` — Sync inventario

Sincroniza el catálogo de ítems entre SQL Server (fuente de verdad) y Google Sheets (operaciones de almacén).

Sheets usadas: `INVENTARIO`, `Complementos`, `DESPACHADO`, `DEVOLUCIONES`, `Logs`

Operaciones principales:
- `compare_coditems()` — diff SQL Server vs INVENTARIO, añade/elimina filas
- `get_item()` — búsqueda por CodItem, devuelve opciones de bodega/fila
- `new_item()` — agrega ítem desde SQL Server a INVENTARIO
- `ship_product()` — mueve de INVENTARIO a DESPACHADO y elimina original
- `return_product()` — procesa devoluciones desde DEVOLUCIONES a INVENTARIO

Las operaciones de Google Sheets son síncronas internamente (API cliente v4) y se ejecutan en threadpool (`run_in_executor`) para no bloquear el event loop.

---

### `src/services/shared.py` — ETag caching

`build_etag_response(request, data)`:
- Serializa `data` a JSON, calcula SHA-256
- Si `If-None-Match` del cliente coincide → `304 Not Modified`
- Si no → `200 OK` con header `ETag`

Usado en `GET /forms/categories` y `GET /forms/tables`.

---

### `src/core/scheduler.py` — Jobs programados

`AsyncIOScheduler` con un único job: llama a `POST /api/v1/sheets/trigger/production` vía `httpx.AsyncClient`. Arranca en el evento `startup` de FastAPI.

---

### `src/core/logging_config.py` — Logging estructurado

- Logger con colores por nivel (INFO=azul, DEBUG=verde, WARNING=amarillo, ERROR=rojo)
- Controla nivel mediante `APP_LOG_LEVEL` y `APP_EXTERNAL_LOG_LEVEL`
- Silencia librerías ruidosas: `apscheduler`, `urllib3`, `httpx`, `passlib`, `bitwarden_sdk`
- Cada módulo obtiene su propio logger con `get_logger(__name__)`

---

### `src/api/v1/common/http_helpers.py` — Utilidades HTTP

- `resolve_request_id(request)` — lee `X-Request-ID` o genera UUID
- `build_error_response(...)` — shape uniforme de errores: `{request_id, detail, code}`
- `log_operation(...)` — registro de auditoría con tiempo de query, filas, status code

---

## Patrones arquitectónicos

| Patrón | Dónde aplica |
|---|---|
| **REST** | Toda la API: recursos en sustantivos, verbos HTTP para acciones |
| **Service Layer** | `routes/` llaman a `services/`; handlers sin lógica de negocio |
| **Repository implícito** | `services/users.py`, `services/apps.py`, `services/roles.py` encapsulan queries |
| **Dependency Injection** | FastAPI `Depends()` para db session, usuario autenticado, apps |
| **Allowlist validation** | `data_viewer` y `forms` validan tabla/columna contra config en BD antes de ejecutar |
| **Fail-fast config** | Bitwarden se resuelve en startup; app no arranca si faltan secretos |
| **ETag caching** | `GET` en resources estables devuelve `304` si el cliente tiene versión vigente |
| **Streaming response** | Export CSV usa `StreamingResponse` + `AsyncIterator` para no cargar todo en memoria |
| **Structured logging** | Logger por módulo, request_id propagado, audit logs en data_viewer |
| **Parametrized queries** | Sin interpolación de strings en SQL; todos los valores como parámetros posicionales |

---

## Base de datos

### PostgreSQL (async vía asyncpg + SQLAlchemy 2.0)
Esquemas relevantes:
- `auth` — `users`, `user_roles`, `roles`
- `workspace` — `apps`, `role_apps`, `ui_config_tablas`, `ui_categorias_tablas`
- `access` — tablas de datos de negocio (destino de formularios)

### SQL Server (sync vía pyodbc, ejecutado en threadpool)
- Fuente de verdad del catálogo de ítems para inventario
- Tabla principal: `Item` con joins a otras entidades de producto

---

## Autenticación

Flujo OAuth2 password:
1. `POST /api/v1/login` con `username` + `password` (form data)
2. `authenticate_user()` verifica bcrypt hash en `auth.users`
3. Devuelve JWT firmado con `SECRET_KEY` (HS256), expiración 600 minutos
4. Endpoints protegidos usan `Depends(get_current_user)` que decodifica el JWT

---

## Lo que está incompleto o roto

### Bugs confirmados

1. **Discrepancia scheduler** (`src/core/scheduler.py:10` vs `src/main.py:45`)
   - El decorator dice `minutes=240` (4 horas) pero el docstring del job y el log de startup dicen "cada 10 minutos".
   - El comportamiento real es cada **240 minutos**. El comentario está desactualizado o el valor es incorrecto.

2. **`on_event` deprecado** (`src/main.py:42-50`)
   - `@app.on_event("startup")` y `@app.on_event("shutdown")` están deprecados desde FastAPI 0.93.
   - Migrar a `lifespan` con `asynccontextmanager`.

### Stubs sin implementar

3. **Orders** (`src/api/v1/routes/workspace/orders/orders.py`)
   - `POST /api/v1/workspace/orders` simplemente hace `return order`.
   - No persiste en base de datos, no llama a ningún servicio, no tiene lógica real.
   - `_db: AsyncSession` se inyecta pero no se usa.

### Potencialmente incompleto

4. **Sentry no inicializado**
   - `sentry-sdk==2.53.0` está en `requirements.txt` pero no hay ninguna llamada a `sentry_sdk.init()` en el código fuente encontrado.
   - O falta la inicialización o es una dependencia residual sin uso.

5. **`external_db.py` sin consumidor claro**
   - `src/services/external_db.py` guarda y consulta datos de emails parseados.
   - No existe ningún route que llame a `all_missing()` o exponga estos datos vía API.
   - Puede ser funcionalidad pendiente de conectar.

6. **`scripts/ensure_module_loggers.py`**
   - Script de utilidad presente pero sin integración en CI/CD ni en el arranque.

7. **Tests mínimos**
   - Solo existen 2 archivos de test: auth/validación de forms e identificadores.
   - No hay tests para `data_viewer`, `sheets`, `users`, `auth`, ni para los endpoints principales.

8. **`POST /api/v1/sheets/trigger/production` sin autenticación**
   - Endpoint de trigger expuesto sin ningún mecanismo de auth (ni API key ni JWT).
   - Cualquier cliente con acceso a la red puede disparar la sincronización.
