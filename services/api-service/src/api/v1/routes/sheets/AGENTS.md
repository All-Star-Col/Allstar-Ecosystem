# SHEETS ROUTES KNOWLEDGE

## OVERVIEW
Endpoints to trigger inventory sync and CRUD-style inventory operations backed by Sheets/SQL Server.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Trigger production sync | `sheets.py` | Calls `SheetsService.trigger_production`; simple success/fail response |
| Inventory ops | `inventory/inventory.py` | GET/PATCH/POST handlers delegating to `SheetsService` methods |
| Service logic | `src/services/sheets.py` | Google Sheets + SQL Server coordination, status codes |
| Common deps | `src/api/deps.py` | Auth + DB session for protected routes |

## CONVENTIONS
- Inject `SheetsService` via `Depends(get_sheets_service)`; use async handlers.
- Map service-returned status codes to HTTP responses; raise `HTTPException` when service signals error.
- Log via `get_logger(__name__)`; keep route layer free of business logic.
- Keep path params (`item`, `row`) validated by service; routes should not enforce additional schema.

## ANTI-PATTERNS
- Do not duplicate Sheets logic in routes; extend `sheets.py` service instead.
- Do not ignore service-returned status codes/messages when building responses.
- Do not bypass auth on protected inventory endpoints.

## NOTES
- Service depends on secrets/config from `core/config.py` (Bitwarden); ensure env is loaded before hitting these routes.
