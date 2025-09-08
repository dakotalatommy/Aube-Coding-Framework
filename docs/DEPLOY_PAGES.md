Cloudflare Pages Deployment (Wrangler)

Prereqs
- Node 18+
- Wrangler installed (`npm i -g wrangler`) or use `npx wrangler`
- Environment variables set (do not commit secrets):
  - `export CLOUDFLARE_API_TOKEN=...` (Pages:Write + Account:Read)
  - `export CLOUDFLARE_ACCOUNT_ID=...` (your account ID)
  - Optional overrides:
    - `export CF_PAGES_PROJECT=brandvx-operator-ui`
    - `export CF_PAGES_BRANCH=main` (must match your Production Branch in Pages)

Build and deploy
```
cd apps/operator-ui
npm ci
npm run build
npx wrangler pages deploy dist \
  --project-name=${CF_PAGES_PROJECT:-brandvx-operator-ui} \
  --branch=${CF_PAGES_BRANCH:-main} \
  --commit-dirty=true
```

Or use the helper script:
```
./scripts/deploy_pages.sh
```

Notes
- Configure `VITE_API_BASE_URL` and other build-time vars in Cloudflare Pages → Settings → Environment Variables.
- The backend already whitelists production UI and Pages preview via CORS. Regex is sanitized at startup.
- To force a production deploy, ensure `CF_PAGES_BRANCH` matches the project’s Production Branch (commonly `main`).

