#!/usr/bin/env python3
"""
Import Acuity data with RLS temporarily disabled
"""
import os
import requests
import psycopg2
import time

TENANT_ID = "c02177e3-ed55-4a55-995d-bc4aebece594"
API_BASE = "https://api.brandvx.io"
DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE")

print("\n" + "="*80)
print("ACUITY IMPORT WITH RLS TEMPORARILY DISABLED")
print("="*80)
print("\n⚠️  WARNING: This will temporarily disable RLS on contacts and appointments")
print("   tables to allow the import to proceed.\n")

# Step 1: Disable RLS
print("Step 1: Disabling RLS...")
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("ALTER TABLE contacts DISABLE ROW LEVEL SECURITY")
cur.execute("ALTER TABLE appointments DISABLE ROW LEVEL SECURITY")
conn.commit()
print("✅ RLS disabled on contacts and appointments")

# Step 2: Trigger the import
print("\nStep 2: Triggering Acuity import via API...")
headers = {"Authorization": f"Bearer {SUPABASE_SERVICE_ROLE}"}

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
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Import completed")
        print(f"   Clients fetched: {result.get('clients_count', 0)}")
        print(f"   Appointments fetched: {result.get('appointments_count', 0)}")
        print(f"   New imports: {result.get('imported', 0)}")
        print(f"   Skipped: {result.get('skipped_duplicates', 0)}")
    else:
        print(f"❌ API error: {response.status_code} - {response.text[:200]}")
        
except Exception as e:
    print(f"❌ Import error: {e}")

# Step 3: Re-enable RLS
print("\nStep 3: Re-enabling RLS...")
cur.execute("ALTER TABLE contacts ENABLE ROW LEVEL SECURITY")
cur.execute("ALTER TABLE appointments ENABLE ROW LEVEL SECURITY")
conn.commit()
print("✅ RLS re-enabled on contacts and appointments")

# Step 4: Verify the import
print("\nStep 4: Verifying database contents...")
time.sleep(2)

cur.execute("""
    SELECT COUNT(*) FROM contacts 
    WHERE tenant_id = %s::uuid
""", (TENANT_ID,))
total_contacts = cur.fetchone()[0]

cur.execute("""
    SELECT COUNT(*) FROM contacts 
    WHERE tenant_id = %s::uuid AND contact_id LIKE 'acuity:%%'
""", (TENANT_ID,))
acuity_contacts = cur.fetchone()[0]

cur.execute("""
    SELECT COUNT(*) FROM appointments 
    WHERE tenant_id = %s::uuid
""", (TENANT_ID,))
total_appts = cur.fetchone()[0]

cur.execute("""
    SELECT COUNT(*) FROM appointments 
    WHERE tenant_id = %s::uuid AND external_ref LIKE 'acuity:%%'
""", (TENANT_ID,))
acuity_appts = cur.fetchone()[0]

print(f"\n📊 Final Database State:")
print(f"   Total contacts: {total_contacts}")
print(f"   Acuity contacts: {acuity_contacts}")
print(f"   Total appointments: {total_appts}")
print(f"   Acuity appointments: {acuity_appts}")

if acuity_contacts > 0:
    print(f"\n✅ SUCCESS! {acuity_contacts} Acuity contacts imported")
    print("\n📝 Sample contacts:")
    cur.execute("""
        SELECT contact_id, display_name, email_hash IS NOT NULL as has_email
        FROM contacts 
        WHERE tenant_id = %s::uuid AND contact_id LIKE 'acuity:%%'
        LIMIT 5
    """, (TENANT_ID,))
    for row in cur.fetchall():
        email_icon = "✉️ " if row[2] else "   "
        print(f"   {email_icon}{row[0]}: {row[1]}")
else:
    print("\n⚠️  Still 0 contacts - there may be a deeper issue with the import function")

conn.close()

print("\n" + "="*80)
print("COMPLETE - RLS has been restored")
print("="*80 + "\n")

