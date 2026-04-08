# API-ARCH.md

## 1) Alcance y criterio

Este documento describe la arquitectura observable de `services/api-service` a fecha **2026-04-08**, basado en inspección directa del código fuente, rutas, servicios, configuración y pruebas actuales.

Objetivo:
- explicar cómo está construida hoy la API;
- dejar un plan claro para implementar **un endpoint nuevo desde cero**;
- que sea legible tanto por personas como por modelos de IA.

Notas de alcance:
- Se documenta lo que existe hoy en el repo.
- Donde hay ambigüedad o diferencia entre docs y código, se señala explícitamente.

---

## 2) Mapa de estructura (as-is)

```text
services/api-service/
├── src/
│   ├── main.py                      # App FastAPI, CORS, include_router, startup/shutdown scheduler
│   ├── api/
│   │   ├── deps.py                  # Auth deps (JWT), apps del usuario, require_admin
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
│   │               └── users/users.py
│   ├── core/
│   │   ├── config.py                # Settings + carga de secretos en Bitwarden
│   │   ├── auth.py                  # OAuth2 password flow + JWT
│   │   ├── security.py              # Hash/verify password
│   │   ├── logging_config.py        # setup_logging + get_logger(__name__)
│   │   └── scheduler.py             # APScheduler -> trigger sheets
│   ├── db/database.py               # Async engine/session PostgreSQL + conexión SQL Server
│   ├── schemas/models.py            # Modelos Pydantic centralizados
│   └── services/
│       ├── users.py                 # usuarios y admin CRUD (parcial)
│       ├── roles.py                 # rol por usuario
│       ├── apps.py                  # apps por rol
│       ├── forms.py                 # metadata formularios + submit + FK lookups
│       ├── data_viewer.py           # query/export/patch dinámico con allowlist
│       ├── sheets.py                # integración Google Sheets + SQL Server
│       ├── shared.py                # helper ETag
│       └── external_db.py           # helper para email_data
└── tests/
    ├── api/
    ├── services/
    └── test_docker_paths.py
```

---

## 3) Arquitectura por capas

## 3.1 Flujo general de request

1. `main.py` monta routers bajo `/api/v1`.
2. Endpoint en `src/api/v1/routes/...` recibe request.
3. `Depends(...)` inyecta auth (`get_current_user`) y/o recursos (`get_db`, service factory).
4. Route delega lógica a `src/services/...`.
5. Service ejecuta validación de dominio + acceso DB/API externa.
6. Route transforma excepción/resultado a respuesta HTTP y `response_model` (Pydantic en `schemas/models.py`).

## 3.2 Responsabilidad de cada capa

- `main.py`:
  - composición global de la app (CORS, router registry, scheduler lifecycle).

- `api/deps.py`:
  - autenticación JWT y dependencias reutilizables.
  - `get_current_user`, `get_current_active_apps`, `require_admin`.

- `api/v1/routes/*`:
  - capa HTTP.
  - parsing de parámetros/body.
  - mapeo de excepciones a códigos HTTP.
  - no debería concentrar lógica de negocio pesada.

- `services/*`:
  - lógica de negocio y acceso a datos/integraciones.
  - validación avanzada (ej. SQL identifiers, allowlists, reglas de edición).
  - raise de excepciones de dominio para que route responda bien.

- `schemas/models.py`:
  - contratos request/response de endpoints.
  - validaciones Pydantic (Field, validators).

- `core/*`:
  - configuración global y secretos (`config.py`).
  - auth JWT (`auth.py`), crypto password (`security.py`).
  - logging estandarizado (`logging_config.py`).
  - jobs programados (`scheduler.py`).

- `db/database.py`:
  - fábrica de sesión `AsyncSession` PostgreSQL.
  - helper de conexión SQL Server vía `pyodbc` en threadpool.

---

## 4) Convenciones operativas importantes

- Logger por módulo: `from src.core.logging_config import get_logger` + `logger = get_logger(__name__)`.
- Auth protegida: `Depends(get_current_user)` para endpoints privados.
- Servicios asíncronos y routes delgadas.
- Validación de identificadores SQL cuando haya SQL dinámico (`forms.py`, `data_viewer.py`).
- Errores:
  - Forms: `IdentifierValidationError` -> 422.
  - Data Viewer: `build_error_response(...)` con `request_id` y `code`.
  - Sheets: service retorna status int y route mapea a HTTPException.
- ETag:
  - Forms metadata usa `build_etag_response` (`shared.py`) para `/categories`, `/tables`, `/tables/{table_name}`.
- Correlación observabilidad:
  - Data Viewer usa `X-Request-ID` + `log_operation(...)`.

---

## 5) Endpoints actuales (resumen)

- Auth:
  - `POST /api/v1/login`
  - `POST /api/v1/register`

- Public:
  - `GET /api/v1/public`

- Workspace:
  - `GET /api/v1/workspace`
  - Forms: `/api/v1/workspace/forms/*`
  - Data Viewer: `/api/v1/workspace/data-viewer/*`
  - Orders: `/api/v1/workspace/orders/orders` (stub)
  - Users: `/api/v1/workspace/users/*`

- Sheets:
  - `POST /api/v1/sheets/trigger/production`
  - Inventario: `/api/v1/sheets/inventory/*`

---

## 6) Cómo implementar un endpoint nuevo desde cero

Esta es la guía recomendada para mantener coherencia con la arquitectura actual.

## Paso 0: decidir dominio y ubicación

Elige en qué router vive:
- auth/public/workspace/sheets;
- o nuevo submódulo dentro de `workspace`/`sheets` si aplica.

Regla práctica:
- si es HTTP/API contract -> `routes`;
- si es lógica/reglas/integraciones -> `services`.

## Paso 1: definir schemas en `src/schemas/models.py`

Agregar (según necesidad):
- `MiEndpointRequest`;
- `MiEndpointResponse`;
- modelos auxiliares (errores específicos, payloads internos).

Buenas prácticas aquí:
- usar `Field(...)` con límites y `pattern` para identificadores;
- usar `field_validator` para normalización/validación de negocio ligera;
- mantener nombres explícitos y orientados al endpoint.

## Paso 2: implementar lógica en `src/services/...`

Crear o extender el servicio correcto. Aquí debe ir:
- consulta/transformación de datos;
- validaciones de dominio;
- acceso DB o integraciones externas;
- excepciones de dominio reutilizables.

No debe ir aquí:
- `Request`, `Response`, `Depends`, headers HTTP;
- decisiones de formato HTTP final.

Patrón recomendado:
- Excepción propia (`class MiError(Exception)` o derivada de error de dominio existente).
- Función async o método de clase service.
- Commits/rollbacks explícitos cuando hay escrituras.

## Paso 3: crear endpoint en `src/api/v1/routes/...`

1. Crear archivo de route (o extender uno existente).
2. Definir `router = APIRouter()`.
3. Crear dependency factory del service si aplica, por ejemplo:
   - `def get_mi_service(db: AsyncSession = Depends(get_db)) -> MiService: ...`
4. Definir endpoint con `response_model`.
5. Inyectar auth según necesidad:
   - público: sin auth.
   - privado: `current_user: User = Depends(get_current_user)`.
   - admin: `admin: User = Depends(require_admin)` (actualmente devuelve `None` si no admin; ver riesgos).
6. Llamar al service y mapear errores de dominio a HTTP status.

## Paso 4: registrar router en `src/main.py`

Agregar import del módulo y `app.include_router(...)` con:
- prefijo correcto (`/api/v1/...`);
- tag correspondiente.

Sin este paso, el endpoint no queda expuesto en `/docs`.

## Paso 5: evaluar si requiere cambios en `core/*`

Solo cuando haga falta:
- `core/config.py`: si necesitas nuevos secretos/config global.
- `core/auth.py` o `api/deps.py`: si cambia auth/autorización.
- `core/scheduler.py`: si endpoint será invocado por job periódico.
- `core/logging_config.py`: normalmente no requiere cambios; usar `get_logger`.

Si no hay necesidad real, no tocar `core`.

## Paso 6: agregar/ajustar pruebas

- Tests de servicio: `tests/services/`.
- Tests de endpoint: `tests/api/`.

Patrón actual de tests API:
- `FastAPI()` local + `include_router(...)`.
- `dependency_overrides` para `get_db` y factory del service.
- patch de `settings.SECRET_KEY`, `settings.ALGORITHM`, y `get_user` para JWT controlado.

## Paso 7: validar manualmente

- Ejecutar API local (`uvicorn src.main:app --reload`).
- Verificar `/docs`.
- Probar casos:
  - feliz;
  - validación;
  - auth 401/403;
  - errores de dominio.

---

## 7) Plantilla mínima para endpoint nuevo

## 7.1 `schemas/models.py`

```python
class ExampleCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class ExampleResponse(BaseModel):
    id: str
    name: str
```

## 7.2 `services/example.py`

```python
from sqlalchemy.ext.asyncio import AsyncSession


class ExampleDomainError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


class ExampleService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, name: str) -> dict:
        # logica de negocio + DB
        # raise ExampleDomainError(...) si aplica
        return {"id": "abc123", "name": name}
```

## 7.3 `api/v1/routes/workspace/example/example.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.db.database import get_db
from src.schemas.models import ExampleCreateRequest, ExampleResponse, User
from src.services.example import ExampleService, ExampleDomainError

router = APIRouter()


def get_example_service(db: AsyncSession = Depends(get_db)) -> ExampleService:
    return ExampleService(db)


@router.post("/", response_model=ExampleResponse)
async def create_example(
    payload: ExampleCreateRequest,
    _current_user: User = Depends(get_current_user),
    service: ExampleService = Depends(get_example_service),
):
    try:
        data = await service.create(payload.name)
        return ExampleResponse(**data)
    except ExampleDomainError as e:
        raise HTTPException(status_code=422, detail=e.detail)
```

## 7.4 `main.py`

```python
from src.api.v1.routes.workspace.example import example

app.include_router(example.router, prefix="/api/v1/workspace/example", tags=["Workspace"])
```

---

## 8) Qué va específicamente en `services/`

Checklist de “sí va”:
- consultas SQL y transformaciones;
- interacción con APIs externas (Sheets, SQL Server, etc.);
- reglas de negocio (allowlist, restricciones de edición, estados);
- excepciones de dominio;
- utilidades compartidas de lógica (no HTTP).

Checklist de “no va”:
- construcción de `JSONResponse`/`HTTPException` (eso en routes, salvo patrón explícito);
- manipulación directa de headers de request/response;
- dependencia directa de FastAPI Request object para lógica central.

---

## 9) Riesgos/observaciones detectadas en el estado actual

- `require_admin` en `api/deps.py` retorna `None` si no es admin, en lugar de lanzar 403 explícito.
- `scheduler.py` tiene `minutes=240`, pero comentarios/logs dicen “cada 10 minutos”.
- `services/sheets.py` usa `self.SHEET_NAME_ACCES` en sincronización, pero ese atributo no está definido en el constructor.
- `FORMS_SCHEMA` en `services/forms.py` está en `"data"`; si se esperaba otro esquema, confirmar antes de nuevos endpoints.
- `src/README.md` es mínimo (`## API`), por lo que la referencia útil real está en código + README raíz del servicio.

Estos puntos no bloquean crear endpoints, pero conviene revisarlos antes de extender zonas sensibles.

---

## 10) Checklist final para “endpoint listo”

- [ ] Schema request/response agregado en `schemas/models.py`.
- [ ] Lógica implementada en `services/` (sin meter lógica de negocio en route).
- [ ] Endpoint creado en `api/v1/routes/...` con `response_model`.
- [ ] Dependencias de auth/DB correctas (`get_current_user`, `get_db`, etc.).
- [ ] Router registrado en `main.py`.
- [ ] Manejo de errores consistente (422/404/500 según caso).
- [ ] Tests de service y/o API actualizados.
- [ ] Endpoint visible y funcional en `/docs`.

