# Acuity Integration Deep Investigation - Codex Handoff

**Date**: October 22, 2025  
**Investigator**: Primary AI Assistant  
**Next Investigator**: GPT-5 Codex (Complex Problem Specialist)  
**Issue**: Acuity backfill only capturing 6% of expected revenue despite successful API access

---

## CRITICAL CONTEXT

**Note to Codex**: The assistant you're working with (me) has full database and API access. For any queries, API calls, or commands you need run, just specify them clearly and I'll execute them and paste back the results. You focus on analysis and solution design.

---

## Executive Summary

BrandVX is importing Acuity booking data but only capturing **6% of expected transactions**:
- **Expected**: 4,381 transactions, $375,159 (from Acuity screenshots)
- **Actual**: 279 transactions, $21,772 (in database)
- **Gap**: 4,102 transactions, $353,387 missing

Despite:
- ✅ API authentication working
- ✅ Code deployed with date attribution fix
- ✅ Contact rollups fixed (no longer over-counting)
- ✅ Backfill jobs completing "successfully"

---

## Data Verification (As of Oct 22, 2025)

### What Acuity API Actually Has

I queried the live Acuity API directly. Here's what exists:

**2023 Data** (June-December only, NOT January-December):
```
Total: 867 appointments
June: 50 appointments
July: 122 appointments
August: 148 appointments
September: 134 appointments
October: 132 appointments
November: 148 appointments
December: 133 appointments
```

**2024 Data** (Full year):
```
Total: 1,705 appointments
January: 117 | February: 122 | March: 167 | April: 128
May: 174 | June: 122 | July: 133 | August: 157
September: 134 | October: 154 | November: 147 | December: 150
```

**2025 Data** (January-December):
```
Total: 1,533 appointments  
January: 151 | February: 152 | March: 147 | April: 132
May: 165 | June: 137 | July: 107 | August: 165
September: 150 | October: 170 | November: 52 | December: 5
```

**Grand Total Available**: 4,105 appointments across 2023-2025

---

### What's Actually in BrandVX Database

**Appointments Imported**:
```sql
2023: 144 appointments (June: 44, July: 2, Dec: 98)
2024: 189 appointments (Oct: 96, Dec: 93)
2025: 155 appointments (Oct: 95, Nov: 51, Dec: 5)
Total: 488 appointments (12% of available)
```

**Transactions Imported**:
```sql
2023: 153 transactions, $12,534.75
  - June: 43 txns, $4,243
  - July: 2 txns, $130
  - December: 108 txns, $8,162

2024: 109 transactions, $9,135.50
  - September: 9 txns, $326  
  - December: 100 txns, $8,810

2025: 62 transactions, $4,475
  - July: 1 txn, $24
  - August: 3 txns, $233
  - September: 6 txns, $260
  - October: 52 txns, $3,958

Total: 324 transactions, $26,145.25
```

---

## Key Findings from Investigation

### Finding 1: Massive Month Gaps

Despite date range parameters (`since=2023-01-01&until=2023-12-31`), the backfill is NOT importing most months:

**2023 Missing**: August, September, October, November (602 appointments, ~73% of 2023 data)  
**2024 Missing**: Jan-Aug, November (1,401 appointments, ~82% of 2024 data)  
**2025 Missing**: Jan-June (1,009 appointments, ~66% of 2025 data)

### Finding 2: Contact Matching Failures

From June 2023 backfill job result:
- API returned: 50 appointments
- Persisted: 46 appointments
- Skipped (unmatched contacts): 4 appointments
- Success rate: 92%

**BUT** - Contact matching seems to be working reasonably well (92%). The issue is that entire months are not being fetched/processed.

### Finding 3: Payment Method Labeling Issue

Sample from June 2023 backfill job result shows:
```json
{
  "contact_id": "acuity:c1b27c7e78",
  "amount_cents": 7500,
  "payment_method": "appointment",  // ← WRONG! Should be "cash"
  "payment_source": "appointment",
  "transaction_id": ""
}
```

But Acuity API returns:
```json
{
  "transactionID": "",
  "processor": "cash",  // ← Actual payment method
  "amount": "75.00"
}
```

The code is setting `payment_method: "appointment"` when it should be capturing `processor: "cash"`.

### Finding 4: Job Status Confusion

Jobs report as "done" with `status: "done"` but produce incomplete results:
- June 2023 job: Reported "done", imported 45/50 appointments
- No errors logged
- Jobs appear successful but silently skip most data

---

## Code Analysis

**File**: `src/backend/app/integrations/booking_acuity.py`

### Date Range Parameters (Lines 844-848)
```python
params: Dict[str, object] = {"limit": limit, "offset": offset}
if since:
    params["minDate"] = since
if until:
    params["maxDate"] = until
```
✅ Looks correct - passes `minDate` and `maxDate` to Acuity API

### Historical Filtering (Lines 886-889)
```python
if not allow_historical and start_ts < now_ts:
    appointments_skipped_historical += 1
    skipped += 1
    continue
```
✅ Looks correct - `allow_historical=True` is passed, so this shouldn't filter

### Early Exit Condition (Lines 1085-1087)
```python
if not allow_historical and inserts_this_page == 0 and appt_pages > 0:
    print(f"[acuity] appointments_up_to_date: All future appointments exist, stopping import after page {appt_pages}")
    break
```
✅ Looks correct - shouldn't trigger when `allow_historical=True`

### Pagination Logic (Lines 1094-1101)
```python
if len(arr) < limit:
    print(f"[acuity] PAGINATION_END: Last page reached...")
    break
print(f"[acuity] pagination_continue: offset {offset} -> {offset + limit}")
offset += limit
```
✅ Looks correct - standard pagination pattern

### Payment Method Capture (Line 311)
```python
payment_method = payment.get("processor") or payment.get("paymentType") or payment.get("paymentMethod") or "appointment"
```
✅ Code looks correct - checks `processor` first

**BUT** - Payment records show `payment_method: "appointment"` even when API returns `processor: "cash"`. Something is overriding this or the wrong structure is being used.

---

## Hypothesis: Root Cause Theories

### Theory 1: Acuity API Pagination Issues
The Acuity API might be returning appointments in non-chronological order or with gaps when using date range filters. The pagination might end prematurely even though more data exists.

**Evidence**:
- June 2023: All 50 appointments returned ✅
- July 2023: Only 2 out of 122 appointments imported ❌
- Pattern suggests pagination breaks after first page for some months

### Theory 2: Contact Lookup Performance
The code pre-loads all contacts into memory maps (lines 790-830). For 654 contacts, this should be fast, but if there's a database timeout or connection issue during long-running jobs, subsequent appointment lookups might fail silently.

### Theory 3: Job Worker Timeout/Hanging
From handoff docs, jobs were hanging during contact rollup phase. Even though batching was added (lines 1166-1212), jobs might still be timing out and partially completing before being marked "done".

**Evidence**:
- Earlier jobs hung indefinitely
- Current jobs complete but with missing data
- No clear error logging

### Theory 4: Acuity API Rate Limiting
Acuity might be rate-limiting requests, causing some appointment fetches to fail silently. The code doesn't have retry logic or rate limit handling.

### Theory 5: Payment Collection Timing
The code collects payments immediately after importing appointments (lines 1040-1076). If the appointment import phase completes but payment collection fails/hangs, transactions won't be created even though appointments exist.

**Evidence**:
- 488 appointments imported
- Only 324 transactions created
- 67% conversion rate (should be higher for past appointments)

---

## Acuity API Behavior Observations

### Confirmed Working
- Bearer token authentication ✅
- `/appointments` endpoint with `minDate`/`maxDate` ✅
- `/appointments/{id}/payments` endpoint ✅
- Returns cash payments with `processor: "cash"` ✅

### Possible Issues
- Pagination might not respect date ranges properly
- Might have undocumented limits (max 1000 appointments per request?)
- Could have rate limiting not documented in API docs

---

## Questions for Codex to Investigate

1. **Why are entire months being skipped?**
   - Is there a bug in the pagination logic that causes early termination?
   - Does Acuity API require different parameters for historical data?
   - Is there a limit on how far back date ranges can go?

2. **Why do jobs report "done" when only partial data is imported?**
   - Should the code validate expected vs actual counts?
   - Is there a timeout happening that's not being caught?
   - Should we add checkpoints/progress tracking?

3. **What's the best approach to import the missing ~4,000 appointments?**
   - Month-by-month chunking?
   - Offset-based pagination without date filters?
   - Parallel jobs for different date ranges?

4. **How can we make imports idempotent and resumable?**
   - Track which months have been successfully imported
   - Add verification step after each job
   - Implement retry logic for failed months

5. **Should we query Acuity API differently?**
   - Use `offset` pagination instead of date ranges?
   - Fetch all appointments then filter by date locally?
   - Use a different API endpoint?

---

## Constraints

1. **Cannot change database schema** - Work within existing `transactions`, `appointments`, `contacts` tables
2. **Must preserve idempotency** - `ON CONFLICT DO NOTHING` on transactions must stay
3. **Must handle contact rollups correctly** - No more over-counting
4. **Jobs must complete in <15 minutes** - Render timeout limit
5. **Must work with current Acuity API** - No undocumented endpoints

---

## Success Criteria

After your investigation and proposed fixes:
- ✅ 2023 revenue: ~$81K (currently $12K)
- ✅ 2024 revenue: ~$161K (currently $9K)
- ✅ 2025 revenue: ~$133K (currently $4K)
- ✅ All months imported, not just scattered ones
- ✅ Payment methods correctly labeled (cash, stripe, paypal)
- ✅ Jobs complete reliably without hanging
- ✅ Clear progress/error reporting

---

## Files You'll Need Context On

**Backend Integration**: `src/backend/app/integrations/booking_acuity.py`
- `import_appointments()` function (lines 680-1340)
- `_collect_appointment_payments()` function (lines 224-366)
- `_collect_orders_payments()` function (lines 368-580)

**Worker**: `src/backend/app/workers/followups.py`
- `_process_acuity_backfill_job()` function (lines 1012-1066)

**API Endpoint**: `src/backend/app/main.py`
- `/admin/acuity/backfill-transactions` (lines 14127-14159)

---

## Your Mission, Codex

1. **Analyze the code** and identify why entire months are being skipped
2. **Determine if Acuity API has undocumented behavior** we're missing
3. **Propose a fix** that will reliably import all historical data
4. **Design a verification strategy** to ensure completeness
5. **Suggest improvements** for error handling and progress tracking

I'll be your executor - you provide the analysis and commands, I'll run them and report back.

---

## How to Get Started

**First, read these files from the repository:**

1. `ACUITY_INTEGRATION_HANDOFF.md` - Original handoff document with full context
2. `ACUITY_PAYMENT_GAP_DIAGNOSIS.md` - Initial diagnostic findings
3. `ACUITY_FIX_STATUS.md` - Results after initial fixes
4. `CODEX_HANDOFF_ACUITY_INVESTIGATION.md` - This document (my investigation findings)
5. `src/backend/app/integrations/booking_acuity.py` - Main integration code
6. `src/backend/app/workers/followups.py` - Background job processor (see `_process_acuity_backfill_job`)

After reading these files, tell me:

1. What additional data/queries do you need me to run to diagnose the root cause?
2. What's your primary hypothesis for why entire months are being skipped?
3. What specific code changes or investigation steps would you like to try first?

Remember: You provide the SQL queries, curl commands, code analysis, or fix proposals - I'll execute them and report back results. You don't have direct access to run commands or query databases.

