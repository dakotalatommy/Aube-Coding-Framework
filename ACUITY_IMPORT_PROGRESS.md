# Acuity Import Instrumentation & Next Steps

## Added Diagnostics
- `acuity_import_started` (src/backend/app/integrations/booking_acuity.py): Emits tenant, date bounds, cursor, and options as soon as a job begins.
- `acuity_clients_page` & `acuity_contacts_progress`: Log every page of `/clients` API results (with fetch latency) and every 50 contacts written.
- `acuity_appointments_page` & `acuity_appointments_progress`: Log every page of `/appointments` results (with fetch latency) and every 25 appointments persisted.
- `acuity_import_summary`: One-line rollup when the import finishes (or exits early) with counts for contacts, appointments, and skips.

All logs use `logger.info` so they surface in Render’s default output.

## How To Use The Logs
1. Trigger `/integrations/booking/acuity/import` (set `page-limit` header to a conservative value such as `10` or `25` for debugging).
2. Tail the worker logs; you should immediately see `acuity_import_started`, followed by `acuity_clients_page` entries.
3. Confirm progress logs continue to advance—if they stop, the last message pinpoints the stalled phase (clients vs. appointments vs. payments).
4. The run should conclude with `acuity_import_summary`. If that line never appears, the worker is still stuck inside the loop indicated by the last progress message.

## Recommended Next Steps
1. Re-run the import for tenant `a8d9029d-dbbb-4b8f-bc33-161e40a1ff54` with `page-limit: 25`, monitor the new logs, and capture the final `acuity_import_summary`.
2. If the logs stall on a specific page, note the `offset` and retry the import with `cursor`/date filters to isolate the problematic slice.
3. Should HTTP latency spike (large `elapsed_ms` values), consider raising the Acuity client timeout or adding retries around the slow endpoint.
4. Once the small-run completes, progressively raise the `page-limit` until performance degrades; use that threshold to plan batch sizes or chained jobs.
5. After a successful full import, verify appointments in the database and ensure `AcuityImportCompleted` events fire as expected.

Provide the captured log excerpts and results to Claude so the next session can zero in on any remaining bottlenecks.
