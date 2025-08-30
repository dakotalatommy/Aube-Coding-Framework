import { api } from '../lib/api';

export async function startOAuth(provider: 'square'|'acuity'|'hubspot'|'google'|'facebook'|'instagram'|'shopify', opts?: { returnTo?: 'onboarding'|'workspace' }){
  // Prefer server to return a URL; handle redirect responses too.
  try {
    const q = new URLSearchParams();
    if (opts?.returnTo) q.set('return', opts.returnTo);
    const res = await fetch(`${(import.meta as any).env?.VITE_API_BASE_URL || ''}/api/oauth/${provider}/start${q.toString()?`?${q.toString()}`:''}`, {
      credentials: 'include',
      headers: { 'X-User-Id': 'dev', 'X-Role': 'owner_admin' },
      redirect: 'follow',
    });
    if ((res as any).redirected && res.url) {
      window.location.href = res.url;
      return;
    }
    try {
      const j = await res.json();
      const url = (j && j.url) || '';
      if (url) { window.location.href = url; return; }
    } catch {}
  } catch {}
  // Fallback: call non-aliased route if present
  try {
    const j = await api.get(`/oauth/${provider}/login${opts?.returnTo?`?return=${encodeURIComponent(opts.returnTo)}`:''}`);
    if (j?.url) { window.location.href = j.url; }
  } catch {}
}


