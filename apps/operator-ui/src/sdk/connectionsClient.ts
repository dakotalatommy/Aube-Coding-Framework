import { api } from '../lib/api';

export async function startOAuth(provider: 'square'|'acuity'|'hubspot'|'google'|'facebook'|'instagram'|'shopify'){
  // Prefer server to return a URL; handle redirect responses too.
  try {
    const res = await fetch(`${(import.meta as any).env?.VITE_API_BASE_URL || ''}/api/oauth/${provider}/start`, {
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
    const j = await api.get(`/oauth/${provider}/login`);
    if (j?.url) { window.location.href = j.url; }
  } catch {}
}


