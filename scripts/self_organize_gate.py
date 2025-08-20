#!/usr/bin/env python3
from pathlib import Path
import json
import sys


ROOT = Path.cwd()
SYN = ROOT / "synthesis"
PLAN = ROOT / "docs" / "plan" / "plan_card.md"
PROMPTS = ROOT / "docs" / "prompts"


def fail(msg: str) -> None:
    print(msg)
    sys.exit(1)


def main() -> None:
    # 1) Required artifacts exist
    required = [
        SYN / "FTSS.json",
        SYN / "invariants.md",
        SYN / "code_inventory_pass1.json",
        SYN / "code_inventory_pass2.json",
        SYN / "force_review.md",
        SYN / "change_journal.md",
        PLAN,
    ]
    for p in required:
        if not p.exists() or not p.read_text().strip():
            fail(f"Missing or empty artifact: {p}")

    # 2) Force review has two sections present
    fr = (SYN / "force_review.md").read_text()
    if "## Review A" not in fr or "## Review B" not in fr:
        fail("force_review.md missing Review A/B sections")

    # 3) Plan card has at least one Proposed Deltas section
    pc = PLAN.read_text()
    if "## Proposed Deltas @" not in pc:
        fail("plan_card.md missing 'Proposed Deltas @' section")

    # 4) Invariants sanity: presence of STOP/HELP, reminders, fallback
    inv = (SYN / "invariants.md").read_text().lower()
    anchors = ["stop/help", "7d / 3d / 1d / 2h", "fallback"]
    for a in anchors:
        if a.lower() not in inv:
            fail(f"invariants.md missing anchor: {a}")

    # 5) FTSS structure sanity
    ftss = json.loads((SYN / "FTSS.json").read_text())
    if not ftss.get("iterations") or not ftss.get("node13"):
        fail("FTSS.json missing iterations/node13")

    # 6) Golden prompts present with safety keywords
    required_prompts = [
        "BVX_onboard_greeter_v1.md",
        "BVX_lead_nurture_v1.md",
        "BVX_fallback_tone_v1.md",
    ]
    if not PROMPTS.exists():
        fail("Missing docs/prompts directory")
    for fname in required_prompts:
        p = PROMPTS / fname
        if not p.exists():
            fail(f"Missing golden prompt: {p}")
        txt = p.read_text().lower()
        if "stop" not in txt and "help" not in txt and "soonest" not in txt and "anytime" not in txt:
            fail(f"Prompt missing safety/choice language: {p}")

    print("Self-Organize Gate: OK")


if __name__ == "__main__":
    main()


