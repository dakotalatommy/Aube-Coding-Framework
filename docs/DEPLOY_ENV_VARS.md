BrandVX Deploy: Environment Variables

Backend (Render)
- Core:
  - `BACKEND_BASE_URL` (e.g., https://api.brandvx.io)
  - `FRONTEND_BASE_URL` (e.g., https://app.brandvx.io)
  - `CORS_ORIGINS` (comma-separated app origins)
- Database:
  - `DATABASE_URL` (Postgres)
  - `DB_POOL_SIZE` (e.g., 20)
  - `DB_MAX_OVERFLOW` (e.g., 40)
  - `DB_POOL_TIMEOUT` (e.g., 5)
  - `DB_POOL_RECYCLE_SECONDS` (e.g., 300)
  - `DB_POOL_PRE_PING=1`
  - `PG_STATEMENT_TIMEOUT_MS=12000`, `PG_LOCK_TIMEOUT_MS=3000`, `PG_IDLE_IN_TXN_TIMEOUT_MS=10000`
- Scheduler & Worker:
  - `ENABLE_SCHEDULER=1`
  - `SCHEDULER_INTERVAL_SECS=60`
  - `SCHEDULER_TICK_LIMIT=200`
  - `ENABLE_WORKER=0|1` (enable when ready)
  - `REDIS_URL=rediss://...` (for rate limits/breaker/locks/worker)
- Supabase (server-only):
  - `SUPABASE_URL=https://<ref>.supabase.co`
  - `SUPABASE_SERVICE_ROLE_KEY=...`
  - `SUPABASE_READ_ONLY=true`
- Auth/JWT (Supabase JWKS):
  - `JWT_JWKS_URL=https://<ref>.supabase.co/auth/v1/keys`
  - `JWT_ISSUER=https://<ref>.supabase.co/auth/v1`
  - `JWT_AUDIENCE=authenticated`
  - `ALLOW_WEAK_JWT=0`, `DEV_AUTH_ALLOW=0`
- Stripe:
  - `STRIPE_SECRET_KEY=sk_live_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_...`
  - `STRIPE_PRICE_147=price_...`, `STRIPE_PRICE_97=price_...`, `STRIPE_TRIAL_DAYS=7`
- Vision (Gemini/Banana):
  - `GEMINI_API_KEY=...`
  - `GEMINI_IMAGE_MODEL=gemini-2.5-flash`
  - `NANO_BANANA_API_URL`, `NANO_BANANA_API_KEY` (optional fallback)
- Providers (optional):
  - Instagram Basic: `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`
  - Facebook Login/Graph: `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`
  - Square: `SQUARE_CLIENT_ID`, `SQUARE_CLIENT_SECRET`, `SQUARE_WEBHOOK_SECRET`
  - Twilio/SendGrid as needed
- Observability (optional):
  - `POSTHOG_API_KEY`, `POSTHOG_HOST=https://app.posthog.com`
  - `SENTRY_DSN`

Frontend (Cloudflare Pages)
- Build: root `apps/operator-ui`, build `npm ci && npm run build`, output `dist`
- API & Auth:
  - `VITE_API_BASE_URL=https://api.brandvx.io`
  - `VITE_SUPABASE_URL=https://<ref>.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=...`
- Stripe:
  - `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...`
  - `VITE_STRIPE_BUY_BUTTON_147=buy_btn_...`
  - `VITE_STRIPE_BUY_BUTTON_97=buy_btn_...`
- Analytics/Errors (optional):
  - `VITE_POSTHOG_KEY=...`, `VITE_POSTHOG_HOST=https://us.i.posthog.com`
  - `VITE_SENTRY_DSN`

Meta (Instagram/Facebook) Setup
- Meta Developers → your app → Settings → Basic: copy App ID/Secret; set App Domains (api/app.brandvx.io)
- Add Products: Facebook Login, Instagram Graph API (and/or Instagram Basic Display)
- Valid OAuth Redirect URIs:
  - Facebook: `https://api.brandvx.io/oauth/facebook/callback`
  - Instagram Basic: `https://api.brandvx.io/oauth/instagram/callback`
- For IG Graph, ensure IG account is Business/Creator and connected to a FB Page; request relevant permissions for Live use.

