# BrandVX Demo — Local Run

Prereqs
- Python 3.10+
- `pip install fastapi uvicorn pydantic`

Run with Docker (recommended)
```
docker compose up --build
```

App
- Backend: http://localhost:8000/health
- Web UI (served by backend): http://localhost:8000/app

Demo path
1) Import contacts
2) Start cadence
3) Simulate message
4) Fetch metrics

Notes
- Events print to stdout (replace with bus later).
- SQLite file persists in container volume; switch DATABASE_URL for Postgres.

AI setup
- Copy your OpenAI key into environment variables. Two options:
  - Temporary (current shell):
    ```bash
    export OPENAI_API_KEY=sk-...yourkey...
    ```
  - Persistent via Compose: create a `.env` file next to `docker-compose.yml`:
    ```bash
    echo "OPENAI_API_KEY=sk-...yourkey..." > .env
    echo "OPENAI_MODEL=gpt-5" >> .env
    # Optional model fallbacks, comma-separated. Example:
    echo "OPENAI_FALLBACK_MODELS=gpt-4o-mini" >> .env
    ```
    Then `docker compose up --build` (Compose auto-loads `.env`).
  - Optional:
    - `OPENAI_MODEL` (default: gpt-4o-mini)
    - `OPENAI_BASE_URL` (default: https://api.openai.com/v1)
    - `AI_PROVIDER` (chat|agents). For GPT‑5 Agents SDK set `AI_PROVIDER=agents` and provide:
      - `OPENAI_AGENT_ID=...` (your agent ID)
      - `OPENAI_AGENTS_URL` (default: `$OPENAI_BASE_URL/responses`)

Webhooks
- Twilio: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` and POST to `/webhooks/twilio`.
- SendGrid: set `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`. Signature verify is pluggable via `sendgrid_verify_signature`.

Auth
- For JWT via JWKS: set `JWT_JWKS_URL`, `JWT_AUDIENCE`, `JWT_ISSUER`.

Migrations
- Alembic is configured; run locally if you change models:
  ```bash
  alembic revision --autogenerate -m "change"
  alembic upgrade head
  ```

Supabase (L-layer)
- Set `SUPABASE_URL` (Project URL) and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.
- Seed example (run in Supabase SQL editor): insert a template and a rule using your `tenant_id` from `profiles`.
- The backend reads Supabase via an adapter, filtered by `tenant_id`; writes remain in H.



