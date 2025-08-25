import { useEffect, useMemo, useRef, useState } from 'react';
import { track } from '../lib/analytics';
import { supabase } from '../lib/supabase';

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
  const [freePromptsLeft, setFreePromptsLeft] = useState<number>(()=> 2);
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

  const handleSend = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    pushUser(text);
    setBusy(true);
    window.setTimeout(()=>{
      // If still in intake
      if (idx < intakeQuestions.length){
        const key = intakeQuestions[idx].key;
        const next = { ...profile, [key]: text } as Record<string,string>;
        setProfile(next); saveProfile(next);
        try { track('intake_field',{ key }); } catch {}
        const nextIdx = idx + 1;
        setIdx(nextIdx);
        if (nextIdx < intakeQuestions.length) {
          pushAssistant(intakeQuestions[nextIdx].q);
        } else {
          pushAssistant('Perfect. Thanks! You can ask me two quick questions about BrandVX, then I’ll set you up with a full demo.');
          try { track('intake_complete'); } catch {}
          void saveRemote(next);
        }
        setBusy(false);
        return;
      }
      // Post‑intake: allow limited follow‑ups
      if (freePromptsLeft > 0) {
        const remain = freePromptsLeft - 1;
        setFreePromptsLeft(remain);
        pushAssistant(remain>0 ?
          'Great question. In short: BrandVX automates cadences, reminders, and human‑feeling follow‑ups across SMS/email while you stay in your craft.' :
          'Love that. I can show you much more with the interactive tour. Use the button below to create your BrandVX and I’ll walk you through.');
        if (remain === 0) {
          // Nudge CTA inline
          setTimeout(()=> pushAssistant('Ready when you are — click “Create your BrandVX” to continue.'), 300);
        }
        setBusy(false);
        return;
      }
      // After limit, keep nudging
      pushAssistant('Tap “Create your BrandVX” to continue the full tour.');
      setBusy(false);
    }, 400);
  };

  const skip = () => {
    try { track('intake_skip'); } catch {}
    setIdx(intakeQuestions.length);
    pushAssistant('No problem. Ask me two quick questions about BrandVX, then we’ll start your guided demo.');
  };

  const tz = useMemo(()=> Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Full-screen centered AskVX window as demo gate */}
      <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border bg-white/90 backdrop-blur shadow-md">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b">
            <div className="font-medium text-slate-800">Ask VX</div>
            {idx < intakeQuestions.length && (
              <button className="text-xs text-slate-600 hover:underline" onClick={skip}>Skip</button>
            )}
          </div>
          <div className="p-3">
            <div className="h-64 overflow-auto rounded-md border bg-white p-3 text-sm">
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
              <textarea className="flex-1 border rounded-md px-3 py-2 max-h-24 overflow-auto" rows={2} placeholder="Type here" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={(e)=>{ if (e.key==='Enter' && (e.metaKey||e.ctrlKey)) { e.preventDefault(); handleSend(); } }} />
              <button className="rounded-full px-4 py-2 bg-gradient-to-r from-blue-100 to-blue-300 hover:from-blue-200 hover:to-blue-400 shadow text-slate-900" onClick={handleSend} disabled={busy}>{busy?'…':'Send'}</button>
            </div>
            {idx >= intakeQuestions.length && (
              <div className="text-[11px] text-slate-500 mt-1">You have {freePromptsLeft} quick questions before we start the full tour.</div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={()=>{ try { track('tour_start_click',{source:'intake_gate'}); } catch{}; window.location.href='/workspace?pane=dashboard&demo=1&tour=1'; }} className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-slate-900 shadow bg-gradient-to-r from-blue-100 to-blue-300 hover:from-blue-200 hover:to-blue-400">Start guided walkthrough</button>
              <button onClick={()=>{ try { track('signup_click',{source:'intake_gate'}); } catch{}; window.location.href='/signup?from=intake'; }} className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-white shadow bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600">Create your BrandVX</button>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 -z-10" style={{
        background: 'radial-gradient(900px 400px at 10% -10%, rgba(236,72,153,0.10), transparent), radial-gradient(800px 300px at 90% -20%, rgba(99,102,241,0.12), transparent)'
      }} />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold" style={{fontFamily:'var(--font-display)'}}>Quick intro for your demo</h1>
            <div className="text-sm text-slate-600">We detected {tz}. You can adjust later.</div>
          </div>
          <div className="text-sm">
            <a href="/login" className="text-slate-700 hover:underline">Already have BrandVX? Sign in</a>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-12 gap-4 items-start">
          <div className="col-span-12 md:col-span-5 lg:col-span-4">
            <div className="rounded-2xl border bg-white/80 backdrop-blur p-3 shadow-sm" style={{minHeight: '28rem'}}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-slate-800">Ask VX</div>
                {idx < intakeQuestions.length && (
                  <button className="text-xs text-slate-600 hover:underline" onClick={skip}>Skip</button>
                )}
              </div>
              <div className="h-80 overflow-auto rounded-md border bg-white p-3 text-sm">
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
                <textarea className="flex-1 border rounded-md px-3 py-2 max-h-24 overflow-auto" rows={2} placeholder="Type here" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={(e)=>{ if (e.key==='Enter' && (e.metaKey||e.ctrlKey)) { e.preventDefault(); handleSend(); } }} />
                <button className="rounded-full px-4 py-2 bg-gradient-to-r from-blue-100 to-blue-300 hover:from-blue-200 hover:to-blue-400 shadow text-slate-900" onClick={handleSend} disabled={busy}>{busy?'…':'Send'}</button>
              </div>
              {idx >= intakeQuestions.length && (
                <div className="text-[11px] text-slate-500 mt-1">You have {freePromptsLeft} quick questions before we start the full tour.</div>
              )}
            </div>
          </div>
          <div className="col-span-12 md:col-span-7 lg:col-span-8">
            <div className="rounded-2xl border bg-white/70 backdrop-blur p-4 shadow-sm min-h-[28rem]">
              <div className="text-slate-700 text-sm">We’ll tailor the demo using your answers. You can change these later.</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={()=>{ try { track('tour_start_click',{source:'intake_panel'}); } catch{}; window.location.href='/workspace?pane=dashboard&demo=1&tour=1'; }} className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-slate-900 shadow bg-gradient-to-r from-blue-100 to-blue-300 hover:from-blue-200 hover:to-blue-400">Start guided walkthrough</button>
                <button onClick={()=>{ try { track('signup_click',{source:'persistent_cta'}); } catch{}; window.location.href='/signup?from=intake'; }} className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-white shadow bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600">Create your BrandVX</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Persistent bottom-right CTA */}
      <div className="fixed right-4 bottom-4 z-20 flex flex-col gap-2 items-end">
        <button onClick={()=>{ try { track('tour_start_click',{source:'intake_fab'}); } catch{}; window.location.href='/workspace?pane=dashboard&demo=1&tour=1'; }} className="rounded-full px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg bg-gradient-to-r from-blue-100 to-blue-300 hover:from-blue-200 hover:to-blue-400">Start guided walkthrough</button>
        <button onClick={()=>{ try { track('signup_click',{source:'floating_cta'}); } catch{}; window.location.href='/signup?from=intake'; }} className="rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600">Create your BrandVX</button>
      </div>
    </div>
  );
}


