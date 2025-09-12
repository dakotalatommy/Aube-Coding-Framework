## Onboarding Showcase Runbook

Purpose: Single guided sequence to “wow” new users immediately after signup/payment. Covers brandVZN, Contacts import, AskVX finance answers + 14‑day plan, and returns to Dashboard with summary.

Trigger
- After billing success or first login (trialing/active), if `bvx_showcase_done` not set.

Flow (workspace-only panes; deterministic)
1) Dashboard: start guide; highlight KPIs and Quick Start.
2) Integrations (if booking not connected): show providers; optionally connect; return.
3) Dashboard billing CTA: open modal; gate next step until dismissed or subscription covered.
4) brandVZN (Vision): upload/paste, analyze, run edit, refine, download. Latency cue if >2.5s.
5) Contacts: Import from booking (Square/Acuity). On success → auto backfill metrics.
6) AskVX: Auto-send finance prompts (3‑month revenue, top clients with names). Limit clarifiers (0‑2). Summarize; Pin to Dashboard.
7) TrainVX hop: open Train & Profile briefly; return.
8) Dashboard: show “Next Best Steps” and “Last session summary.”

Progress
- Server checkpoints (`/onboarding/complete_step`) on each step; compact status endpoint `/onboarding/progress/status` returns percent.

Billing Gates
- If trialing → show trial modal on login with days left; if expired/not active → show Trial ended modal and soft‑gate actions.
- Webhook lag fallback: on `billing=success` query, poll `/settings` for subscription_status for ~20s before proceeding.

Integrations
- Settings split cards for Square/Acuity; actions: Connect, Import, Refresh. Last sync surfaced; Refresh reanalyzes and attempts reconnect.

AskVX
- Onboarding mode (`onboard=1`) primes context; names allowed (emails/phones masked server-side). Copy/Pin plan available.

Vision (brandVZN)
- DnD/paste, before/after slider, curated prompt chips, sample image, ZIP download fallback.

Contacts
- Import from booking; post-import nudge; optional duplicate preview with Tools: `contacts.dedupe.preview` then `contacts.dedupe`.

Smoke Test (post-deploy)
- Load Dashboard → run 13-step intro → Billing CTA on Dashboard → brandVZN (within /workspace) → Contacts import → AskVX answers with names → Pin to Dashboard. Verify same-tab navigation and no console errors.


