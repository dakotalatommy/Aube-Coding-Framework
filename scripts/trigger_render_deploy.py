#!/usr/bin/env python3
"""
Trigger a Render backend deploy using credentials in the repo .env and poll until live.

Env file expected at: <repo>/.env with keys:
  RENDER_API_TOKEN=...\n
  RENDER_SERVICE_ID=...\n
This script avoids sourcing shell and tolerates extra/unknown lines in .env.
"""
import json
import os
import sys
import time
from urllib import request, error


def load_env_from_dotenv(dotenv_path: str) -> dict:
    data: dict[str, str] = {}
    try:
        with open(dotenv_path, 'r', encoding='utf-8') as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' not in line:
                    continue
                k, v = line.split('=', 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k:
                    data[k] = v
    except FileNotFoundError:
        pass
    return data


def http_json(method: str, url: str, headers: dict = None, payload: dict = None) -> dict:
    body_bytes = None
    if payload is not None:
        body_bytes = json.dumps(payload).encode('utf-8')
    req = request.Request(url=url, method=method.upper(), data=body_bytes)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    if payload is not None:
        req.add_header('Content-Type', 'application/json')
    try:
        with request.urlopen(req, timeout=30) as resp:
            txt = resp.read().decode('utf-8')
            return json.loads(txt) if txt else {}
    except error.HTTPError as e:
        try:
            msg = e.read().decode('utf-8')
        except Exception:
            msg = str(e)
        raise RuntimeError(f"HTTP {e.code} {e.reason}: {msg}")
    except Exception as e:
        raise RuntimeError(str(e))


def main() -> int:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    dotenv_path = os.path.join(repo_root, '.env')
    env = load_env_from_dotenv(dotenv_path)
    token = env.get('RENDER_API_TOKEN') or os.getenv('RENDER_API_TOKEN')
    service = env.get('RENDER_SERVICE_ID') or os.getenv('RENDER_SERVICE_ID')
    if not token or not service:
        print('Missing RENDER_API_TOKEN or RENDER_SERVICE_ID in .env or environment', file=sys.stderr)
        return 1

    base = f'https://api.render.com/v1/services/{service}'
    auth = {'Authorization': f'Bearer {token}'}
    print(f'Triggering deploy for service {service} ...', flush=True)
    deploy = http_json('POST', f'{base}/deploys', headers=auth, payload={})
    print('Deploy response:', json.dumps({k: deploy.get(k) for k in ('id', 'status', 'createdAt')}, indent=2))
    if not deploy.get('id'):
        print('Failed to create deploy (no id). Full response above.', file=sys.stderr)
        return 2

    # Poll status
    print('Polling deploy status (up to ~2 min)...', flush=True)
    for i in range(36):  # 36 * 5s = 180s
        items = http_json('GET', f'{base}/deploys?limit=1', headers=auth)
        if isinstance(items, list):
            last = items[0] if items else {}
        else:
            last = (items.get('items') or [{}])[0]
        status = last.get('status', '')
        print(f'[{i+1}] {status}', flush=True)
        if status in ('live', 'succeeded'):
            break
        if status in ('failed', 'build_failed', 'update_failed'):
            print('Deploy failed. Last item:', json.dumps(last, indent=2))
            return 3
        time.sleep(5)

    # Quick smoke check
    try:
        print('Re-running /messages/simulate smoke check...', flush=True)
        sim = http_json('POST', 'https://api.brandvx.io/messages/simulate',
                        headers={'Content-Type': 'application/json'},
                        payload={
                            'tenant_id': 't1',
                            'contact_id': 'c_demo',
                            'channel': 'sms',
                            'generate': False
                        })
        print('Simulate result:', json.dumps(sim, indent=2))
    except Exception as e:
        print('Smoke check error (will require manual retry):', str(e), file=sys.stderr)
        return 4
    return 0


if __name__ == '__main__':
    raise SystemExit(main())


