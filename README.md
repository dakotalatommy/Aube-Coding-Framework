# BrandVX Demo — Local Run

Prereqs
- Python 3.10+
- `pip install fastapi uvicorn pydantic`

Run backend
```
uvicorn src.backend.app.main:app --reload
```

Open web UI
- Serve `src/web/index.html` with any static server, or open directly and proxy to backend on `http://localhost:8000`.

Demo path
1) Import contacts
2) Start cadence
3) Simulate message
4) Fetch metrics

Notes
- Events are printed to stdout. Replace with real bus later.
- In-memory state only; for demo purposes.


