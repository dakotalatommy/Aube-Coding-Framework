#!/usr/bin/env bash
set -euo pipefail

# Commit current changes (if any), push to main, then deploy to Cloudflare Pages.
# This uses scripts/deploy-frontend.sh under the hood.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
BRANCH="${1:-main}"

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "CLOUDFLARE_ACCOUNT_ID is required" >&2
  exit 1
fi
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is required" >&2
  exit 1
fi

pushd "${ROOT_DIR}" >/dev/null

echo "🔍 Checking repo status"
git add -A
if ! git diff --cached --quiet; then
  COMMIT_MSG=${COMMIT_MSG:-"chore: push and deploy frontend"}
  echo "📝 Committing staged changes: ${COMMIT_MSG}"
  git commit -m "${COMMIT_MSG}"
else
  echo "ℹ️ No changes to commit."
fi

echo "📤 Pushing to ${BRANCH}"
git push origin "${BRANCH}"

echo "🚀 Deploying via scripts/deploy-frontend.sh"
"${ROOT_DIR}/scripts/deploy-frontend.sh" "${BRANCH}"

popd >/dev/null

echo "✅ Push and deploy completed."


