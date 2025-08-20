from typing import Dict, List
import time


def fetch_inventory_snapshot(tenant_id: str) -> Dict[str, object]:
    now = int(time.time())
    # Scaffolded sample payload; replace with real Shopify API calls
    items: List[Dict[str, object]] = [
        {"sku": "SH-001", "name": "Hydrating Serum 30ml", "stock": 22, "cost": 14.0, "price": 39.0, "provider": "shopify"},
        {"sku": "SH-002", "name": "Vitamin C Brightening", "stock": 5, "cost": 12.0, "price": 34.0, "provider": "shopify"},
    ]
    summary = {"products": 128, "low_stock": 6, "out_of_stock": 2, "top_sku": "SH-001"}
    return {"items": items, "summary": summary, "ts": now}



