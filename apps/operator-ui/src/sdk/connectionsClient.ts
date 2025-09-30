import { api } from '../lib/api';

export async function startOAuth(provider: 'square'|'acuity'|'hubspot'|'google'|'facebook'|'instagram'|'shopify', opts?: { returnTo?: 'onboarding'|'workspace' }){
  // Robust strategy: request explicit login URL first (works across CORS), then fall back to /api/oauth/start redirect
  try {
    const first = await api.get(`/oauth/${provider}/login${opts?.returnTo?`?return=${encodeURIComponent(opts.returnTo)}`:''}`);
    const url = String(first?.url||'');
    if (url) { window.location.href = url; return; }
  } catch {}
  try {
    const params = opts?.returnTo ? `?return=${encodeURIComponent(opts.returnTo)}` : '';
    const j = await api.get(`/oauth/${provider}/start${params}`);
    const url = (j && j.url) || '';
    if (url) { window.location.href = url; return; }
  } catch {}
}


