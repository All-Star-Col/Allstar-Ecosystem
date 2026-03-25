# Domains

## OVERVIEW
Bounded-context documentation lives here; each domain folder uses the same doc set and should stay focused on one business area.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Auth/access domain | `authentication-access/` | Most populated domain docs today |
| Inventory domain | `inventory/` | Shared template present; some files still empty |
| Workspace domain | `operational-workspace/` | Shared template present |
| Production domain | `production/` | Shared template present |

## CONVENTIONS
- Keep one bounded context per child directory.
- Prefer the established five-file set: `domain.md`, `data-model.md`, `api-contract.md`, `frontend-behavior.md`, `PRD.md`.
- When the doc is derived from inspected code, use the repo's observable-facts style and mark gaps as `TBD`.
- Link to `applications/web-app/`, `services/api-service/`, or `integrations/*.md` when implementation details already live there.

## ANTI-PATTERNS
- Do not duplicate the same concept across multiple domain folders.
- Do not invent API contracts or data models for empty template files.
- Do not place service operations, deployment steps, or secret-handling procedures here; those belong in `services/`, `infra/`, or `integrations/`.
