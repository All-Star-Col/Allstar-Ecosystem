# Problem Statement

This repository documents an internal platform composed of a web client and an API service.

Based on what is observable in the current repo, the platform is solving these operational problems:

- Provide authenticated access for employees via username/password and JWT (see `services/api-service/src/api/v1/routes/login/login.py`, `services/api-service/src/api/v1/routes/register/register.py`).
- Provide a "workspace" response that returns which apps a user should see based on database role mappings (see `services/api-service/src/api/v1/routes/workspace/workspace.py`, `services/api-service/src/services/apps.py`).
- Support dynamic form-driven inserts into a Postgres `access` schema while validating table/column identifiers against configuration and information_schema (see `services/api-service/src/services/forms.py`).
- Integrate with Google Sheets as an inventory surface, including item lookup, location updates, dispatch updates, and adding new items (see `services/api-service/src/api/v1/routes/sheets/inventory/inventory.py`, `services/api-service/src/services/sheets.py`).
- Keep a Google Sheets "access/base" sheet synchronized with recent SQL Server items via a scheduled trigger (see `services/api-service/src/core/scheduler.py`, `services/api-service/src/api/v1/routes/sheets/sheets.py`, `services/api-service/src/services/sheets.py`).

Constraints and implications observable in the repo:

- The API service requires Bitwarden secrets at startup via `BW_ACCESS_TOKEN` (see `services/api-service/src/core/config.py`).
- The deployed API is reachable from a Tailscale network (see `services/api-service/.github/workflows/main.yml` and the `VITE_API_SERVER` values in `applications/web-app/.env.*`).

TBD / questions (not observable in the inspected files):

- Which specific business processes and departments are in scope.
- Which workspace "apps" exist at the UI layer and how they map to business capabilities.
