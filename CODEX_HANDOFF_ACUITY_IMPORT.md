# Acuity Import – Post-Change Handoff Checklist

## What Changed
- Added future-only guardrails so appointments with `start_ts` before “now” are skipped deterministically (historic rows no longer inflate counters).
- Counted only persisted writes: the UPSERT now checks `rowcount` / insert success before incrementing.
- Broke out detailed skip metrics (`historical`, `unmatched`, `missing_time`, `write_failures`) and exposed them in the job result.
- Updated the final summary log/event payload so `appointments_imported` reflects persisted rows (~99) instead of attempted (~1980).

## Deploy & Smoke Test
1. **Deploy** the latest build (API + worker) via Render and restart the worker service.
2. Watch startup logs; confirm the new summary line mentions `appointments_attempted`/`appointments_persisted`.

## Limited Import Validation
```
curl -X POST "https://api.brandvx.io/integrations/booking/acuity/import" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -H "page-limit: 25" \
  -d '{"tenant_id":"a8d9029d-dbbb-4b8f-bc33-161e40a1ff54"}'
```
- Wait up to 90 seconds.
- Query the job:
  ```sql
  SELECT status,
         result->>'appointments_persisted' AS persisted,
         result->>'appointments_skipped_total' AS skipped,
         to_timestamp(result->>'finished_at')::timestamptz AS finished_at
  FROM jobs
  WHERE kind = 'bookings.acuity.import'
  ORDER BY created_at DESC
  LIMIT 1;
  ```
- Expect `status = 'done'`, `persisted ≈ 99`, `skipped ≈ 1900`.

## Database Spot Check
```sql
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE start_ts >= extract(epoch FROM now())) AS future_only,
       to_timestamp(MAX(created_at)) AS last_created
FROM appointments
WHERE tenant_id = 'a8d9029d-dbbb-4b8f-bc33-161e40a1ff54';
```
- Total should remain ~99 (all future).

## Revenue Check
```sql
SELECT COUNT(*) FILTER (WHERE lifetime_cents > 0)    AS contacts_with_revenue,
       SUM(lifetime_cents)::bigint / 100             AS total_revenue_usd
FROM contacts
WHERE tenant_id = 'a8d9029d-dbbb-4b8f-bc33-161e40a1ff54';
```
- Expect ~87 contacts, ~$1.46k (current orders coverage).

## Full Import Run
- Repeat the curl without `page-limit`.
- Re-run the SQL checks and ensure the job record shows the same persisted/skipped split.

## UI Verification
- Log in as the tenant and confirm future appointments display through May 2026.
- Revenue widgets should match the SQL totals.

## If Something Fails
- If the job status reverts to `running`, capture worker logs around the `import_summary`.
- If persisted ≠ database totals, inspect the `appointments_skipped_*` values to identify the category.
- Any unexpected exceptions will print as `appointment_write_error` with tenant/external_ref for rapid triage.
