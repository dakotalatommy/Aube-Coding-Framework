# UI V2 API Audit Prep

Use this as the agenda for the upcoming contract review. Each row references the catalogue and feature map entries.

| Area | Required Data | Existing Endpoint | Gap / Questions |
| --- | --- | --- | --- |
| Dashboard KPIs | Monthly revenue, active clients, retention, ROI deltas | `/admin/kpis`, `/metrics`, `/funnel/daily` | Confirm KPIs contain all four metrics; if not, extend aggregator. |
| Agenda progress | Task list with priority, due time, completion state | `/cadences/queue`, `/followups/draft_batch` | Need consolidated feed with urgency flags and completion acknowledgement. |
| Notifications drawer | Same as agenda plus calendar reminders | *None* | Design new `/notifications` (tenant-scoped, grouped by type) returning unread counts. |
| AskVX ratings | thumbs up/down, suggestion list | `/ai/chat/raw` | Add rating fields to response + POST route to persist. |
| AskVX suggestions | Prefill buttons per persona | Static config | Confirm we can hardcode suggestions; no API needed unless dynamic. |
| BrandVZN assets | Before/after uploads, consultation prompts, export URLs | `/ai/brandvzn`, `/ai/onboarding`, Supabase storage | Validate storage bucket path + metadata for new cards. |
| Messaging analytics | Segment performance, send results, reply rates | `/messages`, `/cadences/queue` | Need aggregated stats endpoint for charts. |
| Segment builder | Saved segments, filter definitions | `/contacts/segments`? | Verify such endpoint exists; if not, plan create/update/delete routes. |
| Client profile | Lifetime value, visit cadence, notes | `/contacts/{id}`, `/appointments`, `/messages` | Ensure endpoints support combined data, or create summary endpoint. |
| Inventory KPIs | Stock value, reorder alerts, turnover | `/inventory/metrics`, `/inventory/items` | Check metrics payload includes thresholds; add reorder POST if required. |
| Integrations KPIs | Square POS revenue, Acuity bookings | `/integrations/status` | Build new `GET /integrations/{provider}/summary` with stats (bookings rate, last sync). |
| Fill Your Chair / Grow with VX | Marketing automations, funnel stats | *None* | Decide: locked overlay vs MVP endpoints. |
| Tutorials progress | Lesson list, completion percentage | *None* | Plan `/tutorials` list + `/tutorials/progress` endpoints. |
| Settings goals | Client/revenue/time goals storage | `/settings` | Extend schema to include goal fields; ensure RLS permitted. |
| Settings tours | Welcome tour toggle + progress | `/settings`, `/onboarding/progress` | Provide aggregated completion status for display. |
| Billing plan cards | Current plan, upgrade URLs, invoice history | `/billing/status`, `/billing/history`, `/billing/create-checkout-session` | Confirm endpoints expose needed trial days & price IDs. |

## Pre-Audit Checklist

- [ ] Review `docs/ui-v2-catalog.md` and `docs/ui-v2-feature-map.md` in advance.
- [ ] Gather sample payloads from legacy UI (Postman collection).
- [ ] Enumerate required Supabase schema changes (settings, chat sessions, jobs).
- [ ] Identify owner for each backend change (analytics, integrations, messaging).

## Desired Outcomes

1. Finalize the list of backend gaps with estimates.
2. Decide on MVP behaviour for new modules (Fill Your Chair, Grow with VX, Tutorials).
3. Approve the notifications aggregation design.
4. Confirm data contracts for Square & Acuity summaries.

