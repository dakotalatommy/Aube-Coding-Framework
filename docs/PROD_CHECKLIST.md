Production Launch Checklist

- Backend (FastAPI)
  - DATABASE_URL points to Postgres (not SQLite)
  - Alembic migrations applied (`alembic upgrade head`)
  - CORS_ORIGINS includes only your production UI origins (and preview regex if needed)
  - DEV_AUTH_ALLOW=0 and ALLOW_WEAK_JWT=0 (unset or 0)
  - JWT_JWKS_URL/JWT_AUDIENCE/JWT_ISSUER configured (or HS secret if using HS tokens)
  - REDIS_URL set for cache/rate limits/circuit breaker across instances
  - SENTRY_DSN set (optional but recommended)
  - ENABLE_SCHEDULER set for exactly one instance (or run scheduler in a single worker)
  - TWILIO/SENDGRID/STRIPE keys present; signatures verified where applicable

- Frontend (Cloudflare Pages)
  - Root directory: `apps/operator-ui`
  - Build command: `npm ci && npm run build`
  - Output directory: `apps/operator-ui/dist`
  - Environment variables:
    - VITE_API_BASE_URL=https://api.brandvx.io (or your API)
    - SUPABASE_URL, SUPABASE_ANON_KEY (if using Supabase auth)
  - Preview domains permitted via CORS_ORIGIN_REGEX in backend

- Validation
  - Run unit tests locally: `pytest -q`
  - Verify `/health`, `/ready`, `/metrics/prometheus` endpoints
  - Exercise key flows (auth, onboarding, contacts import, cadences, AI chat)

