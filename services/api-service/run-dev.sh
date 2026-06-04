#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f "keys.dev.env" ]]; then
  echo "Missing keys.dev.env. Restore it from the repository and run again."
  exit 1
fi

if [[ -z "${BW_ACCESS_TOKEN:-}" ]]; then
  echo "BW_ACCESS_TOKEN is not set in the current environment. Export it (or set it in /etc/environment) and run again."
  exit 1
fi

if docker container inspect allstar-api-dev >/dev/null 2>&1; then
  echo "Recreating existing allstar-api-dev container."
  docker rm -f allstar-api-dev >/dev/null
fi

PORT_80_CONTAINER="$(docker ps --filter publish=80 --format '{{.Names}}' | head -n 1 || true)"

if [[ -n "${PORT_80_CONTAINER}" ]]; then
  echo "Port 80 is already used by Docker container: ${PORT_80_CONTAINER}"
  echo "Stop that container first. Docker cannot publish two containers on the same host port."
  exit 1
fi

echo "Starting API on http://localhost"
docker compose up --build "$@"
