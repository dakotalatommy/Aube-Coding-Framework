#!/usr/bin/env bash

# Simple smoke test for tenant-scoped reads/writes.
# Usage:
#   TENANT_ID=b9246d80-c17c-4f70-9204-89dda4127352 ./scripts/smoke_tenant.sh
# Optional env:
#   BASE_URL (default http://localhost:8000)
#   DEV_HEADERS=1 to send X-* dev headers (requires backend DEV_AUTH_ALLOW=1)
#   AUTH="Bearer <JWT>" to use a real token instead of dev headers

set -u

BASE_URL="${BASE_URL:-http://localhost:8000}"
TENANT_ID="${TENANT_ID:-}"
AUTH="${AUTH:-}"
DEV_HEADERS="${DEV_HEADERS:-1}"

if [[ -z "$TENANT_ID" ]]; then
  echo "TENANT_ID is required. Export TENANT_ID and rerun." >&2
  exit 1
fi

hdrs=("-sS")
if [[ -n "$AUTH" ]]; then
  hdrs+=("-H" "Authorization: $AUTH")
elif [[ "${DEV_HEADERS}" == "1" ]]; then
  hdrs+=("-H" "X-User-Id: dev-user" "-H" "X-Role: owner_admin" "-H" "X-Tenant-Id: ${TENANT_ID}")
fi

echo "== BrandVX Smoke for ${TENANT_ID} (BASE_URL=${BASE_URL}) =="

step() { echo -e "\n-- $*"; }
req() {
  method="$1"; path="$2"; body="${3:-}"
  if [[ -n "$body" ]]; then
    echo "curl ${method} ${path}"
    curl "${hdrs[@]}" -H 'Content-Type: application/json' -X "$method" \
      "$BASE_URL$path" --data "$body" || true
  else
    echo "curl GET ${path}"
    curl "${hdrs[@]}" "$BASE_URL$path" || true
  fi
  echo
}

step "Health"
req GET "/ops/health"

step "Progress Status"
req GET "/onboarding/progress/status?tenant_id=${TENANT_ID}"

step "Plan Generate"
req POST "/plan/14day/generate" "{\"tenant_id\": \"${TENANT_ID}\"}"
req GET "/plan/14day/status?tenant_id=${TENANT_ID}"

step "Vision Library"
data_url="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
req POST "/client-images/save" "{\"tenant_id\":\"${TENANT_ID}\",\"contact_id\":\"library\",\"url\":\"${data_url}\"}"
req GET "/client-images/list?tenant_id=${TENANT_ID}&contact_id=library"

step "AskVX Sessions"
req POST "/ai/chat/session/new" "{\"tenant_id\":\"${TENANT_ID}\"}"

step "Messages + To-Do"
req GET "/messages/list?tenant_id=${TENANT_ID}&filter=all"
req POST "/todo/add" "{\"tenant_id\":\"${TENANT_ID}\",\"type\":\"approval\",\"title\":\"Smoke test item\"}"
req GET "/todo/list?tenant_id=${TENANT_ID}&status=pending"

step "Calendar"
req POST "/calendar/sync" "{\"tenant_id\":\"${TENANT_ID}\",\"provider\":\"auto\"}"
req GET "/calendar/list?tenant_id=${TENANT_ID}"

step "Follow-ups"
req GET "/followups/candidates?tenant_id=${TENANT_ID}&scope=reengage_30d"

step "Settings"
req POST "/settings" "{\"tenant_id\":\"${TENANT_ID}\",\"quiet_hours\":{\"start\":\"21:00\",\"end\":\"08:00\"}}"
req POST "/settings" "{\"tenant_id\":\"${TENANT_ID}\",\"training_notes\":\"Demo note from smoke\"}"
req GET "/onboarding/progress/status?tenant_id=${TENANT_ID}"

echo -e "\n== Done =="

