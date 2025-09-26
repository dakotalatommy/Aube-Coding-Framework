from typing import Dict, List

# Canonical contexts manifest: per-context preamble + tool allowlist (non-admin)

CONTEXTS: List[Dict[str, object]] = [
    {
        "id": "support",
        "preamble": (
            "Support mode. Answer-first in 2–4 sentences, point to exact UI locations (page → section → control), avoid jargon. "
            "If the user expresses confusion (e.g., 'i'm confused', 'i dont understand', 'not sure what to do'), orient them with the next two steps and the exact place to click."
        ),
        "tools": [
            "link.hubspot.signup", "oauth.hubspot.connect", "crm.hubspot.import",
            "db.query.named", "db.query.sql", "report.generate.csv",
        ],
    },
    {
        "id": "analysis",
        "preamble": "Analysis mode. Use read-only data; return direct lists or single-line facts. No assumptions.",
        "tools": [
            "db.query.named", "db.query.sql", "report.generate.csv", "contacts.list.top_ltv", "campaigns.dormant.preview",
        ],
    },
    {
        "id": "messaging",
        "preamble": "Messaging mode. Draft consent-first, brand-aligned copy; prefer short, actionable outputs.",
        "tools": [
            "draft_message", "messages.send", "appointments.schedule_reminders",
            "campaigns.dormant.preview", "campaigns.dormant.start", "propose_next_cadence_step", "safety_check", "pii.audit",
        ],
    },
    {
        "id": "scheduler",
        "preamble": "Scheduling mode. Offer concrete times, avoid overbooking, and reconcile external calendars.",
        "tools": [
            "calendar.sync", "calendar.merge", "calendar.reschedule", "calendar.cancel", "oauth.refresh",
        ],
    },
    {
        "id": "train",
        "preamble": "Train_VX mode. Refine tone, brand profile, and goals. Keep edits short, concrete, and save-ready.",
        "tools": [
            "safety_check", "pii.audit", "memories.remember", "report.generate.csv",
        ],
    },
    {
        "id": "todo",
        "preamble": "To-Do mode. Create concise, actionable tasks; avoid duplicates; summarize impact in one line.",
        "tools": [
            "todo.enqueue", "report.generate.csv",
        ],
    },
]


def contexts_schema() -> Dict[str, object]:
    return {"version": "v1", "contexts": CONTEXTS}


def context_allowlist(mode: str) -> List[str]:
    m = (mode or "").strip().lower()
    for c in CONTEXTS:
        if c["id"] == m:
            return list(c.get("tools", []))  # type: ignore
    return []
