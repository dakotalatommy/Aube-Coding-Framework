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
import { track } from './analytics';
import * as Sentry from '@sentry/react';

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
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  // Use legacy session-based authentication (no explicit headers needed)
  // The backend should handle authentication via session cookies

  const doFetch = async (base: string) => {
    // Add a default timeout and preserve any passed AbortController
    const ctl = new AbortController();
    const passedSignal = (options as any).signal as AbortSignal | undefined;
    const timeoutMs = (options as any).timeoutMs as number | undefined;
    const to = window.setTimeout(()=>{ try { ctl.abort('timeout'); } catch {} }, typeof timeoutMs === 'number' ? timeoutMs : 20000);
    const compositeSignal = passedSignal ? new AbortSignalAny([passedSignal, ctl.signal]) : ctl.signal;
    const url = `${base}${path}`;
    try { console.info('[bvx:api] fetch', url); } catch {}
    const res = await fetch(url, { ...options, headers, signal: compositeSignal });
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
    } catch (e) {
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
            const tid = (typeof window !== 'undefined' ? (localStorage.getItem('bvx_tenant')||'') : '') || 'anon';
            const paramsStr = JSON.stringify(b?.params||{});
            let hash = 0;
            for (let i = 0; i < paramsStr.length; i++) { hash = ((hash << 5) - hash + paramsStr.charCodeAt(i)) | 0; }
            const bucket = Math.floor(Date.now() / 10000); // 10s bucket
            b.idempotency_key = `${tid}:${toolName||'tool'}:${hash}:${bucket}`;
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

