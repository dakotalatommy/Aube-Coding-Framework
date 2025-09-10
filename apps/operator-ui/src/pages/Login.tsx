import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import CenteredCard from '../components/ui/CenteredCard';
import Button from '../components/ui/Button';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try{
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      try{
        const ret = localStorage.getItem('bvx_auth_return');
        if (ret) { localStorage.removeItem('bvx_auth_return'); window.location.assign(ret); return; }
      }catch{}
      navigate('/workspace?pane=dashboard');
    }catch(err){
      alert(String((err as Error).message || err));
    }finally{
      setLoading(false);
    }
  };

  return (
    <CenteredCard>
      <h1 className="text-[40px] md:text-[56px] leading-[1.05] font-extrabold text-slate-900 text-center [text-shadow:0_1px_2px_rgba(0,0,0,0.06)]">Sign in</h1>
      <p className="text-slate-600 mt-1 text-[16px] md:text-[18px] text-center [text-shadow:0_1px_1px_rgba(0,0,0,0.04)]">Welcome back.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" aria-live="polite" role="status">
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
          autoComplete="current-password"
          className="mt-1 w-full h-12 md:h-14 border border-slate-300/60 rounded-xl px-3 bg-white/80 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-300/60 focus:border-transparent"
          placeholder="••••••••"
        />
      </div>
        <Button disabled={loading} aria-label="Sign in" className="w-full !rounded-full !py-4 !text-[18px] md:!text-[20px]">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="text-sm text-slate-600 mt-4 pl:[10px]">
        No account? <Link to="/signup" className="text-pink-600 hover:underline">Create one</Link>
      </p>
      <div className="my-4">
        <Button
          variant="outline"
          disabled={loading}
          className="w-full h-12 md:h-14 !rounded-xl"
          onClick={async()=>{
            try{ localStorage.setItem('bvx_offer_pending','1'); }catch{}
            try{
              const next = '/onboarding';
              const fallback = '/workspace?pane=dashboard&tour=1&postVerify=1';
              const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&alt=${encodeURIComponent(fallback)}`;
              const { data, error } = await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo } });
              if (error) { alert(String(error.message||error)); return; }
              if (data && (data as any).url) window.location.assign((data as any).url as string);
            } catch(e:any){ alert(String(e?.message||e)); }
          }}
        >Continue with Google</Button>
      </div>
    </CenteredCard>
  );
}


