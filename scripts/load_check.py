#!/usr/bin/env python3
import time, sys, json
import urllib.request

BASE = "http://localhost:8000"
TENANT = "t1"

def get(path):
    with urllib.request.urlopen(f"{BASE}{path}") as r:
        return json.loads(r.read().decode())

def main():
    start = time.time()
    ok = 0
    for i in range(50):
        get(f"/metrics?tenant_id={TENANT}")
        ok += 1
    dur = time.time() - start
    print(f"50 requests in {dur:.2f}s (avg {dur/50:.3f}s)")
    if dur/50 > 0.3:
        print("WARN: p50 latency above 300ms")
    sys.exit(0)

if __name__ == "__main__":
    main()


