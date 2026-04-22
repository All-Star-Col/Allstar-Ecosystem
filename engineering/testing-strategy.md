# Testing Strategy (Observed)

Scope note: this strategy is based on test files and runnable scripts present in the repository today.

## Test surface by component

### 1) Web app (`applications/web-app`)

- Runner: Vitest (`vitest.config.ts`).
- Environment: `jsdom`.
- Included test globs:
  - `src/apps/forms/**/*.spec.ts`
  - `src/apps/data-viewer/**/*.spec.ts`
  - `src/test/**/*.spec.tsx`
- Current command:
  - `npm --prefix applications/web-app run test`

Web app quality gate also includes lint + contract check:

- `npm --prefix applications/web-app run lint`

### 2) API service (`services/api-service`)

- Tests are present under:
  - `tests/api/**`
  - `tests/services/**`
  - `tests/test_docker_paths.py`
- Style: `unittest` (`TestCase` and `IsolatedAsyncioTestCase`) with FastAPI `TestClient`, mocks, and dependency overrides.

Because no dedicated backend test script is defined in `package.json` or `Makefile`, use one of:

- `cd services/api-service && python -m unittest discover -s tests -p "test_*.py"`
- Optional (if available in your env): `cd services/api-service && pytest`

## What to test when changing code

- Route contract changes:
  - status codes
  - auth requirements
  - response payload shape
- Service logic changes:
  - domain validation paths
  - DB/external integration boundary behavior (mocked in unit tests)
- Frontend API-client changes:
  - headers (`Authorization`, `If-None-Match`, `X-Request-ID`)
  - error mapping behavior

## Practical PR checklist

1. Run web lint/tests if touching `applications/web-app/**`.
2. Run API tests if touching `services/api-service/**`.
3. Note any skipped suites and why.
4. Add regression tests for new bugfixes whenever feasible.

## Known limitations observed

- Backend test dependencies are not pinned separately for dev tooling (for example, `pytest` is not listed in `requirements.txt`).
- `tests/test_docker_paths.py` uses an absolute path (`/home/automation/Documents/Allstar-Ecosystem/...`) that may require adaptation in different local environments.

## TBD / optional

- End-to-end test harness that runs web + api together is not documented.
- Performance/load testing strategy is not documented.
- CI test stage policy for backend/frontend beyond deploy workflows is not fully documented in repository docs.
