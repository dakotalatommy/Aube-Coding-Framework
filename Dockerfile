FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Run a fast syntax/import check, then migrations, then start the app
CMD bash -lc "python -m py_compile src/backend/app/main.py && python -c 'from uvicorn.importer import import_from_string as ifs; ifs(\"src.backend.app.main:app\")' && alembic upgrade head || true; uvicorn src.backend.app.main:app --host 0.0.0.0 --port 8000 --workers 1"


