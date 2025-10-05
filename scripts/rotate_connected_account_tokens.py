#!/usr/bin/env python3
"""Utility to re-encrypt connected account tokens when SECRET_KEY rotates."""

import os
import argparse
import sys
from typing import Iterable, Optional

import psycopg2
from psycopg2.extras import DictCursor

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.backend.app.crypto import decrypt_text, encrypt_text  # type: ignore  # noqa:E402


def _decrypt_with(secret: str, payload: str) -> Optional[str]:
    os.environ['SECRET_KEY'] = secret
    return decrypt_text(payload)


def reencrypt_row(cur, row, new_secret: str, old_secrets: Iterable[str], dry_run: bool) -> bool:
    access = row['access_token_enc']
    refresh = row['refresh_token_enc']
    if not access and not refresh:
        return False
    plain_access = None
    plain_refresh = None
    for secret in old_secrets:
        if access and plain_access is None:
            plain_access = _decrypt_with(secret, access)
        if refresh and plain_refresh is None:
            plain_refresh = _decrypt_with(secret, refresh)
        if (plain_access or not access) and (plain_refresh or not refresh):
            break
    if access and not plain_access:
        print(f"[skip] id={row['id']} provider={row['provider']} unable to decrypt access token")
        return False
    if refresh and not plain_refresh:
        print(f"[skip] id={row['id']} provider={row['provider']} unable to decrypt refresh token")
        return False
    os.environ['SECRET_KEY'] = new_secret
    new_access = encrypt_text(plain_access) if plain_access else None
    new_refresh = encrypt_text(plain_refresh) if plain_refresh else None
    if dry_run:
        print(f"[dry-run] id={row['id']} provider={row['provider']} would update")
        return True
    cur.execute(
        "UPDATE connected_accounts_v2 SET access_token_enc=%s, refresh_token_enc=%s WHERE id=%s",
        (new_access or access, new_refresh or refresh, row['id']),
    )
    print(f"[updated] id={row['id']} provider={row['provider']}")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-encrypt connected account tokens with new secret")
    parser.add_argument('--dsn', required=True, help='Postgres connection string')
    parser.add_argument('--old-secret', action='append', required=True, help='Old SECRET_KEY values (append per rotation)')
    parser.add_argument('--new-secret', required=True, help='New SECRET_KEY value to apply')
    parser.add_argument('--providers', nargs='*', help='Limit to providers (e.g. square acuity)')
    parser.add_argument('--tenant', help='Limit to tenant UUID')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    conn = psycopg2.connect(args.dsn)
    conn.autocommit = not args.dry_run
    with conn.cursor(cursor_factory=DictCursor) as cur:
        where = []
        params = {}
        if args.providers:
            where.append("provider = ANY(%(providers)s)")
            params['providers'] = args.providers
        if args.tenant:
            where.append("tenant_id = %(tenant)s::uuid")
            params['tenant'] = args.tenant
        sql = "SELECT id, tenant_id, provider, access_token_enc, refresh_token_enc FROM connected_accounts_v2"
        if where:
            sql += " WHERE " + " AND ".join(where)
        cur.execute(sql, params)
        rows = cur.fetchall()
        updated = 0
        for row in rows:
            if reencrypt_row(cur, row, args.new_secret, args.old_secret, args.dry_run):
                updated += 1
        print(f"Done. Updated {updated} rows (dry-run={args.dry_run}).")

    conn.close()


if __name__ == '__main__':
    main()
