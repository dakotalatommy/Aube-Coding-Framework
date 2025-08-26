import { useEffect, useMemo, useRef, useState } from 'react';
import { track } from '../lib/analytics';
import { supabase } from '../lib/supabase';
import { api, getTenant } from '../lib/api';

type Msg = { role: 'user'|'assistant'; content: string };

const intakeQuestions = [
  { key:'brand',    q:'What’s your brand or studio name?' },
  { key:'services', q:'Which services do you offer? (cuts, color, lashes, nails, brows, other)' },
  { key:'booking',  q:'Do you use Square, Acuity, or something else for booking?' },
  { key:'sms',      q:'Can you use a dedicated business number for SMS?' },
  { key:'tone',     q:'Which brand tone feels right? Soft‑care, Editorial crisp, or Playful concierge?' },
  { key:'quiet',    q:'What quiet hours should we respect? (e.g., 8pm–8am). Your timezone is auto‑detected.' },
];

export default function DemoIntake(){
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const [freePromptsLeft, setFreePromptsLeft] = useState<number>(()=> 5);
  const [profile, setProfile] = useState<Record<string,string>>(()=>{
    try { return JSON.parse(localStorage.getItem('bvx_demo_profile')||'{}'); } catch { return {}; }
  });
  const started = useRef(false);

  useEffect(()=>{
    if (started.current) return;
    started.current = true;
    try { track('intake_start'); } catch {}
    pushAssistant("Quick intro for your demo. I’ll ask a few questions and then you can chat with me. You can skip anytime.");
    setTimeout(()=> pushAssistant(intakeQuestions[0].q), 250);
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
      await supabase
        .from('demo_intake')
        .upsert({ session_id: intakeId, profile: next, source: 'brandvx_landing' }, { onConflict: 'session_id' });
    } catch {}
  };

  const saveProfile = (next: Record<string,string>) => {
    try { localStorage.setItem('bvx_demo_profile', JSON.stringify(next)); } catch {}
    void saveRemote(next);
  };

  const pushAssistant = (text: string) => setMessages(m=>[...m,{role:'assistant',content:text}]);
  const pushUser = (text: string) => setMessages(m=>[...m,{role:'user',content:text}]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    pushUser(text);
    setBusy(true);
    try{
      // If still in scripted intake, capture answer and ask next scripted question
      if (idx < intakeQuestions.length){
        const key = intakeQuestions[idx].key;
        const next = { ...profile, [key]: text } as Record<string,string>;
        setProfile(next); saveProfile(next);
        try { track('intake_field',{ key }); } catch {}
        const nextIdx = idx + 1;
        setIdx(nextIdx);
        if (nextIdx < intakeQuestions.length) {
          // Keep intake snappy: advance to the next scripted question without AI
          pushAssistant(intakeQuestions[nextIdx].q);
        } else {
          pushAssistant('Perfect. Thanks! Ask me a few quick questions about BrandVX — I’ll keep it brief.');
          try { track('intake_complete'); } catch {}
          void saveRemote(next);
        }
        setBusy(false);
        return;
      }
      // Post‑intake: power replies via AskVX with a 5-turn cap
      if (freePromptsLeft > 0) {
        const r = await api.post('/ai/chat', {
          tenant_id: await getTenant(),
          messages: [ { role:'user', content: text } ],
          allow_tools: false,
          session_id: 'demo_followup',
          mode: 'sales_onboarding',
        }, { timeoutMs: 20000 }).catch(async ()=>{
          return await api.post('/ai/chat', {
            tenant_id: await getTenant(),
            messages: [ { role:'user', content: text } ],
            allow_tools: false,
            session_id: 'demo_followup_r1',
            mode: 'sales_onboarding',
          }, { timeoutMs: 20000 });
        });
        const reply = String((r as any)?.text || '').trim();
        pushAssistant(reply || 'Thanks!');
        setFreePromptsLeft(freePromptsLeft-1);
        setBusy(false);
        return;
      }
      pushAssistant('Tap “Create your BrandVX” to continue the full tour.');
    } catch(e:any){
      pushAssistant(String(e?.message||e));
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    try { track('intake_skip'); } catch {}
    setIdx(intakeQuestions.length);
    pushAssistant('No problem. Ask me two quick questions about BrandVX, then we’ll start your guided demo.');
  };

  const tz = useMemo(()=> Intl.DateTimeFormat().resolvedOptions().timeZone, []);

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
      <div aria-hidden className="absolute inset-0 -z-10" style={{
        background: 'radial-gradient(900px 400px at 10% -10%, rgba(236,72,153,0.10), transparent), radial-gradient(800px 300px at 90% -20%, rgba(99,102,241,0.12), transparent)'
      }} />
      <div className="max-w-6xl mx-auto px-4 py-6 h-full overflow-hidden flex flex-col pb-[max(env(safe-area-inset-bottom,0px),12px)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold leading-tight" style={{fontFamily:'var(--font-display)'}}>Quick intro for your demo</h1>
            <div className="text-sm text-slate-600 mt-0.5">We detected {tz}. You can adjust later.</div>
          </div>
          <div className="text-sm">
            <a href="/login" className="text-slate-700 hover:underline">Already have BrandVX? Sign in</a>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-12 gap-4 items-start flex-1 min-h-0">
          <div className="col-span-12 md:col-span-5 lg:col-span-4 h-full">
            <div className="h-full rounded-2xl border bg-white/80 backdrop-blur p-3 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-slate-800">Ask VX</div>
                {idx < intakeQuestions.length && (
                  <button className="text-xs text-slate-600 hover:underline" onClick={skip}>Skip</button>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-auto rounded-md border bg-white p-3 text-sm">
                {messages.length === 0 && (
                  <div className="text-slate-500">I’ll ask a few questions to tailor your demo. You can skip anytime.</div>
                )}
                <div className="space-y-2">
                  {messages.map((m,i)=> (
                    <div key={i} className={m.role==='user'?'text-right':'text-left'}>
                      <span className={'inline-block px-3 py-2 rounded-lg '+(m.role==='user'?'bg-sky-100 text-slate-900':'bg-slate-100 text-slate-900')}>{m.content}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex gap-2 items-start shrink-0">
                <textarea className="flex-1 border rounded-md px-3 py-2 max-h-24 overflow-auto" rows={2} placeholder="Type here" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={(e)=>{ if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } if (e.key==='Enter' && (e.metaKey||e.ctrlKey)) { e.preventDefault(); handleSend(); } }} />
                <button className="rounded-full px-4 py-2 bg-gradient-to-r from-blue-100 to-blue-300 hover:from-blue-200 hover:to-blue-400 shadow text-slate-900" onClick={handleSend} disabled={busy}>{busy?'…':'Send'}</button>
              </div>
              {idx >= intakeQuestions.length && (
                <div className="text-[11px] text-slate-500 mt-1">You have {freePromptsLeft} quick questions before we start the full tour.</div>
              )}
            </div>
          </div>
          <div className="col-span-12 md:col-span-7 lg:col-span-8 h-full">
            <div className="h-full rounded-2xl border bg-white/70 backdrop-blur p-4 shadow-sm flex flex-col">
              <div className="text-slate-700 text-sm">We’ll tailor the demo using your answers. You can change these later.</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={()=>{ try { track('tour_start_click',{source:'intake_panel'}); } catch{}; window.location.href='/workspace?pane=dashboard&demo=1&tour=1'; }} className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-slate-900 shadow bg-gradient-to-r from-blue-100 to-blue-300 hover:from-blue-200 hover:to-blue-400">Start guided walkthrough</button>
                <button onClick={()=>{ try { track('signup_click',{source:'persistent_cta'}); } catch{}; window.location.href='/signup?from=intake'; }} className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-white shadow bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600">Create your BrandVX</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Remove floating duplicate CTAs to prevent overlay/stacking */}
    </div>
  );
}


