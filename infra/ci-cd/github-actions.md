# GitHub Actions (Observed)

This document describes the workflows currently present in `.github/workflows/`.

Scope note: only observable facts from this repository are documented. Unknowns are marked as `TBD`.

## Workflow inventory

- `.github/workflows/deploy-api.yml`
  - Name: `Deploy API Service`
  - Purpose: build/push API Docker image and trigger remote deploy on VM via Tailscale + SSH.
- `.github/workflows/azure-static-web-apps-purple-water-03112dc0f.yml`
  - Name: `Deploy Frontend (Azure Static Web Apps)`
  - Purpose: build/deploy web app to Azure Static Web Apps and close PR previews.

## API workflow (`deploy-api.yml`)

### Trigger and concurrency

- Triggers:
  - `push` on branch `main`, only when files under `services/api-service/**` or `.github/workflows/deploy-api.yml` change.
  - `workflow_dispatch`.
- Concurrency:
  - `group: deploy-api`
  - `cancel-in-progress: true`

### Jobs

- `build_and_push`
  - Runner: `ubuntu-latest`
  - Builds from:
    - `context: ./services/api-service`
    - `file: ./services/api-service/Dockerfile`
  - Pushes image tags:
    - `starbotdocker/allstar-fastapi-repository:latest`
    - `starbotdocker/allstar-fastapi-repository:prod`
    - `starbotdocker/allstar-fastapi-repository:${{ github.sha }}`
- `deploy_to_vm` (depends on `build_and_push`)
  - Connects to Tailscale with `tailscale/github-action@v4` using OAuth client credentials.
  - Validates network reachability (`tailscale status`, `tailscale ping`, `nc` to TCP 22).
  - Creates temporary SSH key file from `VM_SSH_PRIVATE_KEY`.
  - Runs remote script:
    - Target: `${{ secrets.VM_SSH_USER }}@${{ secrets.VM_TAILSCALE_IP }}`
    - Command: `/opt/allstar-api/deploy.sh`
    - Inline env passed: `BW_ACCESS_TOKEN`, `ENVIRONMENT=prod`, `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`.

### Secrets referenced

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `TS_OAUTH_CLIENT_ID`
- `TS_OAUTH_SECRET`
- `VM_TAILSCALE_IP`
- `VM_SSH_USER`
- `VM_SSH_PRIVATE_KEY`
- `BW_ACCESS_TOKEN`

### TBD

- Exact behavior of `/opt/allstar-api/deploy.sh` (script is outside this repository).

## Frontend workflow (`azure-static-web-apps-purple-water-03112dc0f.yml`)

### Triggers

- `push` on branch `main` with path filters:
  - `applications/web-app/**`
  - `.github/workflows/deploy-frontend.yml`
- `pull_request` on branch `main` with types:
  - `opened`
  - `synchronize`
  - `reopened`
  - `closed`
- `workflow_dispatch`

### Jobs

- `build_and_deploy`
  - Runs on `push`, `workflow_dispatch`, and PR events except `closed`.
  - Permissions:
    - `id-token: write`
    - `contents: read`
  - Uses:
    - `actions/checkout@v4` (`submodules: true`, `lfs: false`)
    - `actions/github-script@v6` to request OIDC token
    - `Azure/static-web-apps-deploy@v1` with:
      - `action: upload`
      - `app_location: ./applications/web-app`
      - `output_location: dist`
      - `azure_static_web_apps_api_token` from secret
  - Exposes `VITE_API_SERVER` to build via job env.
- `close_pull_request`
  - Runs on `pull_request` + `closed`
  - Calls `Azure/static-web-apps-deploy@v1` with `action: close`.

### Secrets referenced

- `AZURE_STATIC_WEB_APPS_API_TOKEN_PURPLE_WATER_03112DC0F`
- `VITE_API_SERVER`

### Observed note

- The workflow file is named `azure-static-web-apps-purple-water-03112dc0f.yml`, but one push path filter references `.github/workflows/deploy-frontend.yml`.

### TBD

- Azure environment/resource mapping details (resource group, app name, subscription) are not documented in this repository.
- Branch/preview retention policy in Azure Static Web Apps is not documented in this repository.
