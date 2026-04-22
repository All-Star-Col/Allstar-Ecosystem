# Error Handling Guide (Observed)

Scope note: this guide reflects current implementation patterns in the repository.

## Core principles in current code

- Convert domain/service failures into stable HTTP responses at route layer.
- Avoid exposing raw stack traces to API consumers.
- Keep machine-readable error codes where implemented (currently strongest in Data Viewer).
- Preserve request correlation context when available (`X-Request-ID`).

## Current backend patterns

### 1) FastAPI `HTTPException` pattern (general endpoints)

Common in auth/forms/sheets routes:

- Validation/business conflict: usually `422` (for identifier validation in forms).
- Auth failures: `401`.
- Backend/integration failures: typically `500`.

### 2) Structured error response pattern (Data Viewer)

Data Viewer routes (`/workspace/data-viewer/**`) use helper-based structured responses:

- Builder: `build_error_response(...)` in `src/api/v1/common/http_helpers.py`.
- Payload shape:
  - `request_id`
  - `detail`
  - `code`
- Header:
  - `X-Request-ID`

Validation errors are mapped to explicit codes (examples):

- `INVALID_Q_LENGTH`
- `LIMIT_EXCEEDED`
- `UNSUPPORTED_OPERATOR`
- `INVALID_IDENTIFIER`
- `INVALID_FILTER`

## Mapping service exceptions to HTTP

Observed mapping in forms routes:

- `IdentifierValidationError` -> `HTTP 422`
- `DBCommunicationError` -> `HTTP 500`

When adding endpoints, keep this mapping explicit in route handlers and avoid swallowing domain semantics.

## Frontend handling expectations

- Data Viewer frontend wraps API failures into `DataViewerApiError` with:
  - HTTP status
  - backend `code`
  - `requestId`
- Forms frontend currently throws generic `Error` for non-OK responses.

## Practical checklist for new errors

1. Choose one response shape for the endpoint family.
2. Map domain exceptions to specific HTTP status codes.
3. Return actionable `detail` messages without secret/internal context.
4. Include correlation id when the endpoint already supports request IDs.
5. Add or update tests for unhappy paths.

## TBD / optional

- Unified cross-API error contract (all routes using same `{code, detail, request_id}` shape) is not enforced repository-wide.
- Global error middleware strategy is not currently documented in the service.
