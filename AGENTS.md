# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-22
**Commit:** 35cd694
**Branch:** main

## OVERVIEW
Documentation-driven monorepo for the Allstar ecosystem. The repo mixes living system docs with two runnable artifacts: `applications/web-app` (React/Vite) and `services/api-service` (FastAPI).

## STRUCTURE
```text
.
├── business/        # problem framing, vision, terminology
├── architecture/    # cross-system behavior and reviews
├── domains/         # bounded-context doc sets
├── applications/    # frontend app contexts
├── services/        # backend service contexts
├── infra/           # CI/CD, deployment, networking
├── integrations/    # external systems and contracts
└── engineering/     # engineering standards and guidance docs
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Repo map | `README.md` | Best starting index for current observable scope |
| System overview | `architecture/system-overview.md` | Web app, API, data stores, auth model |
| Integration flow | `architecture/integration-architecture.md` | Web→API and API→external systems |
| Frontend work | `applications/web-app/` | Read local `AGENTS.md` and `README.md` |
| Mobile app status | `applications/mobile-app/` | Docs scaffold; source/tests are `.gitkeep` only |
| Backend work | `services/api-service/` | Read local `AGENTS.md` and `README.md` |
| Domain docs | `domains/` | Shared bounded-context template; read local `AGENTS.md` |
| CI/CD | `.github/workflows/deploy-api.yml`, `.github/workflows/azure-static-web-apps-purple-water-03112dc0f.yml`, and `infra/ci-cd/github-actions.md` | API and frontend workflows exist in root `.github/workflows/` |
| External systems | `integrations/*.md` | Bitwarden, Google Sheets, Postgres, SQL Server, n8n |

## CONVENTIONS
- Do not change the documentation distribution.
- Respect each file path as part of its meaning.
- Use existing `.md` files as the source of project context.
- Prefer extending current documentation over creating duplicate docs.
- Prefer the repo's observed-documentation style: describe what is visible in the repo today, then mark gaps as `TBD`.
- Keep scoped guidance local: root covers cross-repo rules; child `AGENTS.md` files cover only local differences.
- For `applications/web-app`: prefer semantic token classes (`bg-card`, `text-foreground`, etc.) over raw hex values. Typography tokens (font sizes, weights, line-height) are centralized in `src/shared/theme.css`; do not hard-code font stacks in individual components.

## ANTI-PATTERNS (THIS PROJECT)
- Do not move content between top-level folders just to "tidy" the tree; the folder boundary is part of the meaning.
- Do not document behavior that is not grounded in inspected files; use `TBD` instead of guessing.
- Do not treat scaffold docs in `applications/mobile-app/` as authoritative implementation.
- Do not log, paste, or restate secrets/tokens from service config, Bitwarden, or CI docs.
- Do not create extra scoped `AGENTS.md` files unless the child directory has rules the parent cannot express concisely.

## UNIQUE STYLES
- `domains/*/` follows a repeated five-file pattern: `domain.md`, `data-model.md`, `api-contract.md`, `frontend-behavior.md`, `PRD.md`.
- Several docs use an explicit scope-note pattern: observable facts only, unknowns called out as `TBD`.
- `applications/web-app` and `services/api-service` are the main implementation roots; most other top-level folders are explanatory docs.

## COMMANDS
```bash
npm --prefix applications/web-app run dev
npm --prefix applications/web-app run test
npm --prefix applications/web-app run lint
docker compose -f services/api-service/docker-compose.yml up --build
# from services/api-service/
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

## NOTES
- Root GitHub Actions includes both API (`deploy-api.yml`) and frontend (`azure-static-web-apps-purple-water-03112dc0f.yml`) workflows.
- `applications/mobile-app/` is currently a documentation scaffold, not an implemented app.
- `services/api-service/src/README.md` is only a placeholder; rely on the service root README and source tree instead.
