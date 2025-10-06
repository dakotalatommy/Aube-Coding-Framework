#!/bin/bash
# Test script for Square payment sync implementation
# Usage: ./test_payment_sync.sh <bearer_token> <tenant_id>

set -e

BEARER_TOKEN="${1}"
TENANT_ID="${2:-2cf02a7d-ce3b-482f-9760-76d6ff09fb71}"
API_BASE="${3:-https://api.brandvx.io}"

if [ -z "$BEARER_TOKEN" ]; then
    echo "❌ Error: Bearer token required"
    echo "Usage: ./test_payment_sync.sh <bearer_token> [tenant_id] [api_base]"
    exit 1
fi

echo "🧪 Testing Square Payment Sync Implementation"
echo "=============================================="
echo ""

# Test 1: Check admin/kpis endpoint for new fields
echo "📊 Test 1: Checking admin/kpis for new revenue fields..."
KPI_RESPONSE=$(curl -s -X GET "${API_BASE}/admin/kpis?tenant_id=${TENANT_ID}" \
  -H "Authorization: Bearer ${BEARER_TOKEN}" \
  -H "Content-Type: application/json")

echo "$KPI_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$KPI_RESPONSE"

# Check for new fields
if echo "$KPI_RESPONSE" | grep -q "current_month_revenue_cents"; then
    echo "✅ current_month_revenue_cents field present"
else
    echo "⚠️  current_month_revenue_cents field missing"
fi

if echo "$KPI_RESPONSE" | grep -q "lifetime_revenue_cents"; then
    echo "✅ lifetime_revenue_cents field present"
else
    echo "⚠️  lifetime_revenue_cents field missing"
fi

echo ""

# Test 2: Call Square payment sync (limited to 1 page for testing)
echo "💳 Test 2: Testing Square payment sync endpoint..."
SYNC_RESPONSE=$(curl -s -X POST "${API_BASE}/integrations/booking/square/sync-payments" \
  -H "Authorization: Bearer ${BEARER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"tenant_id\":\"${TENANT_ID}\",\"max_pages\":1,\"since_date\":\"2024-10-01\"}")

echo "$SYNC_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SYNC_RESPONSE"

# Check for success
if echo "$SYNC_RESPONSE" | grep -q "synced"; then
    SYNCED=$(echo "$SYNC_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('synced', 0))" 2>/dev/null || echo "0")
    CREATED=$(echo "$SYNC_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('transactions_created', 0))" 2>/dev/null || echo "0")
    echo "✅ Payment sync completed"
    echo "   - Payments processed: $SYNCED"
    echo "   - Transactions created: $CREATED"
else
    echo "⚠️  Payment sync may have encountered an error"
fi

echo ""

# Test 3: Verify transactions were created (requires SQL access, so we'll check KPIs again)
echo "🔍 Test 3: Checking if monthly revenue updated..."
sleep 2
KPI_RESPONSE_2=$(curl -s -X GET "${API_BASE}/admin/kpis?tenant_id=${TENANT_ID}" \
  -H "Authorization: Bearer ${BEARER_TOKEN}" \
  -H "Content-Type: application/json")

MONTHLY_REV=$(echo "$KPI_RESPONSE_2" | python3 -c "import sys, json; print(json.load(sys.stdin).get('current_month_revenue_cents', 0))" 2>/dev/null || echo "0")

if [ "$MONTHLY_REV" -gt 0 ]; then
    echo "✅ Monthly revenue is now: \$$(python3 -c "print($MONTHLY_REV / 100)")"
else
    echo "⚠️  Monthly revenue still $0 (may need full sync or check transaction table)"
fi

echo ""
echo "=============================================="
echo "✅ Test suite completed"

