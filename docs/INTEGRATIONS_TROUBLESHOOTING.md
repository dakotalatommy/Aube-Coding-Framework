# Integrations Troubleshooting

## Common symptoms and fixes

- CORS error in console
  - Usually an underlying 401/422/500. Verify:
    - Backend returns 401 without auth: curl -i -s -H 'Origin: https://app.brandvx.io' https://api.brandvx.io/me
    - In app, ensure requests include a Bearer token and real tenant_id.

- /me returns tenant_id 't1'
  - Fix: Set backend JWT_SECRET (Supabase HS256), keep JWT_ISSUER and JWT_AUDIENCE correct; redeploy.

- Connect button shows “link unavailable”
  - Ensure DEV_OAUTH_AUTOCONNECT=0 in prod; otherwise /oauth/{provider}/login returns {url:}.
  - Verify redirect URI in provider console matches backend (see Preflight).

- Square connect succeeds but status not updating
  - Click Re‑analyze; backend probe is tolerant to legacy schemas.
  - Call /integrations/connected-accounts?tenant_id=<uuid>; expect square entry.

- Square import fails
  - Click Refresh on Square card, then Import contacts.
  - Ensure Square is connected and token present.

## Environment checklist

- Supabase
  - SUPABASE_URL, VITE_SUPABASE_ANON_KEY, JWT_SECRET, JWT_ISSUER=https://<ref>.supabase.co/auth/v1, JWT_AUDIENCE=authenticated.

- Cloudflare Pages (frontend)
  - Vite env set (STRIPE, SUPABASE, API base URL, feature flags).

- Render (backend)
  - BACKEND_BASE_URL, FRONTEND_BASE_URL, provider client IDs/secrets, DEV_OAUTH_AUTOCONNECT=0.

## Debug endpoints

- GET /integrations/preflight → provider readiness and redirect URIs
- GET /debug/cors → allowed origins
- GET /integrations/connected-accounts?tenant_id=<uuid> → recent connections and last callback
