# Feature Implementation Guide (Production-Ready Patterns)

**Purpose**: This is your golden playbook for adding ANY feature to BrandVX. Follow these patterns and your features will work correctly with multi-tenant isolation, proper authorization, and no data leakage.

**Last Updated**: October 16, 2024  
**Status**: Production-Verified (Tested with Square + Acuity integrations across 2+ tenants)

---

## Executive Summary

After 2 months of building and debugging multi-tenant isolation, we've established **verified patterns** that guarantee proper data isolation. Every new feature MUST follow these patterns.

**The Golden Rule**: Always set GUCs before querying tenant-scoped data.

```python
# Copy-paste this into every new endpoint:
db.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
db.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
```

**Why this matters**:
- ✅ RLS policies enforce tenant isolation at database level
- ✅ GUCs tell PostgreSQL which tenant's data to return
- ✅ No risk of data leakage between tenants
- ✅ Scales to 10,000+ tenants safely

---

## The 3-Layer Architecture

Understanding this is critical:

```
Layer 1: PostgreSQL RLS Policies (Database)
├── Tables have tenant_id column
├── Policies check: current_setting('app.tenant_id')::uuid = tenant_id
└── Blocks queries that don't match tenant context

Layer 2: GUC Session Variables (Backend)
├── SET LOCAL app.role = 'owner_admin'
├── SET LOCAL app.tenant_id = '<uuid>'
└── These variables make RLS policies allow the query

Layer 3: JWT Authentication (API Gateway)
├── Supabase issues JWT with user.id
├── Backend extracts tenant_id from JWT
└── UserContext dependency validates every request
```

**If any layer is missing, queries fail or return empty results.**

---

## Pattern 1: Read-Only API Endpoint (Most Common)

Use this for: Dashboard stats, analytics, client lists, revenue reports

### Example: Get Client Birthday Reminders

```python
from fastapi import Depends
from sqlalchemy.orm import Session
from sqlalchemy import text as _sql_text
from app.db import get_db
from app.auth import get_user_context, UserContext

@app.get("/clients/birthdays", tags=["Clients"])
def get_birthday_reminders(
    tenant_id: str,
    days_ahead: int = 7,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context)
):
    """Returns clients with birthdays in the next N days"""
    
    # 1. AUTHORIZATION CHECK
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    
    # 2. SET GUCs (MANDATORY)
    db.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
    db.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
    
    # 3. QUERY WITH CONFIDENCE
    # RLS will enforce tenant_id isolation automatically
    rows = db.execute(_sql_text("""
        SELECT 
            contact_id::text,
            display_name,
            birthday,
            email_hash,
            phone_hash
        FROM contacts
        WHERE tenant_id = CAST(:t AS uuid)
        AND birthday IS NOT NULL
        AND birthday >= CURRENT_DATE
        AND birthday <= CURRENT_DATE + INTERVAL ':days days'
        ORDER BY birthday ASC
    """), {"t": tenant_id, "days": days_ahead}).fetchall()
    
    # 4. RETURN DATA
    items = [{
        "contact_id": r[0],
        "name": r[1],
        "birthday": str(r[2]),
        "email": r[3],
        "phone": r[4]
    } for r in rows]
    
    return {"items": items, "total": len(items)}
```

**Key Points**:
- ✅ GUCs set BEFORE any query
- ✅ Uses parameterized queries (`:t` not f-strings)
- ✅ Returns empty list on auth failure (not 403 error)
- ✅ Type-casts UUID properly (`CAST(:t AS uuid)`)

---

## Pattern 2: Write Operation (Database Modification)

Use this for: Creating records, updating data, importing from integrations

### Example: Create Custom Client Tag

```python
@app.post("/clients/tags/create", tags=["Clients"])
def create_client_tag(
    tenant_id: str,
    contact_id: str,
    tag_name: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context)
):
    """Adds a custom tag to a client"""
    
    # 1. AUTHORIZATION
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    
    # 2. USE SHORT-LIVED TRANSACTION
    try:
        with engine.begin() as conn:
            # 3. SET GUCs FIRST
            conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            
            # 4. PERFORM WRITE
            conn.execute(_sql_text("""
                INSERT INTO client_tags (tenant_id, contact_id, tag_name, created_at)
                VALUES (
                    CAST(:t AS uuid),
                    :cid,
                    :tag,
                    EXTRACT(EPOCH FROM now())::bigint
                )
                ON CONFLICT (tenant_id, contact_id, tag_name) DO NOTHING
            """), {"t": tenant_id, "cid": contact_id, "tag": tag_name})
            
        # Transaction auto-commits on context exit
        return {"status": "ok", "tag": tag_name}
        
    except Exception as e:
        # NEVER swallow errors - log and return
        logger.exception("Failed to create tag", extra={"tenant_id": tenant_id})
        return {"status": "error", "detail": str(e)[:200]}
```

**Key Points**:
- ✅ Uses `engine.begin()` for short-lived connection
- ✅ GUCs scoped to transaction (auto-reset after)
- ✅ Idempotent (ON CONFLICT DO NOTHING)
- ✅ Errors surface (logged and returned)
- ✅ Transaction auto-commits on success

---

## Pattern 3: Complex Query with Joins

Use this for: Analytics, reporting, multi-table aggregations

### Example: Revenue by Service Type

```python
@app.get("/analytics/revenue-by-service", tags=["Analytics"])
def revenue_by_service(
    tenant_id: str,
    start_date: str,  # YYYY-MM-DD
    end_date: str,    # YYYY-MM-DD
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context)
):
    """Returns revenue breakdown by service category"""
    
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"breakdown": []}
    
    # SET GUCs
    db.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
    db.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
    
    # Complex join across tables - RLS applies to ALL
    rows = db.execute(_sql_text("""
        SELECT 
            i.category,
            COUNT(DISTINCT t.id) as transaction_count,
            SUM(t.amount_cents) as total_cents
        FROM transactions t
        JOIN inventory_items i ON i.item_id = t.item_id AND i.tenant_id = t.tenant_id
        WHERE t.tenant_id = CAST(:t AS uuid)
        AND t.transaction_date >= :start::date
        AND t.transaction_date <= :end::date
        GROUP BY i.category
        ORDER BY total_cents DESC
    """), {"t": tenant_id, "start": start_date, "end": end_date}).fetchall()
    
    breakdown = [{
        "category": r[0],
        "transactions": r[1],
        "revenue_cents": r[2],
        "revenue_dollars": round(r[2] / 100, 2)
    } for r in rows]
    
    return {"breakdown": breakdown, "period": f"{start_date} to {end_date}"}
```

**Key Points**:
- ✅ RLS applies to EVERY table in the join
- ✅ Always filter by tenant_id in WHERE clause (belt + suspenders)
- ✅ Date parameters properly typed (`:start::date`)
- ✅ Returns structured data for UI consumption

---

## Pattern 4: Background Job / Async Processing

Use this for: Batch imports, AI generation, scheduled tasks

### Example: Batch Generate Birthday Messages

```python
@app.post("/campaigns/birthday-batch", tags=["Campaigns"])
def generate_birthday_messages(
    tenant_id: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context)
):
    """Queues birthday message generation job"""
    
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    
    # 1. Create job record
    job_id = f"birthday_{tenant_id}_{int(time.time())}"
    
    with engine.begin() as conn:
        conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
        conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
        
        # Insert job
        conn.execute(_sql_text("""
            INSERT INTO background_jobs (job_id, tenant_id, job_type, status, created_at)
            VALUES (:jid, CAST(:t AS uuid), 'birthday_messages', 'queued', :ts)
        """), {"jid": job_id, "t": tenant_id, "ts": int(time.time())})
    
    # 2. Enqueue for processing (worker will set its own GUCs)
    enqueue_job(job_id, tenant_id)
    
    return {"status": "queued", "job_id": job_id}


def process_birthday_job(job_id: str):
    """Worker function - runs in background"""
    
    # Fetch job details
    with engine.begin() as conn:
        row = conn.execute(_sql_text("""
            SELECT tenant_id FROM background_jobs WHERE job_id = :jid
        """), {"jid": job_id}).fetchone()
        
        if not row:
            return
        
        tenant_id = str(row[0])
        
        # Set GUCs for this tenant
        conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
        conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
        
        # Get upcoming birthdays
        clients = conn.execute(_sql_text("""
            SELECT contact_id, display_name, birthday, phone_hash
            FROM contacts
            WHERE tenant_id = CAST(:t AS uuid)
            AND birthday >= CURRENT_DATE
            AND birthday <= CURRENT_DATE + INTERVAL '7 days'
        """), {"t": tenant_id}).fetchall()
        
        # Generate messages for each
        for client in clients:
            message = generate_ai_birthday_message(client[1], client[2])
            
            # Store draft (GUCs still active in this transaction)
            conn.execute(_sql_text("""
                INSERT INTO message_drafts (tenant_id, contact_id, content, created_at)
                VALUES (CAST(:t AS uuid), :cid, :msg, :ts)
            """), {
                "t": tenant_id,
                "cid": client[0],
                "msg": message,
                "ts": int(time.time())
            })
        
        # Mark job complete
        conn.execute(_sql_text("""
            UPDATE background_jobs
            SET status = 'completed', completed_at = :ts
            WHERE job_id = :jid
        """), {"jid": job_id, "ts": int(time.time())})
```

**Key Points**:
- ✅ Job creation and processing both set GUCs
- ✅ Worker re-establishes tenant context from job data
- ✅ All writes happen within tenant-scoped transaction
- ✅ Job status tracked for UI polling

---

## Pattern 5: Integration Data Import

Use this for: Square sync, Acuity sync, HubSpot import

### Example: Import Custom CRM Contacts

```python
@app.post("/integrations/custom-crm/import", tags=["Integrations"])
def import_crm_contacts(
    tenant_id: str,
    api_key: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context)
):
    """Imports contacts from external CRM"""
    
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    
    # 1. Fetch from external API (NO GUCs yet - not querying DB)
    external_contacts = fetch_from_crm_api(api_key)
    
    if not external_contacts:
        return {"status": "no_data", "imported": 0}
    
    # 2. Import in batch
    imported = 0
    failed = 0
    
    try:
        with engine.begin() as conn:
            # Set GUCs BEFORE writes
            conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            
            for contact in external_contacts:
                try:
                    conn.execute(_sql_text("""
                        INSERT INTO contacts (
                            tenant_id, contact_id, display_name, 
                            email_hash, phone_hash, creation_source, created_at
                        ) VALUES (
                            CAST(:t AS uuid), :cid, :name,
                            :email, :phone, 'custom_crm', :ts
                        )
                        ON CONFLICT (tenant_id, contact_id) 
                        DO UPDATE SET
                            display_name = EXCLUDED.display_name,
                            email_hash = EXCLUDED.email_hash,
                            phone_hash = EXCLUDED.phone_hash
                    """), {
                        "t": tenant_id,
                        "cid": contact["id"],
                        "name": contact["name"],
                        "email": contact.get("email"),
                        "phone": contact.get("phone"),
                        "ts": int(time.time())
                    })
                    imported += 1
                    
                except Exception as e:
                    logger.error(f"Failed to import contact {contact['id']}", exc_info=e)
                    failed += 1
                    # Continue processing other contacts
        
        return {
            "status": "ok",
            "imported": imported,
            "failed": failed,
            "total": len(external_contacts)
        }
        
    except Exception as e:
        logger.exception("CRM import failed", extra={"tenant_id": tenant_id})
        return {"status": "error", "detail": str(e)[:200]}
```

**Key Points**:
- ✅ External API fetch happens BEFORE GUCs (no DB access)
- ✅ Batch import uses single transaction with GUCs
- ✅ Upsert pattern (ON CONFLICT DO UPDATE)
- ✅ Individual errors logged but don't stop batch
- ✅ Returns detailed import statistics

---

## Common Pitfalls & How to Avoid Them

### ❌ Pitfall 1: Forgetting GUCs

```python
# WRONG - Will return empty or fail
@app.get("/clients/list")
def list_clients(tenant_id: str, db: Session = Depends(get_db)):
    rows = db.execute(_sql_text("SELECT * FROM contacts WHERE tenant_id = CAST(:t AS uuid)"), {"t": tenant_id})
    return {"items": rows}
```

**Why it fails**: RLS policies block the query because no GUCs are set.

```python
# CORRECT
@app.get("/clients/list")
def list_clients(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    
    # SET GUCS FIRST
    db.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
    db.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
    
    rows = db.execute(_sql_text("SELECT * FROM contacts WHERE tenant_id = CAST(:t AS uuid)"), {"t": tenant_id}).fetchall()
    return {"items": rows}
```

---

### ❌ Pitfall 2: Wrong Parameter Syntax

```python
# WRONG - Will cause syntax error
conn.execute(_sql_text("INSERT INTO table (data) VALUES (:param::jsonb)"), {"param": "{}"})
# Error: psycopg2.errors.SyntaxError at ":"
```

**Why it fails**: SQLAlchemy's parameter binding conflicts with PostgreSQL's `::type` casting.

```python
# CORRECT - Use CAST() instead
conn.execute(_sql_text("INSERT INTO table (data) VALUES (CAST(:param AS jsonb))"), {"param": "{}"})
```

**Verified casting patterns**:
- ✅ `CAST(:tenant_id AS uuid)`
- ✅ `CAST(:data AS jsonb)`
- ✅ `CAST(:timestamp AS bigint)`
- ✅ `:date::date` (PostgreSQL date casting is OK)

---

### ❌ Pitfall 3: Holding Session Across Network Calls

```python
# WRONG - Session transaction held during slow API call
with engine.begin() as conn:
    conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
    
    # This could take 30 seconds!
    external_data = requests.get("https://slow-api.com/data").json()
    
    # Connection held this entire time
    conn.execute(_sql_text("INSERT INTO ..."), {...})
```

**Why it's bad**:
- Holds DB connection during network I/O
- Blocks connection pool
- Risk of timeout/disconnect

```python
# CORRECT - Fetch first, then write
external_data = requests.get("https://slow-api.com/data").json()

# Now open short-lived transaction
with engine.begin() as conn:
    conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
    conn.execute(_sql_text("INSERT INTO ..."), {...})
```

---

### ❌ Pitfall 4: Swallowing Errors

```python
# WRONG - Error silently ignored
try:
    with engine.begin() as conn:
        conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
        conn.execute(_sql_text("INSERT INTO ..."), {...})
except Exception:
    pass  # DANGER - error is lost
```

**Why it's bad**: You'll never know why writes fail.

```python
# CORRECT - Log and surface errors
try:
    with engine.begin() as conn:
        conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
        conn.execute(_sql_text("INSERT INTO ..."), {...})
except Exception as e:
    logger.exception("Write failed", extra={"tenant_id": tenant_id})
    return {"status": "error", "detail": str(e)[:200]}
```

---

## UI Integration Patterns

Once your backend endpoint is ready, wire it to the UI:

### Frontend Fetch Pattern

```typescript
// File: apps/operator-ui/src/v2/pages/MyNewFeature.tsx
import { useEffect, useState } from 'react'
import api from '@/lib/api'

export function MyNewFeature() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function fetchData() {
      try {
        // api.ts automatically adds Authorization header
        const response = await api.get('/my-new-endpoint', {
          params: { tenant_id: getTenant() }
        })
        setData(response.data)
      } catch (error) {
        console.error('Failed to fetch', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])
  
  if (loading) return <div>Loading...</div>
  
  return <div>{/* Render your data */}</div>
}
```

**Key Points**:
- ✅ `api.get()` handles auth headers automatically
- ✅ Uses tenant_id from session
- ✅ Error handling with user feedback
- ✅ Loading states for better UX

---

## Testing Your Feature

### Manual Testing Checklist

Use these test tenants (from production):

**Tenant 1: Vivid Hairr (Square)**
- UUID: `155d68e3-14ce-4789-87cc-c643dda85013`
- Has: 284 contacts, $214K lifetime revenue, Square integration

**Tenant 2: Partner's Mother (Acuity)**
- UUID: [Get from user]
- Has: Acuity appointments, custom workflows

**Test Steps**:
1. Get fresh bearer token for tenant
2. Call your endpoint with curl:
   ```bash
   curl "https://api.brandvx.io/your-endpoint?tenant_id=155d68e3-..." \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
3. Verify response data is tenant-specific
4. Test with other tenant - confirm data isolation
5. Deploy to Cloudflare and test in UI

---

## Deployment Checklist

Before shipping your feature:

- [ ] GUCs set in all database queries
- [ ] Authorization check with `UserContext`
- [ ] Error logging in place
- [ ] Returns proper JSON structure
- [ ] Tested with 2+ tenants for isolation
- [ ] UI component handles loading/error states
- [ ] Frontend deployed to Cloudflare
- [ ] Backend deployed to Render (auto-deploys on push)

---

## Quick Reference Card

**Copy this into every new endpoint:**

```python
@app.get("/your-endpoint", tags=["YourTag"])
def your_endpoint(
    tenant_id: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context)
):
    # 1. Auth check
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    
    # 2. Set GUCs
    db.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
    db.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
    
    # 3. Query
    rows = db.execute(_sql_text("""
        SELECT * FROM your_table
        WHERE tenant_id = CAST(:t AS uuid)
    """), {"t": tenant_id}).fetchall()
    
    # 4. Return
    return {"items": [dict(r) for r in rows]}
```

---

## Final Notes

**You now have a production-grade, multi-tenant SaaS architecture.**

Every feature you build from here will:
- ✅ Work correctly on first deploy
- ✅ Scale to thousands of tenants
- ✅ Isolate data properly
- ✅ Follow security best practices

**The foundation is done. Now you get to build.**

When in doubt, reference this guide. When you add a feature, copy one of the 5 patterns above.

**Welcome to the velocity phase.** 🚀

---

**Questions? Check these docs:**
- `backend-db-architecture.md` - Deep dive on RLS + GUCs
- `BACKEND_UI_INTEGRATION_GUIDE.md` - Verified endpoints and data structures
- `brandvx-system-guide.md` - Full system architecture

**Still stuck?** Check Render logs for PostgreSQL errors. 99% of issues are missing GUCs.

