# BrandVX Getting Started

1) Prereqs
- Docker Desktop installed and running

2) Configure environment
- Create `.env` in repo root:
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5
# Optional GPT-5 Agents
# AI_PROVIDER=agents
# OPENAI_AGENT_ID=...
```

3) Run
```
docker compose up -d --build
```

4) Try the demo UI
- http://localhost:8000/app

5) API docs
- http://localhost:8000/docs

6) Providers (optional)
- Twilio: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, and `TEST_SMS_TO`
- SendGrid: set `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, and `TEST_EMAIL_TO`

7) Common endpoints
- /ai/chat — Ask VX
- /ai/tools/execute — safe tool execution with optional approvals
- /approvals — list approvals; /approvals/action — approve/reject
- /ai/embed and /ai/search — RAG indexing and search

8) Gateway model (recommended)
- Frontend calls only the FastAPI backend via `VITE_API_BASE_URL` (e.g., http://127.0.0.1:8000)
- FastAPI exposes S2S proxy routes to Supabase Edge Functions:
  - POST /ai/proxy/specialist-router
  - POST /ai/proxy/ai-recommendations
  - POST /ai/proxy/master-agent-orchestrator
  - POST /ai/proxy/realtime-token
- Configure backend env (.env):
```
BACKEND_BASE_URL=http://127.0.0.1:8000
FRONTEND_BASE_URL=http://127.0.0.1:5174
CORS_ORIGINS=http://localhost:5174,http://127.0.0.1:5174

# AI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5
OPENAI_USE_RESPONSES=true
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_EMBED_MODEL=text-embedding-3-small
AI_CHAT_MAX_TOKENS=1200

# Supabase (server-side only)
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
# Optional; if blank derived from SUPABASE_URL
SUPABASE_FUNCTIONS_BASE=https://<ref>.functions.supabase.co

# Providers (optional)
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
SQUARE_CLIENT_ID=
SQUARE_CLIENT_SECRET=
ACUITY_CLIENT_ID=
ACUITY_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
```
- Configure frontend env (`apps/operator-ui/.env`):
```
VITE_API_BASE_URL=http://127.0.0.1:8000
# Browser-safe only
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=...
```
