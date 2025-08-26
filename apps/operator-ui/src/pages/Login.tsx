import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

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
      navigate('/dashboard');
    }catch(err){
      alert(String((err as Error).message || err));
    }finally{
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="border rounded-2xl p-6 shadow-sm" style={{background:'linear-gradient(180deg, #fff, #fff8fb)'}}>
        <h1 className="text-3xl font-semibold text-slate-900">Sign in</h1>
        <p className="text-slate-600 mt-1">Welcome back. Continue to your dashboard.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-sm text-slate-600 mt-4">
          No account? <Link to="/signup" className="text-pink-600 hover:underline">Create one</Link>
        </p>
        <div className="my-4">
          <button
            disabled={loading}
            className="w-full px-4 py-2 rounded-xl border bg-white hover:shadow-sm"
            onClick={async()=>{
              try{ localStorage.setItem('bvx_offer_pending','1'); }catch{}
              try{
                const redirectTo = `${window.location.origin}/onboarding?offer=1`;
                const { data, error } = await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo } });
                if (error) { alert(String(error.message||error)); return; }
                if (data && (data as any).url) window.location.assign((data as any).url as string);
              } catch(e:any){ alert(String(e?.message||e)); }
            }}
          >Continue with Google</button>
        </div>
      </div>
    </div>
  );
}


