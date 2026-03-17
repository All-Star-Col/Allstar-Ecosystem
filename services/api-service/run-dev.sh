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

docker compose up --build "$@"
