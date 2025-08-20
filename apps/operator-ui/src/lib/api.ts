// Normalize API base URL to avoid malformed values (e.g., stray characters after port)
function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL || '').toString().trim();
  const fallback = 'http://localhost:8000';
  if (!raw) return fallback;
  try {
    // If raw is a full URL, use its origin; if it lacks protocol, prefix http://
    const candidate = raw.startsWith('http') ? raw : `http://${raw}`;
    const url = new URL(candidate);
    return url.origin;
  } catch {
    return fallback;
  }
}

export const API_BASE = resolveApiBase();
import { supabase } from './supabase';

// Resolve and cache tenant id via /me; fallback to localStorage if available
let _cachedTenantId: string | null = null;
export async function getTenant(): Promise<string> {
  try {
    if (_cachedTenantId) return _cachedTenantId;
    const fromLocal = typeof window !== 'undefined' ? (localStorage.getItem('bvx_tenant') || '') : '';
    if (fromLocal) { _cachedTenantId = fromLocal; return fromLocal; }
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const session = (await supabase.auth.getSession()).data.session;
    if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
    const me = await fetch(`${API_BASE}/me`, { headers }).then(r=>r.ok?r.json():null);
    const tid = me?.tenant_id || '';
    if (tid) {
      _cachedTenantId = tid;
      try { localStorage.setItem('bvx_tenant', tid); } catch {}
      return tid;
    }
  } catch {}
  return 't1';
}

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  // Prefer Supabase session if present; otherwise fall back to dev headers
  let session: any = null;
  try {
    session = (await supabase.auth.getSession()).data.session;
  } catch {
    // If Supabase env is not configured, silently fall back to dev headers
    session = null;
  }
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  } else {
    headers.set('X-User-Id', 'dev');
    headers.set('X-Role', 'owner_admin');
  }
  // Ensure X-Tenant-Id header is set by consulting /me once when missing (avoid recursion)
  if (!headers.get('X-Tenant-Id') && path !== '/me') {
    try {
      const me = await fetch(`${API_BASE}/me`, { headers }).then(r=>r.ok?r.json():null);
      if (me?.tenant_id) headers.set('X-Tenant-Id', me.tenant_id);
    } catch {}
  }
  // Inject tenant_id into JSON body if present/missing, preferring header/X-Tenant-Id
  try {
    const ct = headers.get('Content-Type') || '';
    const tid = headers.get('X-Tenant-Id') || (typeof window !== 'undefined' ? localStorage.getItem('bvx_tenant') || '' : '');
    if (ct.includes('application/json') && options.body && typeof options.body === 'string') {
      const parsed = JSON.parse(options.body as string);
      if (tid) parsed.tenant_id = tid;
      options.body = JSON.stringify(parsed);
    }
  } catch {}
  // Cache tenant locally for other modules to consume
  try {
    const tid = headers.get('X-Tenant-Id');
    if (tid) localStorage.setItem('bvx_tenant', tid);
  } catch {}
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body: unknown) => request(path, { method: 'POST', body: JSON.stringify(body) }),
};
