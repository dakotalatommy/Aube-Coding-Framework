# BrandVX Deployment Playbook (Render + Cloudflare Pages)

This is the single source of truth for deployment. Keep secrets in .env (NOT committed). Use the provided script for repeatable deploys.

## Environments & domains
- Frontend (Cloudflare Pages): app.brandvx.io (Pages project)
- Backend (Render Web Service): api.brandvx.io (Docker)

## Prereqs (once per machine)
- Node 20+ and npm
- Python 3.11+
- Git with remote set (e.g., origin)
- Cloudflare auth: API token with Pages + Cache purge
- Render auth: API token, Service ID

## Secrets (.env at repo root; do not commit)
```
# Render
RENDER_API_TOKEN=...
RENDER_SERVICE_ID=...

# Cloudflare
CF_API_TOKEN=...
CF_ACCOUNT_ID=...
CF_PAGES_PROJECT=brandvx-app   # your Pages project name
CF_ZONE_ID=...                 # zone for brandvx.io (for cache purge)
CF_BRANCH=main                 # optional, defaults to main

# Optional front-end build vars (for operator-ui)
VITE_API_BASE_URL=https://api.brandvx.io
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_POSTHOG_KEY=...
VITE_POSTHOG_HOST=https://app.posthog.com
VITE_OAUTH_APPLE=0
VITE_STRIPE_PK=...
VITE_STRIPE_PRICE_147=...
VITE_STRIPE_PRICE_97=...
VITE_STRIPE_TRIAL_DAYS=7
```

## One-command deploy
```
# from repo root
bash scripts/deploy_all.sh
```
What it does:
1) Builds operator-ui (Vite) → `apps/operator-ui/dist`
2) Deploys frontend to Cloudflare Pages (via Wrangler)
3) Triggers Render backend deploy via API and polls until live
4) Purges Cloudflare CDN cache for app/api
5) Prints production URLs

## Manual steps (if you need them)
- Frontend build:
```
cd apps/operator-ui
npm ci --prefer-offline --no-audit --progress=false
npm run build
```
- Frontend deploy (Cloudflare Pages):
```
export CLOUDFLARE_API_TOKEN=$CF_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID=$CF_ACCOUNT_ID
npx --yes wrangler@3 pages deploy ./apps/operator-ui/dist \
  --project-name "$CF_PAGES_PROJECT" \
  --branch "${CF_BRANCH:-main}"
```
- Backend deploy (Render):
```
python3 scripts/trigger_render_deploy.py
```
- Purge Cloudflare cache:
```
curl -sS -X POST \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache \
  -d '{"purge_everything":true}' | jq .
```

## Environment TRIPLE‑CHECK (before every deploy)
1) Confirm .env exists and read keys (without values):
```
ls -la | grep -E '^\.|\.env'
awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{print $1}' .env | sort | uniq
```
2) If step 1 fails (dotfiles hidden/ignored), override and try again:
```
/bin/ls -la . | cat
awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{print $1}' .env | sort | uniq
```
3) Cross‑check backups and DB stub:
```
for f in .env.bak* .env.db; do echo "== $f =="; [ -f "$f" ] && awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{print $1}' "$f" | sort | uniq; done
```
Required keys (must appear in .env):
- RENDER_API_TOKEN, RENDER_SERVICE_ID
- CF_API_TOKEN, CF_ACCOUNT_ID, CF_PAGES_PROJECT, CF_ZONE_ID (and optional CF_BRANCH)
- VITE_API_BASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (for operator‑ui)
- OPENAI_API_KEY, OPENAI_MODEL; JWT_AUDIENCE, JWT_ISSUER (and JWT_JWKS_URL or JWT_SECRET)

If any check fails, DO NOT DEPLOY. Fix .env and re‑run the triple‑check.

## Preflight parity (Cloudflare/Render vs local .env)
Run this to ensure Vite keys present locally also exist on Cloudflare Pages, and that your Render service is reachable:
```
python3 scripts/preflight_env_parity.py
```
If it reports missing VITE_* on Cloudflare or locally, fix before building/deploying.

## Verification checklist (post-deploy)
- API: `GET https://api.brandvx.io/health` => 200
- CORS: browser calls to API from app.brandvx.io succeed
- Frontend: loads at `https://app.brandvx.io` with correct ENV (check network tab `VITE_API_BASE_URL`)
- AskVX Command Bar visible in workspace; Action Drawer opens on activity
- No vertical scroll; arrows navigate panes

## Notes
- Keep `render.yaml` as the Render service definition of record
- Keep `deploy/render-env.txt` and `deploy/pages-env.txt` as reference mappings for envs
- Never commit secrets; .env is local only
