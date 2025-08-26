import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';

export default function Signup() {
  // navigate not needed in the confirmation flow; the callback handles redirect
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const appleEnabled = String(import.meta.env.VITE_OAUTH_APPLE || '0') === '1';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try{
      const redirectTo = `${window.location.origin}/auth/callback?next=/workspace?pane=dashboard&tour=all`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, business }, emailRedirectTo: redirectTo }
      });
      if (error) throw error;
      setAwaitingConfirm(true);
      try { localStorage.setItem('bvx_offer_pending','1'); } catch {}
      // Referral attribution
      try {
        const ref = localStorage.getItem('bvx_ref');
        const me = (await supabase.auth.getUser()).data.user?.id;
        if (ref && me) {
          const { data: rc } = await supabase.from('referral_codes').select('user_id, code').eq('code', ref).single();
          if (rc?.user_id) {
            await supabase.from('referrals').insert({ ref_code: rc.code, referrer_user_id: rc.user_id, referred_user_id: me, landing_url: window.location.href });
            try { track('referral_attributed', { ref }); } catch {}
          }
        }
      } catch {}
      // We’ll move to workspace after confirmation via auth listener; keep user here for clarity
      // navigate('/workspace?pane=dashboard&tour=all');
    }catch(err){
      alert(String((err as Error).message || err));
    }finally{
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="border rounded-2xl p-6 shadow-sm" style={{background:'linear-gradient(180deg, #fff, #fff8fb)'}}>
        <h1 className="text-3xl font-semibold text-slate-900">Create your account</h1>
        <p className="text-slate-600 mt-1">Start your onboarding in minutes.</p>
        {!awaitingConfirm ? (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm text-slate-700">Your name</label>
          <input
            required
            value={name}
            onChange={e=>setName(e.target.value)}
            className="mt-1 w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200"
            placeholder="Alex Rivera"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-700">Business name</label>
          <input
            required
            value={business}
            onChange={e=>setBusiness(e.target.value)}
            className="mt-1 w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200"
            placeholder="Vivid Studio"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-700">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={e=>setEmail(e.target.value)}
            className="mt-1 w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-700">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={e=>setPassword(e.target.value)}
            className="mt-1 w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200"
            placeholder="••••••••"
          />
        </div>
          <button disabled={loading} className="w-full px-4 py-2 rounded-xl bg-pink-500 text-white hover:bg-pink-600 transition">
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
        ) : (
          <div className="mt-6 space-y-3">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
              We sent a confirmation link to <b>{email || 'your email'}</b>. After you click it, we’ll open your workspace automatically.
            </div>
            <div className="flex gap-2">
              <a className="text-sm text-pink-600 hover:underline" href="https://mail.google.com" target="_blank" rel="noreferrer">Open Gmail</a>
              <span className="text-slate-300">—</span>
              <button type="button" className="text-sm text-slate-700 hover:underline" onClick={async()=>{
                try {
                  const redirectTo = `${window.location.origin}/auth/callback?next=/workspace?pane=dashboard&tour=all`;
                  await supabase.auth.resend({ type:'signup', email, options:{ emailRedirectTo: redirectTo } });
                } catch {}
              }}>Resend verification</button>
              <span className="text-slate-300">—</span>
              <button type="button" className="text-sm text-slate-700 hover:underline" onClick={async()=>{
                try{
                  const redirectTo = `${window.location.origin}/auth/callback?next=/workspace?pane=dashboard&tour=all`;
                  const { data, error } = await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo } });
                  if (error) { alert(String(error.message||error)); return; }
                  if (data && (data as any).url) window.location.assign((data as any).url as string);
                } catch(e:any){ alert(String(e?.message||e)); }
              }}>Use Google instead</button>
            </div>
          </div>
        )}
        <div className="my-4 grid grid-cols-1 gap-2">
          <button
            disabled={loading}
            className="w-full px-4 py-2 rounded-xl border bg-white hover:shadow-sm"
            onClick={async()=>{
              try{ track('signup_oauth_click',{provider:'google'}); }catch{}
              try{ localStorage.setItem('bvx_offer_pending','1'); }catch{}
              try{
                const redirectTo = `${window.location.origin}/onboarding?offer=1`;
                const { data, error } = await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo } });
                if (error) {
                  alert(String(error.message||error));
                  return;
                }
                // Some environments require explicitly following the returned URL
                if (data && (data as any).url) {
                  window.location.assign((data as any).url as string);
                }
              } catch(e:any){
                alert(String(e?.message||e));
              }
            }}
          >Continue with Google</button>
          {appleEnabled && (
            <button
              disabled={loading}
              className="w-full px-4 py-2 rounded-xl border bg-white hover:shadow-sm"
              onClick={async()=>{
                try{ track('signup_oauth_click',{provider:'apple'}); }catch{}
                try{ localStorage.setItem('bvx_offer_pending','1'); }catch{}
                await supabase.auth.signInWithOAuth({ provider:'apple', options:{ redirectTo: `${window.location.origin}/onboarding?offer=1` } });
              }}
            >Continue with Apple</button>
          )}
        </div>
        <p className="text-sm text-slate-600 mt-4">
          Already have an account? <Link to="/login" className="text-pink-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}


