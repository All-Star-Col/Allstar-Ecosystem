# API Service

## OVERVIEW
FastAPI backend for auth, workspace access, forms, and Google Sheets synchronization; runtime secrets load from Bitwarden.

## STRUCTURE
```text
api-service/
├── README.md              # setup, secrets, endpoints, docker notes
├── docker-compose.yml     # local container workflow
├── src/
│   ├── api/v1/routes/     # route handlers by domain
│   ├── core/              # auth, config, logging, scheduler, security
│   ├── db/                # database/session wiring
│   ├── services/          # business logic and integrations
│   └── schemas/           # request/response models
└── tests/
    ├── api/
    └── services/
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Local run + secrets | `README.md` | `BW_ACCESS_TOKEN` is mandatory |
| App entrypoint | `src/main.py` | FastAPI app, router mounting, startup/shutdown |
| Runtime settings | `src/core/config.py` | Bitwarden-backed secret loading |
| Auth / request deps | `src/core/auth.py`, `src/api/deps.py` | JWT creation and validation |
| Sheets behavior | `src/services/sheets.py`, `src/api/v1/routes/sheets/` | Google Sheets + SQL Server sync |
| Tests | `tests/api/`, `tests/services/` | Existing verification split |

## CONVENTIONS
- Read the service README before changing setup, secrets, Docker flow, or endpoint docs.
- `BW_ACCESS_TOKEN` is required at startup because `Settings` loads Bitwarden secrets during initialization.
- Keep route handlers thin under `src/api/v1/routes/`; put reusable logic in `src/services/` or `src/core/`.
- Service behavior already has companion docs in `integrations/` and `architecture/`; extend those instead of cloning integration explanations here.
- CI/CD is defined in the repo-root workflow, but it is scoped to `services/api-service/**` changes.

## ANTI-PATTERNS
- Do not commit `.env`, credential JSON, tokens, or other secret material.
- Do not log secrets/tokens or expose raw internal exception details in user-facing API errors.
- Do not treat `src/README.md` as a maintained source of truth; it is currently a placeholder.
- Do not move integration-specific documentation out of `integrations/*.md` when a shared doc already exists.

## COMMANDS
```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
docker compose up --build
pytest
```
