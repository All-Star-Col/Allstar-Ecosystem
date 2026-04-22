# Production Deployment (Observed)

This document summarizes how production deployment is implemented in this repository today.

Scope note: observable facts only. Unknowns are marked as `TBD`.

## Deployment surfaces

- API service:
  - Build/push and remote deploy are automated by `.github/workflows/deploy-api.yml`.
  - Runtime target is a VM reached over Tailscale + SSH.
- Web app:
  - Build/deploy is automated by `.github/workflows/azure-static-web-apps-purple-water-03112dc0f.yml`.
  - Runtime target is Azure Static Web Apps.

## API production flow

1. A push to `main` affecting `services/api-service/**` (or the workflow file itself) triggers `deploy-api.yml`.
2. CI builds and pushes Docker image `starbotdocker/allstar-fastapi-repository` using tags:
   - `latest`
   - `prod`
   - `${{ github.sha }}`
3. CI joins Tailscale and SSHes to `${{ secrets.VM_SSH_USER }}@${{ secrets.VM_TAILSCALE_IP }}`.
4. CI executes `/opt/allstar-api/deploy.sh` on the VM, passing:
   - `BW_ACCESS_TOKEN`
   - `ENVIRONMENT=prod`
   - Docker Hub credentials

## Frontend production flow

1. A push to `main` affecting `applications/web-app/**` triggers `azure-static-web-apps-purple-water-03112dc0f.yml`.
2. CI runs `Azure/static-web-apps-deploy@v1` with:
   - `app_location: ./applications/web-app`
   - `output_location: dist`
3. The workflow also handles PR preview lifecycle via:
   - deploy on opened/synchronize/reopened PR events
   - preview close on PR closed

## Environment and config signals observed

- API workflow sets `ENVIRONMENT=prod` in workflow env.
- Frontend workflow exposes `VITE_API_SERVER` through workflow env when deploying.
- `applications/web-app/.env` exists in repo and includes local API config pattern.

## Operational gaps (TBD)

- VM provisioning details (OS baseline, Docker runtime management, service supervisor).
- Rollback procedure for API VM deploys.
- Rollback or pinning strategy for Azure Static Web Apps deploys.
- Production observability stack (logs, metrics, alerts, dashboards).
- Disaster recovery targets (RPO/RTO) and documented runbooks.
