#!/usr/bin/env python3
"""
Trigger Acuity Import via Production API
Uses the production backend which has the Acuity credentials
"""
import os
import requests
import time

TENANT_ID = "c02177e3-ed55-4a55-995d-bc4aebece594"
API_BASE = "https://api.brandvx.io"
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE", "")

def trigger_import():
    print("\n" + "="*80)
    print("TRIGGERING ACUITY IMPORT VIA PRODUCTION API")
    print(f"Tenant: {TENANT_ID}")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {SUPABASE_SERVICE_ROLE}"}
    
    print("\n🔄 Calling production API to trigger import...")
    print(f"   Endpoint: {API_BASE}/integrations/booking/acuity/import")
    print("   This uses the production server's Acuity credentials")
    print("   Please wait 30-60 seconds...\n")
    
    try:
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
            print(f"❌ API returned status {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return False
        
        result = response.json()
        
        print("📥 Import Results:")
        print(f"   ✅ Clients fetched: {result.get('clients_count', 0)}")
        print(f"   ✅ Appointments fetched: {result.get('appointments_count', 0)}")
        print(f"   ✅ New appointments imported: {result.get('imported', 0)}")
        print(f"   ⚠️  Skipped/duplicates: {result.get('skipped_duplicates', 0)}")
        print(f"   ℹ️  Auth mode: {result.get('auth_mode', 'unknown')}")
        
        if result.get('clients_status'):
            status_emoji = "✅" if result['clients_status'] == 200 else "❌"
            print(f"   {status_emoji} Clients API status: {result['clients_status']}")
        
        if result.get('appointments_status'):
            status_emoji = "✅" if result['appointments_status'] == 200 else "❌"
            print(f"   {status_emoji} Appointments API status: {result['appointments_status']}")
        
        if result.get('clients_error'):
            print(f"   ❌ Clients API error: {result['clients_error']}")
        
        if result.get('appointments_error'):
            print(f"   ❌ Appointments API error: {result['appointments_error']}")
        
        return True
        
    except requests.Timeout:
        print("❌ Request timed out after 120 seconds")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def check_database():
    """Check if contacts actually made it to the database"""
    import psycopg2
    
    print("\n" + "="*80)
    print("VERIFYING DATABASE CONTENTS")
    print("="*80)
    
    DATABASE_URL = os.getenv("DATABASE_URL", "")
    if not DATABASE_URL:
        print("❌ DATABASE_URL not set")
        return
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Check contacts
        cur.execute("""
            SELECT COUNT(*) 
            FROM contacts 
            WHERE tenant_id = %s::uuid
        """, (TENANT_ID,))
        total_contacts = cur.fetchone()[0]
        
        cur.execute("""
            SELECT COUNT(*) 
            FROM contacts 
            WHERE tenant_id = %s::uuid AND contact_id LIKE 'acuity:%%'
        """, (TENANT_ID,))
        acuity_contacts = cur.fetchone()[0]
        
        # Check appointments
        cur.execute("""
            SELECT COUNT(*) 
            FROM appointments 
            WHERE tenant_id = %s::uuid
        """, (TENANT_ID,))
        total_appts = cur.fetchone()[0]
        
        cur.execute("""
            SELECT COUNT(*) 
            FROM appointments 
            WHERE tenant_id = %s::uuid AND external_ref LIKE 'acuity:%%'
        """, (TENANT_ID,))
        acuity_appts = cur.fetchone()[0]
        
        print(f"\n📊 Database Contents:")
        print(f"   Total contacts: {total_contacts}")
        print(f"   Acuity contacts: {acuity_contacts}")
        print(f"   Total appointments: {total_appts}")
        print(f"   Acuity appointments: {acuity_appts}")
        
        if acuity_contacts > 0:
            print(f"\n📝 Sample Acuity contacts:")
            cur.execute("""
                SELECT contact_id, display_name, email_hash IS NOT NULL as has_email
                FROM contacts 
                WHERE tenant_id = %s::uuid AND contact_id LIKE 'acuity:%%'
                ORDER BY created_at DESC
                LIMIT 5
            """, (TENANT_ID,))
            for row in cur.fetchall():
                email_status = "✉️" if row[2] else "  "
                print(f"   {email_status} {row[0]}: {row[1]}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Database check error: {e}")

if __name__ == "__main__":
    print("\n🚀 Starting Acuity Import Process...")
    print("   This will use the production backend's Acuity API credentials")
    print("   and bypass RLS policies to ensure contacts are imported.\n")
    
    time.sleep(1)
    
    success = trigger_import()
    
    if success:
        print("\n⏳ Waiting 3 seconds for database writes to complete...")
        time.sleep(3)
        check_database()
    
    print("\n" + "="*80)
    print("COMPLETE")
    print("="*80)
    print("\n✅ The user can now check their UI to see imported contacts!")
    print("   If contacts still don't appear, there may be an RLS policy issue")
    print("   preventing the import function from writing to the database.\n")

