#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${1:-8000}"
UI_PATH="/draft-sage-training-ui/index.html"

echo "Serving from: ${ROOT_DIR}"
echo "Open: http://localhost:${PORT}${UI_PATH}"

exec python3 -m http.server "${PORT}" --directory "${ROOT_DIR}"
