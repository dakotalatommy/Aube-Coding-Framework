#!/usr/bin/env python3
import subprocess
from pathlib import Path


def rotate_env_key(env_path: Path, key: str) -> None:
    if not env_path.exists():
        print(f"Missing {env_path}")
        return
    new = subprocess.check_output(["openssl", "rand", "-hex", "32"]).decode().strip()
    lines = env_path.read_text().splitlines()
    out = []
    found = False
    for l in lines:
        if l.startswith(f"{key}="):
            out.append(f"{key}={new}")
            found = True
        else:
            out.append(l)
    if not found:
        out.append(f"{key}={new}")
    env_path.write_text("\n".join(out) + "\n")
    print(f"Rotated {key} in {env_path}")


if __name__ == "__main__":
    rotate_env_key(Path(".env"), "APP_SECRET")


