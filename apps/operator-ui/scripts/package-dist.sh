#!/usr/bin/env bash
set -euo pipefail

# Build and package the operator UI for manual upload (e.g., Cloudflare Pages direct upload)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Building operator UI…"
npm run build

echo "Zipping dist → operator-ui-dist.zip"
cd dist
zip -r ../operator-ui-dist.zip . >/dev/null
cd ..

echo "Done: $(pwd)/operator-ui-dist.zip"
echo "Upload this ZIP in the Cloudflare Pages UI (Direct Upload) or unzip and drag the dist folder."

