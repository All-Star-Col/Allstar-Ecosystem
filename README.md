# Allstar Ecosystem

Repositorio monorepo orientado a documentacion para el ecosistema Allstar, con dos artefactos ejecutables principales:

- `applications/web-app`: frontend en React + TypeScript + Vite.
- `services/api-service`: backend en FastAPI.

El resto de carpetas (`business`, `architecture`, `domains`, `infra`, `integrations`) documentan el funcionamiento, alcance y contexto operativo del sistema.

## Que resuelve este ecosistema (estado observable)

A partir del codigo y documentacion actuales, el sistema cubre principalmente:

- Autenticacion de usuarios con JWT (`/api/v1/login`, `/api/v1/register`).
- Resolucion de aplicaciones visibles por usuario/rol (`/api/v1/workspace`).
- Modulos operativos en frontend (forms, products, data-viewer, carpentry).
- Formularios dinamicos con inserciones controladas en PostgreSQL (esquema `access`).
- Integracion de inventario con Google Sheets.
- Sincronizacion periodica SQL Server -> Google Sheets via scheduler interno.

## Funcionamiento end-to-end

1. El usuario entra al `web-app` y se autentica contra la API.
2. La API emite un JWT; el frontend protege rutas con ese token.
3. El dashboard solicita `GET /api/v1/workspace` y renderiza apps disponibles segun rol.
4. Cada modulo frontend consume endpoints bajo `/api/v1/workspace/*` o `/api/v1/sheets/*`.
5. El servicio API integra datos y operaciones con PostgreSQL, SQL Server y Google Sheets.
6. Un job interno (APScheduler) ejecuta cada 10 minutos un trigger de sincronizacion de inventario.

## Arquitectura (alto nivel)

### Frontend (`applications/web-app`)

- Stack: React 19 + TypeScript + Vite.
- Rutas base del shell: `/login`, `/dashboard`, `/dashboard/profile`.
- Modulos registrados actualmente:
  - `/app/forms`
  - `/app/products`
  - `/app/data-viewer`
  - `/app/carpentry`
- Configuracion API por variable `VITE_API_SERVER` (archivo `.env`).

### Backend (`services/api-service`)

- Stack: FastAPI + Uvicorn + SQLAlchemy async + `asyncpg` + `pyodbc`.
- Prefijo principal de API: `/api/v1`.
- Grupos de rutas observables:
  - Auth/public: `login`, `register`, `public`.
  - Workspace: `workspace`, `forms`, `orders`, `data-viewer`, `users`, `carpentry`.
  - Sheets: `trigger/production` e inventario.
- Scheduler interno en startup para sincronizacion periodica de datos.

### Integraciones y datos

- Bitwarden: carga de secretos en runtime mediante `BW_ACCESS_TOKEN`.
- PostgreSQL: auth, roles, workspace y formularios dinamicos.
- SQL Server: fuente upstream para sincronizacion de inventario.
- Google Sheets API: operacion de inventario y hoja base/access.

## Composicion del monorepo

```text
.
├── business/        # contexto de problema, vision, terminologia
├── architecture/    # documentacion de arquitectura y revisiones
├── domains/         # dominios acotados (patron de 5 documentos por dominio)
├── applications/    # apps frontend (web-app implementado, mobile-app en scaffold)
├── services/        # servicios backend (api-service implementado)
├── infra/           # CI/CD, despliegue y red
└── integrations/    # contratos y contexto de sistemas externos
```

Notas de estado:

- `applications/mobile-app` existe como scaffold documental (`src/` y `tests/` con `.gitkeep`).
- `engineering/` contiene placeholders (no es fuente principal de comportamiento ejecutable).

## Ejecucion local

### 1) API (FastAPI)

```bash
cd services/api-service
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
export BW_ACCESS_TOKEN="tu_token"
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

Alternativa con contenedor:

```bash
docker compose -f services/api-service/docker-compose.yml up --build
```

### 2) Web app (React)

```bash
npm --prefix applications/web-app install
printf 'VITE_API_SERVER=http://localhost:8000\n' > applications/web-app/.env
npm --prefix applications/web-app run dev
```

Scripts utiles del frontend:

- `npm --prefix applications/web-app run test`
- `npm --prefix applications/web-app run lint`
- `npm --prefix applications/web-app run build`

## CI/CD (estado actual)

Workflows observables en `.github/workflows/`:

- `deploy-api.yml`
  - Trigger: `push` a `main` con cambios en `services/api-service/**`.
  - Flujo: build/push de imagen Docker + despliegue a VM via Tailscale SSH.
- `azure-static-web-apps-purple-water-03112dc0f.yml`
  - Trigger: `push`/`pull_request` para cambios en `applications/web-app/**`.
  - Flujo: build y despliegue del frontend en Azure Static Web Apps.

## Mapa de documentacion recomendada

- Vision de sistema: [`architecture/system-overview.md`](architecture/system-overview.md)
- Integraciones: [`architecture/integration-architecture.md`](architecture/integration-architecture.md)
- Problema de negocio: [`business/problem-statement.md`](business/problem-statement.md)
- Dominios:
  - [`domains/authentication-access/domain.md`](domains/authentication-access/domain.md)
  - [`domains/operational-workspace/domain.md`](domains/operational-workspace/domain.md)
  - [`domains/inventory/domain.md`](domains/inventory/domain.md)
  - [`domains/production/domain.md`](domains/production/domain.md)
- Integraciones externas:
  - [`integrations/bitwarden.md`](integrations/bitwarden.md)
  - [`integrations/google-sheets.md`](integrations/google-sheets.md)
  - [`integrations/postgres.md`](integrations/postgres.md)
  - [`integrations/sqlserver.md`](integrations/sqlserver.md)
  - [`integrations/n8n.md`](integrations/n8n.md)

## Alcance y limites del README

Este README resume comportamiento observable hoy en el repositorio. Cuando una capacidad no esta respaldada por archivos inspeccionables, debe considerarse `TBD` en la documentacion especifica del area.
