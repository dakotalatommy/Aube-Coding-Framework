# UI V2 Execution Plan (Agent Checklist)

## 0. Ground Rules
- No redundant `git status`/`git diff` loops; only run when validating a change or before commit.
- Keep work in focused passes (~5 tasks) without pausing for status unless blocked.
- Update `docs/ui-v2-progress.md` when a module rolls from _In Progress_ ➜ _Completed_.
- Surface blockers immediately; otherwise continue until tasks below are done.

## 1. Agenda & Follow Ups (`apps/operator-ui/src/v2/components/agenda.tsx`)
1. Switch `loadAgenda()` to call `/dashboard/agenda` (tasks/reminders) + `/calendar/list` (events).
   - Parse `agenda` ➜ `mapAgendaTasks`; ensure `todoId`, `priority`, `completed` flow through.
   - Parse `queue` ➜ `mapReminders`; use `urgency`, `dueTs`, `actionLabel` from backend.
2. Ensure `handleCompleteTask` / `handleCompleteReminder` / `handleCreateTask` hit `/todo/ack` & `/todo/create`.
   - Add optimistic button disabled state + success/error toasts.
   - After each action: `await loadAgenda()` + dispatch `bvx:navigate` for bell sync.
3. Use backend completion flags for progress bar + "Today’s follow-ups" tiles.
4. Calendar sync actions: send provider to `/calendar/sync`, show spinner + toast.

## 2. Messaging Workspace (`apps/operator-ui/src/v2/components/messages.tsx`)
1. Confirm long-running send path calls the expected queue endpoint (`/followups/enqueue` or spec-defined) with template/contact payload.
2. If backend supports template persistence, POST selected template/body when user saves (otherwise note as pending).
3. Verify follow-up poll inserts completed drafts into history and surfaces notifications.
4. Smoke-test send/draft paths end-to-end and add error toasts where still missing.

## 3. Clients (`apps/operator-ui/src/v2/components/clients.tsx`)
1. `loadSegments()` ➜ fetch `/contacts/segments`, render segments + smart lists, hook click to `setActiveSegment`.
2. `loadClients()` ➜ call `/contacts/list` with search, segment, sort, pagination params.
3. Render health summary counts (VIP/At Risk/Referral Champions) from response.
4. Confirm `initialSearch` prop applies once, then `onAckSearch()` clears the prefill.
5. Implement empty states for no segments / no clients.

## 4. Inventory (`apps/operator-ui/src/v2/components/inventory.tsx`)
1. Populate hero tiles + table from `/inventory/metrics` data (currency/percent formatting).
2. Filter buttons (All/Low/Out) use `deriveSegment`; update counts dynamically.
3. `Sync now` and provider select ➜ `/inventory/sync`, toast + `await loadInventory()`.
4. `Merge duplicates` ➜ `/inventory/merge`, toast + reload.
5. Hide recommendations card if backend returns empty array.

## 5. Settings (`apps/operator-ui/src/v2/components/settings.tsx`)
1. `loadSettings()` ➜ hydrate profile, business, brand, notifications, goals, quiet hours, tone, messaging.
2. `saveSettings()` ➜ POST `/settings` with merged payload (profile/business/brand/notifications/goals/quiet_hours/tone/training_notes/providers_live/messaging).
3. Wire notification toggles, quiet hours inputs, and Twilio provision UI to state + backend endpoints.
4. Render integrations status from `/integrations/status`; open `connectUrl` when present.

## 6. QA & Telemetry
1. Add `toast.error` + `console.error` for all API failures introduced above.
2. Ensure backend logs (`logger.exception`) already in place for new routes.
3. Manual smoke after wiring:
   - Agenda: create task, complete task/reminder, run calendar sync.
   - Messaging: draft, send, confirm follow-up poll.
   - Clients: switch segments, search, view health.
   - Inventory: run sync + merge, inspect table/tiles.
   - Settings: update profile + toggles, save, reload.
4. Update `docs/ui-v2-progress.md` and notify user when all above are validated.

## 7. Finalization
- Prepare Render deploy hook (per user) once UI verified.
- Leave Tutorials deferred; note in progress doc.
- Provide launch-ready summary with validation steps.

