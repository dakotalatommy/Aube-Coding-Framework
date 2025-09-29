# UI V2 Migration Progress

_Last updated: $(date '+%Y-%m-%d %H:%M:%S %Z')_

## Completed
- **Dashboard shell**: live Supabase profile fallback (neutral greeting), notification bell using new unified `/notifications` feed, global search wired to `/search`.
- **Landing page polish**: gradient smoothing, GLB background via `<model-viewer>`, logging instrumentation.
- **AskVX**: streaming responses restored, quick actions trigger real prompts, follow-up drafting dispatches `/followups/draft_batch` and surfaces results in notifications.
- **BrandVZN**: real photo uploads (base64 → `/ai/tools/execute` image.edit), progress UI, error handling, before/after preview.
- **Backend endpoints**: added `/notifications` aggregator and `/search` (clients + appointments) to support header UI.

## Completed
- **Messaging workspace**: GPT prompt templates wired, streaming drafts, follow-up queue polling, notifications integration.
- **Clients**: segments/search/sort wired to `/contacts/segments` & `/contacts/list`, health cards populated.

## In Progress
- **Agenda & Follow Ups**: enable task creation, unify calendar data (Square/Acuity/Google), surface notifications.

## Backlog (next steps)
1. **Clients**: ensure filters/search/tags populate from `/contacts/list`, wire health segments, confirm imports.
2. **Agenda & Follow Ups**: enable task creation, unify calendar data (Square/Acuity/Google), surface notifications.
3. **Messages** (remaining items): queue long-running sends, store templates server-side when available.
4. **Inventory**: confirm live endpoints, hide placeholder UI until data arrives.
5. **Settings**: reintroduce profile/business/notifications forms, saving via `/settings`.
6. **Tutorials**: defer until other modules complete.
7. **QA/Telemetry**: add smoke tests, toast/error coverage, and additional logging where useful.

## Notes
- Legacy endpoints remain the source of truth; new UI consumes them directly once wired.
- Worker job completions should persist to a shared notifications table so the bell remains accurate.
- Continue updating this file at the end of each implementation pass.

