from datetime import datetime
from typing import Dict, Any


def emit_event(name: str, payload: Dict[str, Any]) -> None:
    event = {
        "name": name,
        "ts": datetime.utcnow().isoformat(),
        "payload": payload,
    }
    # Minimal placeholder: print to stdout; replace with real bus later
    print(f"EVENT {event['ts']} {name}: {payload}")


