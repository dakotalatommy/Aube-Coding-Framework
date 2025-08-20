from fastapi.testclient import TestClient
from src.backend.app.main import app


client = TestClient(app)


def test_ai_chat_roundtrip():
    r = client.post(
        "/ai/chat",
        json={
            "tenant_id": "t1",
            "messages": [
                {"role": "user", "content": "Say hello succinctly."}
            ],
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("text"), str)
    assert len(data.get("text")) > 0

