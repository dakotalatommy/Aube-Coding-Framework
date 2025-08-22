import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try{
      const redirectTo = `${window.location.origin}/onboarding`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, business }, emailRedirectTo: redirectTo }
      });
      if (error) throw error;
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
      navigate('/onboarding');
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
        <p className="text-sm text-slate-600 mt-4">
          Already have an account? <Link to="/login" className="text-pink-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}


