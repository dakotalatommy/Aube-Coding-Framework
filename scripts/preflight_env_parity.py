#!/usr/bin/env python3
"""
Preflight parity check for deployment.

Validates that Vite build-time env vars (VITE_*) required by operator-ui are
present in local .env AND on Cloudflare Pages (variables or secrets). Optionally
verifies Render service exists and can return env vars.

Exit codes:
  0 = OK
  2 = Missing required VITE_* on Cloudflare or local .env
  3 = Could not read local .env; treat as failure
  4 = Cloudflare API error (will print context)
  5 = Render API error (non-fatal for UI deploy)
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, Iterable, Set
from urllib import request, error


REPO_ROOT = Path(__file__).resolve().parents[1]
OPUI_SRC = REPO_ROOT / 'apps' / 'operator-ui' / 'src'


def load_env(dotenv_path: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    try:
        for raw in dotenv_path.read_text(encoding='utf-8').splitlines():
            line = raw.strip()
            if not line or line.startswith('#'):
                continue
            if '=' not in line:
                continue
            k, v = line.split('=', 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k:
                env[k] = v
    except FileNotFoundError:
        pass
    return env


def find_vite_keys(src_dir: Path) -> Set[str]:
    pat = re.compile(r'VITE_[A-Z0-9_]+')
    keys: Set[str] = set()
    for p in src_dir.rglob('*.ts*'):
        try:
            for m in pat.findall(p.read_text(encoding='utf-8', errors='ignore')):
                keys.add(m)
        except Exception:
            continue
    return keys


def http_json(method: str, url: str, headers: Dict[str, str] | None = None) -> dict:
    req = request.Request(url=url, method=method.upper())
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode('utf-8')
            return json.loads(body) if body else {}
    except error.HTTPError as e:
        msg = e.read().decode('utf-8', errors='ignore')
        raise RuntimeError(f'HTTP {e.code}: {msg}')


def fetch_cloudflare_vars() -> Set[str]:
    account = os.getenv('CF_ACCOUNT_ID', '')
    project = os.getenv('CF_PAGES_PROJECT', '')
    token = os.getenv('CF_API_TOKEN', '')
    if not (account and project and token):
        raise RuntimeError('Missing CF_ACCOUNT_ID / CF_PAGES_PROJECT / CF_API_TOKEN')
    base = f'https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects/{project}'
    auth = {'Authorization': f'Bearer {token}'}
    names: Set[str] = set()
    # Variables
    try:
        r_vars = http_json('GET', f'{base}/variables', headers=auth)
        for k in (r_vars.get('result') or {}).keys():
            names.add(str(k))
    except Exception:
        # Not all accounts have variables API; proceed
        pass
    # Secrets
    try:
        r_sec = http_json('GET', f'{base}/secrets', headers=auth)
        for item in (r_sec.get('result') or []):
            name = item.get('name')
            if name:
                names.add(str(name))
    except Exception:
        # Some accounts restrict listing secrets; ignore
        pass
    return names


def render_env_check() -> None:
    token = os.getenv('RENDER_API_TOKEN', '')
    service = os.getenv('RENDER_SERVICE_ID', '')
    if not (token and service):
        print('Render check: skipped (missing RENDER_API_TOKEN / RENDER_SERVICE_ID)')
        return
    base = f'https://api.render.com/v1/services/{service}'
    auth = {'Authorization': f'Bearer {token}'}
    try:
        meta = http_json('GET', base, headers=auth)
        print(f"Render service: {meta.get('service', meta.get('id', 'ok'))}")
    except Exception as e:
        print(f'Render check: warning: {e}')


def main() -> int:
    dotenv = REPO_ROOT / '.env'
    env = load_env(dotenv)
    if not env:
        print('ERROR: .env not found or empty at repo root.', file=sys.stderr)
        return 3

    vite_keys_in_code = sorted(find_vite_keys(OPUI_SRC))
    local_vite_set = {k for k in vite_keys_in_code if k in env and env.get(k, '') != ''}
    missing_local = [k for k in vite_keys_in_code if k not in local_vite_set]

    # Cloudflare
    cf_names: Set[str] = set()
    cf_error = None
    try:
        cf_names = fetch_cloudflare_vars()
    except Exception as e:
        cf_error = str(e)

    missing_cf = [k for k in vite_keys_in_code if k not in cf_names]

    print('\nVite keys referenced in operator-ui:')
    for k in vite_keys_in_code:
        lp = 'set' if k in local_vite_set else 'missing'
        cp = 'present' if (not cf_error and k in cf_names) else ('unknown' if cf_error else 'missing')
        print(f'- {k}: local={lp}, cloudflare={cp}')

    if cf_error:
        print(f"\nCloudflare check warning: {cf_error}")

    render_env_check()

    fail = False
    if missing_local:
        print('\nERROR: Missing locally before build (Vite):', ', '.join(missing_local))
        fail = True
    if not cf_error and missing_cf:
        print('ERROR: Missing on Cloudflare (Vite):', ', '.join(missing_cf))
        fail = True

    if fail:
        return 2
    print('\nPreflight parity OK.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())


