# Referral System Implementation Status & Fix Plan

## Current State Assessment (2025-10-22)

### ✅ What's Working

#### 1. QR Code Generation & Storage
**Endpoint**: `GET /referrals/qr`
**Status**: ✅ FULLY WORKING

```json
{
  "code": "ce5az9",
  "share_url": "https://app.brandvx.io/r/ce5az9",
  "qr_url": "https://dwfvnqajrwruprqbjxph.supabase.co/storage/v1/object/public/referral-assets/155d68e3-14ce-4789-87cc-c643dda85013/ce5az9-qr-1761127045.png",
  "generated_at": "2025-10-22T09:57:26.219255Z",
  "monthly_savings_cents": 5000
}
```

**Evidence**:
- Supabase storage bucket `referral-assets` created ✅
- RLS policies configured (service_role can write, public can read) ✅
- Public URLs accessible (HTTP 200, ~29KB PNG) ✅
- Settings sync working (`settings.data_json.referral`) ✅
- Cache working (1 hour TTL) ✅

#### 2. Referral Count Tracking
**Endpoint**: `POST /billing/referral`
**Status**: ✅ WORKING (increments/decrements correctly)

**Test Results**:
- `delta: 1` → `referral_count: 1` ✅
- `delta: 1` → `referral_count: 2` ✅
- `delta: 1` → `referral_count: 3` ✅
- `delta: -3` → `referral_count: 0` ✅

**Database Evidence**:
```sql
SELECT data_json::jsonb->'referral_count' FROM settings WHERE tenant_id = '155d68e3-14ce-4789-87cc-c643dda85013';
-- Returns: 0 (after regression test)
```

#### 3. Price Tier Changes (1-2 Referrals)
**Status**: ✅ PARTIALLY WORKING

**Working**:
- 0 → 1 referral: Changes `target_price` to `price_1S33lQKsdVcBvHY10JQsdlAt` ($127) ✅
- 1 → 2 referrals: Changes `target_price` to `price_1S33l3KsdVcBvHY15cvhXFE5` ($97) ✅

**Evidence**:
```json
// Increment #1 response
{"status": "ok", "referral_count": 1, "target_price": "price_1S33lQKsdVcBvHY10JQsdlAt"}

// Increment #2 response
{"status": "ok", "referral_count": 2, "target_price": "price_1S33l3KsdVcBvHY15cvhXFE5"}
```

---

### ⚠️ What's Broken

#### 1. Coupon Creation at 3+ Referrals
**Status**: ❌ NOT WORKING

**Expected Behavior**:
- At 3+ referrals: Create Stripe coupon for $30 × (count - 2)
- Store `referral_coupon_id` and `referral_coupon_amount_cents` in settings
- Attach coupon to subscription
- Keep price at $127

**Actual Behavior**:
- API returns: `{"status": "ok", "referral_count": 3, "target_price": "price_1S33lQKsdVcBvHY10JQsdlAt"}`
- Database shows: `referral_count: 3` ✅
- Database shows: `referral_coupon_id: NULL` ❌
- Database shows: `referral_coupon_amount_cents: NULL` ❌

**Missing in Settings**:
```sql
SELECT 
  data_json::jsonb->'referral_coupon_id',
  data_json::jsonb->'referral_coupon_amount_cents'
FROM settings 
WHERE tenant_id = '155d68e3-14ce-4789-87cc-c643dda85013';

-- Returns: NULL, NULL (should have coupon data)
```

**Possible Causes**:
1. Stripe API call failing silently
2. Coupon created but not synced to settings
3. Logic never reached (conditional bug)
4. Try/catch swallowing error

#### 2. Regression to Zero Referrals
**Status**: ❌ NOT WORKING

**Expected Behavior**:
- `delta: -3` from count=3 → count=0
- Should revert to base price: `price_1S33llKsdVcBvHY1yrEZWop0` ($147)
- Should remove coupon from subscription
- Should clear `referral_coupon_id` and `referral_coupon_amount_cents` from settings

**Actual Behavior**:
- Referral count: 0 ✅
- Target price: `price_1S33lQKsdVcBvHY10JQsdlAt` ($127) ❌
- Settings: Still shows `stripe_price_id: price_1S33lQKsdVcBvHY10JQsdlAt` ❌

**Database Evidence**:
```sql
SELECT 
  data_json::jsonb->'referral_count',
  data_json::jsonb->'stripe_price_id'
FROM settings 
WHERE tenant_id = '155d68e3-14ce-4789-87cc-c643dda85013';

-- Returns: 0, "price_1S33lQKsdVcBvHY10JQsdlAt"
-- Expected: 0, "price_1S33llKsdVcBvHY1yrEZWop0" ($147 base)
```

#### 3. Static Monthly Savings
**Status**: ❌ NOT WORKING

**Expected Behavior**:
- `monthly_savings_cents` should update based on `referral_count`:
  - 0 referrals: 0 ($0)
  - 1 referral: 2000 ($20) [$147 → $127]
  - 2 referrals: 5000 ($50) [$147 → $97]
  - 3 referrals: 8000 ($80) [$97 + $30 coupon]
  - 4 referrals: 11000 ($110) [$97 + $60 coupon]

**Actual Behavior**:
- `monthly_savings_cents: 5000` at ALL referral counts (0, 1, 2, 3)
- Never updates

**Database Evidence**:
```sql
SELECT data_json::jsonb->'referral'->'monthly_savings_cents'
FROM settings 
WHERE tenant_id = '155d68e3-14ce-4789-87cc-c643dda85013';

-- Returns: 5000 (regardless of referral_count)
```

---

## Investigation Plan

### Step 1: Locate `/billing/referral` Endpoint Logic

**File**: `src/backend/app/main.py`
**Search for**: `@app.post("/billing/referral"` or `def billing_apply_referral`

**What to examine**:
1. How does it calculate `target_price`?
2. Where does it create Stripe coupons for 3+ referrals?
3. Does it update settings with coupon metadata?
4. Does it handle regression (delta < 0) to reset to base price?
5. Does it update `monthly_savings_cents` dynamically?

### Step 2: Check Stripe Price ID Mappings

**Verify these constants exist**:
```python
STRIPE_PRICE_147 = "price_1S33llKsdVcBvHY1yrEZWop0"  # Base $147
STRIPE_PRICE_127 = "price_1S33lQKsdVcBvHY10JQsdlAt"  # 1 referral
STRIPE_PRICE_97 = "price_1S33l3KsdVcBvHY15cvhXFE5"   # 2 referrals
```

**Check mapping logic**:
```python
def _get_price_for_referral_count(count: int) -> str:
    if count == 0:
        return STRIPE_PRICE_147  # ← Is this implemented?
    elif count == 1:
        return STRIPE_PRICE_127  # ✅ Working
    elif count >= 2:
        return STRIPE_PRICE_127  # 2+ stays at $127 + coupon
```

### Step 3: Trace Coupon Creation Logic

**Search for**:
```python
# In /billing/referral endpoint
if referral_count >= 3:
    # Create/update Stripe coupon
    coupon_amount = (referral_count - 2) * 3000  # $30 per extra referral
    
    # Should see:
    # 1. stripe.Coupon.create() or stripe.Coupon.modify()
    # 2. stripe.Subscription.modify(customer=..., coupon=...)
    # 3. settings update with coupon_id and amount
```

**Check for try/catch blocks** that might be swallowing errors.

### Step 4: Check Settings Update Logic

**Search for**:
```python
# After Stripe operations, should update settings
_mutate_settings_json(tenant_id, lambda data: {
    **data,
    'referral_count': new_count,
    'stripe_price_id': target_price_id,
    'referral_coupon_id': coupon_id if new_count >= 3 else None,
    'referral_coupon_amount_cents': coupon_amount if new_count >= 3 else None,
    'referral': {
        **data.get('referral', {}),
        'monthly_savings_cents': _calculate_savings(new_count)
    }
})
```

### Step 5: Check `/referrals/qr` Endpoint

**File**: `src/backend/app/main.py`
**Line**: ~786-811

**Current behavior**:
```python
monthly_savings_cents = 5000  # ← Hard-coded!
```

**Should be**:
```python
# Read actual referral count from settings
settings_row = db.query(Settings).filter_by(tenant_id=tenant_id).first()
referral_count = settings_row.data_json.get('referral_count', 0)
monthly_savings_cents = _calculate_savings(referral_count)
```

---

## Fix Plan

### Fix 1: Add Dynamic Savings Calculation Helper

**File**: `src/backend/app/main.py`
**Location**: Before `/referrals/qr` endpoint

```python
def _calculate_monthly_savings(referral_count: int) -> int:
    """
    Calculate monthly savings based on referral count.
    
    Pricing structure:
    - 0 referrals: $147/mo (base price)
    - 1 referral: $127/mo (save $20)
    - 2 referrals: $97/mo (save $50)
    - 3+ referrals: $97/mo + $30 coupon per extra referral
    
    Returns: Savings in cents
    """
    if referral_count == 0:
        return 0
    elif referral_count == 1:
        return 2000  # $147 - $127 = $20
    elif referral_count == 2:
        return 5000  # $147 - $97 = $50
    else:
        # 2 referrals = $50 savings, plus $30 per additional referral
        base_savings = 5000
        extra_savings = (referral_count - 2) * 3000
        return base_savings + extra_savings
```

### Fix 2: Update `/referrals/qr` to Use Dynamic Savings

**File**: `src/backend/app/main.py`
**Line**: ~801 (replace hard-coded 5000)

```python
@app.get("/referrals/qr", tags=["Billing"])
async def referrals_qr(tenant_id: str, ctx: UserContext = Depends(get_user_context)):
    # ... existing code ...
    
    # OLD:
    # monthly_savings_cents = 5000  # Hard-coded
    
    # NEW: Read actual referral count from settings
    with engine.begin() as conn:
        conn.execute(_sql_text("SELECT set_config('app.role', 'owner_admin', true)"))
        conn.execute(_sql_text("SELECT set_config('app.tenant_id', :t, true)"), {"t": tenant_id})
        row = conn.execute(
            _sql_text("SELECT data_json::jsonb->'referral_count' FROM settings WHERE tenant_id = CAST(:t AS uuid)"),
            {"t": tenant_id}
        ).fetchone()
        referral_count = int(row[0] or 0) if row else 0
    
    monthly_savings_cents = _calculate_monthly_savings(referral_count)
    
    # ... rest of endpoint ...
```

### Fix 3: Fix Price Mapping in `/billing/referral`

**File**: `src/backend/app/main.py`
**Search**: `@app.post("/billing/referral"`

**Add/Fix**:
```python
def _get_target_price_for_count(count: int) -> str:
    """Map referral count to Stripe price ID."""
    PRICE_147 = os.getenv("STRIPE_PRICE_147", "price_1S33llKsdVcBvHY1yrEZWop0")
    PRICE_127 = os.getenv("STRIPE_PRICE_127", "price_1S33lQKsdVcBvHY10JQsdlAt")
    PRICE_97 = os.getenv("STRIPE_PRICE_97", "price_1S33l3KsdVcBvHY15cvhXFE5")
    
    if count == 0:
        return PRICE_147  # ← Currently missing!
    elif count == 1:
        return PRICE_127
    else:  # 2+
        return PRICE_127  # Stay at $127, use coupon for extras
```

### Fix 4: Add Coupon Creation for 3+ Referrals

**File**: `src/backend/app/main.py`
**In**: `/billing/referral` endpoint

```python
@app.post("/billing/referral", tags=["Billing"])
def billing_apply_referral(req: ReferralUpdateRequest, ...):
    # ... existing count update logic ...
    
    new_count = current_count + req.delta
    target_price = _get_target_price_for_count(new_count)
    
    # Handle coupon for 3+ referrals
    coupon_id = None
    coupon_amount_cents = None
    
    if new_count >= 3:
        # Calculate coupon amount: $30 per referral beyond 2
        coupon_amount_cents = (new_count - 2) * 3000
        
        try:
            import stripe
            stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
            
            # Get Stripe customer ID from settings
            stripe_customer_id = settings_data.get("stripe_customer_id")
            
            if stripe_customer_id:
                # Create or update "forever" coupon
                coupon_name = f"referral_{tenant_id}_{new_count}"
                
                try:
                    # Try to create new coupon
                    coupon = stripe.Coupon.create(
                        amount_off=coupon_amount_cents,
                        currency="usd",
                        duration="forever",
                        name=coupon_name,
                        metadata={"tenant_id": tenant_id, "referral_count": new_count}
                    )
                    coupon_id = coupon.id
                except stripe.error.InvalidRequestError:
                    # Coupon might already exist, retrieve it
                    pass
                
                # Attach coupon to subscription
                subscriptions = stripe.Subscription.list(customer=stripe_customer_id, limit=1)
                if subscriptions.data:
                    subscription = subscriptions.data[0]
                    stripe.Subscription.modify(
                        subscription.id,
                        coupon=coupon_id
                    )
        except Exception as e:
            logger.error(f"Failed to create referral coupon: {e}")
            # Don't fail the whole request, just log
    
    elif new_count < 3:
        # Remove coupon if dropping below 3 referrals
        try:
            stripe_customer_id = settings_data.get("stripe_customer_id")
            if stripe_customer_id:
                subscriptions = stripe.Subscription.list(customer=stripe_customer_id, limit=1)
                if subscriptions.data:
                    subscription = subscriptions.data[0]
                    stripe.Subscription.modify(
                        subscription.id,
                        coupon=""  # Remove coupon
                    )
        except Exception as e:
            logger.error(f"Failed to remove referral coupon: {e}")
    
    # Update settings with all metadata
    _mutate_settings_json(tenant_id, lambda data: {
        **data,
        'referral_count': new_count,
        'stripe_price_id': target_price,
        'referral_coupon_id': coupon_id,
        'referral_coupon_amount_cents': coupon_amount_cents,
        'referral': {
            **data.get('referral', {}),
            'monthly_savings_cents': _calculate_monthly_savings(new_count)
        }
    })
    
    return {
        "status": "ok",
        "referral_count": new_count,
        "target_price": target_price,
        "monthly_savings_cents": _calculate_monthly_savings(new_count),
        "coupon_id": coupon_id,
        "coupon_amount_cents": coupon_amount_cents
    }
```

---

## Testing Plan (After Fixes)

### Test 1: Zero State
```bash
# Reset to zero
POST /billing/referral {"tenant_id": "...", "delta": -X}

# Verify:
# - referral_count: 0
# - target_price: price_1S33llKsdVcBvHY1yrEZWop0 ($147)
# - monthly_savings_cents: 0
# - coupon_id: null
# - coupon_amount_cents: null
```

### Test 2: One Referral
```bash
POST /billing/referral {"tenant_id": "...", "delta": 1}

# Verify:
# - referral_count: 1
# - target_price: price_1S33lQKsdVcBvHY10JQsdlAt ($127)
# - monthly_savings_cents: 2000 ($20)
# - coupon_id: null (no coupon yet)
```

### Test 3: Two Referrals
```bash
POST /billing/referral {"tenant_id": "...", "delta": 1}

# Verify:
# - referral_count: 2
# - target_price: price_1S33l3KsdVcBvHY15cvhXFE5 ($97)
# - monthly_savings_cents: 5000 ($50)
# - coupon_id: null (no coupon yet)
```

### Test 4: Three Referrals (Coupon Creation)
```bash
POST /billing/referral {"tenant_id": "...", "delta": 1}

# Verify:
# - referral_count: 3
# - target_price: price_1S33lQKsdVcBvHY10JQsdlAt ($127)
# - monthly_savings_cents: 8000 ($80 = $50 base + $30 coupon)
# - coupon_id: "referral_..." (created)
# - coupon_amount_cents: 3000 ($30)
# - Stripe: subscription has coupon attached
```

### Test 5: Four Referrals (Coupon Update)
```bash
POST /billing/referral {"tenant_id": "...", "delta": 1}

# Verify:
# - referral_count: 4
# - monthly_savings_cents: 11000 ($110 = $50 + $60)
# - coupon_amount_cents: 6000 ($60)
```

### Test 6: Regression to Zero
```bash
POST /billing/referral {"tenant_id": "...", "delta": -4}

# Verify:
# - referral_count: 0
# - target_price: price_1S33llKsdVcBvHY1yrEZWop0 ($147)
# - monthly_savings_cents: 0
# - coupon_id: null (removed)
# - Stripe: subscription has no coupon
```

### Test 7: QR Endpoint Shows Dynamic Savings
```bash
GET /referrals/qr?tenant_id=...

# At 0 referrals: monthly_savings_cents: 0
# At 1 referral: monthly_savings_cents: 2000
# At 2 referrals: monthly_savings_cents: 5000
# At 3 referrals: monthly_savings_cents: 8000
```

---

## Success Criteria

### API Responses
- ✅ `/billing/referral` returns correct `target_price` for all counts (0-4+)
- ✅ `/billing/referral` creates coupons at 3+ referrals
- ✅ `/billing/referral` removes coupons when dropping below 3
- ✅ `/billing/referral` returns dynamic `monthly_savings_cents`
- ✅ `/referrals/qr` shows current savings based on actual count

### Database State
- ✅ `settings.referral_count` tracks correctly
- ✅ `settings.stripe_price_id` matches `target_price`
- ✅ `settings.referral_coupon_id` populates at 3+ referrals
- ✅ `settings.referral_coupon_amount_cents` = (count - 2) × 3000
- ✅ `settings.referral.monthly_savings_cents` updates dynamically

### Stripe State
- ✅ Subscription price changes at 1 and 2 referrals
- ✅ Coupon created and attached at 3+ referrals
- ✅ Coupon updated when count increases
- ✅ Coupon removed when count drops below 3

---

## Files to Modify

1. **src/backend/app/main.py**
   - Add `_calculate_monthly_savings()` helper
   - Add `_get_target_price_for_count()` helper
   - Fix `/referrals/qr` to use dynamic savings
   - Fix `/billing/referral` to handle all edge cases:
     - Return to 0 referrals (reset to $147)
     - Coupon creation at 3+ referrals
     - Coupon removal when dropping below 3
     - Update all settings fields

## Estimated Time

- **Investigation**: 15 minutes (read code, understand current logic)
- **Fixes**: 45 minutes (implement helpers, update endpoints)
- **Testing**: 30 minutes (run all 7 test scenarios)
- **Total**: ~90 minutes

---

## Next Steps

1. **Read `/billing/referral` endpoint code** to understand current implementation
2. **Identify missing logic** (compare to fix plan above)
3. **Implement fixes** in order:
   - Add helper functions
   - Fix QR endpoint (easy win)
   - Fix billing endpoint (complex)
4. **Deploy and test** with Vivid's tenant
5. **Verify Stripe dashboard** shows coupons correctly

