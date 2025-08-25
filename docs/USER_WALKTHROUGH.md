# BrandVX — End‑to‑End Walkthrough (Staging)

## 0) Start
- Visit `/brandvx` and click “Try the demo today”.
- If you land on `/demo`, use “Start guided walkthrough”; otherwise ensure you’re at `/workspace?pane=dashboard&demo=1`.

## 1) Demo gate + AskVX
- The centered AskVX asks a few brand questions; answer or click “Skip”.
- Use contextual CTAs in AskVX to open panes (Integrations, Inventory, Messages, Contacts, Calendar, Approvals, Workflows).

## 2) Guided tours
- Dashboard: click “Guide me” (or add `&tour=1` to URL).
- Full demo: click “Run full demo tour” (or add `&tour=all`).
- Tours respect “seen” state and won’t auto‑reopen on refresh.

## 3) Create account
- Persistent “Create your BrandVX” CTA opens `/signup`.
- Sign up via email/Google/Apple. After confirmation, you’ll be routed to `/onboarding?offer=1` with a plan offer modal.

## 4) Offer modal (optional)
- Choose Lifetime $97 (one‑time) or 7‑day free trial → $147/mo, or skip for now.
- Billing page supports both subscription and lifetime (one‑time) checkout.

## 5) Onboarding (5 quick steps)
- Steps: Connect tools → Vibe & services → Preview → Timing → Go live.
- Click “Guide me” for an overlay tour.
- “Skip for now” routes to `/workspace?pane=dashboard&tour=1`.

## 6) Integrations
- Open `/workspace?pane=integrations`.
- Connect: Square/Acuity/Google/HubSpot/Shopify/Twilio. FB/IG hidden unless `VITE_FEATURE_SOCIAL=1`.
- Use “Re‑analyze” to refresh status; deep‑links and retries are in place.

## 7) Core panes
- Messages: simulate or send (demo‑safe). Consent and quiet hours upheld.
- Contacts: import/export; dedupe and data requests.
- Calendar: unified view; Apple toggle hides if not configured.
- Inventory: low‑stock highlight; threshold defaults to 5.
- Approvals: review “pending” and approve/reject; bulk actions available.

## 8) Workflows (48‑hour impact)
- Run: Dedupe, Low‑stock, Social 14‑day draft, Warm 5, Reminders.
- AskVX can run plans; completion is tracked in dashboard’s 5‑workflow tracker.

## 9) Dashboard
- KPIs + funnel + cadence queue.
- “Quick Start · 5 workflows” tracker reflects progress (`wf_progress`).

## 10) Admin
- `/admin`: KPIs, recompute marts, Creator Mode, Health, Clear Tenant Cache.

## Notes
- Demo mode: tenant discovery via `/me` headers; AskVX embedded CTAs navigate the parent window.
- Caching/Rate limiting backed by Redis when `REDIS_URL` is set; safe fallbacks otherwise.


