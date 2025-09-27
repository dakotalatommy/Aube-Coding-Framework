# UI V2 Feature Mapping

This matrix aligns every V2 surface with the legacy implementation, identifies what we reuse, what gets replaced, and where backend changes are required.

| Module | Legacy Surface (v1 screenshots) | V2 Destination (catalog reference) | Backend Status | Frontend Work | Backend Work |
| --- | --- | --- | --- | --- | --- |
| Routing & Shell | `WorkspaceShell` with driver.js tours, legacy sidebar | New sidebar + header (Dashboard hero) | Existing auth/session APIs reusable | Implement env flag, new shell layout, notification badge, Supabase auth injection | None |
| Landing / Auth | Legacy login/signup forms | V2 welcome + sign-in (transcript) | Supabase auth endpoints intact | Replace forms with new components, wire Google OAuth button, update copy | None |
| Dashboard KPIs | `Dashboard.tsx` cards (time saved, contacts) | V2 KPI cards + agenda (4.41.xx) | `/admin/kpis`, `/metrics` existing | Build new card components, referral box, agenda progress | Extend `/notifications` for drawer (Gap) |
| Notifications | Legacy To-Do modal (driver.js) | Header badge + drawer (4.41.56) | Partial (cadence queue) | Implement provider to aggregate notifications, integrate with header | Add `/notifications` endpoint combining cadences + calendar reminders |
| AskVX Chat | Legacy AskVX UI | V2 chat & rating (4.42.xx) | Existing chat endpoints | Port chat hooks into new components, add rating capture, suggestions | Add fields for rating/feedback in chat session table |
| BrandVZN / Consultations | Legacy BrandVZN wizard | V2 hero + results (4.42.46 – 4.43.39) | `/ai/onboarding`, `/ai/strategy` existing | Replace wizard UI, integrate file upload, result export | Ensure strategy artifacts saved with new metadata (tags) |
| Messages | Legacy messaging wizard | V2 multi-step send + inbox (4.43.46 – 4.44.12) | `/messages`, `/cadences/queue` existing | Rebuild wizard UI, integrate template cards, analytics | Add `/cadences/stats` for success metrics |
| Follow Ups | Legacy follow-up queue | Agenda tasks + notifications (4.45.xx) | `/followups/draft_batch` existing | Integrate queue data into agenda cards, mark complete flows | Extend job payload to return urgency/priority |
| Clients | Legacy contacts list & detail | V2 list, profile, segment builder (4.44.42 – 4.45.36) | Contacts endpoints existing | Port list/table, new filters, profile tabs | Add segment save API if not present |
| Agenda / Calendar | Legacy calendar page | V2 agenda timeline + sync modals (4.45.43 – 4.46.18) | `/calendar/sync`, `/calendar/events` existing | Build timeline view, week toggle, sync CTA | Provide aggregated stats per provider |
| Fill Your Chair | Not present | New marketing module (4.46.25 – 4.46.46) | Gap | Implement UI with locked overlay pending backend | Define roadmap for marketing endpoints |
| Grow with VX | Not present | Advanced automation module (4.47.14 – 4.47.20) | Gap | Show locked state unless plan supports | Plan future backend work |
| Tutorials | Minimal help overlay | Tutorials hub (4.47.27 – 4.47.34) | Supabase storage (videos) optional | Render lesson list, progress tracking | Add `/tutorials` API & progress persistence |
| Inventory | Legacy inventory summary | V2 cards & table (4.47.40 – 4.48.02) | `/inventory/*` existing | Replace tables, reorder modal | Might add reorder endpoint |
| Integrations | Legacy toggle list | V2 integrations KPIs (4.48.08 – 4.48.31) | Basic status endpoints | Build cards, manage connection modals | Add booking metrics summarizers |
| Settings | Legacy modals & driver.js toggles | V2 tabbed settings (4.48.43 – 4.49.12) | `/settings`, `/billing` existing | Implement form sections, plan cards, goal forms | Extend `/settings` schema for goals, tour toggles |

## Roadmap Phases

1. **Tooling & Flag Setup**
   - Upgrade React 19, align dependencies.
   - Add `VITE_UI_VARIANT` gate with runtime override support.
   - Migrate Figma assets into `src/assets`.

2. **Shell & Auth Parity**
   - Integrate new navigation, header, notifications, splash.
   - Replace login/signup with new UI.
   - Remove driver.js and legacy onboarding modals.

3. **Core Feature Parity**
   - Dashboard, AskVX/BrandVZN, Messages, Clients, Agenda, Inventory, Integrations, Settings.
   - Ensure all existing backend data flows render correctly.

4. **New Feature Enablement**
   - Fill Your Chair, Grow with VX, Tutorials (locked or MVP feature set).
   - Notifications endpoint + metrics gaps filled.

5. **QA & Rollout**
   - Playwright coverage updated for new flows.
   - Side-by-side testing with env flag before flipping default.

## Backend Enhancements Checklist

- [ ] `/notifications` aggregation endpoint.
- [ ] Chat satisfaction fields (`rating`, `helpful`) + API update.
- [ ] Cadence stats endpoint for messaging analytics.
- [ ] Integration summaries (Square, Acuity bookings metrics).
- [ ] Settings schema update for goals & tour toggles.
- [ ] Tutorials list/progress endpoint.
- [ ] (Optional) Reorder request endpoint for inventory items.

Update this file as backend work is scoped or completed.

