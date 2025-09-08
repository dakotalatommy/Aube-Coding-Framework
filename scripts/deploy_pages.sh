#!/usr/bin/env bash
set -euo pipefail

# Deploy the built Operator UI to Cloudflare Pages.
# Requires: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID env vars,
# and an existing Pages project (or wrangler will prompt/create interactively).

PROJECT_NAME=${CF_PAGES_PROJECT:-brandvx-operator-ui}
BRANCH=${CF_PAGES_BRANCH:-main}

cd "$(dirname "$0")/.."/apps/operator-ui

if [ ! -d dist ]; then
  echo "Building UI..."
  npm ci
  npm run build
fi

echo "Deploying to Cloudflare Pages project: $PROJECT_NAME (branch: $BRANCH)"
exec npx --yes wrangler pages deploy dist --project-name="$PROJECT_NAME" --branch="$BRANCH" --commit-dirty=true

