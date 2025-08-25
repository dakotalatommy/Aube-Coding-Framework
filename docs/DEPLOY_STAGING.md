# Staging Deploy Notes

## Environments
- API_BASE_URL: https://api.brandvx.io (or Render service URL)
- VITE_API_BASE_URL: matches API BASE for operator-ui
- VITE_POSTHOG_KEY / VITE_POSTHOG_HOST: analytics
- VITE_SENTRY_DSN (optional): error tracing
- JWT_ISSUER=brandvx, JWT_AUDIENCE=brandvx-users
- JWT_SECRET (staging only) or JWT_JWKS_URL (prod)
- REDIS_URL: redis://... (Render/Upstash)
- CORS_ORIGINS: https://app.brandvx.io, https://staging.brandvx.io

## DNS/SSL
- Cloudflare proxies for app/api; enable SSL Full (strict)
- A records/CNAMEs: app.brandvx.io → Pages/Render; api.brandvx.io → Render service

## OAuth/webhooks
- Google: {baseApi}/oauth/google/callback
- Apple: {baseApi}/oauth/apple/callback
- Square: {baseApi}/oauth/square/callback
- HubSpot: {baseApi}/oauth/hubspot/callback
- Stripe webhook: {baseApi}/billing/webhook

## Redis/Health
- Health: GET /health; Ready: GET /ready
- Rate-limit backed by REDIS_URL; fallback memory

## Build/Preview
- operator-ui: npm run build; vite preview
- backend: uvicorn src.backend.app.main:app

