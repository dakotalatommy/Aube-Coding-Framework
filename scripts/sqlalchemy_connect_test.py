from sqlalchemy import create_engine
from urllib.parse import urlparse
from dotenv import load_dotenv
import os

load_dotenv()

USER = os.getenv("user")
PASSWORD = os.getenv("password")
HOST = os.getenv("host")
PORT = os.getenv("port")
DBNAME = os.getenv("dbname")

db_url = os.getenv("DATABASE_URL")

if not (USER and PASSWORD and HOST and PORT and DBNAME) and db_url:
    p = urlparse(db_url)
    USER = USER or (p.username or "")
    PASSWORD = PASSWORD or (p.password or "")
    HOST = HOST or (p.hostname or "")
    PORT = PORT or (str(p.port) if p.port else "5432")
    DBNAME = DBNAME or (p.path.lstrip("/") or "postgres")

DATABASE_URL = f"postgresql+psycopg2://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}?sslmode=require"

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        v = conn.execute("select version()").fetchone()[0]
        print("Connection successful!", v[:40])
except Exception as e:
    print("Failed to connect:", e)


