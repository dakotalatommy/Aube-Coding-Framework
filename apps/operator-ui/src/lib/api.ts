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
import { track } from './analytics';
import * as Sentry from '@sentry/react';

// Resolve and cache tenant id via /me; fallback to localStorage if available
let _cachedTenantId: string | null = null;
let _mePromise: Promise<any> | null = null;
export async function getTenant(): Promise<string> {
  try {
    if (_cachedTenantId) return _cachedTenantId;
    const fromLocal = typeof window !== 'undefined' ? (localStorage.getItem('bvx_tenant') || '') : '';
    if (fromLocal) { _cachedTenantId = fromLocal; return fromLocal; }
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const session = (await supabase.auth.getSession()).data.session;
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    } else {
      // Only allow dev fallback when explicitly in demo or localhost
      const isLocal = typeof window !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
      const isDemo = sp.get('demo') === '1';
      if (isLocal || isDemo) {
        headers.set('X-User-Id', 'dev');
        headers.set('X-Role', 'owner_admin');
        const hintedTid = typeof window !== 'undefined' ? (localStorage.getItem('bvx_tenant') || '') : '';
        if (hintedTid) headers.set('X-Tenant-Id', hintedTid);
      }
    }
    const me = await fetch(`${API_BASE}/me`, { headers }).then(r=>r.ok?r.json():null);
    const tid = me?.tenant_id || '';
    if (tid) {
      _cachedTenantId = tid;
      try { localStorage.setItem('bvx_tenant', tid); } catch {}
      return tid;
    }
  } catch {}
  // In production, never return dev tenant. Force caller to handle lack of tenant.
  return '';
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
    // Only use dev headers on localhost or when demo=1
    try {
      const isLocal = typeof window !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
      const isDemo = sp.get('demo') === '1';
      if (isLocal || isDemo) {
        headers.set('X-User-Id', 'dev');
        headers.set('X-Role', 'owner_admin');
      }
    } catch {}
  }
  // Ensure X-Tenant-Id header is set. Prefer cached/localStorage, then consult /me once.
  if (!headers.get('X-Tenant-Id') && path !== '/me') {
    try {
      const localTid = typeof window !== 'undefined' ? (localStorage.getItem('bvx_tenant') || '') : '';
      if (_cachedTenantId || localTid) {
        headers.set('X-Tenant-Id', (_cachedTenantId || localTid) as string);
      } else {
        if (!_mePromise) {
          _mePromise = fetch(`${API_BASE}/me`, { headers }).then(r=>r.ok?r.json():null).finally(()=>{ _mePromise = null; });
        }
        const me = await _mePromise;
        if (me?.tenant_id) {
          headers.set('X-Tenant-Id', me.tenant_id);
          _cachedTenantId = me.tenant_id;
          try { localStorage.setItem('bvx_tenant', me.tenant_id); } catch {}
        }
      }
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
  // Prevent rapid redirect loops on repeated 401s
  let redirectedRecently = false;
  try {
    const last = Number(localStorage.getItem('bvx_last_401_redirect_ts') || '0');
    redirectedRecently = Date.now() - last < 6000;
  } catch {}

  const doFetch = async (base: string, isRetry: boolean = false) => {
    // Add a default timeout and preserve any passed AbortController
    const ctl = new AbortController();
    const passedSignal = (options as any).signal as AbortSignal | undefined;
    const timeoutMs = (options as any).timeoutMs as number | undefined;
    const to = window.setTimeout(()=>{ try { ctl.abort('timeout'); } catch {} }, typeof timeoutMs === 'number' ? timeoutMs : 20000);
    const compositeSignal = passedSignal ? new AbortSignalAny([passedSignal, ctl.signal]) : ctl.signal;
    const res = await fetch(`${base}${path}`, { ...options, headers, signal: compositeSignal });
    if (!res.ok) {
      try { track('api_error', { path, status: res.status, statusText: res.statusText, base }); } catch {}
      try { Sentry.addBreadcrumb({ category: 'api', level: 'error', message: `HTTP ${res.status} ${res.statusText}`, data: { path, base } }); } catch {}
      // Handle unauthorized centrally (skip in demo contexts)
      if (res.status === 401 && typeof window !== 'undefined') {
        // Retry once after refreshing the session
        if (!isRetry) {
          try {
            const refreshed = await supabase.auth.refreshSession();
            const newToken = refreshed?.data?.session?.access_token;
            if (newToken) {
              headers.set('Authorization', `Bearer ${newToken}`);
              window.clearTimeout(to);
              return await doFetch(base, true);
            }
          } catch {}
        }
        // Guard redirect to avoid infinite loops or redirects from auth pages
        try {
          const p = window.location.pathname;
          const onAuthPage = p === '/login' || p === '/signup' || p === '/auth/callback';
          const sp = new URLSearchParams(window.location.search);
          const isDemo = sp.get('demo') === '1';
          const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
          if (!onAuthPage && !isDemo && !redirectedRecently) {
            if (!isLocal) {
              try { localStorage.setItem('bvx_auth_return', window.location.href); } catch {}
              try { localStorage.setItem('bvx_last_401_redirect_ts', String(Date.now())); } catch {}
              window.location.assign('/login');
            }
          }
        } catch {}
      }
      throw new Error(`${res.status} ${res.statusText}`);
    }
    window.clearTimeout(to);
    return res.json();
  };
  try {
    return await doFetch(API_BASE);
  } catch (e: any) {
    // Network/mixed-content fallback: retry against production API if local base failed
    const msg = String(e?.message || e || '');
    const isNetwork = msg.includes('Failed to fetch') || msg.includes('TypeError');
    if (isNetwork && API_BASE.includes('localhost')) {
      try {
        try { track('api_retry_prod', { path, reason: msg }); } catch {}
        try { Sentry.addBreadcrumb({ category: 'api', level: 'warning', message: 'Retrying API against prod', data: { path, reason: msg } }); } catch {}
        return await doFetch('https://api.brandvx.io');
      } catch {}
    }
    try { track('api_request_failed', { path, message: msg }); } catch {}
    try { Sentry.captureException(e); } catch {}
    throw e;
  }
}

export const api = {
  get: (path: string, opts?: RequestInit & { timeoutMs?: number }) => request(path, opts),
  post: (path: string, body: unknown, opts?: RequestInit & { timeoutMs?: number }) => request(path, { method: 'POST', body: JSON.stringify(body), ...(opts||{}) }),
};

// Utility to merge multiple AbortSignals (first to abort wins)
class AbortSignalAny implements AbortSignal {
  aborted: boolean;
  onabort: ((this: AbortSignal, ev: any) => any) | null = null;
  reason: any;
  throwIfAborted(): void { if (this.aborted) throw new DOMException('Aborted', 'AbortError'); }
  addEventListener: AbortSignal['addEventListener'];
  removeEventListener: AbortSignal['removeEventListener'];
  dispatchEvent: AbortSignal['dispatchEvent'];
  constructor(signals: AbortSignal[]) {
    const ctrl = new AbortController();
    this.aborted = false;
    this.reason = undefined;
    const onAbort = (ev: any) => {
      if (!this.aborted) {
        this.aborted = true;
        this.reason = ev?.target?.reason || 'abort';
        ctrl.abort(this.reason);
        if (typeof this.onabort === 'function') {
          try { this.onabort.call(this, ev); } catch {}
        }
      }
    };
    for (const s of signals) {
      if (s.aborted) { onAbort({ target: s }); break; }
      s.addEventListener('abort', onAbort, { once: true });
    }
    this.addEventListener = ctrl.signal.addEventListener.bind(ctrl.signal);
    this.removeEventListener = ctrl.signal.removeEventListener.bind(ctrl.signal);
    this.dispatchEvent = ctrl.signal.dispatchEvent.bind(ctrl.signal);
  }
}
