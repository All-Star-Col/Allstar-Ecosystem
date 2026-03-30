# CORE MODULE KNOWLEDGE

## OVERVIEW
Runtime configuration, auth, security, logging, and scheduler wiring for the FastAPI app.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Settings & secrets | `config.py` | Pulls Bitwarden items at startup; fail-fast on missing `BW_ACCESS_TOKEN` |
| Auth primitives | `auth.py` | OAuth2 password flow, JWT encode/decode, `oauth2_scheme` |
| Security helpers | `security.py` | Password hashing/verification |
| Logging setup | `logging_config.py` | `get_logger(__name__)` per-module logger factory |
| Scheduler | `scheduler.py` | APScheduler job triggers inventory sync every 10 minutes |
| DB wiring | `../db/database.py` | Async session factory used by deps/services |

## CONVENTIONS
- Always use `get_logger(__name__)` in modules; `ensure_module_loggers.py` keeps parity.
- Secrets must be provided by Bitwarden IDs defined in `config.py`; do not hardcode or bypass.
- JWT settings (`SECRET_KEY`, `ALGORITHM`) come from `settings`; keep `oauth2_scheme` as the single source for token extraction.
- Scheduler jobs should remain idempotent and short-lived; avoid long-running work inside scheduled callbacks.

## ANTI-PATTERNS
- Do not log secrets or decoded JWT payloads.
- Do not construct database engines/sessions outside `db/database.py`.
- Do not change hashing parameters in `security.py` without updating dependent clients/tests.
- Do not introduce alternate secret-loading paths; Bitwarden is authoritative.

## NOTES
- `scheduler.py` posts to `/api/v1/sheets/trigger/production`; ensure the endpoint remains stable.
- `auth.py` is relied on by `api/deps.py` for current-user resolution; keep signatures backward compatible.
