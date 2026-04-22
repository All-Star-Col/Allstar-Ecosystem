# Coding Standards (Observed)

Scope note: these standards are grounded in current repository behavior. Missing conventions are marked as `TBD` or optional.

## Baseline workflow

- Keep changes scoped to the relevant area (docs, web app, or API service).
- Before merge, run checks that match your touched area:
  - Web app: `npm --prefix applications/web-app run lint`
  - Web app tests: `npm --prefix applications/web-app run test`
  - API tests: see `engineering/testing-strategy.md`

## Web app standards (`applications/web-app`)

- Stack: React + TypeScript + Vite.
- Respect project aliases:
  - `@/*`
  - `@src/*`
- Follow lint gates in `package.json`:
  - `lint` includes `check:forms-category-contract`.
- Reuse shared primitives before creating new ones:
  - `src/shared/ui/**`
  - `src/shared/components/**`
- Prefer semantic theme tokens over raw color values in components:
  - examples: `bg-card`, `text-foreground`, `border-border`
- Keep typography token usage aligned with `src/shared/theme.css`.

## API standards (`services/api-service`)

- Keep route handlers thin (`src/api/v1/routes/**`).
- Put business logic in `src/services/**`.
- Use dependency injection for DB/service dependencies.
- Use Pydantic models from `src/schemas/models.py` for request/response contracts.
- Use module loggers with:
  - `from src.core.logging_config import get_logger`
  - `logger = get_logger(__name__)`
- Avoid `print` debugging in API code paths.

## Documentation standards

- Document observable behavior first, then unknowns as `TBD`.
- Prefer extending existing docs over creating duplicate files.
- Do not describe behavior that is not present in inspected code/scripts.

## Security and config hygiene

- Never commit secrets, tokens, or credential files.
- Do not hardcode runtime credentials in code.
- Keep env/secrets references indirect (Bitwarden + env variables as implemented).

## TBD / optional

- No repository-wide formatter config is currently visible (`prettier`, `black`, `ruff`, `editorconfig` not present at root).
- No explicit cross-repo naming convention for files/functions is documented beyond local AGENTS guidance.
