# Handoff Prompt for Next Agent

Copy and paste this into your next AI session:

---

## Task: Continue Acuity Integration Work

I need you to take over work on the Acuity integration for BrandVX. **IMPORTANT: Do not make any changes yet.** First, you must thoroughly read and understand the current state of the project.

### Step 1: Read the Comprehensive Handoff Document

Please read this file completely before doing anything else:
- **`ACUITY_INTEGRATION_HANDOFF.md`** - This is the master document with everything you need to know

### Step 2: Review Supporting Documentation

Also review these files for additional context:
- **`CREDENTIALS_AND_CONFIG.md`** - Database credentials, API tokens, tenant info
- **`ACUITY_PAYMENT_GAP_DIAGNOSIS.md`** - Original diagnostic findings
- **`ACUITY_FIX_STATUS.md`** - Results after initial fixes
- **`diagnose-acuity-payment-gap.plan.md`** - Implementation plan (NOW SUPERSEDED by ACUITY_INTEGRATION_HANDOFF.md)

### Step 3: Understand the Current Codebase

Read these key files:
- **`src/backend/app/integrations/booking_acuity.py`** - Main integration code (recently modified)
- **`src/backend/app/workers/followups.py`** - Background job processor

### Step 4: Verify Current Database State

Using the credentials in `CREDENTIALS_AND_CONFIG.md`, run these queries to confirm current state:

```sql
-- Check transactions
SELECT COUNT(*), SUM(amount_cents)/100.0 
FROM transactions 
WHERE tenant_id = 'a8d9029d-dbbb-4b8f-bc33-161e40a1ff54' AND source = 'acuity';

-- Check contact rollups (should show over-counting issue)
SELECT SUM(lifetime_cents)/100.0 as contacts_total
FROM contacts 
WHERE tenant_id = 'a8d9029d-dbbb-4b8f-bc33-161e40a1ff54';
```

### Step 5: Summarize Your Understanding

After reading everything, please provide a brief summary covering:

1. **What was the original problem?**
2. **What has been fixed so far?**
3. **What is the current outstanding issue?**
4. **What is the recommended next step?**
5. **Why hasn't the next step been completed yet?**

### Step 6: Wait for Approval

**Do not proceed with any fixes until I confirm you have the correct understanding and give you explicit approval to proceed.**

---

## Context Notes

- **Tenant**: Jennifer Atkins (test account), UUID: `a8d9029d-dbbb-4b8f-bc33-161e40a1ff54`
- **Date**: Current work as of October 22, 2025
- **Status**: Code deployed and working, but contact rollups need correction
- **Critical**: The overlapping backfill tests caused contact lifetime values to be over-counted by ~17-20x

Take your time to read thoroughly. This is a handoff, not a rush job.

