# WORKSPACE ROUTES KNOWLEDGE

## OVERVIEW
Workspace endpoints for forms submission, Data Viewer queries/edits, and simple orders echo.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Forms endpoints | `forms/forms.py` | Uses `FormsService`; ETag responses for lists |
| Data Viewer endpoints | `data_viewer/data_viewer.py` | Request ID + `log_operation`; validation with Pydantic models |
| Orders demo | `orders/orders.py` | Simple echo endpoint |
| Helpers | `../../common/http_helpers.py` | Request ID, error/validation formatting, op logging |
| Services | `src/services/forms.py`, `src/services/data_viewer.py` | Domain logic and errors |

## CONVENTIONS
- Depend on services via `Depends(get_forms_service/get_data_viewer_service)`; DB via `get_db`.
- Always resolve `X-Request-ID` in Data Viewer endpoints; set header on responses and log via `log_operation` with timing.
- Map `DataViewerError` to `build_error_response`; map form `IdentifierValidationError` to `HTTPException(status_code=422)`.
- Use Pydantic models for request/response shapes (`schemas/models.py`); use `build_etag_response` for forms metadata lists.
- Keep handlers thin; validation and business rules live in services.

## ANTI-PATTERNS
- Do not drop correlation headers/timing logs in Data Viewer routes.
- Do not bypass form/table identifier validation or hardcode table names in routes.
- Do not return raw exceptions; always convert to structured HTTP errors.

## NOTES
- Tests cover auth/validation for forms (`tests/api/test_workspace_forms_auth_and_validation.py`); maintain dependency override points.
- `data_viewer.py` is large; prefer extracting helpers in services rather than duplicating route logic.
