# Allstar-Ecosystem

This repository is documentation-driven.

The goal of this repo is to keep the Allstar Platform ecosystem described and navigable across:

- `business/`: problem framing, terminology.
- `architecture/`: system and integration overviews.
- `domains/`: bounded domain docs (example: authentication-access).
- `applications/`: frontend apps (example: `applications/web-app`).
- `services/`: backend services (example: `services/api-service`).
- `infra/`: infrastructure, containerization, CI/CD.
- `integrations/`: external systems used by the ecosystem.

## What exists today (observable in this repo)

### Web app (React)

- Location: `applications/web-app/`
- Stack: React + TypeScript + Vite (see `applications/web-app/package.json`).
- API base URL is configured via `VITE_API_SERVER` (see `applications/web-app/.env.development` and `applications/web-app/.env.production`).
- Available scripts (see `applications/web-app/package.json`): `dev`, `build`, `test`, `lint`, `preview`.

### API service (FastAPI)

- Location: `services/api-service/`
- Stack: Python 3.12 + FastAPI + Uvicorn + SQLAlchemy async + asyncpg + pyodbc + Google Sheets API + Bitwarden SDK + APScheduler (see `services/api-service/README.md`).
- HTTP API prefix: `/api/v1` (see `services/api-service/src/main.py`).

Observed endpoints (see `services/api-service/README.md` and `services/api-service/src/api/v1/routes/...`):

- `POST /api/v1/login`
- `POST /api/v1/register`
- `GET /api/v1/public`
- `GET /api/v1/workspace` (JWT required)
- `GET /api/v1/workspace/forms/categories` (JWT required)
- `GET /api/v1/workspace/forms/tables` (JWT required)
- `POST /api/v1/workspace/forms/submit` (JWT required)
- `POST /api/v1/sheets/trigger/production`
- `GET /api/v1/sheets/inventory/get/{item}`
- `POST /api/v1/sheets/inventory/new/{item}`
- `PATCH /api/v1/sheets/inventory/location/{row}`
- `PATCH /api/v1/sheets/inventory/dispatch/{row}`

Note: `services/api-service/src/main.py` includes an additional `orders` router, but its endpoint list is not documented here (TBD: inspect `services/api-service/src/api/v1/routes/workspace/orders`).

## Secrets and configuration

- The API service requires `BW_ACCESS_TOKEN` at runtime to load secrets from Bitwarden (see `services/api-service/src/core/config.py`).
- Secrets loaded from Bitwarden include: `ALGORITHM`, `SECRET_KEY`, DB URLs, Google credentials JSON, and the spreadsheet id (see `services/api-service/README.md` and `services/api-service/src/core/config.py`).

## Where to read next

- System overview: `architecture/system-overview.md`
- Integration map: `architecture/integration-architecture.md`
- Auth domain: `domains/authentication-access/domain.md` and `domains/authentication-access/api-contract.md`
- Bitwarden integration: `integrations/bitwarden.md`
- Google Sheets integration: `integrations/google-sheets.md`
- CI/CD workflow notes: `infra/ci-cd/github-actions.md`
