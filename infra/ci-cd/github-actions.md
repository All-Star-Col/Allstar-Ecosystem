# GitHub Actions (Observed)

This document describes the observed CI/CD workflow for the API service as defined in this repository.

Scope note: this is documentation of what is visible in the repo today. If something is not in the inspected files, it is marked as TBD.

## Where it lives

- Workflow file: `services/api-service/.github/workflows/main.yml`

## Trigger and concurrency

- Trigger: `push` to `master`.
- Concurrency: `group: prod-deploy` with `cancel-in-progress: true`.

## Build and push image (Docker Hub)

Job: `build_push`

- Runner: `ubuntu-latest`.
- Uses `docker/setup-buildx-action@v3`.
- Logs into Docker Hub via `docker/login-action@v3`.
- Builds and pushes using `docker/build-push-action@v6` with:
  - `context: .`
  - `file: ./Dockerfile`
  - `push: true`
  - GitHub Actions cache (`cache-from`/`cache-to`).
- Image name is set by workflow env: `starbotdocker/allstar-fastapi-repository`.
- Tags pushed:
  - `starbotdocker/allstar-fastapi-repository:latest`
  - `starbotdocker/allstar-fastapi-repository:prod`
  - `starbotdocker/allstar-fastapi-repository:${{ github.sha }}`

TBD:

- The Dockerfile used by this workflow (`./Dockerfile` relative to `services/api-service/`) is not described in this doc.

## Deploy to VM (Tailscale + SSH)

Job: `deploy_vm` (depends on `build_push`)

- Runner: `ubuntu-latest`.
- Brings up Tailscale using `tailscale/github-action@v4` with OAuth client credentials.
- Performs basic connectivity checks (tailscale status/ping) and a TCP 22 probe via netcat.
- Prepares an SSH private key from the `VM_SSH_PRIVATE_KEY` secret and validates it via `ssh-keygen`.
- Adds the VM host key to `~/.ssh/known_hosts` via `ssh-keyscan`.
- SSHes to `${{ secrets.VM_SSH_USER }}@${{ secrets.VM_TAILSCALE_IP }}` and runs:
  - `/opt/allstar-api/deploy.sh`
  - with inline environment variables:
    - `BW_ACCESS_TOKEN`
    - `DOCKERHUB_USERNAME`
    - `DOCKERHUB_TOKEN`

TBD:

- The exact behavior of `/opt/allstar-api/deploy.sh` is outside this repository.

## Secrets used (observed)

The workflow references these GitHub Actions secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `TS_OAUTH_CLIENT_ID`
- `TS_OAUTH_SECRET`
- `VM_TAILSCALE_IP`
- `VM_SSH_USER`
- `VM_SSH_PRIVATE_KEY`
- `BW_ACCESS_TOKEN`
