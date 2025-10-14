# Acuity Import Issue - Technical Handoff Document

## Executive Summary

**Problem**: Acuity appointment import failing for tenant `a8d9029d-dbbb-4b8f-bc33-161e40a1ff54` (Jennifer Atkins). Contacts are imported (650 records) but appointments are not importing despite 1,512+ available appointments in Acuity API.

**Current Status**: Background worker architecture implemented, but job creation failing due to SQL/RLS configuration issues. Import endpoint returns `{"job_id": null}` despite code appearing correct.

**Critical Issue**: `create_job_record` function in `jobs.py` is silently failing to create job records in the database, preventing background import from executing.

## Credentials and Configuration

**See file**: `CREDENTIALS_AND_CONFIG.md` - Contains all Supabase credentials, Render environment variables, and test commands.

## Work Completed

### 1. Initial Diagnostics ✅
- **API Connectivity**: Verified Acuity API access with decrypted token `8Rt29UYwPrOHonDKyGmwNtk2acHBsUlPzlRHnYRz`
- **Data Availability**: Confirmed 1,512+ appointments available in Acuity API
- **Database State**: Verified 650 contacts exist but 0 appointments in database
- **Token Validation**: Confirmed encrypted token in `connected_accounts_v2` table decrypts correctly

### 2. Database Schema Fixes ✅
- **Contact Field Mapping**: Updated contact INSERT/UPDATE in `booking_acuity.py` (lines 377, 395) to use `email`/`phone` columns instead of `email_hash`/`phone_hash`
- **Data Migration**: Backfilled 621 existing contacts to copy email_hash → email, phone_hash → phone
- **Contact UUID Lookup**: Implemented pre-fetching mechanism (lines 436-447) to map `contact_id` (external) to `contacts.id` (UUID) to avoid N+1 queries

### 3. Appointment Schema Fixes ✅
- **Contact ID Resolution**: Modified appointment INSERT/UPDATE (lines 500, 517) to cast `contact_id` to UUID using pre-built mapping
- **Timestamp Conversion**: Fixed `start_ts`/`end_ts` to use `to_timestamp()` for proper `timestamptz` conversion
- **Audit Fields**: Added `created_at` and `updated_at` as `NOW()` in INSERT statements

### 4. Background Worker Implementation ✅
- **Route Migration**: Moved `/integrations/booking/acuity/import` from synchronous to background job queuing (lines 7177-7227 in `main.py`)
- **Worker Registration**: Added `"bookings.acuity.import"` to `SUPPORTED_KINDS` in `followups.py` (line 33)
- **Job Processor**: Implemented `_process_acuity_import_job` function (lines 904-939) in `followups.py`
- **Timeout Solution**: Addresses Render's 30-second HTTP timeout by moving long-running import to background

### 5. Code Quality Fixes ✅
- **Duplicate Route**: Removed duplicate route definition at line 10252 in `main.py`
- **SQL Parameter Fix**: Renamed `:input` to `:inp` in `create_job_record` to avoid SQL keyword conflicts
- **F-string Syntax**: Fixed Python f-string syntax error by extracting `tenant_id.replace()` to separate variable

## Current Problem - Job Creation Failure ❌

### Issue Description
The `create_job_record` function in `jobs.py` is failing silently, returning `None` instead of a job ID. API calls to `/integrations/booking/acuity/import` return `{"job_id": null}` and no jobs are created in the database.

### Error Details
**Latest Render Log**: 
```
create_job_record failed: (psycopg2.errors.SyntaxError) syntax error at or near ":"
LINE 1: ... AS uuid), 'bookings.acuity.import', 'queued', 0, :input::js...
```

### Root Cause Analysis
The SQL query in `create_job_record` still has a parameter syntax issue despite previous fixes. The `:inp::jsonb` casting syntax may be incompatible with the SQLAlchemy parameter binding style being used.

### Code Location
**File**: `/Users/dakotalatommy/Aube-Coding-Framework/src/backend/app/jobs.py`
**Function**: `create_job_record` (lines 78-96)
**Current Code**:
```python
def create_job_record(tenant_id: str, kind: str, input_payload: Dict[str, Any], status: str = "queued") -> Optional[str]:
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            safe_tenant_id = tenant_id.replace("'", "''")
            conn.execute(_sql_text(f"SET LOCAL app.tenant_id = '{safe_tenant_id}'"))
            row = conn.execute(
                _sql_text(
                    "INSERT INTO jobs (tenant_id, kind, status, progress, input) "
                    "VALUES (CAST(:t AS uuid), :k, :s, :p, :inp::jsonb) RETURNING id"
                ),
                {"t": tenant_id, "k": kind, "s": status, "p": 0, "inp": json.dumps(input_payload)},
            ).fetchone()
            return str(row[0]) if row else None
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception("create_job_record failed: %s", str(e))
        return None
```

## Required Fixes

### 1. **CRITICAL**: Fix Job Creation SQL Query
The SQL parameter syntax needs to be corrected. Likely solutions:
- Remove `::jsonb` casting and let SQLAlchemy handle JSON serialization
- Use different parameter binding syntax
- Use raw SQL with proper parameter escaping

### 2. Test Background Worker
Once job creation works:
- Verify jobs are queued in database
- Confirm worker picks up and processes jobs
- Validate appointment import completes successfully

### 3. Validate Data Integrity
After successful import:
- Check appointment count matches expected (1,512+)
- Verify contact linkage (appointments.contact_id → contacts.id)
- Confirm timestamp formats are correct
- Validate payment data import (if applicable)

## Database Schema Reference

### Key Tables
- **`connected_accounts_v2`**: Stores encrypted Acuity tokens
- **`contacts`**: 650 records, uses `email`/`phone` columns (not `email_hash`/`phone_hash`)
- **`appointments`**: Target table, links to contacts via UUID `contact_id`
- **`jobs`**: Background job queue, uses RLS with `app.tenant_id` GUC

### Row-Level Security (RLS)
Database uses RLS with these GUCs:
- `app.tenant_id`: Must be set for tenant data access
- `app.role`: Should be `'owner_admin'` for system operations

## Testing Strategy

### 1. Fix and Test Job Creation
```bash
# Test job creation endpoint
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer [BEARER_TOKEN]" \
  -d '{"tenant_id":"a8d9029d-dbbb-4b8f-bc33-161e40a1ff54"}' \
  "https://api.brandvx.io/integrations/booking/acuity/import"

# Should return: {"job_id": "uuid-string", "status": "queued", ...}
```

### 2. Monitor Background Processing
```bash
# Check job status
psql [CONNECTION_STRING] -c "
SELECT id, kind, status, progress, created_at, updated_at 
FROM jobs 
WHERE tenant_id = 'a8d9029d-dbbb-4b8f-bc33-161e40a1ff54' 
ORDER BY created_at DESC LIMIT 5;"
```

### 3. Validate Import Results
```bash
# Check appointment count
psql [CONNECTION_STRING] -c "
SELECT COUNT(*) FROM appointments 
WHERE tenant_id = 'a8d9029d-dbbb-4b8f-bc33-161e40a1ff54';"

# Check contact linkage
psql [CONNECTION_STRING] -c "
SELECT COUNT(*) FROM appointments a 
JOIN contacts c ON a.contact_id = c.id 
WHERE a.tenant_id = 'a8d9029d-dbbb-4b8f-bc33-161e40a1ff54';"
```

## Architecture Context

### Background Worker System
- **Enabled**: `ENABLE_WORKER=1` and `ENABLE_FOLLOWUPS_WORKER=1` in Render env
- **Job Types**: Defined in `SUPPORTED_KINDS` tuple in `followups.py`
- **Processing**: `_process_job()` function dispatches by job kind
- **Database**: Uses `jobs` table with JSON payload storage

### API Integration
- **Acuity API**: Confirmed working with proper scopes and token
- **Rate Limiting**: Acuity has rate limits, code includes delays
- **Data Volume**: 1,512+ appointments available for import
- **Pagination**: Import handles paginated responses from Acuity

## Success Criteria

1. **Job Creation**: API returns valid `job_id` instead of `null`
2. **Background Processing**: Jobs appear in database with `status="queued"` then `status="processing"`
3. **Data Import**: Appointments table populated with 1,500+ records
4. **Data Integrity**: All appointments properly linked to existing contacts
5. **No Regression**: Square connector still functions correctly

## Files Modified

1. `/Users/dakotalatommy/Aube-Coding-Framework/src/backend/app/main.py` - Route conversion to background jobs
2. `/Users/dakotalatommy/Aube-Coding-Framework/src/backend/app/integrations/booking_acuity.py` - Schema fixes and UUID mapping
3. `/Users/dakotalatommy/Aube-Coding-Framework/src/backend/app/workers/followups.py` - Worker job processing
4. `/Users/dakotalatommy/Aube-Coding-Framework/src/backend/app/jobs.py` - Job creation with RLS fixes (NEEDS FINAL FIX)

## Next Agent Instructions

1. **Priority 1**: Fix the SQL syntax error in `create_job_record` function in `jobs.py`
2. **Priority 2**: Test job creation endpoint returns valid job_id
3. **Priority 3**: Monitor background worker processes the job successfully
4. **Priority 4**: Validate 1,500+ appointments imported with proper contact linkage
5. **Priority 5**: Confirm Square connector still works (regression test)

The infrastructure is 95% complete - only the job creation SQL syntax needs to be resolved to unlock the entire import pipeline.
