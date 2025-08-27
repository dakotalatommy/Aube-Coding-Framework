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


