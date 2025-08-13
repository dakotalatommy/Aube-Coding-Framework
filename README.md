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


