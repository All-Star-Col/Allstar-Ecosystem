# Allstar Platform API Services

Backend API del ecosistema Allstar Platform, construido con FastAPI.

## Descripción

Este proyecto expone servicios para:

- Autenticación y registro de usuarios con JWT.
- Workspace según rol/aplicaciones del usuario.
- Integración con Google Sheets para inventario.
- Integración con PostgreSQL (datos de auth/workspace/forms).
- Integración con SQL Server vía `pyodbc`.
- Formularios dinámicos para inserción en tablas del esquema `access`.
- Scheduler interno que dispara sincronización de inventario cada 10 minutos.

## Stack Tecnológico

- Python 3.12
- FastAPI + Uvicorn
- SQLAlchemy Async + `asyncpg` (PostgreSQL)
- `pyodbc` (SQL Server)
- Google Sheets API (`google-api-python-client`)
- Bitwarden SDK (carga de secretos en runtime)
- APScheduler
- Docker / Docker Compose
- GitHub Actions (build + deploy)

## Estructura del Proyecto

```text
API-SERVICES/
├── .github/workflows/main.yml      # CI/CD build + deploy
├── Dockerfile                      # Imagen de la API
├── docker-compose.yml              # Ejecución local en contenedor
├── requirements.txt                # Dependencias Python
├── allstar-fastapi.yml             # Referencia despliegue Azure Container Apps
├── src/
│   ├── main.py                     # App FastAPI y registro de rutas
│   ├── api/
│   │   ├── deps.py                 # Dependencias de auth y apps por usuario
│   │   └── v1/routes/              # Endpoints por dominio
│   ├── core/
│   │   ├── auth.py                 # JWT + autenticación
│   │   ├── config.py               # Configuración y secretos Bitwarden
│   │   ├── scheduler.py            # Job periódico interno
│   │   └── security.py             # Hash de passwords
│   ├── db/database.py              # Sesiones Postgres + conexión SQL Server
│   ├── services/                   # Lógica de negocio
│   └── schemas/models.py           # Modelos Pydantic
└── useful-azure-commands.txt       # Comandos operativos Azure
```

## Variables y Secretos

### Requeridas para ejecutar

- `BW_ACCESS_TOKEN`: token de acceso para leer secretos desde Bitwarden.

### Secretos que se cargan desde Bitwarden (vía IDs en `src/core/config.py`)

- `ALGORITHM`
- `POSTGRES_URL_DATABASE`
- `SECRET_KEY`
- `SQLSERVER_URL_DATABASE`
- `SHEETS_INVENTARIO_ALLSTAR`
- `GOOGLE_CREDENTIALS_JSON`

### Variables adicionales útiles

- `DEBUG` (opcional)
- `ALLOWED_ORIGINS` (se configura en `Settings`)

## Ejecución Local

### 1. Crear entorno virtual e instalar dependencias

```bash
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Definir variables de entorno

El proyecto necesita `BW_ACCESS_TOKEN` para arrancar correctamente.

```bash
export BW_ACCESS_TOKEN="tu_token"
```

Si usas archivo de entorno local, respeta lo que espera el proyecto (`keys.env` / `src/keys.env` según tu flujo).

### 3. Levantar API

```bash
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Documentación automática

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Automatizar Logger Por Módulo

Para agregar automáticamente `from src.core.logging_config import get_logger` y `logger = get_logger(__name__)` en módulos que aún no lo tengan:

```bash
# Simulación (no escribe cambios)
python scripts/ensure_module_loggers.py

# Aplicar cambios
python scripts/ensure_module_loggers.py --apply
```

Notas:
- Por defecto procesa `src/`.
- Omite `__init__.py` y `src/core/logging_config.py`.
- Es idempotente (si ya está agregado, no duplica).

## Ejecución con Docker

### Build

```bash
docker build -t allstar-api:latest .
```

### Run

```bash
docker run -p 8000:8000 \
  -e BW_ACCESS_TOKEN="tu_token" \
  allstar-api:latest
```

### Docker Compose

```bash
docker compose up --build
```

`docker-compose.yml` expone el puerto `8000` y permite inyectar variables por `env_file` y `environment`.

## Endpoints Principales

Prefijo base: `/api/v1`

### Auth

- `POST /api/v1/login`
- `POST /api/v1/register`

### Público

- `GET /api/v1/public`

### Workspace

- `GET /api/v1/workspace` (requiere JWT)

### Workspace Forms

- `GET /api/v1/workspace/forms/categories`
- `GET /api/v1/workspace/forms/tables`
- `POST /api/v1/workspace/forms/submit`

### Sheets / Inventario

- `POST /api/v1/sheets/trigger/production`
- `GET /api/v1/sheets/inventory/get/{item}`
- `POST /api/v1/sheets/inventory/new/{item}`
- `PATCH /api/v1/sheets/inventory/location/{row}`
- `PATCH /api/v1/sheets/inventory/dispatch/{row}`

## Autenticación

- Se usa OAuth2 Password Flow + Bearer Token JWT.
- El token se crea en `src/core/auth.py` y se valida en `src/api/deps.py`.
- El endpoint protegido principal es `/api/v1/workspace` y rutas dependientes.

## Scheduler Interno

En startup, la app activa un job cada 10 minutos (`src/core/scheduler.py`) que hace `POST` a:

- `http://localhost:8000/api/v1/sheets/trigger/production`

## CI/CD (GitHub Actions)

Workflow: `.github/workflows/main.yml`

Flujo actual:

1. Build de imagen Docker.
2. Push de tags (`prod` y `sha`) a Docker Hub.
3. Deploy remoto por SSH ejecutando `/opt/allstar-api/deploy.sh`.

Secretos típicos del workflow:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `VM_SSH_USER`
- `VM_SSH_PRIVATE_KEY`
- `VM_TAILSCALE_IP` (host remoto actual)

## Troubleshooting

- Error de arranque por secretos: verifica `BW_ACCESS_TOKEN`.
- Error DB Postgres/SQL Server: valida connection strings en Bitwarden.
- Error Google Sheets: valida `GOOGLE_CREDENTIALS_JSON` y permisos del spreadsheet.
- Error auth: revisa `SECRET_KEY`, `ALGORITHM` y expiración del token.

## Seguridad

- No subir archivos `.env`, llaves o certificados (ya está contemplado en `.gitignore`).
- Evitar imprimir secretos en logs de CI/CD.
- Rotar credenciales periódicamente (Bitwarden, DB, Docker Hub, SSH).

## Estado del Proyecto

Proyecto operativo con integración multi-fuente (PostgreSQL, SQL Server, Google Sheets) y pipeline de despliegue automatizado.
