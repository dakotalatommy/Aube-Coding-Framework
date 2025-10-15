# Acuity Import – Next Actions for Claude

## Summary of Local Changes
- `src/backend/app/integrations/booking_acuity.py`
  - Store both UUID and canonical `contact_id` when building lookup tables so we can reference the original `acuity:…` identifiers.
  - When an appointment matches a contact by email or phone, reuse the stored `contact_id` rather than synthesising a lower-cased value; this ensures revenue rollups update the correct row.
  - Emit a sample `contact_map` log (email → uuid → contact_id) to confirm the connection is using the latest build.

## What Needs To Happen Next
1. **Deploy the updated backend** so the worker picks up the new matching logic.
2. **Kick off a targeted import** to verify behaviour with the new instrumentation.
3. **Validate appointments and revenue in Supabase**.
4. **Roll the import across the full dataset** once the small batch succeeds.

## Step-by-Step Execution Plan

### 1. Deploy + Restart Worker
1. Trigger a fresh deployment on Render (API + worker).
2. After deploy, confirm the worker logs show the new message:
   ```
   [acuity] contact_map_sample: email=…, uuid=…, contact_id=…
   ```
   If you do not see this line, the new build is not running.

### 2. Run a Limited Import (Page Limit 25)
```bash
curl -X POST "https://api.brandvx.io/integrations/booking/acuity/import" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -H "page-limit: 25" \
  -d '{"tenant_id":"a8d9029d-dbbb-4b8f-bc33-161e40a1ff54"}'
```
Watch the worker logs and capture:
- `contact_maps_built…`
- `contact_map_sample…`
- `appointments_page…`
- `match_stats…`
- `appointments_batch_committed…`

### 3. Verify Database State (Supabase)
Run the following SQL after the job finishes:
```sql
-- Appointment totals and horizon
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE start_ts >= extract(epoch FROM now())) AS future_count,
       to_timestamp(min(start_ts)) AS first_start,
       to_timestamp(max(start_ts)) AS last_start
FROM appointments
WHERE tenant_id = 'a8d9029d-dbbb-4b8f-bc33-161e40a1ff54';

-- Revenue coverage
SELECT COUNT(*) FILTER (WHERE lifetime_cents > 0) AS contacts_with_revenue,
       SUM(lifetime_cents)::bigint / 100 AS total_revenue_usd
FROM contacts
WHERE tenant_id = 'a8d9029d-dbbb-4b8f-bc33-161e40a1ff54';
```

### 4. Full Import Run
Once the limited run succeeds, trigger the full import (no `page-limit` header). Monitor the same log lines and rerun the SQL checks above to confirm:
- Future appointments are present.
- Revenue fields populate for ~480+ contacts.

### 5. UI Smoke Test
Log into the operator UI for tenant `a8d9029d-dbbb-4b8f-bc33-161e40a1ff54` and confirm future appointments and revenue metrics appear in the dashboard.

## If Issues Persist
- **Missing logs** → redeploy and ensure the worker process restarted.
- **`match_stats` shows all `no_match`** → copy the `no_match_example` payloads and compare the email/phone with the contact rows in Supabase.
- **Revenue still sparse** → double-check the `email_map` being passed to `_collect_orders_payments`; confirm the contacts table actually contains email addresses for the affected records.

Once the above steps are complete (or if new blockers appear), hand the findings back so we can iterate further.
