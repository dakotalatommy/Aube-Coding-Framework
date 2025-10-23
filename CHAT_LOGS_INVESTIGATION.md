# Chat Logs Not Persisting - Investigation Report

**Date**: October 23, 2025  
**Investigator**: AI Assistant  
**Status**: Root causes identified - awaiting fix approval

---

## Executive Summary

Chat messages from `/ai/chat/raw` endpoint are **not being persisted** to the database due to **two separate bugs**:

1. **Type mismatch**: `session_id` column is `UUID` type but code generates string IDs like `"s_QVzPbJP0320"` → Cast fails
2. **Function signature mismatch**: Code calls `_safe_audit_log()` with wrong parameter names → Silent failure

Both functions silently swallow exceptions (bare `except Exception: pass`), so the failures are invisible to users and logs.

---

## Issue #1: UUID Type Mismatch in `askvx_messages`

### The Problem

**Location**: `src/backend/app/main.py:517`

```python
def _append_askvx_message(tenant_id: str, session_id: str, role: str, content: str) -> None:
    if not tenant_id:
        return
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SELECT set_config('app.role', 'owner_admin', true)"))
            conn.execute(
                _sql_text(
                    "INSERT INTO askvx_messages (tenant_id, session_id, role, content) VALUES (CAST(:t AS uuid), :sid, :role, :content)"
                    #                                                                                             ^^^^
                    #                                                          Tries to cast session_id to UUID but it's a string!
                ),
                {"t": tenant_id, "sid": session_id[:64], "role": role[:32], "content": content[:8000]},
            )
    except Exception:
        pass  # Silent failure!
```

### Database Schema

```sql
CREATE TABLE askvx_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    session_id uuid NOT NULL,  -- ❌ UUID type!
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
```

### Session ID Format

Session IDs are generated as **strings**, not UUIDs:

```python
# Line 5627 in main.py
sid = "s_" + _secrets.token_urlsafe(8)
# Example: "s_QVzPbJP0320"
```

### Test Reproduction

```sql
-- This is what the code tries to do:
INSERT INTO askvx_messages (tenant_id, session_id, role, content) 
VALUES (
    'a8d9029d-dbbb-4b8f-bc33-161e40a1ff54'::uuid,
    's_QVzPbJP0320',  -- ❌ ERROR: invalid input syntax for type uuid
    'user',
    'Hello'
);

-- Error: invalid input syntax for type uuid: "s_QVzPbJP0320"
```

### Why It's Silent

Line 521: `except Exception: pass` - All errors are swallowed without logging.

---

## Issue #2: Function Signature Mismatch in `_safe_audit_log`

### The Problem

**Call site**: `src/backend/app/main.py:6125`

```python
# Code CALLS the function like this:
_safe_audit_log(db, tenant_id=ctx.tenant_id, session_id=sid, role=str(last.role), content=user_text)
#                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
#                   Parameters: tenant_id, session_id, role, content
```

**Function definition**: `src/backend/app/main.py:3472`

```python
def _safe_audit_log(db: Session, *, tenant_id: str, actor_id: str, action: str, entity_ref: str, payload: Optional[str] = None) -> None:
#                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
#                                    Expected params: tenant_id, actor_id, action, entity_ref, payload
```

### Parameter Name Mismatch

| Call Uses | Function Expects | Result |
|-----------|------------------|--------|
| `tenant_id` | `tenant_id` | ✅ Match |
| `session_id` | `actor_id` | ❌ **Mismatch** |
| `role` | `action` | ❌ **Mismatch** |
| `content` | `entity_ref` | ❌ **Mismatch** |
| (not provided) | `payload` | ✅ Optional |

### What Happens

Python's keyword argument passing means:
- `tenant_id='...'` → Works
- `session_id='...'` → **TypeError: unexpected keyword argument 'session_id'**
- Exception caught by `except Exception: pass` on line 6130
- Function silently fails, nothing logged

### Intended Destination

The function writes to `audit_logs` table:

```sql
CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    actor_id uuid,           -- Who did it
    action text NOT NULL,     -- What they did
    entity_ref text,          -- What entity was affected
    diff jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
```

This table is for **audit trail** (user actions), not chat messages. The call is conceptually wrong even if parameters matched.

---

## Related Tables

### `askvx_messages`
- **Purpose**: Store AskVX chat conversations
- **Session ID Type**: `UUID` (should be `TEXT` or `VARCHAR`)
- **Current Row Count**: Has historical data from before the bug
- **Test Tenant Rows (last hour)**: 0

### `chat_logs`
- **Purpose**: Legacy chat storage? (code doesn't write to it)
- **Session ID Type**: `VARCHAR(128)` ✅
- **Current Row Count**: 0 in last 24 hours
- **Note**: This table is NOT used by current code

### `audit_logs`
- **Purpose**: Audit trail for user actions (settings changes, etc.)
- **Not meant for chat messages**

---

## Code Flow Analysis

```
POST /ai/chat/raw
  ↓
Line 6118-6132: Persist logs (best-effort)
  ↓
Line 6124: _append_askvx_message(ctx.tenant_id, sid, role, user_text)
  ↓
Line 517: INSERT INTO askvx_messages ... CAST(:sid AS uuid)
  ↓
❌ ERROR: invalid input syntax for type uuid: "s_QVzPbJP0320"
  ↓
Line 521: except Exception: pass  (silent failure)
  ↓
Line 6125: _safe_audit_log(db, tenant_id=..., session_id=..., role=..., content=...)
  ↓
Line 3472: def _safe_audit_log(..., actor_id, action, entity_ref, ...)
  ↓
❌ TypeError: unexpected keyword argument 'session_id'
  ↓
Line 6130: except Exception: pass  (silent failure)
  ↓
Line 6129: db.commit()  (commits nothing since both inserts failed)
  ↓
User gets AI response, unaware messages weren't saved
```

---

## Historical Context

Looking at `askvx_messages` row count:

```sql
SELECT COUNT(*) FROM askvx_messages;
-- Returns: 1 row exists (from before the bug)
```

This suggests:
1. The table schema was changed from `TEXT` to `UUID` at some point
2. OR session ID generation format changed
3. Old code/sessions worked, recent ones don't

---

## Why Users Don't Notice

1. **AI responses still work** - The persistence happens AFTER response is generated
2. **Silent failures** - Both functions have `except Exception: pass`
3. **No error logs** - Exceptions are swallowed
4. **No alerts** - No monitoring on chat log write failures

---

## Impact Assessment

### What's Broken
- ❌ AskVX chat history not persisted
- ❌ Cannot retrieve past conversations
- ❌ No usage analytics for AI chat
- ❌ Cannot debug user issues (no logs to review)

### What Still Works
- ✅ AI responses generated successfully
- ✅ Users can chat with AskVX
- ✅ Real-time conversations work

### Affected Endpoints
- `/ai/chat/raw` - Primary chat endpoint
- `/ai/chat` - If it exists and uses same logging

---

## Proposed Fixes

### Fix #1: Change `askvx_messages.session_id` Column Type

**Option A**: Alter column to TEXT (recommended)
```sql
ALTER TABLE askvx_messages 
ALTER COLUMN session_id TYPE TEXT;
```

**Option B**: Generate UUID session IDs
```python
# Change session generation
import uuid
sid = str(uuid.uuid4())
```

**Recommendation**: Use Option A (change column to TEXT) because:
- Simpler migration
- String session IDs are more human-readable
- Matches `chat_logs.session_id` type (VARCHAR)

### Fix #2A: Fix `_safe_audit_log` Call (Wrong Approach)

Don't do this - audit_logs is not for chat messages!

### Fix #2B: Remove Incorrect `_safe_audit_log` Calls

```python
# Line 6118-6132
try:
    sid = req.session_id or "default"
    if req.messages:
        last = req.messages[-1]
        user_text = str(last.content)
        _append_askvx_message(ctx.tenant_id, sid, str(last.role), user_text)
        # _safe_audit_log(...) <- REMOVE THIS (wrong table)
    assistant_text = content or ''
    _append_askvx_message(ctx.tenant_id, sid, 'assistant', assistant_text)
    # _safe_audit_log(...) <- REMOVE THIS (wrong table)
    db.commit()
except Exception:
    try: db.rollback()
    except Exception: pass
```

**OR** Fix #2C: Create proper chat logging function that writes to `chat_logs` table instead.

### Fix #3: Improve Error Handling

```python
def _append_askvx_message(tenant_id: str, session_id: str, role: str, content: str) -> None:
    if not tenant_id:
        return
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SELECT set_config('app.role', 'owner_admin', true)"))
            conn.execute(
                _sql_text(
                    "INSERT INTO askvx_messages (tenant_id, session_id, role, content) VALUES (CAST(:t AS uuid), :sid, :role, :content)"
                ),
                {"t": tenant_id, "sid": session_id[:64], "role": role[:32], "content": content[:8000]},
            )
    except Exception as e:
        # Log the error instead of silent failure
        import logging
        logging.error(f"Failed to append askvx message: {e}", exc_info=True)
        # Optional: send to Sentry
```

---

## Testing Plan

### Step 1: Verify Current Failure
```python
# Run this directly against DB
import psycopg2
conn = psycopg2.connect("postgresql://postgres:...@db.dwfvnqajrwruprqbjxph.supabase.co:5432/postgres")
cur = conn.cursor()
cur.execute("SELECT set_config('app.role', 'owner_admin', true)")
cur.execute("""
    INSERT INTO askvx_messages (tenant_id, session_id, role, content) 
    VALUES ('a8d9029d-dbbb-4b8f-bc33-161e40a1ff54'::uuid, 's_test'::uuid, 'user', 'test')
""")
# Expect: ERROR: invalid input syntax for type uuid: "s_test"
```

### Step 2: Apply Schema Fix
```sql
ALTER TABLE askvx_messages ALTER COLUMN session_id TYPE TEXT;
```

### Step 3: Test Insert After Fix
```python
cur.execute("""
    INSERT INTO askvx_messages (tenant_id, session_id, role, content) 
    VALUES ('a8d9029d-dbbb-4b8f-bc33-161e40a1ff54'::uuid, 's_test', 'user', 'test')
    RETURNING id, created_at
""")
# Expect: Success
```

### Step 4: Test via API
```bash
curl -X POST "https://api.brandvx.io/ai/chat/raw" \
  -H "Authorization: Bearer ..." \
  -d '{"tenant_id":"...", "mode":"support", "session_id":"s_verify", "messages":[{"role":"user","content":"Test"}]}'
```

### Step 5: Verify Persistence
```sql
SELECT session_id, role, content, created_at 
FROM askvx_messages 
WHERE session_id = 's_verify' 
ORDER BY created_at;
```

**Expected**: 2 rows (user message + assistant response)

---

## Additional Observations

### Why `chat_logs` Exists But Isn't Used

The `chat_logs` table has:
- Correct session_id type (VARCHAR)
- Proper indexes
- RLS policies
- 0 rows in last 24 hours

Suggests:
- Legacy table from older implementation
- Code was refactored to use `askvx_messages`
- Column type mismatch introduced during refactor
- No migration script to update column type

### Production Safety Concerns

1. **Silent Failures**: Two separate bugs both masked by `except: pass`
2. **No Monitoring**: No alerts when chat persistence fails
3. **No Logging**: Exceptions swallowed without trace
4. **Data Loss**: Unknown how many conversations lost

---

## Recommended Action Plan

### Immediate (This Session)
1. ✅ **Investigation complete** - Root causes identified
2. ⏳ **Await approval** - User said not to make changes yet
3. ⏳ **Prepare migration** - Draft SQL ALTER statement
4. ⏳ **Prepare code fix** - Remove incorrect audit_log calls

### Short-Term (Today)
1. Apply schema migration (ALTER COLUMN)
2. Deploy code fix (remove wrong audit_log calls)
3. Test via API
4. Verify logs persisting
5. Monitor for 1 hour

### Medium-Term (This Week)
1. Add proper error logging (don't swallow exceptions silently)
2. Add Sentry alerts for chat log failures
3. Decide on `chat_logs` vs `askvx_messages` strategy
4. Add integration test for chat persistence
5. Review all other `except Exception: pass` cases

### Long-Term (This Month)
1. Add monitoring dashboard for chat log write success rate
2. Consider consolidating to single chat table
3. Add data retention policy
4. Implement chat export feature
5. Document chat logging architecture

---

## Questions for User

1. **Schema migration**: OK to change `askvx_messages.session_id` from UUID to TEXT?
2. **audit_logs calls**: Should we remove them (wrong table) or fix to use chat_logs?
3. **Error handling**: Add logging/Sentry or keep silent failures?
4. **Table strategy**: Consolidate to one table or keep both askvx_messages and chat_logs?
5. **Historical data**: Any concern about the 1 existing row in askvx_messages?

---

## Files to Modify

### 1. Database Migration
```sql
-- migration_fix_askvx_session_id.sql
ALTER TABLE askvx_messages 
ALTER COLUMN session_id TYPE TEXT;
```

### 2. Backend Code
- `src/backend/app/main.py`:
  - Line 517: Update INSERT to not cast session_id to UUID
  - Line 6125, 6128: Remove incorrect `_safe_audit_log` calls
  - Line 521: Add proper error logging instead of silent pass

---

**End of Investigation Report**

