#!/usr/bin/env python3
"""
Investigate Acuity Account
Use the stored OAuth token to explore what's actually in the Acuity account
"""
import os
import httpx
import psycopg2
import base64
import hashlib

TENANT_ID = "c02177e3-ed55-4a55-995d-bc4aebece594"
DATABASE_URL = os.getenv("DATABASE_URL")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")

def decrypt_token(encrypted_token):
    """Decrypt the Acuity OAuth token"""
    if not ENCRYPTION_KEY:
        print("⚠️  No ENCRYPTION_KEY - cannot decrypt")
        return None
    
    try:
        # Try to use Fernet encryption
        from cryptography.fernet import Fernet
        f = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
        decrypted = f.decrypt(encrypted_token.encode() if isinstance(encrypted_token, str) else encrypted_token)
        return decrypted.decode('utf-8')
    except ImportError:
        print("⚠️  cryptography module not available")
        return None
    except Exception as e:
        print(f"⚠️  Could not decrypt token: {e}")
        return None

def get_acuity_token():
    """Get the Acuity OAuth token from database"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT access_token_enc, scopes, connected_at
        FROM connected_accounts_v2
        WHERE tenant_id = %s::uuid AND provider = 'acuity'
        ORDER BY id DESC LIMIT 1
    """, (TENANT_ID,))
    
    row = cur.fetchone()
    conn.close()
    
    if not row:
        return None, None, None
    
    encrypted_token = row[0]
    scopes = row[1]
    connected_at = row[2]
    
    # Try to decrypt
    decrypted = decrypt_token(encrypted_token)
    
    return encrypted_token, decrypted, scopes, connected_at

def test_acuity_api(token, is_oauth=True):
    """Test various Acuity API endpoints to see what data exists"""
    
    base = "https://acuityscheduling.com/api/v1"
    
    if is_oauth:
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
        print(f"🔑 Using OAuth Bearer token")
    else:
        # Fallback to basic auth if we have it in env
        user_id = os.getenv("ACUITY_USER_ID", "")
        api_key = os.getenv("ACUITY_API_KEY", "")
        if not user_id or not api_key:
            print("❌ No OAuth token and no basic auth credentials available")
            return
        
        raw = f"{user_id}:{api_key}".encode("utf-8")
        auth = base64.b64encode(raw).decode('utf-8')
        headers = {
            "Authorization": f"Basic {auth}",
            "Accept": "application/json"
        }
        print(f"🔑 Using Basic Auth (user: {user_id[:15]}...)")
    
    print("\n" + "="*80)
    print("INVESTIGATING ACUITY ACCOUNT")
    print("="*80)
    
    with httpx.Client(timeout=30, headers=headers) as client:
        
        # 1. Test /api/v1/me endpoint (account info)
        print("\n📋 Testing /api/v1/me (account info)...")
        try:
            r = client.get(f"{base}/me")
            if r.status_code == 200:
                data = r.json()
                print(f"✅ Account: {data.get('name', 'Unknown')}")
                print(f"   Email: {data.get('email', 'N/A')}")
                print(f"   Timezone: {data.get('timezone', 'N/A')}")
            else:
                print(f"❌ Status {r.status_code}: {r.text[:200]}")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # 2. Check total client count
        print("\n👥 Checking total clients...")
        try:
            # First, get a small batch to see the response
            r = client.get(f"{base}/clients", params={"limit": 1, "offset": 0})
            if r.status_code == 200:
                # Acuity doesn't return total count in headers, so we need to paginate
                # Let's try fetching in larger batches
                print("   Fetching clients in batches...")
                total_found = 0
                offset = 0
                limit = 300  # Max per page
                max_pages = 10  # Safety limit
                
                for page in range(max_pages):
                    r = client.get(f"{base}/clients", params={"limit": limit, "offset": offset})
                    if r.status_code != 200:
                        print(f"   ❌ Error at offset {offset}: {r.status_code}")
                        break
                    
                    clients = r.json()
                    if not clients:
                        break
                    
                    batch_size = len(clients)
                    total_found += batch_size
                    print(f"   Page {page+1}: Found {batch_size} clients (total so far: {total_found})")
                    
                    if batch_size < limit:
                        break  # Last page
                    
                    offset += limit
                
                print(f"\n✅ Total clients found: {total_found}")
                
                if total_found > 0:
                    # Show sample
                    print(f"\n📝 Sample clients (first 5):")
                    r = client.get(f"{base}/clients", params={"limit": 5, "offset": 0})
                    if r.status_code == 200:
                        for c in r.json()[:5]:
                            name = c.get('firstName', '') + ' ' + c.get('lastName', '')
                            email = c.get('email', 'no email')
                            cid = c.get('id', 'no id')
                            print(f"   - ID {cid}: {name} ({email})")
            else:
                print(f"❌ Status {r.status_code}: {r.text[:200]}")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # 3. Check appointments
        print("\n📅 Checking appointments...")
        try:
            r = client.get(f"{base}/appointments", params={"limit": 1, "offset": 0})
            if r.status_code == 200:
                # Count appointments
                print("   Fetching appointments in batches...")
                total_appts = 0
                offset = 0
                limit = 300
                max_pages = 10
                
                for page in range(max_pages):
                    r = client.get(f"{base}/appointments", params={"limit": limit, "offset": offset})
                    if r.status_code != 200:
                        print(f"   ❌ Error at offset {offset}: {r.status_code}")
                        break
                    
                    appts = r.json()
                    if not appts:
                        break
                    
                    batch_size = len(appts)
                    total_appts += batch_size
                    print(f"   Page {page+1}: Found {batch_size} appointments (total so far: {total_appts})")
                    
                    if batch_size < limit:
                        break
                    
                    offset += limit
                
                print(f"\n✅ Total appointments found: {total_appts}")
                
                if total_appts > 0:
                    print(f"\n📝 Sample appointments (first 3):")
                    r = client.get(f"{base}/appointments", params={"limit": 3, "offset": 0})
                    if r.status_code == 200:
                        for a in r.json()[:3]:
                            appt_type = a.get('type', 'Unknown')
                            client_name = a.get('firstName', '') + ' ' + a.get('lastName', '')
                            datetime = a.get('datetime', 'no date')
                            print(f"   - {appt_type} with {client_name} on {datetime}")
            else:
                print(f"❌ Status {r.status_code}: {r.text[:200]}")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # 4. Check appointment types/services
        print("\n🎯 Checking appointment types...")
        try:
            r = client.get(f"{base}/appointment-types")
            if r.status_code == 200:
                types = r.json()
                print(f"✅ Found {len(types)} appointment types:")
                for t in types[:10]:  # Show first 10
                    print(f"   - {t.get('name', 'Unknown')} (ID: {t.get('id', 'N/A')})")
            else:
                print(f"❌ Status {r.status_code}: {r.text[:200]}")
        except Exception as e:
            print(f"❌ Error: {e}")

def main():
    print("\n" + "="*80)
    print("ACUITY ACCOUNT INVESTIGATION")
    print(f"Tenant: {TENANT_ID}")
    print("="*80)
    
    encrypted, decrypted, scopes, connected_at = get_acuity_token()
    
    if not encrypted:
        print("❌ No Acuity token found in database")
        return
    
    print(f"\n📋 Token Info:")
    print(f"   Connected at: {connected_at}")
    print(f"   Scopes: {scopes or 'not specified'}")
    print(f"   Token length (encrypted): {len(encrypted)} chars")
    
    if decrypted:
        print(f"   Token length (decrypted): {len(decrypted)} chars")
        print(f"   Decryption: ✅ Success")
        # Test with OAuth token
        test_acuity_api(decrypted, is_oauth=True)
    else:
        print(f"   Decryption: ❌ Failed or no key available")
        print(f"\n   Falling back to basic auth (if available in environment)...")
        test_acuity_api(None, is_oauth=False)
    
    print("\n" + "="*80)
    print("INVESTIGATION COMPLETE")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()

