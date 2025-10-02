import { track } from './analytics';
import * as Sentry from '@sentry/react';

// Cache for Supabase session to avoid repeated slow getSession() calls
let cachedAccessToken: string | null = null;

// Set the cached access token (called from bootstrap after successful session fetch)
export function setCachedAccessToken(token: string | null) {
  cachedAccessToken = token;
  try { console.info('[bvx:api] cached access token updated:', token ? 'present' : 'null'); } catch {}
}

// Get the cached access token
export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
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

async function request(path: string, options: RequestInit = {}) {
  try { console.info('[bvx:api] request', path, { method: (options as any).method||'GET' }); } catch {}
  
  // Timeout for request preparation phase (before fetch even starts)
  const prepTimeout = setTimeout(() => {
    console.error('[bvx:api] TIMEOUT during request preparation for', path);
    throw new Error(`Request preparation timeout for ${path}`);
  }, 5000); // 5 second timeout for prep
  
  try {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    // Send Authorization header with Supabase access token for authentication
    // Backend expects Bearer token and tenant_id parameter/body field
    // Use cached token to avoid slow getSession() calls
    try {
      try { console.info('[bvx:api] getting auth token for', path); } catch {}
      
      // Use cached token if available (instant, no async call needed)
      const accessToken = cachedAccessToken;
      
      try { console.info('[bvx:api] got auth token for', path, accessToken ? '(cached)' : '(none)'); } catch {}
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }
    } catch (authError) {
      console.warn('[bvx:api] auth error for', path, authError);
      // Continue without auth header if cache unavailable
    }

    // Resolve tenant id and inject it into requests
    let tenantId: string | undefined
    const includeTenant = (options as any).includeTenant !== false // default true
    try {
      if (includeTenant) {
        try { console.info('[bvx:api] getting tenant_id for', path); } catch {}
        tenantId = await getTenant()
        try { console.info('[bvx:api] got tenant_id:', tenantId, 'for', path); } catch {}
        if (tenantId) {
          try { console.info('[bvx:api] injecting tenant_id', tenantId); } catch {}
        }
      }
    } catch (error) {
      console.warn('Failed to resolve tenant_id', error)
    }
    
    clearTimeout(prepTimeout); // Prep complete, clear timeout
    try { console.info('[bvx:api] prep complete for', path); } catch {}

    const doFetch = async (base: string) => {
    // Add a default timeout and preserve any passed AbortController
    const ctl = new AbortController();
    const passedSignal = (options as any).signal as AbortSignal | undefined;
    const timeoutMs = (options as any).timeoutMs as number | undefined;
    const to = window.setTimeout(()=>{ try { ctl.abort('timeout'); } catch {} }, typeof timeoutMs === 'number' ? timeoutMs : 20000);
    const compositeSignal = passedSignal ? new AbortSignalAny([passedSignal, ctl.signal]) : ctl.signal;

    // Inject tenant_id into URL for GET/DELETE requests
    let url = `${base}${path}`
    if (tenantId && (options.method === 'GET' || options.method === 'DELETE' || !options.method)) {
      const separator = url.includes('?') ? '&' : '?'
      url += `${separator}tenant_id=${encodeURIComponent(tenantId)}`
    }

    try { console.info('[bvx:api] fetch', url); } catch {}

    // Prepare body with tenant_id for POST/PUT/PATCH requests
    const finalOptions = { ...options, headers, signal: compositeSignal }
    if (tenantId && (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH')) {
      try {
        let body = finalOptions.body
        if (typeof body === 'string') {
          body = JSON.parse(body)
        }
        if (body && typeof body === 'object' && body !== null && !Array.isArray(body) && !(body instanceof URLSearchParams) && !(body instanceof FormData) && !(body instanceof Blob) && !(body instanceof ReadableStream)) {
          (body as any).tenant_id = tenantId
          finalOptions.body = JSON.stringify(body)
        }
      } catch (error) {
        console.warn('Failed to inject tenant_id into request body', error)
      }
    }

    const res = await fetch(url, finalOptions);
    if (!res.ok) {
      try { console.warn('[bvx:api] error', res.status, res.statusText, path); } catch {}
      try { track('api_error', { path, status: res.status, statusText: res.statusText, base }); } catch {}
      try { Sentry.addBreadcrumb({ category: 'api', level: 'error', message: `HTTP ${res.status} ${res.statusText}`, data: { path, base } }); } catch {}
      throw new Error(`${res.status} ${res.statusText}`);
    }
    window.clearTimeout(to);
    try {
      const json = await res.json();
      try { console.info('[bvx:api] ok', path, { keys: Object.keys(json||{}) }); } catch {}
      return json;
    } catch {
      try { console.warn('[bvx:api] non-json', path); } catch {}
      return null as any;
    }
  };

    try {
      return await doFetch(API_BASE);
    } catch (e: any) {
    // Network/mixed-content fallback: retry against production API if local base failed
    const msg = String(e?.message || e || '');
    const isNetwork = msg.includes('Failed to fetch') || msg.includes('TypeError');
    if (isNetwork && API_BASE.includes('localhost') && !import.meta.env.PROD) {
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
  } catch (prepError: any) {
    clearTimeout(prepTimeout);
    console.error('[bvx:api] Request preparation failed for', path, prepError);
    throw prepError;
  }
}

export const api = {
  get: (path: string, opts?: RequestInit & { timeoutMs?: number; includeTenant?: boolean }) => request(path, opts),
  post: (path: string, body: any, opts?: RequestInit & { timeoutMs?: number }) => {
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
