from typing import Dict, List
import time


def fetch_events(tenant_id: str) -> List[Dict[str, object]]:
    now = int(time.time())
    # Scaffolded sample events; replace with Apple CalDAV/ICS ingestion
    return [
        {"id": f"a-{now}", "title": "Apple: Personal block", "start_ts": now + 5400, "provider": "apple"},
    ]



