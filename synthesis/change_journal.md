# Change Journal (append-only)
Initialized: 2025-08-15T05:23:24Z

- Append a short entry per major change: date, files, rationale, invariants checked, reviewer initials.

- 2025-08-16: Backend OAuth scaffolding and onboarding analysis endpoint.
  - Files: `src/backend/app/main.py`
  - Added: GET `/oauth/{provider}/login`, GET `/oauth/{provider}/callback`, POST `/onboarding/analyze` with env-driven placeholders for google, square, acuity, hubspot, facebook, instagram. Redirect flows back to `/onboarding`.
  - Rationale: Scaffold real integrations requested; wire onboarding step 2 to real endpoints.
  - Invariants: Consent-first UX law preserved (no auto actions; explicit user flows). Security: no service role keys in browser.
  - Initials: VX

- 2025-08-16: Frontend UI polish primitives and onboarding wiring.
  - Files: `apps/operator-ui/src/App.tsx`, `src/pages/Onboarding.tsx`, `src/components/ui/Toast.tsx`, `src/hooks/useLenis.ts`, `src/components/Nav.tsx`, `src/pages/Dashboard.tsx`, `src/components/CommandPalette.tsx`
  - Added: Global Toast/Tooltip providers, Lenis smooth scrolling, Command Palette (Cmd/Ctrl+K), tooltips on nav and dashboard cells; onboarding “Connect” buttons and analysis feedback toast.
  - Rationale: Elevate UX feel, micro-interactions, and onboarding clarity toward professional standard.
  - Invariants: Accessibility (tooltips, focus, skip-to-content), consent copy intact.
  - Initials: VX
