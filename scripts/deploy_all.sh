#!/usr/bin/env bash
set -euo pipefail

# One-command deploy: Frontend (Cloudflare Pages) + Backend (Render) + Cache purge
# Requires .env at repo root with:
#   RENDER_API_TOKEN, RENDER_SERVICE_ID
#   CF_API_TOKEN, CF_ACCOUNT_ID, CF_PAGES_PROJECT, CF_ZONE_ID, [CF_BRANCH]
# Optional Vite envs in the Pages project; this script does not set Pages env vars.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  echo "Loading .env ..."
  # shellcheck disable=SC2046
  export $(grep -v '^[#;]' .env | sed 's/\r$//' | xargs -0 -I {} sh -c 'echo {}' 2>/dev/null || true)
fi

required_env=(RENDER_API_TOKEN RENDER_SERVICE_ID CF_API_TOKEN CF_ACCOUNT_ID CF_PAGES_PROJECT CF_ZONE_ID)
missing=()
for k in "${required_env[@]}"; do
  if [[ -z "${!k:-}" ]]; then missing+=("$k"); fi
done
if (( ${#missing[@]} )); then
  echo "Missing required env vars: ${missing[*]}" >&2
  echo "Populate them in .env at repo root before running." >&2
  exit 1
fi

# Build frontend
echo "[1/5] Building operator-ui (Vite) ..."
pushd apps/operator-ui >/dev/null
npm ci --prefer-offline --no-audit --progress=false
npm run build
popd >/dev/null

# Deploy to Cloudflare Pages using Wrangler
echo "[2/5] Deploying frontend to Cloudflare Pages ..."
export CLOUDFLARE_API_TOKEN="${CF_API_TOKEN}"
export CLOUDFLARE_ACCOUNT_ID="${CF_ACCOUNT_ID}"
npx --yes wrangler@3 pages deploy "${ROOT_DIR}/apps/operator-ui/dist" \
  --project-name "${CF_PAGES_PROJECT}" \
  --branch "${CF_BRANCH:-main}" | cat

# Trigger Render backend deploy
echo "[3/5] Triggering Render backend deploy ..."
python3 scripts/trigger_render_deploy.py || true

# Purge Cloudflare cache (zone-wide)
echo "[4/5] Purging Cloudflare cache ..."
curl -sS -X POST \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -d '{"purge_everything":true}' | cat

echo "[5/5] Done. Production URLs:" 
echo "  App: https://app.brandvx.io"
echo "  API: https://api.brandvx.io"


