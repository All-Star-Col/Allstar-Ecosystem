# API ROUTES KNOWLEDGE (v1)

## OVERVIEW
FastAPI routers grouped by domain: auth (login/register), public, workspace (forms/data viewer/orders), and sheets (inventory + trigger).

## STRUCTURE
```text
routes/
├── login/            # auth endpoints
├── register/         # user registration
├── public/           # public ping/info
├── workspace/        # workspace data_viewer/forms/orders
└── sheets/           # sheets trigger + inventory
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Include v1 router | `src/main.py` | Routers mounted under `/api/v1` |
| Dependencies | `src/api/deps.py` | JWT decoding, current user/apps |
| Common helpers | `src/api/v1/common/http_helpers.py` | Request ID, error formatting, operation logging |
| Workspace routes | `workspace/` | Forms + Data Viewer patterns |
| Sheets routes | `sheets/` | Inventory and trigger endpoints |
| Auth routes | `login/`, `register/` | Token issuance and user creation |
| Public route | `public/` | Simple public check endpoint |

## CONVENTIONS
- Define `router = APIRouter()` per module; include tags and prefixes in the route decorator.
- Inject services via `Depends(...)` factory helpers; DB session via `get_db`.
- Logging: import `get_logger(__name__)`; Data Viewer routes also set `X-Request-ID` and call `log_operation`.
- Error handling: map domain exceptions to HTTP errors (`HTTPException` or `build_error_response`); avoid leaking stack traces.
- Response shaping: use Pydantic models from `schemas/models.py`; use `build_etag_response` for cacheable lists.

## ANTI-PATTERNS
- Do not embed business logic in route handlers; delegate to services.
- Do not bypass auth dependencies (`get_current_user` / `get_current_active_apps`) on protected endpoints.
- Do not drop request correlation headers in Data Viewer endpoints.

## NOTES
- Test coverage for workspace/forms auth & validation lives in `tests/api/test_workspace_forms_auth_and_validation.py`; keep dependency override hooks stable.
