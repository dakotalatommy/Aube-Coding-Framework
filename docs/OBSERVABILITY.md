# Observability

## PostHog (client analytics)
- Keys: VITE_POSTHOG_KEY, VITE_POSTHOG_HOST
- Captures: $pageview, client_error, client_unhandled_rejection, client_console_error/warn, custom events
- Where: operator-ui/src/lib/analytics.ts and main.tsx

## Sentry (optional)
- DSN: VITE_SENTRY_DSN
- Init in main.tsx; tracesSampleRate=0.1 by default

## Server metrics
- /health and /ready endpoints
- Basic KPIs in /admin/kpis (messages_24h, errors_24h, uptime_pct)

## Smoke checks
- Playwright e2e (tests-e2e/): landing, workspace, redirects, inventory, smoke
- How to run: npm run build && npx vite preview; npm run test:e2e

