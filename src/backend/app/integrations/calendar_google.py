from typing import Dict, List
import time


def fetch_events(tenant_id: str) -> List[Dict[str, object]]:
    now = int(time.time())
    # Scaffolded sample events; replace with Google Calendar API
    return [
        {"id": f"g-{now}", "title": "Google: Client appointment", "start_ts": now + 3600, "provider": "google"},
        {"id": f"g-{now+1}", "title": "Google: Product shoot", "start_ts": now + 7200, "provider": "google"},
    ]



