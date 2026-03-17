#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ -z "${BW_ACCESS_TOKEN:-}" ]]; then
  echo "BW_ACCESS_TOKEN is not set. Export BW_ACCESS_TOKEN in your shell and run again."
  exit 1
fi

IMAGE_NAME="allstar-api:latest"
CONTAINER_NAME="allstar-api-prod-local"

docker build -t "$IMAGE_NAME" -f Dockerfile .

if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  docker rm -f "$CONTAINER_NAME"
fi

docker run -d \
  --name "$CONTAINER_NAME" \
  -p 80:8000 \
  -e BW_ACCESS_TOKEN="$BW_ACCESS_TOKEN" \
  "$IMAGE_NAME"

echo "Production-style local container started: http://localhost/api/v1/public"
