from typing import Dict, Any, List
from fastapi.testclient import TestClient
from src.backend.app.main import app


TENANT_ID = "00000000-0000-0000-0000-000000000001"


def h() -> Dict[str, str]:
    return {
        "X-Tenant-Id": TENANT_ID,
        "X-Role": "owner_admin",
        "X-User-Id": "dev",
    }


def main() -> int:
    # Capture 500s as responses instead of raising exceptions
    client = TestClient(app, raise_server_exceptions=False)
    FORCE_NO_APPROVAL = True

    # Fetch a workflow plan
    plan = client.post("/ai/workflow/plan", json={"tenant_id": TENANT_ID, "name": "book_filling"}, headers=h()).json()
    steps: List[Dict[str, Any]] = plan.get("steps", [])
    print("Plan steps:", steps)

    for step in steps:
        name = step.get("tool")
        requires = bool(step.get("requiresApproval", False))
        print(f"\nExecuting: {name} (require_approval={requires})")
        exec_body = {
            "tenant_id": TENANT_ID,
            "name": name,
            "params": {"tenant_id": TENANT_ID},
            "require_approval": False if FORCE_NO_APPROVAL else requires,
        }
        r = client.post("/ai/tools/execute", json=exec_body, headers=h())
        print("execute →", r.status_code, r.json())
        if (not FORCE_NO_APPROVAL) and requires:
            # Find the pending approval and approve it
            approvals = client.get("/approvals", params={"tenant_id": TENANT_ID}, headers=h()).json()
            pending = next((a for a in approvals if a.get("tool_name") == name and a.get("status") == "pending"), None)
            if not pending:
                print("No pending approval found for", name)
                continue
            aid = pending.get("id")
            ar = client.post("/approvals/action", json={"tenant_id": TENANT_ID, "approval_id": aid, "action": "approve"}, headers=h())
            print("approval →", ar.status_code, ar.json())

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


