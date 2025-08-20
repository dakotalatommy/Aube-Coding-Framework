#!/usr/bin/env python3
"""
BrandVX Bootstrap Orchestrator (H→L)

Sequence (idempotent):
1) Load boot index; dedupe referenced docs; write boot_manifest.json
2) UFIS micro-sim (12 lenses) + Node 13 synthesis → FTSS.json
3) Read UX LAW → extract invariants → invariants.md
4) Code scan pass #1 → code_inventory_pass1.json
5) Ingest recent prompt (optional)
6) Code scan pass #2 (drift/opps) → code_inventory_pass2.json
7) Propose plan deltas → append to docs/plan/plan_card.md
8) Force Review A + B → synthesis/force_review.md (gate)
9) Implement elsewhere → append synthesis/change_journal.md manually; future edits must re-read it

Stdlib only; safe to run locally. Assumes repo root CWD.
"""
import os
import re
import json
import hashlib
import datetime
import argparse
from pathlib import Path


ROOT = Path.cwd()
SYN = ROOT / "synthesis"
DOCS = ROOT / "docs"
PLAN_DIR = DOCS / "plan"
APP_SRC = ROOT / "src" / "backend" / "app"
UX_PATH = ROOT / "GitHub Repo Docs" / "User Experience.md"
BOOT_INDEX = ROOT / "Bootstrap Prompt.md"


SYN.mkdir(exist_ok=True)
PLAN_DIR.mkdir(parents=True, exist_ok=True)
DOCS.mkdir(exist_ok=True)


def now_iso() -> str:
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def file_sha(p: Path) -> str:
    try:
        return hashlib.sha256(p.read_bytes()).hexdigest()[:12]
    except Exception:
        return "NA"


def discover_docs_from_boot() -> list[dict]:
    items: list[dict] = []
    if BOOT_INDEX.exists():
        txt = BOOT_INDEX.read_text(encoding="utf-8", errors="ignore")
        paths = re.findall(r"`([^`]+)`", txt)
        seen: set[str] = set()
        for rel in paths:
            p = ROOT / rel.strip().lstrip("/")
            if p.exists() and p.is_file():
                k = str(p)
                if k in seen:
                    continue
                seen.add(k)
                items.append({
                    "path": str(p.relative_to(ROOT)),
                    "sha": file_sha(p),
                    "size": p.stat().st_size,
                })
    # ensure UX LAW is included
    if UX_PATH.exists():
        items.append({
            "path": str(UX_PATH.relative_to(ROOT)),
            "sha": file_sha(UX_PATH),
            "size": UX_PATH.stat().st_size,
        })
    return items


def write_boot_manifest(extra_ctx: dict) -> Path:
    manifest = {
        "ts": now_iso(),
        "git": {"sha": os.getenv("GIT_COMMIT", "")},
        "env": {
            "PYTHON": os.getenv("PYTHON_VERSION", ""),
            "OPENAI_MODEL": os.getenv("OPENAI_MODEL", ""),
        },
        "docs": discover_docs_from_boot(),
        **extra_ctx,
    }
    out = SYN / "boot_manifest.json"
    out.write_text(json.dumps(manifest, indent=2))
    return out


UFIS_LENSES = [
    "FCI",
    "DPR",
    "CBS",
    "ESQ",
    "ENS",
    "TSC",
    "PTL",
    "RMI",
    "CAF",
    "NFG",
    "PIC",
    "CAD",
]


def ufis_micro_sim() -> dict:
    sims: dict[str, dict] = {}
    for d in UFIS_LENSES:
        sims[d] = {
            "dimension": d,
            "horizon_years": 10,
            "notes": (
                f"Micro-sim placeholder for {d}: uphold H→L constraints, consent, "
                "idempotency, rate limits, and UX LAW."
            ),
        }
    node13 = {
        "id": "SOVEREIGN_13",
        "role": "atemporal_synthesis",
        "insight": (
            "Treat MD/YAML as contracts → schemas+IDs; enforce evals; add adapters; "
            "avoid repo churn."
        ),
        "invariants": [
            "Consent/STOP/HELP honored globally",
            "One attempt per cadence step; rate-limits active",
            "Quiet-hours respected per tenant",
            "Idempotency + verified webhooks",
            "H owns canonical state; L supplies rules/templates",
        ],
    }
    return {"iterations": sims, "node13": node13, "ts": now_iso(), "version": "1.0"}


def extract_invariants_from_ux(ux_text: str) -> list[str]:
    keep: list[str] = []
    patt = [
        r"STOP/HELP",
        r"One attempt per step",
        r"Reminders.*7d.*3d.*1d.*2h",
        r"Soonest vs Anytime",
        r"Time Saved.*milestones",
        r"Ambassador Candidate",
        r"Cadence Queue",
        r"Email fallback|fallback",
    ]
    for line in ux_text.splitlines():
        for rx in patt:
            if re.search(rx, line, flags=re.IGNORECASE):
                keep.append(line.strip())
                break
    anchors = [
        "STOP/HELP always works; suppression immediate; evidence auditable.",
        "One attempt per cadence step; reply re-routes state; apply rate limits.",
        "Booking reminders: 7d / 3d / 1d / 2h schedule.",
        "Ask and store Soonest vs Anytime; notify-list triggers on cancellation.",
        "Time Saved = baseline - automation; milestones 10h/25h/50h/100h.",
        "Ambassador Candidate when revenue uplift + usage + referrals thresholds hit.",
        "Maintain accurate Cadence Queue and Dashboard KPIs.",
        "If SMS fails, email fallback (when consented); strict webhook signature verification.",
    ]
    for a in anchors:
        if a not in keep:
            keep.append(a)
    return keep


def write_invariants_md(lines: list[str]) -> Path:
    out = SYN / "invariants.md"
    header = [
        "# BrandVX Invariants (extracted from UX LAW)",
        f"- Generated: {now_iso()}",
        "",
        "These rules are hard constraints for planning and code changes.",
    ]
    body = ["- " + l for l in lines]
    out.write_text("\n".join(header + [""] + body) + "\n")
    return out


def scan_endpoints(py: Path) -> list[dict]:
    items: list[dict] = []
    if not py.exists():
        return items
    for i, line in enumerate(py.read_text(encoding="utf-8", errors="ignore").splitlines(), start=1):
        m = re.match(r"\s*@app\.(get|post|put|delete)\(\"([^\"]+)\"", line)
        if m:
            items.append({"method": m.group(1).upper(), "path": m.group(2), "line": i})
    return items


def code_scan() -> dict:
    inv: dict[str, object] = {}
    endpoints: list[dict] = []
    models: list[str] = []
    if APP_SRC.exists():
        endpoints = scan_endpoints(APP_SRC / "main.py")
        models_py = APP_SRC / "models.py"
        if models_py.exists():
            for line in models_py.read_text(encoding="utf-8", errors="ignore").splitlines():
                cm = re.match(r"\s*class\s+([A-Za-z0-9_]+)\(Base\):", line)
                if cm:
                    models.append(cm.group(1))
    inv["endpoints"] = endpoints
    inv["models"] = models
    return inv


def write_inventory(inv: dict, suffix: str) -> Path:
    out = SYN / f"code_inventory{suffix}.json"
    out.write_text(json.dumps({"ts": now_iso(), **inv}, indent=2))
    return out


def propose_plan_deltas(inv: dict, invariants: list[str]) -> dict:
    return {
        "summary": (
            "Add canonical H tables (appointments, messages), strict webhook verify, "
            "SMS→email fallback, reminder scheduler, events ledger+marts."
        ),
        "acceptance_refs": ["AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"],
        "gaps": [],
    }


def ensure_template(path: Path, content: str) -> None:
    if not path.exists() or not path.read_text().strip():
        path.write_text(content)


def seed_templates() -> None:
    ensure_template(
        PLAN_DIR / "plan_card.md",
        """# Plan Card (H→L, UFIS‑backed)
version: v1
date: 
goal: Align to UX LAW with minimal deltas; no invariant violations.

## Modules & Interfaces
- H tables: appointments, messages
- Reminder scheduler (7d/3d/1d/2h); quiet-hours per tenant
- Provider layer: Twilio+SendGrid with strict signatures, SMS→email fallback
- Events ledger + marts: funnel_daily, time_saved_rollup
- Settings DTO: tone/services; Share milestones

## API Contracts
- POST /settings (persist tone/services)
- GET /cadences/queue, GET /buckets/distribution (existing)
- POST /notify-list/trigger-cancellation (existing)
- Webhooks: /webhooks/twilio, /webhooks/sendgrid (strict verify)

## Data Model
- appointments(id, tenant_id, contact_id, start_ts, end_ts, status, external_ref)
- messages(id, tenant_id, contact_id, channel, direction, template_id?, status, metadata, ts)

## Acceptance Tests (refs)
- See BRANDVX_ACCEPTANCE_TESTS.md §3, §4, §5

## Risks & Mitigations
- Deliverability: strict signatures, fallback
- Drift: invariants.md gating, double force-review
""",
    )
    ensure_template(
        SYN / "force_review.md",
        f"""# Force Review Ledger
Initialized: {now_iso()}

## Review A
status: pending
notes: 

## Review B
status: pending
notes: 
""",
    )
    ensure_template(
        SYN / "change_journal.md",
        f"""# Change Journal (append-only)
Initialized: {now_iso()}

- Append a short entry per major change: date, files, rationale, invariants checked, reviewer initials.
""",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--recent-prompt", help="Optional path to latest prompt to ingest", default=None
    )
    args = parser.parse_args()

    seed_templates()

    manifest = write_boot_manifest({"note": "Bootstrap Orchestrator v1"})
    ufis = ufis_micro_sim()
    (SYN / "FTSS.json").write_text(json.dumps(ufis, indent=2))

    ux_txt = UX_PATH.read_text(encoding="utf-8", errors="ignore") if UX_PATH.exists() else ""
    invariants = extract_invariants_from_ux(ux_txt)
    inv_path = write_invariants_md(invariants)

    inv1 = code_scan()
    write_inventory(inv1, "_pass1")

    # Optional prompt ingestion for trace only
    if args.recent_prompt:
        try:
            prompt_text = Path(args.recent_prompt).read_text(encoding="utf-8", errors="ignore")
            (SYN / "recent_prompt.txt").write_text(prompt_text)
        except Exception:
            pass

    inv2 = code_scan()
    write_inventory(inv2, "_pass2")

    plan = propose_plan_deltas(inv2, invariants)
    plan_card = PLAN_DIR / "plan_card.md"
    with plan_card.open("a", encoding="utf-8") as f:
        f.write(f"\n\n## Proposed Deltas @ {now_iso()}\n")
        f.write(json.dumps(plan, indent=2))
        f.write("\n")

    print("Bootstrap complete.")
    print(f"- Manifest: {manifest}")
    print(f"- FTSS: {SYN/'FTSS.json'}")
    print(f"- Invariants: {inv_path}")
    print(f"- Inventory pass1: {SYN/'code_inventory_pass1.json'}")
    print(f"- Inventory pass2: {SYN/'code_inventory_pass2.json'}")
    print(f"- Plan card: {plan_card}")
    print(f"- Force review: {SYN/'force_review.md'}")
    print(f"- Change journal: {SYN/'change_journal.md'}")


if __name__ == "__main__":
    main()


