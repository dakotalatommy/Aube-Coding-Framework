# Acuity Payment Gap - Diagnostic Report
**Date**: October 22, 2025  
**Tenant**: Jennifer Atkins (`a8d9029d-dbbb-4b8f-bc33-161e40a1ff54`)

## Executive Summary
BrandVX is missing ~90% of October 2025 revenue ($338 vs $11,059 expected). Root cause: **Backfill only captured 68 out of 230 October appointments**, missing 162 appointments and their associated payments.

## Expected vs Actual

### Acuity Report (October 2025)
- **133 transactions**: $11,059.75
  - Stripe: 46 txns ($2,906.75)
  - Cash: 86 txns ($8,017.00) ← Major gap
  - PayPal: 1 txn ($136.00)
- Unpaid/Deposits: 73 appts ($6,584.00)

### BrandVX Database (October 2025)
- **9 transactions**: $338
- **68 appointments** out of 230 (30% capture rate)
- Missing: 162 appointments, ~120 payment records

## Key Findings

### 1. API Endpoints Work Correctly
✅ `/appointments/{id}/payments` returns both online AND cash payments
✅ Payment structure confirmed:
```json
{
  "transactionID": "" // empty for cash payments
  "processor": "cash" | "stripe" | "paypal"
  "amount": "100.00"
  "created": "2025-10-21T19:56:47-0500"
}
```

### 2. Sample Verified Payments
| Appointment ID | Date | Processor | Amount | In DB? | Transaction Created? |
|---|---|---|---|---|---|
| 1547916860 | Oct 21 | Cash + Stripe | $120 | ✅ Yes | ❌ No |
| 1549284919 | Oct 21 | Cash | $50 | ❌ No | ❌ No |
| 1549284684 | Oct 21 | Stripe | $60 | ❌ No | ❌ No |
| 1502121213 | Oct 21 | Stripe | $24 | ❌ No | ❌ No |

### 3. Appointment Import Gap
- **Acuity API returns**: 230 October appointments (`minDate=2025-10-01&max=2000`)
- **Database contains**: 68 October appointments
- **Missing**: 162 appointments (70%)
- **Paid appointments available**: 106 marked as `paid: "yes"`
- **Captured transactions**: Only 9

### 4. Backfill Job Results (Job ID: 8ef7c9e6-1089-4747-afbc-326de9c9f3a8)
```json
{
  "appointments_attempted": 1980,
  "appointments_persisted": 1980,
  "appointments_skipped_unmatched": 20,
  "appointment_payments_checked": 1980,
  "appointment_transactions_created": 13,
  "orders_processed": 2,
  "order_transactions_created": 0
}
```

**Analysis**: Backfill processed 1,980 appointments total (ALL months), but only 13 had payment transactions created. For October specifically, captured only 68/230 appointments.

## Root Causes

### Primary Issue: Incomplete Appointment Import
The backfill imported appointments from **all** months starting October 1, 2025, but:
1. Only 68 October appointments were saved (vs 230 available)
2. Contact matching failures: 20 appointments skipped
3. Possible pagination issues or early termination

### Secondary Issue: Payment Collection Inefficiency
Even for imported appointments:
- Appointment 1547916860 exists in DB but has ZERO transactions despite $120 in payments
- Out of 1,980 appointments checked, only 13 had transactions created (0.6% success rate)

### Code Issues Identified

#### 1. Payment Method Field Mismatch
**Location**: `booking_acuity.py:299`
```python
payment_method = payment.get("paymentType") or payment.get("paymentMethod") or "appointment"
```
**Issue**: Acuity uses `processor` field, not `paymentType`. Cash payments default to `"appointment"` instead of `"cash"`.

**Fix**: Use `processor` field:
```python
payment_method = payment.get("processor") or payment.get("paymentType") or payment.get("paymentMethod") or "appointment"
```

#### 2. Job Hanging
Both backfill jobs stuck in "running" state after transaction creation, before contact rollup completion.

## Verified Working Components

✅ Acuity API authentication  
✅ `/appointments/{id}/payments` endpoint returns cash payments  
✅ Empty `transactionID` handling (fallback to generated ID)  
✅ Payment date extraction  
✅ Database transaction insertion (idempotent via `ON CONFLICT`)

## Action Items

### Immediate (Required to capture October revenue)
1. **Fix pagination/import logic** to capture all 230 October appointments
2. **Re-run backfill** for October 2025 with fixed logic
3. **Fix payment method** field to use `processor` instead of `paymentType`

### Investigation Needed
1. Why did backfill only capture 68/230 October appointments?
   - Check contact matching logic (20 skipped, but 162 missing)
   - Verify pagination loop termination conditions
   - Check if there's a date/time filtering issue

2. Why did 1,980 appointments only yield 13 transactions?
   - Are payments only returned for completed appointments?
   - Is there a timing delay between appointment completion and payment API availability?

3. Job hanging issue
   - Contact rollup loop performance with large datasets
   - Possible infinite loop or database deadlock

### Testing Recommendations
1. Test with specific date range: `since=2025-10-01&until=2025-10-31`
2. Add logging to track which appointments are being skipped and why
3. Test payment collection for appointments with known payments
4. Verify contact matching for appointments like 1549284919 that should match

## Next Steps
1. Review appointment import loop logic for early termination
2. Add comprehensive logging for skip reasons
3. Test backfill with `maxDate` parameter to limit scope
4. Consider daily/weekly incremental syncs vs full backfills
5. Address job hanging issue before production deployment

## Questions for User
1. Should we prioritize fixing the import to get all 230 October appointments?
2. Is there a specific reason 162 appointments weren't imported (contact matching requirements)?
3. Should payments be attributed to appointment date or payment date?

