#!/usr/bin/env python3
"""
Manual Acuity Import via API
Performs three tasks using the backend API:
1. Check if contacts were already imported
2. Fix the status to 'connected' in connected_accounts_v2 (via direct DB)
3. Trigger a fresh Acuity import via API

Usage:
    python scripts/manual_acuity_import_via_api.py
"""
import os
import requests
import psycopg2
from psycopg2.extras import RealDictCursor

# Tenant details
TENANT_ID = "c02177e3-ed55-4a55-995d-bc4aebece594"

# Get credentials from environment
API_BASE = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")
DATABASE_URL = os.getenv("DATABASE_URL", "")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE", "")

# Parse DATABASE_URL if available
def get_db_connection():
    """Get a direct database connection"""
    if not DATABASE_URL:
        print("❌ DATABASE_URL not set in environment")
        return None
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"❌ Could not connect to database: {e}")
        return None


def check_existing_contacts():
    """Task 1: Check if contacts were already imported"""
    print("\n" + "="*80)
    print("TASK 1: Checking Existing Contacts")
    print("="*80)
    
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Set RLS context
            cur.execute(f"SET LOCAL app.role = 'owner_admin'")
            cur.execute(f"SET LOCAL app.tenant_id = '{TENANT_ID}'")
            
            # Count total contacts
            cur.execute("""
                SELECT COUNT(*) as total,
                       COUNT(CASE WHEN contact_id LIKE 'acuity:%' THEN 1 END) as acuity_contacts
                FROM contacts
                WHERE tenant_id = %s::uuid
            """, (TENANT_ID,))
            
            result = cur.fetchone()
            total = result['total'] if result else 0
            acuity = result.get('acuity_contacts', 0) if result else 0
            
            print(f"\n📊 Contact Summary:")
            print(f"   Total contacts: {total}")
            print(f"   Acuity contacts: {acuity}")
            
            if acuity > 0:
                # Show sample contacts
                cur.execute("""
                    SELECT contact_id, display_name, email_hash, phone_hash
                    FROM contacts
                    WHERE tenant_id = %s::uuid
                      AND contact_id LIKE 'acuity:%%'
                    ORDER BY created_at DESC
                    LIMIT 5
                """, (TENANT_ID,))
                
                sample = cur.fetchall()
                print(f"\n   Sample Acuity contacts:")
                for row in sample:
                    print(f"   - {row['contact_id']}: {row['display_name']} (email: {bool(row['email_hash'])}, phone: {bool(row['phone_hash'])})")
            
            # Check appointments
            cur.execute("""
                SELECT COUNT(*) as total,
                       COUNT(CASE WHEN external_ref LIKE 'acuity:%' THEN 1 END) as acuity_appts
                FROM appointments
                WHERE tenant_id = %s::uuid
            """, (TENANT_ID,))
            
            appts = cur.fetchone()
            total_appts = appts['total'] if appts else 0
            acuity_appts = appts['acuity_appts'] if appts else 0
            
            print(f"\n📅 Appointment Summary:")
            print(f"   Total appointments: {total_appts}")
            print(f"   Acuity appointments: {acuity_appts}")
            
            conn.commit()
            return {
                "total_contacts": total,
                "acuity_contacts": acuity,
                "total_appointments": total_appts,
                "acuity_appointments": acuity_appts
            }
            
    except Exception as e:
        print(f"❌ Error checking contacts: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        conn.close()


def fix_connection_status():
    """Task 2: Fix the status to 'connected'"""
    print("\n" + "="*80)
    print("TASK 2: Fixing Connection Status")
    print("="*80)
    
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Set RLS context
            cur.execute(f"SET LOCAL app.role = 'owner_admin'")
            cur.execute(f"SET LOCAL app.tenant_id = '{TENANT_ID}'")
            
            # Check current status
            cur.execute("""
                SELECT id, provider, status, 
                       LENGTH(access_token_enc) as token_len,
                       connected_at, last_sync
                FROM connected_accounts_v2
                WHERE tenant_id = %s::uuid
                  AND provider = 'acuity'
            """, (TENANT_ID,))
            
            current = cur.fetchone()
            
            if not current:
                print("❌ No Acuity connection found for this tenant!")
                return False
            
            print(f"\n📋 Current Status:")
            print(f"   ID: {current['id']}")
            print(f"   Provider: {current['provider']}")
            print(f"   Status: {current['status']}")
            print(f"   Token length: {current['token_len']} chars")
            print(f"   Connected at: {current['connected_at']}")
            print(f"   Last sync: {current['last_sync']}")
            
            if current['status'] == "connected":
                print("\n✅ Status is already 'connected' - no update needed")
                return True
            
            # Update status to connected
            cur.execute("""
                UPDATE connected_accounts_v2
                SET status = 'connected',
                    last_error = NULL
                WHERE tenant_id = %s::uuid
                  AND provider = 'acuity'
            """, (TENANT_ID,))
            
            rows_updated = cur.rowcount
            conn.commit()
            
            if rows_updated > 0:
                print(f"\n✅ Successfully updated status to 'connected' ({rows_updated} row)")
                return True
            else:
                print(f"\n⚠️  No rows updated")
                return False
                
    except Exception as e:
        print(f"❌ Error fixing status: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        return False
    finally:
        conn.close()


def trigger_import():
    """Task 3: Trigger a fresh Acuity import via API"""
    print("\n" + "="*80)
    print("TASK 3: Triggering Fresh Import via API")
    print("="*80)
    
    try:
        print(f"\n🔄 Starting Acuity import for tenant {TENANT_ID}...")
        print(f"   API: {API_BASE}/integrations/booking/acuity/import")
        print("   This may take 30-60 seconds...")
        
        # Call the API endpoint with auth
        headers = {}
        if SUPABASE_SERVICE_ROLE:
            headers["Authorization"] = f"Bearer {SUPABASE_SERVICE_ROLE}"
        
        response = requests.post(
            f"{API_BASE}/integrations/booking/acuity/import",
            json={
                "tenant_id": TENANT_ID,
                "since": None,
                "until": None,
                "cursor": None
            },
            headers=headers,
            timeout=120
        )
        
        if response.status_code != 200:
            print(f"\n❌ API returned status {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return None
        
        result = response.json()
        
        print(f"\n📥 Import Results:")
        print(f"   Contacts imported: {result.get('imported', 0)} (new appointments)")
        print(f"   Contacts updated: {result.get('updated', 0)}")
        print(f"   Skipped: {result.get('skipped_duplicates', 0)}")
        print(f"   Clients fetched: {result.get('clients_count', 0)}")
        print(f"   Appointments fetched: {result.get('appointments_count', 0)}")
        print(f"   Auth mode: {result.get('auth_mode', 'unknown')}")
        
        # Check for errors
        if result.get('clients_error'):
            print(f"\n⚠️  Clients API Error: {result['clients_error']}")
        if result.get('appointments_error'):
            print(f"\n⚠️  Appointments API Error: {result['appointments_error']}")
        
        if result.get('clients_status'):
            print(f"\n   Clients API Status: {result['clients_status']}")
        if result.get('appointments_status'):
            print(f"\n   Appointments API Status: {result['appointments_status']}")
        
        return result
        
    except requests.Timeout:
        print(f"❌ Request timed out after 120 seconds")
        return None
    except Exception as e:
        print(f"❌ Error during import: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """Run all three tasks"""
    print("\n" + "="*80)
    print("MANUAL ACUITY IMPORT SCRIPT (via API)")
    print(f"Tenant: {TENANT_ID}")
    print(f"API Base: {API_BASE}")
    print("="*80)
    
    # Task 1: Check existing data
    existing = check_existing_contacts()
    
    # Task 2: Fix status
    status_fixed = fix_connection_status()
    
    # Task 3: Trigger import
    import_result = trigger_import()
    
    # Final summary
    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    
    if existing:
        print(f"\n✅ Task 1 Complete: Found {existing['acuity_contacts']} existing Acuity contacts")
    else:
        print(f"\n❌ Task 1 Failed: Could not check existing contacts")
    
    if status_fixed:
        print(f"✅ Task 2 Complete: Status set to 'connected'")
    else:
        print(f"⚠️  Task 2: Status update may have failed")
    
    if import_result:
        imported = import_result.get('imported', 0)
        clients = import_result.get('clients_count', 0)
        print(f"✅ Task 3 Complete: Import finished")
        print(f"   - {clients} clients processed")
        print(f"   - {imported} appointments imported")
    else:
        print(f"❌ Task 3 Failed: Import did not complete")
    
    print("\n" + "="*80)
    print("Done! Check the tenant's UI to verify contacts are showing.")
    print("="*80 + "\n")


if __name__ == "__main__":
    main()

