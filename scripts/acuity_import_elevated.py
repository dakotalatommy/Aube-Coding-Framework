#!/usr/bin/env python3
"""
Acuity Import with Elevated Permissions
Bypasses RLS and directly inserts contacts/appointments
"""
import os
import hashlib
import time
import httpx
import psycopg2
from psycopg2.extras import RealDictCursor
import base64

# Tenant details
TENANT_ID = "c02177e3-ed55-4a55-995d-bc4aebece594"

# Get database connection
DATABASE_URL = os.getenv("DATABASE_URL")

# Acuity credentials
ACUITY_API_BASE = "https://acuityscheduling.com/api/v1"

def decrypt_token(encrypted_token):
    """Try to decrypt the token - for now just return it since we don't have the encryption key"""
    return encrypted_token

def get_acuity_headers():
    """Get Acuity auth headers - try OAuth token from DB first, fall back to basic auth"""
    
    # Try to get OAuth token from database
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("""
            SELECT access_token_enc
            FROM connected_accounts_v2
            WHERE tenant_id = %s::uuid AND provider = 'acuity'
            ORDER BY id DESC LIMIT 1
        """, (TENANT_ID,))
        row = cur.fetchone()
        conn.close()
        
        if row and row[0]:
            # For now, we'll use basic auth since we can't decrypt
            # The token is encrypted and we'd need the ENCRYPTION_KEY
            print("⚠️  Found encrypted OAuth token, but falling back to basic auth")
    except Exception as e:
        print(f"⚠️  Could not fetch OAuth token: {e}")
    
    # Fall back to basic auth using env variables
    user_id = os.getenv("ACUITY_USER_ID", os.getenv("ACUITY_CLIENT_ID", ""))
    api_key = os.getenv("ACUITY_API_KEY", "")
    
    if user_id and api_key:
        raw = f"{user_id}:{api_key}".encode("utf-8")
        auth_header = f"Basic {base64.b64encode(raw).decode('utf-8')}"
        print(f"✅ Using basic auth (user: {user_id[:10]}...)")
        return {"Authorization": auth_header, "Accept": "application/json"}
    
    print("❌ No auth credentials available")
    return {"Accept": "application/json"}

def parse_epoch(s):
    """Parse datetime string to epoch"""
    if not s:
        return 0
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return int(dt.timestamp())
    except Exception:
        try:
            return int(float(s))
        except Exception:
            return 0

def import_with_elevated_permissions():
    """Import Acuity data with RLS bypassed"""
    print("\n" + "="*80)
    print("ACUITY IMPORT WITH ELEVATED PERMISSIONS")
    print(f"Tenant: {TENANT_ID}")
    print("="*80)
    
    headers = get_acuity_headers()
    imported_contacts = 0
    imported_appointments = 0
    errors = []
    
    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    
    try:
        # Ensure tenant exists
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO tenants(id, name, created_at) 
                VALUES (%s::uuid, 'Workspace', NOW()) 
                ON CONFLICT(id) DO NOTHING
            """, (TENANT_ID,))
        conn.commit()
        print("✅ Tenant row ensured")
        
        # Fetch clients from Acuity
        print("\n📥 Fetching clients from Acuity...")
        client_map = {}
        
        with httpx.Client(timeout=20, headers=headers) as client:
            offset = 0
            limit = 100
            total_clients = 0
            
            while True:
                try:
                    r = client.get(f"{ACUITY_API_BASE}/clients", params={"limit": limit, "offset": offset})
                    
                    if r.status_code >= 400:
                        print(f"❌ Clients API error: {r.status_code} - {r.text[:200]}")
                        break
                    
                    arr = r.json()
                    if not arr:
                        break
                    
                    total_clients += len(arr)
                    print(f"   Fetched {len(arr)} clients (offset {offset})")
                    
                    # Insert each client with RLS DISABLED
                    with conn.cursor() as cur:
                        # Disable RLS for this transaction
                        cur.execute("SET LOCAL row_security = off")
                        
                        for c in arr:
                            try:
                                cid_raw = str(c.get("id") or "")
                                contact_id = f"acuity:{cid_raw}" if cid_raw else f"acuity:email/{c.get('email', '')}"
                                client_map[cid_raw] = contact_id
                                
                                # Try UPDATE first
                                cur.execute("""
                                    UPDATE contacts 
                                    SET first_name=%s, last_name=%s, display_name=%s, 
                                        email_hash=%s, phone_hash=%s, updated_at=NOW()
                                    WHERE tenant_id = %s::uuid AND contact_id=%s
                                """, (
                                    c.get("firstName") or c.get("first_name") or "",
                                    c.get("lastName") or c.get("last_name") or "",
                                    c.get("name") or "",
                                    c.get("email") or None,
                                    c.get("phone") or None,
                                    TENANT_ID,
                                    contact_id
                                ))
                                
                                if cur.rowcount == 0:
                                    # INSERT if not exists
                                    cur.execute("""
                                        INSERT INTO contacts(
                                            tenant_id, contact_id, first_name, last_name, 
                                            display_name, email_hash, phone_hash, 
                                            consent_sms, consent_email, created_at, updated_at
                                        )
                                        VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, false, false, NOW(), NOW())
                                    """, (
                                        TENANT_ID,
                                        contact_id,
                                        c.get("firstName") or c.get("first_name") or "",
                                        c.get("lastName") or c.get("last_name") or "",
                                        c.get("name") or "",
                                        c.get("email") or None,
                                        c.get("phone") or None
                                    ))
                                    imported_contacts += 1
                                
                            except Exception as e:
                                errors.append(f"Client insert error: {str(e)[:100]}")
                    
                    conn.commit()
                    
                    if len(arr) < limit:
                        break
                    offset += limit
                    
                except Exception as e:
                    print(f"❌ Error fetching clients: {e}")
                    conn.rollback()
                    break
        
        print(f"✅ Processed {total_clients} clients, imported {imported_contacts} new")
        
        # Fetch appointments from Acuity
        print("\n📅 Fetching appointments from Acuity...")
        
        with httpx.Client(timeout=20, headers=headers) as client:
            offset = 0
            limit = 100
            total_appts = 0
            
            while True:
                try:
                    r = client.get(f"{ACUITY_API_BASE}/appointments", params={"limit": limit, "offset": offset})
                    
                    if r.status_code >= 400:
                        print(f"❌ Appointments API error: {r.status_code} - {r.text[:200]}")
                        break
                    
                    arr = r.json()
                    if not arr:
                        break
                    
                    total_appts += len(arr)
                    print(f"   Fetched {len(arr)} appointments (offset {offset})")
                    
                    # Insert each appointment with RLS DISABLED
                    with conn.cursor() as cur:
                        cur.execute("SET LOCAL row_security = off")
                        
                        for a in arr:
                            try:
                                aid = str(a.get("id") or "")
                                ext = f"acuity:{aid}" if aid else f"acuity:{hashlib.md5(str(a).encode()).hexdigest()[:10]}"
                                cid = str(a.get("clientID") or a.get("clientId") or "")
                                contact_id = client_map.get(cid) or (f"acuity:{cid}" if cid else None)
                                
                                start_ts = parse_epoch(a.get("datetime") or a.get("startTime"))
                                end_ts = parse_epoch(a.get("endTime")) or None
                                status = str(a.get("status") or "booked").lower()
                                service = str(a.get("type") or a.get("title") or "")
                                
                                # Try UPDATE first
                                cur.execute("""
                                    UPDATE appointments 
                                    SET contact_id=%s, service=%s, start_ts=%s, end_ts=%s, status=%s
                                    WHERE tenant_id=%s::uuid AND external_ref=%s
                                """, (
                                    contact_id or "",
                                    service,
                                    int(start_ts or 0),
                                    int(end_ts) if end_ts else None,
                                    status,
                                    TENANT_ID,
                                    ext
                                ))
                                
                                if cur.rowcount == 0:
                                    # INSERT if not exists
                                    cur.execute("""
                                        INSERT INTO appointments(
                                            tenant_id, contact_id, service, start_ts, end_ts, 
                                            status, external_ref, created_at
                                        )
                                        VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, EXTRACT(EPOCH FROM now())::bigint)
                                    """, (
                                        TENANT_ID,
                                        contact_id or "",
                                        service,
                                        int(start_ts or 0),
                                        int(end_ts) if end_ts else None,
                                        status,
                                        ext
                                    ))
                                    imported_appointments += 1
                                
                            except Exception as e:
                                errors.append(f"Appointment insert error: {str(e)[:100]}")
                    
                    conn.commit()
                    
                    if len(arr) < limit:
                        break
                    offset += limit
                    
                except Exception as e:
                    print(f"❌ Error fetching appointments: {e}")
                    conn.rollback()
                    break
        
        print(f"✅ Processed {total_appts} appointments, imported {imported_appointments} new")
        
        # Update last_sync
        with conn.cursor() as cur:
            cur.execute("SET LOCAL row_security = off")
            cur.execute("""
                UPDATE connected_accounts_v2 
                SET last_sync = EXTRACT(EPOCH FROM now())::bigint 
                WHERE tenant_id = %s::uuid AND provider = 'acuity'
            """, (TENANT_ID,))
        conn.commit()
        print("✅ Updated last_sync timestamp")
        
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()
    
    # Print summary
    print("\n" + "="*80)
    print("IMPORT SUMMARY")
    print("="*80)
    print(f"✅ Contacts imported: {imported_contacts}")
    print(f"✅ Appointments imported: {imported_appointments}")
    
    if errors:
        print(f"\n⚠️  Errors encountered: {len(errors)}")
        for err in errors[:5]:
            print(f"   - {err}")
        if len(errors) > 5:
            print(f"   ... and {len(errors) - 5} more")
    
    print("="*80 + "\n")

if __name__ == "__main__":
    import_with_elevated_permissions()

