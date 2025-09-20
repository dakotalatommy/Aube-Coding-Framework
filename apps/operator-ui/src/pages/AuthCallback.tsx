import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const loc = useLocation();

  useEffect(() => {
    // 1) Consume OAuth/PKCE return (code/tokens) and set session, if present
    const consumeAuthReturn = async () => {
      try {
        const u = new URL(window.location.href);
        const at = u.searchParams.get('access_token');
        const rt = u.searchParams.get('refresh_token');
        if (at && rt) {
          try {
            await supabase.auth.setSession({ access_token: at, refresh_token: rt } as any);
          } catch {}
        } else {
          try {
            await supabase.auth.exchangeCodeForSession(window.location.href as any);
          } catch {}
        }
      } catch {}
      // Scrub sensitive params from the URL
      try {
        const u = new URL(window.location.href);
        const SENSITIVE = ['access_token','refresh_token','token_type','expires_in','provider_token','code','scope'];
        SENSITIVE.forEach(k => u.searchParams.delete(k));
        // Also scrub from hash if present
        if (u.hash) {
          try {
            const hs = new URLSearchParams(u.hash.replace(/^#/, ''));
            SENSITIVE.forEach(k => hs.delete(k));
            const hstr = hs.toString();
            u.hash = hstr ? '#' + hstr : '';
          } catch {}
        }
        window.history.replaceState({}, '', u.toString());
      } catch {}
    };
    const main = async () => {
      await consumeAuthReturn();
      // Decide target synchronously
      const sp = new URLSearchParams(window.location.search);
      const forcedFlag = sp.get('force') === '1' || sp.get('forceOnboard') === '1' || sp.get('welcome') === '1';
      const forcedOnboarding = forcedFlag;
      let onboardingDone = false; try { onboardingDone = localStorage.getItem('bvx_onboarding_done') === '1'; } catch {}
      const target = (!onboardingDone || forcedOnboarding) ? '/onboarding' : '/workspace?pane=dashboard';

      // Sanitize non-sensitive URL parts
      try {
        const u = new URL(window.location.href);
        ['provider','connected','error','postVerify','tour'].forEach(k => u.searchParams.delete(k));
        window.history.replaceState({}, '', u.toString());
      } catch {}
      // Broadcast readiness
      try { const bc = new (window as any).BroadcastChannel('bvx_auth'); bc.postMessage({ type: 'auth_ready' }); } catch {}
      try { localStorage.setItem('bvx_auth_ready', '1'); } catch {}
      try { localStorage.removeItem('bvx_intro_pending'); } catch {}
      try { localStorage.removeItem('bvx_auth_in_progress'); } catch {}
      try { (window.opener as any)?.postMessage('bvx_auth_ready', window.location.origin); } catch {}

      // Hard redirect to avoid router timing races
      window.location.replace(target);
    };
    void main();
    }, [loc.search]);

  return (
    <div className="max-w-md mx-auto py-10">
      <div className="border rounded-2xl p-6 shadow-sm" style={{background:'linear-gradient(180deg, #fff, #fff8fb)'}}>
        <h1 className="text-2xl font-semibold text-slate-900">Finishing sign‑in…</h1>
        <p className="text-slate-600 mt-2">You can close any extra tabs. We’ll take you to your workspace automatically.</p>
      </div>
    </div>
  );
}
