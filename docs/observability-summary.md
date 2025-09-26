# BrandVX Observability & State Services Summary

Audience: BrandVX engineers preparing for launch and ongoing operations.
Purpose: document how PostHog, Sentry, and Redis are configured in our stack, what data we emit, and how to verify health.

---

## 1. Environment & Credential Map

| Service | Frontend (Cloudflare Pages) | Backend (Render) | Notes |
|---------|-----------------------------|------------------|-------|
| PostHog | `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` | `POSTHOG_API_KEY`, `POSTHOG_HOST` | Both point to `https://app.posthog.com` after the 401 fix. Client key (`phc_…`) and server key can differ; we currently reuse the client key. |
| Sentry  | `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT` | `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` | Frontend DSN is distinct from backend DSN. Both default to environment `production`. |
| Redis   | n/a | `REDIS_URL` (Upstash/Redis Cloud) | Backend only. `cache.py` gracefully falls back to in-process memory if the URL is missing. |

Where they live:
- Cloudflare Pages project env (`VITE_*`).
- Render service env for backend (`POSTHOG_*`, `SENTRY_*`, `REDIS_URL`).
- `.env` mirrors exist locally; run `python3 scripts/preflight_env_parity.py` before deploy to double-check parity.

---

## 2. PostHog

### Initialization
- **Frontend**: `apps/operator-ui/src/lib/analytics.ts` wraps `posthog-js`. `initAnalytics()` defers init via `requestIdleCallback` from `main.tsx` once `VITE_POSTHOG_KEY` exists.
- **Backend**: `src/backend/app/analytics.py` exposes `ph_capture(event, distinct_id, properties)` using the Python SDK. All backend routes call this helper to stay non-breaking if PostHog is disabled.

### Event Catalog (current)
| Event name | Source | Purpose | Properties |
|------------|--------|---------|------------|
| `onboarding.stepper_open` | Frontend | Onboarding flow opened | none |
| `onboarding.step_viewed` | Frontend | Track step navigation | `step`, `position`, optional `direction` |
| `onboarding.step_advanced` | Frontend | Capture completion time per step | `step`, `position` |
| `onboarding.step_completed` | Frontend | Mark user confirming a step | `step` |
| `ask.prompt_submitted` | Frontend (AskVX) | Count prompts, modes | `onboard`, `length`, `mode` |
| `ask.response_stream_start` | Frontend | Track AI response start | `onboard`, `chars` |
| `ask.response_stream_complete` | Frontend | Response latency | `onboard`, `chars`, `duration_ms` |
| `ask.response_error` | Frontend | Error occurrences | `onboard`, `error` snippet |
| `cadence.message_queued` | Backend | Cadence enqueued (SMS/email) | `channel`, `template_id`, `contact_id` |
| `cadence.message_sent` | Backend | Successful send (includes fallback) | `channel`, `template_id`, `contact_id`, optional `fallback` |
| `cadence.message_failed` | Backend | Provider failures | `channel`, `template_id`, `contact_id`, `error` |
| `$pageview` | Frontend | Manual pageview capture | Vite router path |
| `client_error` / `client_unhandled_rejection` | Frontend global handlers | JS errors/warns | message metadata |
| `landing_view`, `onboarding_complete`, etc. | Frontend convenience captures in scenes | vary per component |

Add events by importing `track` / `trackEvent` in React, or calling `ph_capture` in Python.

### Identification & Feature Flags
- `identify(userId, props)` called once Supabase session resolves.
- Feature flag overrides currently manual (`setFeatureFlag` in analytics helper).

### Dashboards to Stand Up for Launch
1. **Activation funnel**: `onboarding.stepper_open` → `onboarding.step_completed` (Time to finish).
2. **AI engagement**: burst charts for `ask.prompt_submitted`, `ask.response_stream_complete` vs `ask.response_error`.
3. **Cadence throughput**: success vs failure ratio from backend events, segmented by channel/template.

Troubleshooting: if events 401 again, confirm host key pair (`https://app.posthog.com`) or regenerate keys.

---

## 3. Sentry

### Initialization
- **Frontend**: `apps/operator-ui/src/main.tsx` runs `Sentry.init` with BrowserTracing + Replay (error-only). User ID set after Supabase login. Console error/warn wrappers feed breadcrumbs before PostHog triggers.
- **Backend**: `src/backend/app/main.py` lazily imports `sentry_sdk` when `SENTRY_DSN` exists. Tools and AI handlers add breadcrumbs (`tool`, `tenant_id`). Exceptions bubble to Sentry before returning JSON error.

Configuration knobs:
- `SENTRY_TRACES_SAMPLE_RATE` (backend) and `tracesSampleRate` (frontend) set to `0.1`. Increase temporarily during launch if you need deeper perf traces.
- `replaysOnErrorSampleRate = 1.0` ensures a session replay for each captured frontend error.

### Usage Tips
- Tag events using `Sentry.setUser({id})` (already in place) and `event.tags` in `beforeSend` (tenant id).
- Add spans with `Sentry.start_span` (backend) or `Sentry.startInactiveSpan` (frontend) around new features when perf matters.
- Check Sentry Issues dashboard after each deploy; set alerts for `production` environment.

---

## 4. Redis

### Connection Helpers
- `src/backend/app/cache.py` provides `cache_get/set/incr/del`. On failure, it falls back to `_mem` (per-process dict) to avoid outages.
- `src/backend/app/events.py` uses `_get_redis()` for pub/sub and health checks.

### Current Responsibilities
- **Cache/memoization**: per-endpoint caches (e.g., `/admin/kpis`) leverage `cache_get/set`.
- **Rate limiting & circuit breaker**: `src/backend/app/rate_limit.py` stores throttle state in Redis keys (e.g., `tenant:{id}:rl_multiplier`).
- **Event fanout (optional)**: `emit_event` publishes to `brandvx.events` channel when Redis is available.
- **Fallback store**: Chat sessions remain in Postgres; Redis is currently used for transient counters and TTL caches, not canonical history.

Key patterns in production:
- Cache keys: `inv:{tenant}`, `inbox:{tenant}:50`, `kpis:{tenant}`.
- Circuit breaker keys: `cb_fail:name`, `cb_open:name`.
- Rate limit keys: `tenant:{id}:rl_multiplier`, `ratelimit:{tenant}:{bucket}`.

### Operational Checks
- Health endpoint `/health` returns `redis: ok/error/disabled` (backend’s FastAPI).
- Manually: `redis-cli -u $REDIS_URL ping` or `GET tenant:{id}:...`.
- TTL expectations: most keys expire within 60–86400 seconds; stale keys auto-evict.

---

## 5. Data Exposure Summary

| Data | Where Stored/Sent | Contains | Notes |
|------|-------------------|----------|-------|
| PostHog events | PostHog Cloud (US) | Tenant IDs, step keys, message channels, no raw PII | Errors include truncated messages (`error` slice 120 chars). |
| Sentry errors | Sentry US region | Stack traces, user id (UUID), tenant tag | No raw client contact data; messaging payloads are redacted before logging. |
| Redis | Redis Cloud (TLS) | Cache values (JSON), counters | No long-term PII; fallback to memory ensures graceful degrade. |
| Postgres | Supabase-managed | Canonical data: contacts, chat logs, metrics | Not covered here but referenced for context. |

Ensure any new analytics event strips or hashes direct customer contact info before sending.

---

## 6. Monitoring & Verification Playbook

1. **After deploy**
   - Open app → confirm PostHog network calls succeed (`/e/…` 200 status).
   - Force a JS error in console; verify Sentry issue appears under `production` environment.
   - Hit `/health` on backend; look for `redis: ok`.
2. **Dashboards**
   - PostHog Live events tab for smoke run, dashboards outlined above.
   - Sentry Issues/Performance views – filter by latest release.
   - Redis metrics via provider dashboard (if throttling/latency spikes).
3. **Troubleshooting**
   - PostHog 401 → check host vs key pairing.
   - Sentry silent → confirm DSN present, environment not filtered.
   - Redis unavailable → logs show fallback warning; switch to memory mode until provider recovers.

---

## 7. Extending Instrumentation

- **Frontend**: import `track`/`trackEvent` from `lib/analytics`; guard with try/catch to avoid user-facing crashes.
- **Backend**: call `ph_capture` in service-layer functions; keep event names `dot.case`.
- **Sentry**: wrap new async flows with spans/breadcrumbs.
- **Redis**: use `cache_set`/`cache_get` for TTL caches; prefix keys with the feature name.

Append new events to this document as we expand coverage (e.g., share prompt conversions, AskVX rating capture).

---

## 8. Useful Links

- PostHog project: https://app.posthog.com/project/ (use analytics@ brandvx credentials).
- Sentry project: https://sentry.io/organizations/brandvx/issues/
- Render Service Logs: https://dashboard.render.com/
- Cloudflare Pages build logs: https://dash.cloudflare.com/
- Health endpoint: `GET https://api.brandvx.io/health`
- Redis provider console: (Redis Cloud dashboard)

