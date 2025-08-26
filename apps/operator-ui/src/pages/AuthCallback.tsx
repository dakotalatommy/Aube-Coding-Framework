import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    const sp = new URLSearchParams(loc.search);
    const next = sp.get('next') || '/workspace?pane=dashboard&tour=all';

    // Broadcast to the opener/original tab that auth is ready
    const signalReady = () => {
      try {
        const bc = new (window as any).BroadcastChannel('bvx_auth');
        bc.postMessage({ type: 'auth_ready' });
      } catch {}
      try { localStorage.setItem('bvx_auth_ready', '1'); } catch {}
      try { (window.opener as any)?.postMessage('bvx_auth_ready', window.location.origin); } catch {}
    };

    let unsub: any;
    const init = async () => {
      // If session already exists, go immediately
      const sess = (await supabase.auth.getSession()).data.session;
      if (sess) {
        signalReady();
        nav(next, { replace: true });
        return;
      }
      // Otherwise, wait for it
      unsub = supabase.auth.onAuthStateChange((_, session) => {
        if (session) {
          signalReady();
          nav(next, { replace: true });
        }
      });
      // Fallback polling in case the event misses
      const t = window.setInterval(async () => {
        const s = (await supabase.auth.getSession()).data.session;
        if (s) {
          window.clearInterval(t);
          signalReady();
          nav(next, { replace: true });
        }
      }, 1200);
      return () => window.clearInterval(t);
    };
    init();
    return () => { try { unsub?.data?.subscription?.unsubscribe?.(); } catch {} };
  }, [loc.search, nav]);

  return (
    <div className="max-w-md mx-auto py-10">
      <div className="border rounded-2xl p-6 shadow-sm" style={{background:'linear-gradient(180deg, #fff, #fff8fb)'}}>
        <h1 className="text-2xl font-semibold text-slate-900">Finishing sign‑in…</h1>
        <p className="text-slate-600 mt-2">You can close any extra tabs. We’ll take you to your workspace automatically.</p>
      </div>
    </div>
  );
}


