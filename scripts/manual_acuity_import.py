#!/usr/bin/env python3
"""
Manual Acuity Import Script
Performs three tasks:
1. Check if contacts were already imported
2. Fix the status to 'connected' in connected_accounts_v2
3. Trigger a fresh Acuity import

Usage:
    python scripts/manual_acuity_import.py
"""
import os
import sys
from pathlib import Path

# Add parent directory to path so we can import backend modules
sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "backend"))

from sqlalchemy import text as sql_text
from app.db import engine
from app.integrations.booking_acuity import import_appointments

# Tenant details
TENANT_ID = "c02177e3-ed55-4a55-995d-bc4aebece594"

def set_rls_context(conn, tenant_id: str, role: str = "owner_admin"):
    """Set RLS GUCs for the connection"""
    try:
        safe_role = role.replace("'", "''")
        conn.execute(sql_text(f"SET LOCAL app.role = '{safe_role}'"))
        safe_tenant = tenant_id.replace("'", "''")
        conn.execute(sql_text(f"SET LOCAL app.tenant_id = '{safe_tenant}'"))
    except Exception as e:
        print(f"⚠️  Warning: Could not set RLS GUCs: {e}")


def check_existing_contacts():
    """Task 1: Check if contacts were already imported"""
    print("\n" + "="*80)
    print("TASK 1: Checking Existing Contacts")
    print("="*80)
    
    try:
        with engine.begin() as conn:
            set_rls_context(conn, TENANT_ID)
            
            # Count total contacts
            result = conn.execute(
                sql_text("""
                    SELECT COUNT(*) as total,
                           COUNT(CASE WHEN contact_id LIKE 'acuity:%' THEN 1 END) as acuity_contacts
                    FROM contacts
                    WHERE tenant_id = CAST(:tid AS uuid)
                """),
                {"tid": TENANT_ID}
            ).fetchone()
            
            total = result[0] if result else 0
            acuity = result[1] if result else 0
            
            print(f"\n📊 Contact Summary:")
            print(f"   Total contacts: {total}")
            print(f"   Acuity contacts: {acuity}")
            
            if acuity > 0:
                # Show sample contacts
                sample = conn.execute(
                    sql_text("""
                        SELECT contact_id, display_name, email_hash, phone_hash
                        FROM contacts
                        WHERE tenant_id = CAST(:tid AS uuid)
                          AND contact_id LIKE 'acuity:%'
                        ORDER BY created_at DESC
                        LIMIT 5
                    """),
                    {"tid": TENANT_ID}
                ).fetchall()
                
                print(f"\n   Sample Acuity contacts:")
                for row in sample:
                    print(f"   - {row[0]}: {row[1]} (email: {bool(row[2])}, phone: {bool(row[3])})")
            
            # Check appointments
            appts = conn.execute(
                sql_text("""
                    SELECT COUNT(*) as total,
                           COUNT(CASE WHEN external_ref LIKE 'acuity:%' THEN 1 END) as acuity_appts
                    FROM appointments
                    WHERE tenant_id = CAST(:tid AS uuid)
                """),
                {"tid": TENANT_ID}
            ).fetchone()
            
            total_appts = appts[0] if appts else 0
            acuity_appts = appts[1] if appts else 0
            
            print(f"\n📅 Appointment Summary:")
            print(f"   Total appointments: {total_appts}")
            print(f"   Acuity appointments: {acuity_appts}")
            
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


def fix_connection_status():
    """Task 2: Fix the status to 'connected'"""
    print("\n" + "="*80)
    print("TASK 2: Fixing Connection Status")
    print("="*80)
    
    try:
        with engine.begin() as conn:
            set_rls_context(conn, TENANT_ID)
            
            # Check current status
            current = conn.execute(
                sql_text("""
                    SELECT id, provider, status, 
                           LENGTH(access_token_enc) as token_len,
                           connected_at, last_sync
                    FROM connected_accounts_v2
                    WHERE tenant_id = CAST(:tid AS uuid)
                      AND provider = 'acuity'
                """),
                {"tid": TENANT_ID}
            ).fetchone()
            
            if not current:
                print("❌ No Acuity connection found for this tenant!")
                return False
            
            row_id, provider, status, token_len, connected_at, last_sync = current
            
            print(f"\n📋 Current Status:")
            print(f"   ID: {row_id}")
            print(f"   Provider: {provider}")
            print(f"   Status: {status}")
            print(f"   Token length: {token_len} chars")
            print(f"   Connected at: {connected_at}")
            print(f"   Last sync: {last_sync}")
            
            if status == "connected":
                print("\n✅ Status is already 'connected' - no update needed")
                return True
            
            # Update status to connected
            result = conn.execute(
                sql_text("""
                    UPDATE connected_accounts_v2
                    SET status = 'connected',
                        last_error = NULL
                    WHERE tenant_id = CAST(:tid AS uuid)
                      AND provider = 'acuity'
                """),
                {"tid": TENANT_ID}
            )
            
            rows_updated = result.rowcount
            
            if rows_updated > 0:
                print(f"\n✅ Successfully updated status to 'connected' ({rows_updated} row)")
                return True
            else:
                print(f"\n⚠️  No rows updated (this might be an RLS issue)")
                return False
                
    except Exception as e:
        print(f"❌ Error fixing status: {e}")
        import traceback
        traceback.print_exc()
        return False


def trigger_import():
    """Task 3: Trigger a fresh Acuity import"""
    print("\n" + "="*80)
    print("TASK 3: Triggering Fresh Import")
    print("="*80)
    
    try:
        print(f"\n🔄 Starting Acuity import for tenant {TENANT_ID}...")
        print("   This may take 30-60 seconds...")
        
        # Call the import function directly
        result = import_appointments(
            tenant_id=TENANT_ID,
            since=None,  # Import all
            until=None,
            cursor=None
        )
        
        print(f"\n📥 Import Results:")
        print(f"   Status: {result.get('status', 'unknown')}")
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
        
    except Exception as e:
        print(f"❌ Error during import: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """Run all three tasks"""
    print("\n" + "="*80)
    print("MANUAL ACUITY IMPORT SCRIPT")
    print(f"Tenant: {TENANT_ID}")
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

