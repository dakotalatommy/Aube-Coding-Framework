# BrandVX UI V2 Screenshot Catalogue

This catalogue maps every screenshot in `v2 screenshots/` and `v1 screenshots/` to the corresponding screen, feature expectations, and backend data requirements. Use it alongside the transcript and `brandvx-system-guide.md` when wiring the new interface.

> Legend
> - **Existing API**: uses an endpoint already implemented in the legacy workspace.
> - **Gap**: requires new backend data or endpoint changes.
> - **UI Notes**: styling, copy, or UX behaviour called out in the transcript.

## Dashboard Family (`v2 screenshots`)

| Screen | Screenshot(s) | Data dependencies | UI Notes |
| --- | --- | --- | --- |
| Dashboard hero + KPI cards | 4.41.13 PM, 4.41.25 PM, 4.41.32 PM | `/admin/kpis`, `/metrics`, `/referrals/qr`, `/calendar/events` | Replace legacy KPI presentation with cards for Monthly Revenue, Active Clients, Retention, ROI. Referral share box uses existing QR endpoint but new copy. Agenda list mirrors legacy "Today's Agenda" content; progress meter 0/3 ties to agenda completion. |
| Agenda task modal states | 4.41.39 PM, 4.41.45 PM | `/cadences/queue`, `/followups/draft_batch`, `/notifications` (Gap) | Agenda expand views show task details, complete buttons, urgency chips. Need notification feed to drive counts. |
| Notification drawer | 4.41.56 PM | `/notifications` (Gap) pulling from cadence jobs + calendar alerts | Transcript: replace legacy driver.js notifications; new drawer lists urgent tasks with priority tags, CTA "View Full Agenda". |
| Dashboard stats + quick actions | 4.42.03 PM, 4.42.10 PM | `/admin/kpis`, `/ai/strategy`, `/integrations/status` | Quick action cards (AskVX, agenda, referrals) replace V1 quick-start boxes. |

## AskVX & BrandVZN (`v2 screenshots`)

| Screen | Screenshot(s) | Data dependencies | UI Notes |
| --- | --- | --- | --- |
| AskVX home | 4.42.19 PM, 4.42.25 PM | `/ai/chat/raw`, `/ai/chat/session/new`, `/trainvx/memories`, Posthog events | Transcript: no legacy modals; adopt v2 prompt buttons, sample suggestions, thumbs up/down. Resource cards for onboarding + tutorials. |
| AskVX conversation | 4.42.32 PM, 4.42.39 PM | existing chat endpoints; rating capture (Gap) | Shows typing indicator, quick replies, timeline slider (Moment snapshots). Need to persist satisfaction rating & flagged suggestions. |
| BrandVZN consultation | 4.42.46 PM, 4.42.52 PM, 4.42.59 PM | `/ai/brandvzn/*`, `/ai/onboarding/plan`, Supabase storage | Includes before/after photo upload, prompt builder, plan CTA. Transcript: rename copy to “customizable consultations”. |
| Consultation results | 4.43.10 PM, 4.43.39 PM | Strategy doc endpoints, Supabase storage for exports | Multi-section summary, download buttons, share toggles. Requires aggregated metrics and ability to save new consultation as artifact. |

## Messages & Follow Ups (`v2 screenshots`)

| Screen | Screenshot(s) | Data dependencies | UI Notes |
| --- | --- | --- | --- |
| Messages workspace dashboard | 4.43.46 PM, 4.43.53 PM, 4.43.59 PM | `/messages`, `/cadences/queue`, `/followups/draft_batch`, `/contacts`, `/templates` | Multi-step send wizard with success metrics. Remove mock Twilio config—use existing integrations flags. |
| Conversation view | 4.44.06 PM, 4.44.12 PM | `/messages/{conversation}`, `/contacts/{id}` | Left nav pinned chats, message timeline, quick templates. Ensure statuses (sent/delivered) map to DB. |
| Bulk scheduling & analytics | 4.44.25 PM, 4.44.32 PM | `/cadences/drafts`, `/cadences/stats` (Gap) | Calendar heatmap, segment insights; new charts require aggregated message stats (success, reply rate). |

## Contacts & CRM (`v2 screenshots`)

| Screen | Screenshot(s) | Data dependencies | UI Notes |
| --- | --- | --- | --- |
| Clients list view | 4.44.42 PM, 4.44.48 PM | `/contacts`, `/contacts/stats`, `/onboarding/progress` | Columns for lifetime value, visit streak, tags. Filters chips pinned at top. |
| Client profile | 4.44.55 PM, 4.45.23 PM | `/contacts/{id}`, `/appointments`, `/cadence/history`, `/trainvx/memories` | Tabs for Overview, Services, Notes, Automations. Need note editor and timeline to map to existing endpoints. |
| Segment builder | 4.45.30 PM, 4.45.36 PM | `/contacts/segments`, `/cadence/templates` | Drag-and-drop filter builder; output used in messaging wizard. |

## Agenda & Calendar (`v2 screenshots`)

| Screen | Screenshot(s) | Data dependencies | UI Notes |
| --- | --- | --- | --- |
| Agenda timeline | 4.45.43 PM, 4.45.50 PM | `/calendar/events`, `/jobs/{id}` | Day/Week toggle, insights bar. Buttons to sync now (Square/Acuity). |
| Task completion flow | 4.45.58 PM, 4.46.05 PM | `/notifications`, `/cadences/queue` | Completion modals feed progress bar. |
| Calendar sync modal | 4.46.12 PM, 4.46.18 PM | `/calendar/sync`, `/integrations/calendar/status` | Manage connected providers; match statuses to transcripts. |

## Fill Your Chair / Grow with VX / Tutorials (`v2 screenshots`)

| Screen | Screenshot(s) | Data dependencies | UI Notes |
| --- | --- | --- | --- |
| Fill Your Chair landing | 4.46.25 PM, 4.46.31 PM | new marketing automation endpoints (Gap) | Provides funnel analytics, landing page builder prompts. Will gate behind plan tier (Pro/Premium). |
| Campaign builder | 4.46.39 PM, 4.46.46 PM, 4.47.07 PM | `/campaigns/templates`, `/campaigns/create` (Gap) | Multi-step wizard for lead capture. If backend not ready, hide or display locked overlay. |
| Grow with VX dashboard | 4.47.14 PM, 4.47.20 PM | Growth metrics (Gap), `/ai/tools/execute` | Offers advanced automation + strategy. Locked for trial/Essentials. |
| Tutorials hub | 4.47.27 PM, 4.47.34 PM | `/tutorials`, supabase storage for video | Lists guided videos, progress state. |

## Inventory (`v2 screenshots`)

| Screen | Screenshot(s) | Data dependencies | UI Notes |
| --- | --- | --- | --- |
| Inventory metrics | 4.47.40 PM, 4.47.48 PM | `/inventory/metrics`, `/inventory/items`, `/integrations/square/status` | KPI cards for stock value, reorder alerts. Connect to existing Square import job. |
| Item detail / reorder | 4.47.55 PM, 4.48.02 PM | `/inventory/items/{id}`, `/inventory/reorder` (Gap) | Table with min/max, reorder button. |

## Integrations (`v2 screenshots`)

| Screen | Screenshot(s) | Data dependencies | UI Notes |
| --- | --- | --- | --- |
| Integrations overview | 4.48.08 PM, 4.48.16 PM, 4.48.23 PM | `/integrations/status`, `/calendar/sync`, `/inventory/sync`, `/crm/status` | Cards for Square POS, Acuity Scheduling with KPIs (This Month revenue, Booking Rate). Need backend summary endpoints to feed stats. Mailchimp/GA/Instagram marked “Coming soon” – hide or keep disabled toggles. |
| Integration detail modal | 4.48.31 PM | Manage connection, sync frequency; mirror existing OAuth flows. |

## Settings (`v2 screenshots`)

| Screen | Screenshot(s) | Data dependencies | UI Notes |
| --- | --- | --- | --- |
| Settings nav tabs | 4.48.43 PM, 4.48.51 PM | `/settings` (update payload schema), `/billing/status`, `/billing/history` | Tabs: Profile, Business, Brand, Integrations, Tours, Goals, Plan. Replace legacy driver.js toggles. |
| Tours & goals | 4.48.58 PM, 4.49.12 PM | `/settings` to store toggles, `/onboarding/progress` summary | Tour progress table, reset button. Goals fields for client/revenue/time management — new backend fields needed. Plan cards align with Stripe pricing. |

## Legacy V1 Reference (`v1 screenshots`)

| Screen | Screenshot(s) | Legacy feature | Migration Notes |
| --- | --- | --- | --- |
| Legacy dashboard cards | 8.47.08 PM – 8.47.52 PM | existing KPI widgets, referral QR, ASK VX dock | Data sources remain valid; visuals replaced by v2. |
| AskVX legacy chat | 8.47.56 PM – 8.48.28 PM | existing chat UI, driver.js overlays | Remove driver.js; reuse logic for chat persistence. |
| Cadences & messages | 8.48.32 PM – 8.48.45 PM | follow-up queue, messaging wizard | Provide parity with new messaging flows. |
| Inventory & integrations | 8.49.00 PM – 8.49.06 PM | inventory summary, integration toggles | Stats already wired; adapt to new design. |
| Settings & onboarding modals | 8.51.31 PM – 8.51.44 PM | tour modal, plan upgrade | All replaced by v2 tabbed settings. |

## Transcript Alignment Highlights

- Replace V1 landing/sign-in copy with v2 language (“customizable consultations”).
- Remove driver.js tours entirely; v2 onboarding tooltips per page will use new context provider.
- Feature gating: Fill Your Chair, Grow with VX, Tutorials remain locked for trial plans; overlay integrates with plan upgrade CTA in Settings.
- Integrations page should only show live providers (Square, Acuity) with accurate stats. Hide Twilio/Mailchimp placeholders until supported.
- Notifications triggered from cadences/calendar should feed the new header badge and drawer instead of legacy To-Do modal.

## Next Steps

1. Use this catalogue to drive the feature mapping matrix and API audit.
2. For each "Gap" entry, create backend tickets (metrics endpoints, notifications feed, tutorial progress API, etc.).
3. During implementation, update this file if new screenshots or states are added.

