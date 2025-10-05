import { track } from './analytics';
import * as Sentry from '@sentry/react';
import { supabase } from './supabase';

// Cache for Supabase session to avoid repeated slow getSession() calls
let cachedAccessToken: string | null = null;

type ApiRequestOptions = RequestInit & {
  timeoutMs?: number;
  includeTenant?: boolean;
  skipAuth?: boolean;
  _retry?: boolean;
};

let inflightTokenPromise: Promise<string | null> | null = null;
let inflightRefreshPromise: Promise<string | null> | null = null;

// Set the cached access token (called from bootstrap after successful session fetch)
export function setCachedAccessToken(token: string | null) {
  cachedAccessToken = token;
  try { console.info('[bvx:api] cached access token updated:', token ? 'present' : 'null'); } catch {}
}

// Get the cached access token
export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
}

async function fetchToken({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<string | null> {
  if (!forceRefresh && cachedAccessToken) {
    return cachedAccessToken;
  }

  if (!forceRefresh && inflightTokenPromise) {
    return inflightTokenPromise;
  }

  const loader = (async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const token = data?.session?.access_token || null;
      setCachedAccessToken(token);
      return token;
    } catch (error) {
      console.error('[bvx:auth] failed to fetch Supabase session', error);
      setCachedAccessToken(null);
      return null;
    }
  })();

  if (!forceRefresh) {
    inflightTokenPromise = loader.finally(() => {
      inflightTokenPromise = null;
    });
    return inflightTokenPromise;
  }

  return loader;
}

async function refreshToken(): Promise<string | null> {
  if (inflightRefreshPromise) {
    return inflightRefreshPromise;
  }

  inflightRefreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      const token = data.session?.access_token || null;
      setCachedAccessToken(token);
      return token;
    } catch (error) {
      console.error('[bvx:auth] refresh session failed', error);
      setCachedAccessToken(null);
      return null;
    } finally {
      inflightRefreshPromise = null;
    }
  })();

  return inflightRefreshPromise;
}

async function ensureAccessToken(options?: ApiRequestOptions): Promise<string | null> {
  if (options?.skipAuth) {
    return null;
  }

  const existing = getCachedAccessToken();
  if (existing) {
    return existing;
  }

  return fetchToken();
}

// Normalize API base URL to avoid malformed values (e.g., stray characters after port)
function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL || '').toString().trim();
  const fallback = 'http://localhost:8000';
  if (!raw) {
    // In production, try to infer a sensible default before throwing
    if (import.meta.env.PROD) {
      if (typeof window !== 'undefined') {
        const host = window.location.host || '';
        const isLocal = host.includes('localhost') || host.startsWith('127.') || host.startsWith('0.0.0.0');
        if (isLocal) {
          return fallback;
        }
        if (host.endsWith('.brandvx.io')) {
          return 'https://api.brandvx.io';
        }
        if (host.endsWith('.brandvx-operator-ui.pages.dev')) {
          return 'https://api.brandvx.io';
        }
        if (window.location.origin) {
          return window.location.origin;
        }
      }
      throw new Error('VITE_API_BASE_URL must be set in production');
    }
    return fallback;
  }
  try {
    // If raw is a full URL, preserve any path prefix; if it lacks protocol, prefix http://
    const candidate = raw.startsWith('http') ? raw : `http://${raw}`;
    const url = new URL(candidate);
    const pathname = url.pathname && url.pathname !== '/' ? url.pathname.replace(/\/$/, '') : '';
    return `${url.origin}${pathname}`;
  } catch {
    // In production, don't fall back to localhost on invalid URLs
    if (import.meta.env.PROD) {
      throw new Error(`Invalid VITE_API_BASE_URL in production: ${raw}`);
    }
    return fallback;
  }
}

export const API_BASE = resolveApiBase();

// Resolve tenant id from localStorage (set during login)
export async function getTenant(): Promise<string> {
  try {
    const fromLocal = typeof window !== 'undefined' ? (localStorage.getItem('bvx_tenant') || '') : '';
    return fromLocal;
  } catch {}
  return '';
}

async function request(path: string, options: ApiRequestOptions = {}) {
  try { console.info('[bvx:api] request', path, { method: options.method || 'GET' }); } catch {}

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (!options.skipAuth) {
    const token = await ensureAccessToken(options);
    if (!token) {
      throw new Error('Supabase session unavailable');
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  let tenantId: string | undefined;
  const includeTenant = options.includeTenant !== false;
  if (includeTenant) {
    try {
      tenantId = await getTenant();
      if (tenantId) {
        headers.set('X-Tenant-Id', tenantId);
        if (!headers.has('X-Role')) {
          headers.set('X-Role', 'owner_admin');
        }
        if (!headers.has('X-User-Id')) {
          headers.set('X-User-Id', 'operator-ui');
        }
      }
    } catch (error) {
      console.warn('[bvx:api] tenant lookup failed', error);
    }
  }

  const execute = async (base: string, retry = false): Promise<any> => {
    const ctl = new AbortController();
    const passedSignal = options.signal as AbortSignal | undefined;
    const timeoutMs = options.timeoutMs ?? 20000;
    const timer = window.setTimeout(() => {
      try { ctl.abort('timeout'); } catch {}
    }, timeoutMs);
    const signal = passedSignal ? new AbortSignalAny([passedSignal, ctl.signal]) : ctl.signal;

    let url = `${base}${path}`;
    const method = options.method?.toUpperCase() || 'GET';
    if (tenantId && (method === 'GET' || method === 'DELETE')) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}tenant_id=${encodeURIComponent(tenantId)}`;
    }

    const finalOptions: RequestInit = {
      ...options,
      headers,
      signal,
    };

    if (tenantId && ['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        let body = finalOptions.body;
        if (typeof body === 'string') body = JSON.parse(body);
        if (body && typeof body === 'object' && !Array.isArray(body)) {
          (body as any).tenant_id = tenantId;
          finalOptions.body = JSON.stringify(body);
        }
      } catch (error) {
        console.warn('[bvx:api] failed to inject tenant_id into body', error);
      }
    }

    try {
      const response = await fetch(url, finalOptions);
      if (response.status === 401 && !options.skipAuth && !retry) {
        setCachedAccessToken(null);
        const refreshed = await refreshToken();
        if (refreshed) {
          headers.set('Authorization', `Bearer ${refreshed}`);
          return execute(base, true);
        }
      }

      if (!response.ok) {
        try { track('api_error', { path, status: response.status, statusText: response.statusText, base }); } catch {}
        try { Sentry.addBreadcrumb({ category: 'api', level: 'error', message: `HTTP ${response.status} ${response.statusText}`, data: { path, base } }); } catch {}

        if (response.status === 401 && !options.skipAuth) {
          setCachedAccessToken(null);
        }

        throw new Error(`${response.status} ${response.statusText}`);
      }

      try { return await response.json(); }
      catch { return null as any; }
    } finally {
      window.clearTimeout(timer);
    }
  };

  try {
    return await execute(API_BASE);
  } catch (error: any) {
    const msg = String(error?.message || error || '');
    const isNetwork = msg.includes('Failed to fetch') || msg.includes('TypeError');
    if (isNetwork && API_BASE.includes('localhost') && !import.meta.env.PROD) {
      try {
        try { track('api_retry_prod', { path, reason: msg }); } catch {}
        try { Sentry.addBreadcrumb({ category: 'api', level: 'warning', message: 'Retrying API against prod', data: { path, reason: msg } }); } catch {}
        return await execute('https://api.brandvx.io');
      } catch (retryError) {
        throw retryError;
      }
    }

    try { track('api_request_failed', { path, message: msg }); } catch {}
    try { Sentry.captureException(error); } catch {}
    throw error;
  }
}

export const api = {
  get: (path: string, opts?: ApiRequestOptions) => request(path, opts),
  post: (path: string, body: any, opts?: ApiRequestOptions) => {
    try {
      // Beta switch: route execute -> qa to avoid gating during early trials
      const beta = (import.meta as any).env?.VITE_BETA_OPEN_TOOLS === '1' || (typeof window !== 'undefined' && localStorage.getItem('bvx_beta_open_tools') === '1');
      if (beta && typeof path === 'string' && path.startsWith('/ai/tools/execute')) {
        path = '/ai/tools/qa';
      }
    } catch {}
    try {
      // Disable idempotency for vision tools to avoid false "duplicate" errors in UI
      if (typeof path === 'string' && path.startsWith('/ai/tools/execute')) {
        const b = (body||{}) as any;
        const toolName = String(b?.name || '');
        const skipIdempotency = toolName === 'image.edit' || toolName === 'vision.analyze.gpt5' || toolName === 'brand.vision.analyze';
        if (skipIdempotency) {
          if (b && b.idempotency_key) delete b.idempotency_key;
          body = b;
        } else {
          if (b && !b.idempotency_key) {
            const paramsStr = JSON.stringify(b?.params||{});
            let hash = 0;
            for (let i = 0; i < paramsStr.length; i++) { hash = ((hash << 5) - hash + paramsStr.charCodeAt(i)) | 0; }
            const bucket = Math.floor(Date.now() / 10000); // 10s bucket
            b.idempotency_key = `${toolName||'tool'}:${hash}:${bucket}`;
            body = b;
          }
        }
      }
    } catch {}
    return request(path, { method: 'POST', body: JSON.stringify(body), ...(opts||{}) });
  },
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
