# Applications

## OVERVIEW
Frontend application contexts live here: one active web app and one mobile-app scaffold.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Active frontend implementation | `web-app/` | React + TypeScript + Vite; read child `AGENTS.md` |
| Mobile planning/docs | `mobile-app/` | `overview.md`, `architecture.md`, `api-usage.md` exist, but source/tests are scaffold-only |
| Shared app boundary | `../domains/` | Domain behavior belongs there, not in duplicated app docs |

## CONVENTIONS
- Keep app-specific setup and runtime notes at the app root, not in `applications/`.
- Treat `web-app/` as the authoritative frontend implementation today.
- Treat `mobile-app/` as a placeholder until real source or tests appear.
- When documenting frontend behavior, prefer linking to the relevant domain doc instead of duplicating domain rules here.

## ANTI-PATTERNS
- Do not infer mobile-app implementation details from empty scaffolding.
- Do not copy backend or integration guidance into app folders; link to `services/`, `infra/`, or `integrations/` instead.
- Do not add application-wide instructions at root when they only apply to frontend work.
