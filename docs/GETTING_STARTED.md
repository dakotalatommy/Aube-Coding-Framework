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
