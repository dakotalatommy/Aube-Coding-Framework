#!/usr/bin/env bash
set -euo pipefail

# Cloudflare Pages deploy for BrandVX operator UI (Wrangler v3)
# Project: brandvx-operator-ui (production domain: app.brandvx.io)
# Frontend path: apps/operator-ui
# Build output: apps/operator-ui/dist
# Production branch: main
#
# Usage:
#   export CLOUDFLARE_ACCOUNT_ID=dc8bc87edd25d41ca71fd55b208b4105
#   export CLOUDFLARE_API_TOKEN=YOUR_TOKEN
#   ./scripts/deploy-frontend.sh [branch]
#
# Notes:
# - Requires Node 18+, npm, and internet access.
# - Does not persist or print secrets. Token must come from env.
# - If jq is installed, deployment metadata will be summarized.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
FRONTEND_DIR="${ROOT_DIR}/apps/operator-ui"
DIST_DIR="${FRONTEND_DIR}/dist"
PROJECT_NAME="brandvx-operator-ui"
BRANCH="${1:-main}"

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "CLOUDFLARE_ACCOUNT_ID is required" >&2
  exit 1
fi
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is required" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required (v18+)" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required" >&2
  exit 1
fi

echo "⏳ Installing dependencies (apps/operator-ui)"
pushd "${FRONTEND_DIR}" >/dev/null
npm ci --no-fund --no-audit || npm install --no-fund --no-audit

echo "🔨 Building frontend"
npm run build --silent
popd >/dev/null

echo "🚀 Deploying to Cloudflare Pages (project=${PROJECT_NAME}, branch=${BRANCH})"
npx --yes wrangler@3 pages deploy "${DIST_DIR}" \
  --project-name "${PROJECT_NAME}" \
  --branch "${BRANCH}" \
  --commit-dirty=true

echo "✅ Deploy command submitted. Fetching latest deployment info..."
DEPLOYMENTS_URL="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments"
AUTH_HEADER=( -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" )

if command -v jq >/dev/null 2>&1; then
  curl -s "${DEPLOYMENTS_URL}" "${AUTH_HEADER[@]}" | jq -r '.result[0] | {id: .id, environment: .environment, source: .source, url: .url, created_on: .created_on}' || true
else
  curl -s "${DEPLOYMENTS_URL}" "${AUTH_HEADER[@]}" | sed -e 's/{/\n{/g' | head -n 5 || true
fi

echo "🌐 HEAD app.brandvx.io"
curl -sI https://app.brandvx.io | sed -n '1,10p' || true

echo "Done."


