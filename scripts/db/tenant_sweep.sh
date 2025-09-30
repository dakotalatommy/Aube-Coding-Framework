#!/usr/bin/env bash
# Orchestrates the tenant database sweep runbook.
# Usage:
#   ./scripts/db/tenant_sweep.sh postgres://postgres:<service_role_key>@db.dwfvnqajrwruprqbjxph.supabase.co:6543/postgres
# or export SUPABASE_DB_URL and run without arguments.

set -Eeuo pipefail

CONN_STRING="${1:-${SUPABASE_DB_URL:-}}"
OUTPUT_DIR="${SWEEP_OUTPUT_DIR:-tmp/tenant-db-sweep-$(date +%Y%m%d%H%M%S)}"

if [[ -z "${CONN_STRING}" ]]; then
  echo "ERROR: Provide a connection string as the first argument or via SUPABASE_DB_URL." >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

run_psql() {
  local label="$1"; shift
  local sql_file="$1"; shift
  local outfile="${OUTPUT_DIR}/${label}.log"
  echo "[INFO] Running ${label} using ${sql_file}" >&2
  PGPASSWORD="${PGPASSWORD:-}" psql "${CONN_STRING}" -f "${sql_file}" \ > "${outfile}"
  echo "[INFO] Output stored in ${outfile}" >&2
}

# Step 1: Inventory (safe, read-only)
run_psql "01_inventory" "scripts/db/sql/01_inventory.sql"

# Step 2: Harden functions + rewrite RLS (idempotent DDL)
run_psql "02_harden_functions_and_rls" "scripts/db/sql/02_harden_functions_and_rls.sql"

# Step 3: Optional duplicate policy merge (comment out if not desired)
if [[ "${RUN_POLICY_MERGE:-1}" == "1" ]]; then
  run_psql "03_merge_duplicate_policies" "scripts/db/sql/03_merge_duplicate_policies.sql"
else
  echo "[INFO] Skipping duplicate policy merge (RUN_POLICY_MERGE=${RUN_POLICY_MERGE:-0})" >&2
fi

# Step 4: Index cleanup and FK coverage (review beforehand)
if [[ "${RUN_INDEX_CLEANUP:-0}" == "1" ]]; then
  run_psql "04_index_cleanup_and_fk" "scripts/db/sql/04_index_cleanup_and_fk.sql"
else
  echo "[INFO] Index cleanup disabled (set RUN_INDEX_CLEANUP=1 to enable)." >&2
fi

cat <<SUMMARY >&2
[INFO] Run complete.
Artifacts stored in: ${OUTPUT_DIR}
Remember to:
  - Review inventory output for straggler tables before dropping anything.
  - Re-run Supabase Performance Advisor and capture screenshots.
  - Update docs/ui-v2-tenant-cleanup-plan.md with decisions and timestamp conversions.
SUMMARY
