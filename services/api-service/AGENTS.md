# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-26  
**Commit:** 14238c8  
**Branch:** main

## OVERVIEW
FastAPI backend for auth, workspace access, dynamic forms, and Google Sheets/SQL Server sync; secrets load from Bitwarden at startup.

## STRUCTURE
```text
api-service/
├── README.md                  # setup, secrets, endpoints, docker notes
├── docker-compose.yml         # local dev container (uses keys.dev.env)
├── src/
│   ├── main.py                # FastAPI app + router mounting
│   ├── api/                   # deps + v1 routers by domain
│   ├── core/                  # config/auth/security/logging/scheduler
│   ├── db/                    # async SQLAlchemy session wiring
│   ├── services/              # business logic + integrations
│   └── schemas/               # Pydantic models & error shapes
├── tests/                     # API + service tests (unittest style)
└── scripts/ensure_module_loggers.py
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Local run + secrets | `README.md` | `BW_ACCESS_TOKEN` required; `keys.dev.env` for docker-compose |
| App entrypoint | `src/main.py` | Mounts `api/v1` routers, starts scheduler |
| Settings & secrets | `src/core/config.py` | Loads Bitwarden items; fail-fast if missing |
| Auth / deps | `src/core/auth.py`, `src/api/deps.py` | OAuth2 password flow, JWT decode, current user/apps |
| Routes | `src/api/v1/routes/` | Domain routers (workspace, sheets, login/register/public) |
| Services | `src/services/` | Forms, data viewer, sheets sync, roles/users/apps |
| Common HTTP helpers | `src/api/v1/common/http_helpers.py` | Request ID, error/validation formatting, op logging |
| Tests | `tests/api/`, `tests/services/`, `tests/test_docker_paths.py` | Unittest + TestClient overrides |

## CONVENTIONS
- Keep handlers thin; push logic into `services/` and shared helpers (`api/v1/common/http_helpers`, `services/shared`).
- Per-module logger via `get_logger(__name__)`; `scripts/ensure_module_loggers.py` enforces.
- Request correlation: Data Viewer endpoints must set/propagate `X-Request-ID` and log via `log_operation`.
- Validation & error shape: use Pydantic models in `schemas/models.py`; build API errors via `build_error_response` or FastAPI `HTTPException` with clear detail/code.
- ETag responses for workspace/forms list endpoints via `build_etag_response`.
- Secrets live in Bitwarden; config pulls IDs from `config.py`. Do not bypass Bitwarden or hardcode secrets.

## ANTI-PATTERNS (THIS PROJECT)
- Do not commit `.env`, credential JSON, or Bitwarden exports; do not log secrets or raw exceptions to clients.
- Do not move business logic into route files; avoid duplicating logic already in `services/` or `core/`.
- Do not treat `src/README.md` as authoritative; use root README + code.
- Do not strip request ID/logging from Data Viewer endpoints; keep correlation for ops.

## UNIQUE STYLES
- Structured request logging for Data Viewer: resolve request ID, measure `query_time_ms`, log rows/status.
- ETag-based caching helper for immutable list responses.
- Tests use dependency overrides + JWT stubs (`tests/api/test_workspace_forms_auth_and_validation.py`).

## COMMANDS
```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
docker compose up --build  # uses keys.dev.env
pytest
```

## NOTES
- Large modules: `src/services/data_viewer.py`, `src/services/sheets.py`; prefer helpers/refactors over route-layer duplication.
- Scheduler triggers inventory sync every 10 minutes (see `src/core/scheduler.py`).
