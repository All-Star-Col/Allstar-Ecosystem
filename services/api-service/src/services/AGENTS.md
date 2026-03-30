# SERVICES MODULE KNOWLEDGE

## OVERVIEW
Business logic and external integrations (forms, data viewer, sheets sync, users/apps/roles, external DB helpers).

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Data Viewer | `data_viewer.py` | Large module; request ID logging, validation, metrics helpers |
| Sheets sync | `sheets.py` | Large module; Google Sheets + SQL Server coordination |
| Forms | `forms.py` | Form submission + identifier validation errors |
| Shared helpers | `shared.py` | `build_etag_response` for cache-friendly list responses |
| Users/roles/apps | `users.py`, `roles.py`, `apps.py` | AuthZ-related fetch helpers |
| External DB | `external_db.py` | Utility for external DB operations |

## CONVENTIONS
- Services are async; inject `AsyncSession` from `db/database.py` and keep route layers thin.
- Raise domain-specific exceptions (e.g., `IdentifierValidationError`, `DataViewerError`) for routes to map to HTTP responses.
- Use `get_logger(__name__)` per module; avoid print debugging.
- Preserve request correlation: Data Viewer functions expect request IDs and log via `log_operation` (see `api/v1/common/http_helpers`).
- For immutable list responses (forms/categories/tables), return data through `build_etag_response`.

## ANTI-PATTERNS
- Do not bypass validation when constructing queries (especially in Data Viewer filters/sorts).
- Do not embed FastAPI request/response objects inside services; keep services framework-agnostic.
- Do not duplicate Sheets sync logic in routes; extend `sheets.py` instead.

## NOTES
- `data_viewer.py` and `sheets.py` exceed 900 lines; prefer extracting helpers over in-route workarounds.
- New domain errors should include clear, user-facing messages; routes map them to HTTP codes.
