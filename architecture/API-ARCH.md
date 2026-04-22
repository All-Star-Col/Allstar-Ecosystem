# API Architecture

Alcance: arquitectura observable de `services/api-service` en el estado actual del repo (2026-04-22).

Criterio:
- solo hechos verificables en codigo/versionado;
- sin suposiciones operativas externas;
- vacios marcados como `TBD`.

## 1) Estructura actual (as-is)

```text
services/api-service/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── src/
│   ├── main.py
│   ├── api/
│   │   ├── deps.py
│   │   └── v1/
│   │       ├── common/http_helpers.py
│   │       └── routes/
│   │           ├── login/login.py
│   │           ├── register/register.py
│   │           ├── public/public.py
│   │           ├── sheets/sheets.py
│   │           ├── sheets/inventory/inventory.py
│   │           └── workspace/
│   │               ├── workspace.py
│   │               ├── forms/forms.py
│   │               ├── data_viewer/data_viewer.py
│   │               ├── orders/orders.py
│   │               ├── users/users.py
│   │               └── carpentry/carpentry.py
│   ├── core/
│   │   ├── config.py
│   │   ├── auth.py
│   │   ├── security.py
│   │   ├── logging_config.py
│   │   └── scheduler.py
│   ├── db/database.py
│   ├── schemas/
│   │   ├── models.py
│   │   └── carpentry.py
│   └── services/
│       ├── users.py
│       ├── roles.py
│       ├── apps.py
│       ├── forms.py
│       ├── data_viewer.py
│       ├── sheets.py
│       ├── shared.py
│       ├── external_db.py
│       └── carpentry/*.py
└── tests/
```

## 2) Composicion de la app

`src/main.py`:
- configura CORS (`allow_origins` + regex para red `100.x.x.x`),
- registra routers,
- inicia/detiene scheduler en startup/shutdown.

Routers montados:
- `/api/v1` -> `login`, `register`, `public`, `workspace`
- `/api/v1/sheets` -> trigger sheets
- `/api/v1/sheets/inventory` -> inventario sheets
- `/api/v1/workspace/forms`
- `/api/v1/workspace/data-viewer`
- `/api/v1/workspace/orders`
- `/api/v1/workspace/users`
- `/api/v1/workspace/carpentry`

## 3) Capas y responsabilidades

## HTTP layer (`src/api/v1/routes/*`)

- Parseo de request.
- Dependencias FastAPI (`Depends`).
- Mapeo de errores a respuesta HTTP.

## Service layer (`src/services/*`)

- Reglas de negocio y acceso a DB/integraciones.
- Validaciones de identificadores para SQL dinamico (`forms`, `data_viewer`).
- Excepciones de dominio para control de errores.

## Contracts (`src/schemas/*`)

- Modelos Pydantic para request/response.

## Core (`src/core/*`)

- Config/secrets (Bitwarden), auth JWT, password hashing, logging, scheduler.

## DB (`src/db/database.py`)

- Sesion async PostgreSQL (`AsyncSession`).
- Conexion SQL Server (`pyodbc`) por helper.

## 4) Superficie HTTP observable

## Auth y publico

- `POST /api/v1/login`
- `POST /api/v1/register`
- `GET /api/v1/public`

## Workspace

- `GET /api/v1/workspace`

### Forms

- `GET /api/v1/workspace/forms/categories`
- `GET /api/v1/workspace/forms/tables`
- `GET /api/v1/workspace/forms/tables/{table_name}`
- `GET /api/v1/workspace/forms/lookups/{table_name}/{column_name}`
- `POST /api/v1/workspace/forms/submit`

### Data Viewer

- `GET /api/v1/workspace/data-viewer/tables`
- `POST /api/v1/workspace/data-viewer/query`
- `POST /api/v1/workspace/data-viewer/export`
- `PATCH /api/v1/workspace/data-viewer/rows`

### Users (admin-gated por dependency)

- `GET /api/v1/workspace/users/`
- `GET /api/v1/workspace/users/{user_id}`
- `POST /api/v1/workspace/users/`
- `PATCH /api/v1/workspace/users/{user_id}`
- `DELETE /api/v1/workspace/users/{user_id}`

### Orders

- `POST /api/v1/workspace/orders/orders` (actualmente retorna el payload; sin persistencia observable)

### Carpentry

- `GET /api/v1/workspace/carpentry/actions`
- `GET /api/v1/workspace/carpentry/ping`
- `POST /api/v1/workspace/carpentry/invoke`

## Sheets

- `POST /api/v1/sheets/trigger/production`
- `GET /api/v1/sheets/inventory/get/{item}`
- `GET /api/v1/sheets/inventory/return_product/get_unknows`
- `GET /api/v1/sheets/inventory/return_product/get/{item}`
- `POST /api/v1/sheets/inventory/new/{item}`
- `POST /api/v1/sheets/inventory/return_product/{item}`
- `PATCH /api/v1/sheets/inventory/location/{row}`
- `PATCH /api/v1/sheets/inventory/dispatch/{row}`

## 5) Datos e integraciones

## PostgreSQL

Uso observable:
- `auth.*` para usuarios/roles.
- `workspace.*` para apps por rol y metadata de UI.
- `data.*` para tablas de forms/data-viewer (consultas e inserciones).
- `carpentry` como schema configurable para acciones de carpinteria.

## SQL Server

- Fuente upstream para operaciones/sincronizacion en `SheetsService`.

## Google Sheets

- Operaciones de inventario y log operativo.
- Spreadsheet y credenciales cargadas desde secretos.

## Bitwarden

- Secrets bootstrap en `Settings.__init__`.
- Si falta `BW_ACCESS_TOKEN`, el proceso no arranca.

## Scheduler

- Job APScheduler cada `240` minutos.
- Llama al trigger local de sheets.
- Comentario/log aun menciona 10 minutos (inconsistencia de texto, no de configuracion efectiva).

## 6) Convenciones tecnicas observables

- Logger por modulo con `get_logger(__name__)`.
- Auth por `Depends(get_current_user)`.
- `require_admin` devuelve usuario o `None` (varios endpoints responden `None` en no-admin).
- ETag para metadata forms (`build_etag_response`).
- Data Viewer usa `X-Request-ID` y respuestas de error estructuradas (`code`, `detail`, `request_id`).
- Validacion estricta de identificadores SQL antes de SQL dinamico.

## 7) Como agregar un endpoint nuevo (patron recomendado)

1. Definir/ajustar modelos en `src/schemas/models.py` o `src/schemas/<dominio>.py`.
2. Implementar logica en `src/services/<dominio>.py`.
3. Exponer route en `src/api/v1/routes/...` con dependencias necesarias.
4. Registrar router en `src/main.py` si es un router nuevo.
5. Agregar tests en `tests/api` y/o `tests/services`.
6. Verificar en `/docs` y probar casos 200/4xx/5xx.

## 8) Gaps / TBD

- Contrato externo formal de SQL Server y Google Sheets (versionado/esquema) no esta documentado como fuente unica dentro del repo.
- Politica uniforme de autorizacion admin (403 vs `None`) es `TBD` desde perspectiva de estandarizacion.
