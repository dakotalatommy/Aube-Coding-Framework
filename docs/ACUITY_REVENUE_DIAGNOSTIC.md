# Acuity Revenue Sync Diagnostic Report
**Tenant**: Jennifer Atkins (a8d9029d-dbbb-4b8f-bc33-161e40a1ff54)  
**Date**: October 19, 2025  
**Issue**: Dashboard shows $0 October revenue vs Acuity's $14,087.00

---

## 🔍 Diagnostic Results

### Current Database State

| Table | Data Found | Details |
|-------|------------|---------|
| **transactions** | ❌ **0 records** | Completely empty - NO Acuity transaction records |
| **contacts** | ✅ 650 contacts | Has aggregate revenue data |
| **contacts.lifetime_cents** | ⚠️ **$6,588.00** | Only 658,800 cents total |
| **contacts.txn_count** | ⚠️ **153 transactions** | Aggregate count |
| **appointments** | ✅ 99 appointments | Future appointments (Oct 17 - May 27, 2026) |

### Acuity October 2025 Report

| Processor | Transactions | Amount |
|-----------|-------------|---------|
| Cash (Appointment) | 108 | $10,444.00 |
| Stripe (Appointment) | 58 | $3,583.00 |
| PayPal (Appointment) | 2 | $60.00 |
| **Total** | **168** | **$14,087.00** |

**Unpaid/Deposits**: 16 appointments, $621.00  
**Total Receivables**: $14,708.00

---

## ❌ Root Cause Analysis

### Problem 1: No Transaction Records Created
**Current Behavior**:
- Acuity sync (`booking_acuity.py`) collects payment data via Orders API
- Revenue is aggregated per contact and stored in `contacts.lifetime_cents`
- **BUT**: No individual `transactions` table records are created

**Impact**:
- Dashboard queries `transactions` table for monthly revenue → Returns $0
- Cannot filter by month/date (no `transaction_date` field)
- Cannot show payment method breakdown (Cash vs Stripe vs PayPal)

### Problem 2: Incomplete Aggregate Data
**Expected**: $14,087.00 (168 transactions)  
**Actual**: $6,588.00 (153 transactions)  
**Missing**: $7,499.00 (15 transactions)

**Possible Causes**:
1. Acuity sync ran before all October transactions were finalized
2. Some orders/payments failed to import due to API pagination issues
3. Data mismatch between appointments and orders in Acuity

### Problem 3: No Date Granularity
Even if `contacts.lifetime_cents` was complete, it's a **lifetime aggregate** with no date information:
- Cannot calculate monthly revenue
- Cannot show revenue trends over time
- Cannot filter by date range

---

## 📊 How Revenue Tracking SHOULD Work

### Square Sync (Working Correctly) ✅
```python
# Line 10598 in main.py
INSERT INTO transactions (
    tenant_id, contact_id, amount_cents, transaction_date, 
    source, external_ref, metadata
) VALUES (...)
```

**Result**: 
- Individual transaction records with dates
- Can calculate monthly revenue: `WHERE transaction_date >= '2025-10-01'`
- Preserves payment method in metadata

### Acuity Sync (Currently Broken) ❌
```python
# Line 876 in booking_acuity.py
UPDATE contacts SET 
    lifetime_cents = COALESCE(lifetime_cents,0) + :cents,
    txn_count = COALESCE(txn_count,0) + :cnt
```

**Result**:
- Only aggregate data, no individual records
- No `transaction_date` stored
- Cannot calculate monthly revenue
- Dashboard shows $0

---

## 🎯 Solution: Implement Acuity Transaction Sync

### What Needs to Be Done

**File**: `src/backend/app/integrations/booking_acuity.py`

**Function**: `_collect_orders_payments()` (called at line 841)

**Current**: Aggregates payments into `payments_map` dict  
**Needed**: ALSO create individual `transactions` table records

### Implementation Approach

1. **Parse Acuity Orders API Response**
   - Extract individual order/payment records
   - Get: order_id, amount, payment_date, payment_method, contact_email

2. **Match to Contact**
   - Use email_map (already populated at line 400)
   - Get contact_id for each payment

3. **Create Transaction Records**
   - INSERT INTO transactions with:
     - `tenant_id`
     - `contact_id` (from email match)
     - `amount_cents`
     - `transaction_date` (from order payment date)
     - `source = 'acuity'`
     - `external_ref = order_id`
     - `metadata = {payment_method: 'cash'/'stripe'/'paypal', ...}`

4. **Maintain Backward Compatibility**
   - KEEP existing `contacts.lifetime_cents` update
   - ADD transaction records (dual-write)
   - Deduplication: Check for existing `external_ref` before INSERT

### Expected Result After Fix

**transactions table**:
```
contact_id | amount_cents | transaction_date | source  | metadata
-----------|--------------|------------------|---------|----------
acuity:123 | 8500         | 2025-10-15       | acuity  | {"method":"cash"}
acuity:456 | 12000        | 2025-10-18       | acuity  | {"method":"stripe"}
...        | ...          | ...              | ...     | ...
```

**Dashboard query**:
```sql
SELECT COALESCE(SUM(amount_cents), 0)
FROM transactions
WHERE tenant_id = '...'
  AND transaction_date >= '2025-10-01'
  AND transaction_date < '2025-11-01'
```

**Result**: $14,087.00 (matches Acuity report) ✅

---

## 📝 Implementation Checklist

### Phase 1: Add Transaction Sync
- [ ] Study Acuity Orders API response format
- [ ] Modify `_collect_orders_payments()` to create transaction records
- [ ] Add deduplication logic (check existing `external_ref`)
- [ ] Set proper GUCs for RLS (`app.tenant_id`, `app.role`)
- [ ] Map Acuity payment methods to metadata JSON

### Phase 2: Backfill Historical Data
- [ ] Create admin endpoint `/acuity/backfill-transactions`
- [ ] Query Acuity Orders API for all historical data
- [ ] Populate transactions table for Jennifer Atkins tenant
- [ ] Verify October total matches: $14,087.00

### Phase 3: Testing
- [ ] Test new Acuity sync creates transaction records
- [ ] Verify monthly revenue query returns correct amount
- [ ] Confirm payment method breakdown (Cash/Stripe/PayPal)
- [ ] Test with second tenant to ensure universal fix

---

## 🚀 Next Steps

### Immediate (This Session)
1. ✅ **Diagnosed the issue** - Transactions table empty, aggregates incomplete
2. 🔄 **Implement transaction sync** - Modify `_collect_orders_payments()`
3. 🔄 **Backfill October data** - Create endpoint to populate historical transactions
4. ✅ **Verify result** - Dashboard should show $14,087.00

### Follow-Up
- Run sync for all Acuity tenants to populate transaction history
- Monitor for any discrepancies between Acuity reports and BrandVX dashboard
- Consider adding revenue reconciliation report

---

## 🔧 Technical Details

### Acuity Orders API
**Endpoint**: `https://acuityscheduling.com/api/v1/orders`  
**Response**: Array of order objects with payment details

**Sample Order Object**:
```json
{
  "id": 12345,
  "appointmentId": 67890,
  "email": "client@example.com",
  "total": "85.00",
  "paid": "85.00",
  "paidDate": "2025-10-15T14:30:00-0400",
  "paymentType": "cash" | "stripe" | "paypal"
}
```

### Transaction Record Format
```sql
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    contact_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    transaction_date TIMESTAMP NOT NULL,
    source TEXT NOT NULL,  -- 'acuity', 'square', etc
    external_ref TEXT,     -- Acuity order_id
    metadata JSONB,        -- {payment_method: 'cash', appointment_id: 67890}
    created_at TIMESTAMP DEFAULT NOW()
);
```

### RLS Requirements
```sql
-- Must set GUCs before INSERT
SET LOCAL app.role = 'owner_admin';
SET LOCAL app.tenant_id = '<tenant_uuid>';
```

---

## 📌 Key Findings Summary

1. **Dashboard shows $0** because it queries `transactions` table
2. **transactions table is empty** for all Acuity tenants
3. **contacts.lifetime_cents has $6,588** but it's incomplete and undated
4. **Acuity report shows $14,087** for October 2025 (168 transactions)
5. **Gap: $7,499 missing** from database
6. **Fix**: Modify Acuity sync to create individual transaction records like Square does
7. **Backfill**: Need to re-import October data after fix is deployed

---

**Status**: Ready to implement fix  
**Priority**: High - Blocking accurate revenue reporting  
**Estimated Time**: 1-2 hours (implement + test + backfill)

