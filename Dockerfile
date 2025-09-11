FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Build-time sanity checks: fail the build on syntax/import errors
RUN python -m compileall -q src/backend/app && \
    python - <<'PY'
from uvicorn.importer import import_from_string as ifs
ifs('src.backend.app.main:app')
print('Import check OK')
PY

EXPOSE 8000

# Run syntax/import checks (must pass), then migrations (best-effort), then start the app
CMD bash -lc "set -e; \
  python -m py_compile src/backend/app/main.py; \
  python - <<'PY' 
from uvicorn.importer import import_from_string as ifs
ifs('src.backend.app.main:app')
PY
  ; \
  alembic upgrade head || true; \
  exec uvicorn src.backend.app.main:app --host 0.0.0.0 --port 8000 --workers 1"


