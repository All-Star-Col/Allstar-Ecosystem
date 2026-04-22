# API Design Guide (Observed)

Scope note: this guide documents behavior visible in the repository today. If a rule is not backed by code or scripts, it is marked as `TBD` or optional.

## Current API shape

- Service: `services/api-service` (FastAPI).
- Root prefix: `/api/v1` (mounted in `src/main.py`).
- Routers are split by domain in `src/api/v1/routes/**`.
- Main groups mounted today:
  - Auth/Public: `login`, `register`, `public`
  - Workspace: `workspace`, `orders`, `forms`, `data-viewer`, `users`, `carpentry`
  - Sheets: `sheets`, `sheets/inventory`

## Routing and layering conventions

- Keep route handlers thin. Business logic should stay in `src/services/**`.
- Use dependency injection for service wiring:
  - Pattern observed: `get_<domain>_service(db: AsyncSession = Depends(get_db))`.
- Keep auth at route layer with `Depends(get_current_user)` for protected endpoints.
- Keep transport concerns (headers, response codes, request parsing) in route layer.

## Request/response contract patterns

- Use explicit `response_model` on routes where possible.
- For forms list endpoints, use ETag revalidation via `build_etag_response` (`src/services/shared.py`):
  - Supports `If-None-Match`.
  - Returns `304` when content hash matches.
- For Data Viewer endpoints, use request correlation with `X-Request-ID`:
  - Request ID resolved from header or generated (`resolve_request_id`).
  - Response sets `X-Request-ID`.

## Validation and query design

- Use Pydantic models for payload validation (`src/schemas/models.py`).
- Use `Query(...)` constraints for range/length limits (example in forms lookup endpoint with `ge`, `le`, `max_length`).
- For Data Viewer, payload is validated explicitly with `model_validate(payload)` to map validation failures to stable error codes.

## Error contract

- Two observable styles exist:
  - Generic FastAPI errors with `HTTPException(status_code, detail)`.
  - Structured Data Viewer error payloads from `build_error_response`:
    - `request_id`
    - `detail`
    - `code`
- When adding new endpoints, prefer one explicit shape per endpoint family and keep it stable for frontend clients.

## Frontend API contract expectations

Observed from `applications/web-app`:

- Forms client sends `Authorization` and optional ETag headers for revalidation.
- Data Viewer client always sends `X-Request-ID` and maps backend errors into `DataViewerApiError`.

## New endpoint checklist

1. Add route under the correct bounded path in `src/api/v1/routes/**`.
2. Reuse `Depends(get_current_user)` for protected routes.
3. Keep DB/service logic in `src/services/**`.
4. Define validation limits in schema or `Query(...)`.
5. Return predictable error shape (`HTTPException` or structured payload).
6. Add tests under `services/api-service/tests/api` and/or `tests/services`.

## TBD / optional

- Global API versioning policy beyond `v1`.
- Formal deprecation policy for routes.
- Single unified error schema for all endpoint families (today it is mixed).
