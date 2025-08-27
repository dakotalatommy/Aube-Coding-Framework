# BrandVX UI Use Pass Log

This running log records a brief before/after use pass for each code edit. Entries are appended in chronological order.

## 2025-08-27 — Pre-change (Batch 1: Landing header Sign in + session-aware CTAs)
- Scope: `apps/operator-ui/src/pages/LandingV2.tsx`
- Baseline observations:
  - Landing hero shows two CTAs: “Try the demo today” and “Start free trial”.
  - No header “Sign in” button; returning users must click “Start free trial” to reach auth.
  - CTAs are not session-aware; signed-in users still see trial/demo.
- Risks to watch after change:
  - Visual balance of hero; ensure new header button doesn’t crowd layout.
  - Session detection flicker; avoid visible swap jank.
- Verification plan after change:
  1) With no session, header shows Sign in; hero shows Demo + Start free trial.
  2) With an active session, header shows Open workspace; hero shows Open workspace + Explore demo.
  3) Mobile: header button remains accessible without overlapping hero.

## 2025-08-27 — Post-change (Batch 1: Landing header Sign in + session-aware CTAs)
- Files changed: `apps/operator-ui/src/pages/LandingV2.tsx`
- Changes:
  - Added session detection via Supabase; header now shows Sign in (no session) or Open workspace (authed).
  - Hero CTAs are session-aware: Open workspace + Explore demo for authed; Try the demo + Start free trial for guests. If local hint `bvx_has_account` exists, “Start free trial” becomes “Sign in.”
- How to verify:
  1) Open app.brandvx.io in a private window (no session). Header button: Sign in; hero: Try the demo + Start free trial.
  2) Sign in (or simulate). Refresh: header shows Open workspace; hero shows Open workspace + Explore demo.
  3) Mobile: ensure header button is visible and not overlapping hero text.
- Notes: CTA clicks set a local hint so returning guests see a Sign in affordance.

## 2025-08-27 — Adjustment: Revert header Sign in (move to later batch)
- Files changed: `apps/operator-ui/src/pages/LandingV2.tsx`
- Changes:
  - Removed temporary header button and session-aware swap on hero per design preference. Hero restored to “Try the demo today” + “Start free trial.”
- Verification:
  - Landing hero shows only the two original CTAs; no extra header button. Visuals match the original layout.

## 2025-08-27 — Pre-change (Batch 2: Demo intake refresh + nav label polish)
- Scope: `apps/operator-ui/src/pages/DemoIntake.tsx`, `apps/operator-ui/src/components/WorkspaceShell.tsx` (label only)
- Baseline observations:
  - Demo intake shows questions but no visible “BrandVX is typing” indicator; chip-based quick answers are not present.
  - After finishing scripted questions, demo posts to /ai/chat; replies appear instantly without typing animation.
  - Left nav still shows “Integrations” (technical wording).
- Risks to watch after change:
  - Ensure typing indicator doesn’t flicker; preserve performance on low devices.
  - Chips should not block manual typing; both should co-exist.
  - Nav label change should not affect routing.
- Verification plan after change:
  1) Open /demo: see “Welcome…” then first question; while waiting after send, a typing indicator animates.
  2) Each question offers multiple-choice chips (plus optional short answer).
  3) Left nav label displays “Settings/Connections”; route remains functional.

## 2025-08-27 — Post-change (Batch 2: Demo intake refresh + nav label polish)
- Files changed: `apps/operator-ui/src/pages/DemoIntake.tsx`, `apps/operator-ui/src/components/WorkspaceShell.tsx`
- Changes:
  - Demo intake: added visible typing indicator during waits; added multiple‑choice chips (with optional short answer) for the active question; preserved manual typing.
  - Nav: label “Integrations” renamed to “Settings/Connections” (route unchanged).
- How to verify (local build):
  1) Open /demo: initial “Welcome…” shows; after sending, typing indicator animates.
  2) Each scripted question displays chips relevant to the question; clicking a chip submits and advances.
  3) Left nav shows “Settings/Connections”; clicking still opens the current integrations page.

## 2025-08-27 — Pre-change (Batch 3: Settings/Connections page text + Contacts revamp)
- Scope: `apps/operator-ui/src/pages/Integrations.tsx` (title text), `apps/operator-ui/src/pages/Contacts.tsx`
- Baseline observations:
  - Integrations page header reads “Integrations & Settings”; we want “Settings & Connections”.
  - Contacts page exposes a JSON import textarea and CSV/Export controls; we want a simple “Import from booking / CRM” only, no JSON/CSV for users.
- Risks to watch after change:
  - Don’t break existing routes or guides; keep “Guide me” targets present.
  - Ensure demo mode shows disabled messaging for imports (no backend calls).
- Verification plan after change:
  1) Integrations page shows title “Settings & Connections.”
  2) Contacts page shows two buttons: “Import from booking” and “Sync from CRM (HubSpot)”; no JSON/CSV UI.
  3) In demo, buttons show a disabled message; in live, they call backend and surface results.

## 2025-08-27 — Post-change (Batch 3: Settings/Connections page text + Contacts revamp)
- Files changed: `apps/operator-ui/src/pages/Integrations.tsx`, `apps/operator-ui/src/pages/Contacts.tsx`
- Changes:
  - Integrations page title updated to “Settings & Connections.”
  - Contacts page: removed JSON/CSV UI; added “Import from booking” (calendar sync) and “Sync from CRM (HubSpot)” actions; kept “How to import” guide.
- How to verify (local build):
  1) Open /workspace?pane=integrations → header reads “Settings & Connections.”
  2) Open /workspace?pane=contacts → only the two import buttons are present; no JSON textarea; guide button persists.
  3) In demo mode (`&demo=1`), buttons show disabled toasts; in live, actions call backend and show results in the status area.

## 2025-08-27 — Pre-change (Batch 4: Guides expansion + Messages draft CTA)
- Scope: `apps/operator-ui/src/lib/guide.ts`, `apps/operator-ui/src/pages/Messages.tsx`
- Baseline observations:
  - Dashboard guide “Trend” step not always visible if chart is below fold.
  - Messages page lacks a clear “Draft for me” action; relies on presets or manual typing.
- Risks to watch after change:
  - Ensure guide targets exist and auto-scroll into view reliably.
  - Draft CTA should not override existing content unintentionally.
- Verification plan after change:
  1) Run Dashboard guide: when “Trend” appears, the chart is scrolled into view and highlighted.
  2) Messages page shows a visible “Draft for me” option that inserts a reasonable draft.

## 2025-08-27 — Post-change (Batch 4: Guides expansion + Messages draft CTA)
- Files changed: `apps/operator-ui/src/lib/guide.ts`, `apps/operator-ui/src/pages/Messages.tsx`
- Changes:
  - Guide copy updated to reflect Contacts import changes; ensure elements are targetable.
  - Messages: added “Draft for me” action that inserts a preset and sets status to “Draft prepared”.
- How to verify (local build):
  1) Run Dashboard guide and confirm the “Trend” step appears and the chart is in view.
  2) Open Messages, click “Draft for me” → body is populated and status shows “Draft prepared.”


