import { useEffect, useState } from 'react';
import { track } from '../lib/analytics';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

// Trim to 3 highest-signal questions for a faster intake
const intakeQuestions = [
  { key:'brand',    q:'What’s your brand or studio name?' },
  { key:'booking',  q:'Do you use Square, Acuity, or something else for booking?' },
  { key:'tone',     q:'Which brand tone feels right? Soft‑care, Editorial crisp, or Playful concierge?' },
];

const choiceBank: Record<string, string[]> = {
  booking: ['Square','Acuity','Other / Not sure'],
  tone: ['Super chill','Warm','Balanced','Polished','Very professional'],
};

export default function DemoIntake(){
  const [input, setInput] = useState('');
  const busy = false;
  const [idx, setIdx] = useState(0);
  const [profile, setProfile] = useState<Record<string,string>>(()=>{
    try { return JSON.parse(localStorage.getItem('bvx_demo_profile')||'{}'); } catch { return {}; }
  });

  useEffect(()=>{
    try { track('intake_start'); } catch {}
    // Prefill input if saved
    const k = intakeQuestions[0].key;
    const v = (profile||{})[k] || '';
    setInput(String(v));
  }, []);

  // Ensure any persisted floater state is off on demo
  useEffect(()=>{
    try {
      localStorage.setItem('bvx-ask-open','0');
      localStorage.setItem('bvx-ask-docked','0');
    } catch {}
  },[]);

  const [intakeId] = useState<string>(() => {
    const k = 'bvx_demo_intake_session';
    const ex = localStorage.getItem(k);
    if (ex) return ex;
    const id = 'di_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(k, id);
    return id;
  });

  const saveRemote = async (next: Record<string,string>) => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) return; // avoid 403s in unauthenticated demo
      await supabase
        .from('demo_intake')
        .upsert({ session_id: intakeId, profile: next, source: 'brandvx_landing' }, { onConflict: 'session_id' });
    } catch {}
  };

  const saveProfile = (next: Record<string,string>) => {
    try { localStorage.setItem('bvx_demo_profile', JSON.stringify(next)); } catch {}
    void saveRemote(next);
  };

  const persistAnswer = (key: string, value: string) => {
    const next = { ...profile, [key]: value } as Record<string,string>;
    setProfile(next);
    saveProfile(next);
  };

  const saveSettingsPartial = async (key: string, value: string) => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) return; // skip if not authenticated (demo)
      const current = await api.get(`/settings`);
      const data = current?.data || {};
      if (key === 'brand') {
        const brand_profile = { ...(data.brand_profile||{}), name: value };
        await api.post('/settings', { brand_profile });
      } else if (key === 'booking') {
        const preferences = { ...(data.preferences||{}), booking_provider: value };
        await api.post('/settings', { preferences });
      } else if (key === 'tone') {
        const brand_profile = { ...(data.brand_profile||{}), voice: value };
        await api.post('/settings', { brand_profile });
      }
    } catch {}
  };

  const nextStep = async () => {
    if (busy) return;
    const key = intakeQuestions[idx].key;
    const val = (profile||{})[key] || input.trim();
    if (!val) return; // require answer
    persistAnswer(key, val);
    void saveSettingsPartial(key, val);
    const nextIdx = idx + 1;
    setIdx(nextIdx);
    try { track('intake_field',{ key }); } catch {}
    setInput(String((profile||{})[intakeQuestions[nextIdx]?.key] || ''));
    if (nextIdx >= intakeQuestions.length) {
      try { track('intake_complete'); } catch {}
      // Finalize: ensure both brand_profile and preferences are persisted when authenticated; otherwise skip
      try {
        const session = (await supabase.auth.getSession()).data.session;
        if (session?.access_token) {
          const current = await api.get(`/settings`);
          const data = current?.data || {};
          const brand_profile = { ...(data.brand_profile||{}), name: (profile as any).brand || val, voice: (profile as any).tone || data.brand_profile?.voice };
          const preferences = { ...(data.preferences||{}), booking_provider: (profile as any).booking || data.preferences?.booking_provider };
          await api.post('/settings', { brand_profile, preferences });
        }
      } catch {}
      try { await api.post('/onboarding/email-owner', { profile: { ...profile, [key]: val }, source: 'demo' }); } catch {}
      void saveRemote({ ...profile, [key]: val });
      // Land in demo workspace
      window.location.assign('/workspace?pane=dashboard&demo=1');
    }
  };

  const prevStep = () => {
    if (busy) return;
    const prev = Math.max(0, idx - 1);
    setIdx(prev);
    const pk = intakeQuestions[prev].key;
    setInput(String((profile||{})[pk] || ''));
  };

  // skip removed: intake is required before entering demo

  return (
    <div className="min-h-[100svh] demo-svh relative overflow-hidden bg-white">
      <style>{`#bvx-ask-float{display:none!important}`}</style>
      <style>{`
        @supports (height: 100dvh) {
          .demo-svh { min-height: 100dvh; }
        }
      `}</style>
      {/* Removed duplicate full-screen overlay to avoid double Ask UI; using inline panel below */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-white" />
      <div className="max-w-[560px] mx-auto px-4 py-8 h-full overflow-hidden flex flex-col pb-[max(env(safe-area-inset-bottom,0px),12px)] items-center justify-center">

        {/* Single auth-sized card with prev/next stepper */}
        <div className="w-full max-w-[560px] min-h-[560px] group rounded-2xl border-[3px] border-white/60 shadow-[0_24px_48px_-22px_rgba(0,0,0,0.25)] bg-white/70 backdrop-blur p-7 md:p-8 relative overflow-visible">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 w-full h-[120px] md:h-[140px] rounded-2xl blur-md opacity-70" style={{
            background: 'radial-gradient(60% 140px at 20% 20%, rgba(236,72,153,0.14), transparent 70%), radial-gradient(60% 140px at 80% 20%, rgba(99,102,241,0.12), transparent 72%)'
          }} />
          <div aria-hidden className="pointer-events-none absolute -inset-2 rounded-2xl blur-md opacity-0 transition group-hover:opacity-100" style={{
            background: 'radial-gradient(420px 180px at 20% -10%, rgba(236,72,153,0.18), transparent 60%), radial-gradient(480px 200px at 80% -15%, rgba(99,102,241,0.18), transparent 65%)'
          }} />
          <h1 className="text-[40px] md:text-[56px] leading-[1.05] font-extrabold text-slate-900 text-center">Quick demo setup</h1>
          <div className="mt-6">
            <div className="text-sm text-slate-700 mb-2">Step {idx+1} of {intakeQuestions.length}</div>
            <div className="text-[16px] md:text-[18px] font-medium text-slate-900">{intakeQuestions[idx].q}</div>
            {(choiceBank[intakeQuestions[idx].key]||[]).length>0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(choiceBank[intakeQuestions[idx].key]||[]).map((c)=> (
                  <button key={c} className={'px-3 py-1.5 rounded-full border text-sm '+(input===c?'bg-slate-900 text-white':'bg-white text-slate-800')} onClick={()=> setInput(c)}>{c}</button>
                ))}
              </div>
            )}
            <div className="mt-3">
              <input className="w-full h-12 md:h-14 border border-slate-300/60 rounded-xl px-3 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-300/60 focus:border-transparent" value={input} onChange={e=> setInput(e.target.value)} placeholder="Type your answer" />
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button className="px-4 py-2 rounded-full border bg-white text-slate-800 disabled:opacity-50" onClick={prevStep} disabled={idx===0 || busy}>Prev</button>
              <button className="px-5 py-2 rounded-full bg-gradient-to-b from-pink-500 to-violet-500 text-white disabled:opacity-50" onClick={nextStep} disabled={busy || !input.trim()}>{idx<intakeQuestions.length-1? 'Next' : 'Finish'}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Remove floating duplicate CTAs to prevent overlay/stacking */}
    </div>
  );
}

