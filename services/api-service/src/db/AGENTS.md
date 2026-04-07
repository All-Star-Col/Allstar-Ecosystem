# DB MODULE KNOWLEDGE

## OVERVIEW
Database wiring: async Postgres engine/session factory and threadpooled SQL Server connector.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Async Postgres engine/session | `database.py` | `engine = create_async_engine(...)`, `SessionLocal = async_sessionmaker(..., class_=AsyncSession)` |
| Declarative base | `database.py` | `Base = declarative_base()` for ORM models (if added) |
| DB dependency (Postgres) | `database.py::get_db` | `async with SessionLocal()` yields `AsyncSession` |
| DB dependency (SQL Server) | `database.py::get_sqlserver_db` | Uses `run_in_threadpool(pyodbc.connect(...))`; closes in finally |

## CONVENTIONS
- Fail-fast: raises if `POSTGRES_URL_DATABASE` or `SQLSERVER_URL_DATABASE` missing in settings.
- Always acquire DB sessions via `get_db` / `get_sqlserver_db` dependencies; avoid creating engines/sessions ad hoc.
- `get_sqlserver_db` runs pyodbc in threadpool to avoid blocking the event loop; keep it that way.
- Logging available via `get_logger(__name__)`; keep imports when extending.

## ANTI-PATTERNS
- Do not build new engines/sessions outside this module; reuse `engine`/`SessionLocal`.
- Do not call pyodbc directly on the event loop; always use `run_in_threadpool` or provided dependency.
- Do not swallow configuration errors; maintain fail-fast on missing URLs.

## NOTES
- Postgres echo is disabled; enable locally only for debugging.
- `Base` exists for future ORM models; currently models are Pydantic-based in `src/schemas/models.py`.
