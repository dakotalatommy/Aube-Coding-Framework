from typing import Dict, List
import time


def fetch_inventory_snapshot(tenant_id: str) -> Dict[str, object]:
    now = int(time.time())
    # Scaffolded sample payload; replace with real Square Catalog/Inventory API calls
    items: List[Dict[str, object]] = [
        {"sku": "SQ-010", "name": "Nourish Conditioner 250ml", "stock": 9, "cost": 7.5, "price": 19.0, "provider": "square"},
        {"sku": "SQ-011", "name": "Balance Shampoo 250ml", "stock": 0, "cost": 6.5, "price": 18.0, "provider": "square"},
    ]
    summary = {"products": 96, "low_stock": 4, "out_of_stock": 1, "top_sku": "SQ-010"}
    return {"items": items, "summary": summary, "ts": now}



