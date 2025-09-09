import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import CenteredCard from '../components/ui/CenteredCard';

export default function Signup() {
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
      const redirectTo = `${window.location.origin}/auth/callback?next=/onboarding`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, business }, emailRedirectTo: redirectTo }
      });
      if (error) throw error;
      setAwaitingConfirm(true);
      try { localStorage.setItem('bvx_offer_pending','1'); } catch {}
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
    }catch(err){
      alert(String((err as Error).message || err));
    }finally{
      setLoading(false);
    }
  };

  return (
    <CenteredCard>
      <h1 className="text-[40px] md:text-[56px] leading-[1.05] font-extrabold text-slate-900 text-center [text-shadow:0_1px_2px_rgba(0,0,0,0.06)]">Create your account</h1>
      <p className="text-slate-600 mt-1 text-[16px] md:text-[18px] text-center [text-shadow:0_1px_1px_rgba(0,0,0,0.04)]">Start in minutes—your dashboard is ready.</p>
      {!awaitingConfirm ? (
      <form onSubmit={onSubmit} className="mt-6 space-y-4" aria-live="polite" role="status">
      <div>
        <label className="block text-sm text-slate-700 pl-[10px]">Your name</label>
        <input
          required
          value={name}
          onChange={e=>setName(e.target.value)}
          autoComplete="name"
          className="mt-1 w-full h-12 md:h-14 border border-slate-300/60 rounded-xl px-3 bg-white/80 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-300/60 focus:border-transparent"
          placeholder="Alex Rivera"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-700 pl-[10px]">Business name</label>
        <input
          required
          value={business}
          onChange={e=>setBusiness(e.target.value)}
          autoComplete="organization"
          className="mt-1 w-full h-12 md:h-14 border border-slate-300/60 rounded-xl px-3 bg-white/80 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-300/60 focus:border-transparent"
          placeholder="Vivid Studio"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-700 pl-[10px]">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={e=>setEmail(e.target.value)}
          autoComplete="email"
          className="mt-1 w-full h-12 md:h-14 border border-slate-300/60 rounded-xl px-3 bg-white/80 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-300/60 focus:border-transparent"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-700 pl-[10px]">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={e=>setPassword(e.target.value)}
          autoComplete="new-password"
          className="mt-1 w-full h-12 md:h-14 border border-slate-300/60 rounded-xl px-3 bg-white/80 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-300/60 focus:border-transparent"
          placeholder="••••••••"
        />
      </div>
        <button disabled={loading} aria-label="Create account" className="relative w-full py-4 rounded-full bg-gradient-to-b from-pink-500 to-violet-500 text-white text-[18px] md:text-[20px] hover:from-pink-600 hover:to-violet-600 transition shadow-[inset_0_2px_0_rgba(255,255,255,.35),0_40px_80px_-32px_rgba(192,132,252,.35)]">
          <span className="absolute inset-x-0 -top-1 h-1.5 bg-white/40 blur-[2px] pointer-events-none" aria-hidden />
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
                const redirectTo = `${window.location.origin}/auth/callback?next=/onboarding`;
                await supabase.auth.resend({ type:'signup', email, options:{ emailRedirectTo: redirectTo } });
              } catch {}
            }}>Resend verification</button>
            <span className="text-slate-300">—</span>
            <button type="button" className="text-sm text-slate-700 hover:underline" onClick={async()=>{
              try{
                const googleRedirect = `${window.location.origin}/auth/callback?next=/onboarding`;
                const { data, error } = await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: googleRedirect } });
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
          className="w-full h-12 md:h-14 rounded-xl border border-slate-300/60 bg-white hover:bg-slate-50"
          onClick={async()=>{
            try{ track('signup_oauth_click',{provider:'google'}); }catch{}
            try{ localStorage.setItem('bvx_offer_pending','1'); }catch{}
            try{
              const oauthRedirect = `${window.location.origin}/auth/callback?next=/onboarding`;
              try{ localStorage.setItem('bvx_auth_in_progress','1'); }catch{}
              const { data, error } = await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: oauthRedirect } });
              if (error) {
                alert(String(error.message||error));
                return;
              }
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
            className="w-full h-12 md:h-14 rounded-xl border border-slate-300/60 bg-white hover:bg-slate-50"
            onClick={async()=>{
              try{ track('signup_oauth_click',{provider:'apple'}); }catch{}
              try{ localStorage.setItem('bvx_offer_pending','1'); }catch{}
              await supabase.auth.signInWithOAuth({ provider:'apple', options:{ redirectTo: `${window.location.origin}/onboarding?offer=1` } });
            }}
          >Continue with Apple</button>
        )}
      </div>
      <p className="text-sm text-slate-600 mt-4 pl-[10px]">
        Already have an account? <Link to="/login" className="text-pink-600 hover:underline">Sign in</Link>
      </p>
    </CenteredCard>
  );
}


