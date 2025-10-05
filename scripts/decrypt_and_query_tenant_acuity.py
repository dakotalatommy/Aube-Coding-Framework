#!/usr/bin/env python3
"""
Decrypt tenant's Acuity OAuth token and query their account
"""
import os
import base64
import hashlib
import httpx
from nacl import secret as nacl_secret

TENANT_ID = "c02177e3-ed55-4a55-995d-bc4aebece594"
ENCRYPTED_TOKEN = "2RsRWBvnxn+6JE3p/EaICQUzY0twAa5yd31y8rklCjIPT7WZGXJ9P2/vQ5H6n8nV01ZTVSZHVhMADyqSCIxoKHWTL40/1vXeK3pSwwyleRE="

def derive_key(secret_key: str) -> bytes:
    """Derive a 32-byte key via SHA-256"""
    return hashlib.sha256(secret_key.encode("utf-8")).digest()

def decrypt_token(enc_b64: str, secret_key: str) -> str:
    """Decrypt the OAuth token using NaCl SecretBox"""
    try:
        raw = base64.b64decode(enc_b64)
        key = derive_key(secret_key)
        box = nacl_secret.SecretBox(key)
        plaintext = box.decrypt(raw)
        return plaintext.decode("utf-8")
    except Exception as e:
        print(f"❌ Decryption failed: {e}")
        return None

def query_acuity_account(oauth_token: str):
    """Query the Acuity API using the OAuth Bearer token"""
    
    base = "https://acuityscheduling.com/api/v1"
    headers = {
        "Authorization": f"Bearer {oauth_token}",
        "Accept": "application/json"
    }
    
    print("\n" + "="*80)
    print(f"QUERYING TENANT'S ACUITY ACCOUNT")
    print(f"Tenant: {TENANT_ID}")
    print("="*80)
    
    with httpx.Client(timeout=30, headers=headers) as client:
        
        # Get account info
        print("\n📋 Account Information...")
        try:
            r = client.get(f"{base}/me")
            if r.status_code == 200:
                data = r.json()
                print(f"✅ Business: {data.get('name', 'Unknown')}")
                print(f"   Email: {data.get('email', 'N/A')}")
                print(f"   Timezone: {data.get('timezone', 'N/A')}")
            else:
                print(f"❌ Status {r.status_code}: {r.text[:300]}")
                return
        except Exception as e:
            print(f"❌ Error: {e}")
            return
        
        # Count clients
        print("\n👥 Counting Clients...")
        try:
            total_clients = 0
            offset = 0
            limit = 300
            max_pages = 20
            
            for page in range(max_pages):
                r = client.get(f"{base}/clients", params={"limit": limit, "offset": offset})
                if r.status_code != 200:
                    print(f"   ❌ Error at offset {offset}: {r.status_code}")
                    break
                
                clients = r.json()
                if not clients:
                    break
                
                batch_size = len(clients)
                total_clients += batch_size
                print(f"   Page {page+1}: Found {batch_size} clients (total: {total_clients})")
                
                if batch_size < limit:
                    break
                
                offset += limit
            
            print(f"\n✅ Total clients: {total_clients}")
            
            # Show sample
            if total_clients > 0:
                print(f"\n📝 Sample clients (first 10):")
                r = client.get(f"{base}/clients", params={"limit": 10, "offset": 0})
                if r.status_code == 200:
                    for i, c in enumerate(r.json()[:10], 1):
                        first = c.get('firstName', '')
                        last = c.get('lastName', '')
                        email = c.get('email', 'no email')
                        cid = c.get('id', 'no id')
                        print(f"   {i}. {first} {last} ({email}) [ID: {cid}]")
        
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # Count appointments
        print("\n📅 Counting Appointments...")
        try:
            total_appts = 0
            offset = 0
            limit = 300
            max_pages = 20
            
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
                print(f"   Page {page+1}: Found {batch_size} appointments (total: {total_appts})")
                
                if batch_size < limit:
                    break
                
                offset += limit
            
            print(f"\n✅ Total appointments: {total_appts}")
        
        except Exception as e:
            print(f"❌ Error: {e}")

def main():
    secret_key = os.getenv("SECRET_KEY", "")
    
    if not secret_key:
        print("❌ SECRET_KEY environment variable not set!")
        print("\n   Please provide the SECRET_KEY from your Render backend.")
        print("   Usage: SECRET_KEY='your_key_here' python3 script.py")
        return
    
    print(f"🔑 Using SECRET_KEY: {secret_key[:10]}..." if len(secret_key) > 10 else f"🔑 Using SECRET_KEY: {secret_key}")
    print(f"📦 Encrypted token: {ENCRYPTED_TOKEN[:50]}...")
    
    print("\n🔓 Decrypting token...")
    oauth_token = decrypt_token(ENCRYPTED_TOKEN, secret_key)
    
    if not oauth_token:
        print("❌ Failed to decrypt token")
        print("\n   Possible reasons:")
        print("   - Wrong SECRET_KEY")
        print("   - Token was encrypted with a different key")
        print("   - Token format has changed")
        return
    
    print(f"✅ Token decrypted successfully!")
    print(f"   Token length: {len(oauth_token)} characters")
    print(f"   Token preview: {oauth_token[:20]}...")
    
    # Query Acuity with the decrypted token
    query_acuity_account(oauth_token)
    
    print("\n" + "="*80)
    print("COMPLETE")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()

