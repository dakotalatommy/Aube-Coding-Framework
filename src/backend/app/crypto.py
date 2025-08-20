import os
import base64
import hashlib
from typing import Optional
from nacl import secret, utils


def _derive_key(secret_key: str) -> bytes:
    # Derive a 32-byte key via SHA-256
    return hashlib.sha256(secret_key.encode("utf-8")).digest()


def _box() -> secret.SecretBox:
    key_str = os.getenv("SECRET_KEY", "dev_secret_key_change_me")
    key = _derive_key(key_str)
    return secret.SecretBox(key)


def encrypt_text(plain: str) -> str:
    box = _box()
    nonce = utils.random(secret.SecretBox.NONCE_SIZE)
    ct = box.encrypt(plain.encode("utf-8"), nonce)
    return base64.b64encode(ct).decode("utf-8")


def decrypt_text(enc_b64: str) -> Optional[str]:
    try:
        raw = base64.b64decode(enc_b64)
        box = _box()
        pt = box.decrypt(raw)
        return pt.decode("utf-8")
    except Exception:
        return None



