import { useEffect, useRef, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
import { api, getTenant } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { track } from '../lib/analytics';
import { motion } from 'framer-motion';

type Msg = { role: 'user' | 'assistant'; content: string };
// Removed Action type and contextual actions

export default function Ask(){
  // const navigate = useNavigate();
  const { showToast } = useToast();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const streamId = useRef<number | null>(null);
  const [smartAction, setSmartAction] = useState<{ label: string; tool: string; params?: any } | null>(null);
  const [toolRunning, setToolRunning] = useState<boolean>(false);
  const [toolResult, setToolResult] = useState<any>(null);
  const [firstNoteShown, setFirstNoteShown] = useState<boolean>(() => {
    const k = 'bvx_first_prompt_note';
    return localStorage.getItem(k) === '1';
  });
  const [sessionId] = useState<string>(() => {
    const key = 'bvx_chat_session';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const sid = 's_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(key, sid);
    return sid;
  });
  // Restore cached messages for continuity across pane navigation
  useEffect(()=>{
    try{
      const cache = localStorage.getItem(`bvx_chat_cache_${sessionId}`);
      if (cache) {
        const arr = JSON.parse(cache);
        if (Array.isArray(arr)) setMessages(arr);
      }
    } catch {}
  }, [sessionId]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  // removed sessions listing
  const lastAssistantText = String(messages.filter(m=>m.role==='assistant').slice(-1)[0]?.content||'');
  // Removed plan state and tool labels
  const [trainerInput, setTrainerInput] = useState<string>('');
  const [trainerSaving, setTrainerSaving] = useState<boolean>(false);
  const [sessionSummary, setSessionSummary] = useState<string>('');
  const [summarizing, setSummarizing] = useState<boolean>(false);
  // removed getToolLabel
  const inputRef = useRef<HTMLTextAreaElement|null>(null);
  useEffect(()=>{ try{ inputRef.current?.focus(); } catch{} },[]);
  const loadHistory = async () => {
    try{
      const tid = await getTenant();
      const r = await api.get(`/ai/chat/logs?tenant_id=${encodeURIComponent(tid)}&session_id=${encodeURIComponent(sessionId)}&limit=200`);
      setHistory(r?.items||[]);
    } catch{}
  };
  // Removed loadSessions

  // Removed computeContext

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;
    const next = [...messages, { role: 'user' as const, content: prompt }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try{
      const r = await api.post('/ai/chat/raw', {
        tenant_id: await getTenant(),
        messages: next,
        session_id: sessionId,
      }, { timeoutMs: 60000 });
      if (r?.error) { setMessages(curr => [...curr, { role:'assistant', content: `Error: ${String(r.detail||r.error)}` }]); setLoading(false); return; }
      const text = String(r?.text || '');
      if (!firstNoteShown) {
        setFirstNoteShown(true);
        localStorage.setItem('bvx_first_prompt_note', '1');
      }
      setStreaming(true);
      setMessages(curr => [...curr, { role: 'assistant', content: '' }]);
      const step = Math.max(2, Math.floor(text.length / 200));
      let i = 0;
      if (streamId.current) { window.clearInterval(streamId.current); streamId.current = null; }
      streamId.current = window.setInterval(() => {
        i = Math.min(text.length, i + step);
        const chunk = text.slice(0, i);
        setMessages(curr => {
          const out = curr.slice();
          const lastIdx = out.length - 1;
          if (lastIdx >= 0 && out[lastIdx].role === 'assistant') {
            out[lastIdx] = { role: 'assistant', content: chunk };
          }
          return out;
        });
        if (i >= text.length) {
          if (streamId.current) { window.clearInterval(streamId.current); streamId.current = null; }
          setStreaming(false);
        }
      }, 20);
    } catch(e:any){
      setMessages(curr => [...curr, { role: 'assistant', content: String(e?.message||e) }]);
    } finally {
      setLoading(false);
    }
  };

  // Heuristic: propose one smart action chip based on the last assistant reply
  useEffect(()=>{
    try{
      const t = lastAssistantText.toLowerCase();
      if (!t) { setSmartAction(null); return; }
      if (t.includes('import') && t.includes('contact')) {
        setSmartAction({ label: 'Import contacts from Square', tool: 'contacts.import.square', params: {} });
        return;
      }
      if (t.includes('sync') && t.includes('calendar')) {
        setSmartAction({ label: 'Sync calendar', tool: 'calendar.sync', params: { provider: 'auto' } });
        return;
      }
      if (t.includes('send') && (t.includes('sms') || t.includes('text'))) {
        setSmartAction({ label: 'Send a test SMS', tool: 'messages.send', params: { contact_id: 'c_demo', channel: 'sms', body: 'Hi from BrandVX (demo)' } });
        return;
      }
      setSmartAction(null);
    } catch { setSmartAction(null); }
  }, [lastAssistantText]);

  const runSmartAction = async () => {
    if (!smartAction || toolRunning) return;
    try{
      setToolRunning(true);
      setToolResult({ status: 'running' });
      const r = await api.post('/ai/tools/execute', {
        tenant_id: await getTenant(),
        name: smartAction.tool,
        params: { tenant_id: await getTenant(), ...(smartAction.params||{}) },
        require_approval: false,
      });
      setToolResult(r || { status: 'ok' });
      try { showToast({ title: 'Action executed', description: smartAction.label }); } catch {}
    } catch(e:any){
      setToolResult({ status: 'error', detail: String(e?.message||e) });
      try { showToast({ title: 'Action failed', description: String(e?.message||e) }); } catch {}
    } finally {
      setToolRunning(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter; allow newline with Shift+Enter; keep Cmd/Ctrl+Enter support
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
      return;
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  };

  const reset = () => { setMessages([]); setInput(''); };
  const saveTrainerNotes = async () => {
    try{
      if (!trainerInput.trim()) { showToast({ title:'Nothing to save', description:'Add a note first.' }); return; }
      setTrainerSaving(true);
      const tid = await getTenant();
      const r = await api.get(`/settings?tenant_id=${encodeURIComponent(tid)}`);
      const current = String(r?.data?.training_notes||'');
      const next = (current ? current + '\n' : '') + trainerInput.trim();
      await api.post('/settings', { tenant_id: tid, training_notes: next });
      setTrainerInput('');
      showToast({ title:'Saved', description:'Added to brand training notes.' });
      try { track('brand_trainer_saved'); } catch {}
    } catch(e:any){ showToast({ title:'Save error', description:String(e?.message||e) }); }
    finally { setTrainerSaving(false); }
  };
  const summarizeSession = async () => {
    try{
      if (summarizing) return;
      setSummarizing(true);
      const tid = await getTenant();
      const prompt = 'Summarize this chat session for a beauty professional in 4 short bullets: focus on wins, next steps, and any data insights. Keep proper nouns. Avoid sensitive data.';
      const msgs = messages.length > 0 ? [...messages, { role:'user' as const, content: prompt }] : [{ role:'user' as const, content: prompt }];
      const r = await api.post('/ai/chat/raw', { tenant_id: tid, session_id: sessionId, messages: msgs }, { timeoutMs: 45000 });
      const text = String(r?.text||'');
      if (!text) { showToast({ title:'No summary', description:'The model did not return text.' }); return; }
      setSessionSummary(text);
      // Persist summary to backend so it’s available on reopen
      try { await api.post('/ai/chat/session/summary', { tenant_id: tid, session_id: sessionId, summary: text }); } catch {}
      try { track('ask_session_summarized'); } catch {}
    } catch(e:any){ showToast({ title:'Summary error', description:String(e?.message||e) }); }
    finally { setSummarizing(false); }
  };
  // removed goto helper

  useEffect(() => {
    return () => { if (streamId.current) { window.clearInterval(streamId.current); streamId.current = null; } };
  }, []);

  // Auto-summarize last session once on mount
  useEffect(()=>{ (async()=>{ try{ await summarizeSession(); } catch{} })(); },[]);

  const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const embedded = sp.get('embed') === '1';
  const askIsDemo = sp.get('demo') === '1';
  const initialPage = sp.get('page') === '2' ? 1 : 0;
  const [pageIdx, setPageIdx] = useState<number>(initialPage);

  return (
    <div className={`h-full min-h-0 flex flex-col min-w-0 overflow-x-hidden`}>
      {askIsDemo && (
        <div className="rounded-2xl p-3 border bg-amber-50/80 border-amber-200 text-amber-900">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Demo mode — chat replies are simulated.</span>
            <a href="/signup" className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-sm">Create account</a>
            <a href="/billing" className="px-3 py-1.5 rounded-full border bg-white text-sm">Add payment</a>
          </div>
        </div>
      )}
      {!embedded && (
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold" style={{fontFamily:'var(--font-display)'}}>Brand&nbsp;VX</h3>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border bg-white overflow-hidden">
              <button className={`px-3 py-1 text-sm ${pageIdx===0? 'bg-slate-900 text-white':'text-slate-700'}`} onClick={()=> setPageIdx(0)}>Chat</button>
              <button className={`px-3 py-1 text-sm ${pageIdx===1? 'bg-slate-900 text-white':'text-slate-700'}`} onClick={()=> setPageIdx(1)}>Train & Profile</button>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <button className="px-2 py-1 text-xs border rounded-md bg-white" onClick={()=> setPageIdx(p=> Math.max(0, p-1))} disabled={pageIdx===0}>Prev</button>
              <button className="px-2 py-1 text-xs border rounded-md bg-white" onClick={()=> setPageIdx(p=> Math.min(1, p+1))} disabled={pageIdx===1}>Next</button>
            </div>
            {/* Top-right onboarding/get started removed */}
          </div>
        </div>
      )}
      {/* "This week" section removed */}
      {pageIdx===0 && (
      <div className={`grid ${embedded ? 'grid-cols-3' : 'grid-cols-3'} items-center gap-2 text-sm`}>
        <div className="flex items-center gap-2">
          <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={()=>{ setHistoryOpen(h=>!h); if (!historyOpen) void loadHistory(); }}>{historyOpen ? 'Hide history' : 'Show history'}</button>
          <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={()=>{ const sid = 's_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('bvx_chat_session', sid); window.location.reload(); }}>New session</button>
          {/* Sessions button removed */}
        </div>
        <div className="flex items-center">
          <div className="font-semibold" style={{fontFamily:'var(--font-display)'}}>Ask VX</div>
        </div>
        <div className="flex items-center justify-end" />
      </div>
      )}
      {pageIdx===0 && historyOpen && (
        <div className="rounded-xl bg-white shadow-sm p-3 max-h-40 overflow-auto text-xs text-slate-700 border">
          {history.length === 0 ? <div>No messages yet.</div> : (
            <ul className="space-y-1">
              {history.map(h=> (
                <li key={h.id}><span className="font-medium">{h.role}</span>: {h.content}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {pageIdx===0 && (
      <div className={`rounded-xl bg-white shadow-sm p-3 border flex-1 min-h-0 overflow-auto min-w-0`} aria-live="polite" aria-atomic="false" role="log">
        {messages.length === 0 && (
          <div className="text-sm text-slate-500">Start a conversation below.</div>
        )}
        <div className="space-y-2">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <span className={
                'inline-block px-3 py-2 rounded-lg text-sm ' +
                (m.role === 'user' ? 'bg-sky-100 text-slate-900' : 'bg-slate-100 text-slate-900')
              }>
                {m.content}
              </span>
            </div>
          ))}
          {(loading || streaming) && (
            <div className="text-left" aria-live="assertive" aria-atomic="true">
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-slate-100 text-slate-900">
                <span>AskVX is typing</span>
                <span className="inline-flex ml-1 items-end">
                  <motion.span className="w-1.5 h-1.5 bg-slate-600 rounded-full"
                    animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.6] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: 0 }} />
                  <motion.span className="w-1.5 h-1.5 bg-slate-600 rounded-full ml-1"
                    animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.6] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }} />
                  <motion.span className="w-1.5 h-1.5 bg-slate-600 rounded-full ml-1"
                    animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.6] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }} />
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
      )}
      {pageIdx===0 && smartAction && (
        <div className="mt-2">
          <button className="px-3 py-1.5 text-xs rounded-full border bg-white hover:shadow-sm" onClick={runSmartAction} disabled={toolRunning}>
            {toolRunning ? 'Running…' : smartAction.label}
          </button>
          {toolResult && (
            <div className="mt-1 text-[11px] text-slate-600">
              {toolResult.status === 'running' ? 'Starting…' : `Result: ${String(toolResult.status||'ok')}`}
              {new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').has('dev') && (
                <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(toolResult, null, 2)}</pre>
              )}
            </div>
          )}
        </div>
      )}
      {pageIdx===0 && !embedded && !askIsDemo && (
      <div className="flex flex-wrap gap-2 text-xs">
        <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={async()=>{ setInput('What can BrandVX do for me? Keep it concise and tailored to beauty pros.'); await Promise.resolve(); void send(); }}>What can BrandVX do?</button>
        <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={async()=>{ setInput('How do I get started? Give me the first 3 actions and where to click.'); await Promise.resolve(); void send(); }}>How do I get started?</button>
        <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={async()=>{ setInput('Create a 48‑hour plan to show quick wins. Ask me any intro questions you need first (services, avg ticket, schedule, audience, platform preference).'); await Promise.resolve(); void send(); }}>Create a 48‑hour plan</button>
      </div>
      )}
      {/* Last session summary moved to bottom and auto-populated */}
      {pageIdx===0 && (
      <div className={`flex gap-2 items-start ${embedded ? 'shrink-0' : 'shrink-0'} pb-[max(env(safe-area-inset-bottom,0px),0px)]`}>
        <textarea
          className={`flex-1 border rounded-md px-3 py-2 ${embedded ? 'min-h-[120px]' : ''}`}
          rows={3}
          placeholder="How can I save you time today?"
          value={input}
          onFocus={()=>{ if (!input) setInput(''); }}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={onKeyDown}
          ref={inputRef}
        />
        <div className="flex flex-col gap-2">
          <button className="border rounded-full px-4 py-2 bg-gradient-to-r from-blue-100 to-blue-300 hover:from-blue-200 hover:to-blue-400 shadow text-slate-900" onClick={send} disabled={loading || streaming}>
            {loading ? 'Sending…' : 'Send'}
          </button>
          <button className="text-sm text-slate-600 hover:underline" onClick={reset}>Clear</button>
        </div>
      </div>
      )}
      {!firstNoteShown && (
        <div className="text-xs text-slate-500 mt-1 shrink-0">(Responses may take a moment to ensure quality!)</div>
      )}
      {false && lastAssistantText && (<div />)}
      {pageIdx===1 && (
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl bg-white shadow-sm p-3 border">
            <div className="text-sm font-semibold text-slate-900">Train VX</div>
            <textarea className="mt-2 w-full border rounded-md px-2 py-1 text-sm" rows={4} placeholder="Add a brand fact, tone note, or preference…" value={trainerInput} onChange={e=>setTrainerInput(e.target.value)} />
            <div className="mt-2 flex justify-end">
              <button className="border rounded-md px-3 py-1 bg-white hover:shadow-sm text-xs" onClick={saveTrainerNotes} disabled={trainerSaving}>{trainerSaving ? 'Saving…' : 'Save to training'}</button>
            </div>
          </div>
          <ProfileEditor />
        </div>
      )}
      {/* Bottom: Last session summary (auto) */}
      {!embedded && !askIsDemo && (
        <div className="mt-2 rounded-xl bg-white shadow-sm p-3 border">
          <div className="text-sm font-semibold text-slate-900">Last session summary</div>
          <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap min-h-[48px]">{sessionSummary || '—'}</div>
        </div>
      )}
    </div>
  );
}

function ProfileEditor(){
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tone, setTone] = useState('');
  const [brandProfile, setBrandProfile] = useState('');
  const [avgPrice, setAvgPrice] = useState<string>('');
  const [avgTime, setAvgTime] = useState<string>('');
  const [monthlyRent, setMonthlyRent] = useState<string>('');
  const [primaryGoal, setPrimaryGoal] = useState('');
  useEffect(()=>{ (async()=>{
    try{
      const tid = await getTenant();
      const r = await api.get(`/settings?tenant_id=${encodeURIComponent(tid)}`);
      const bp = r?.data?.brand_profile || {};
      const goals = r?.data?.goals || {};
      setTone(String(bp?.voice||''));
      setBrandProfile(String(bp?.about||''));
      setAvgPrice(String(r?.data?.avg_service_price_cents ? (Number(r.data.avg_service_price_cents)/100).toFixed(2) : ''));
      setAvgTime(String(r?.data?.avg_service_minutes || ''));
      setMonthlyRent(String(r?.data?.monthly_rent_cents ? (Number(r.data.monthly_rent_cents)/100).toFixed(2) : ''));
      setPrimaryGoal(String(goals?.primary||''));
    } finally { setLoading(false); }
  })(); },[]);
  const save = async()=>{
    try{
      setSaving(true);
      const tid = await getTenant();
      const priceCents = Math.round(Number(avgPrice||'0')*100)||0;
      const rentCents = Math.round(Number(monthlyRent||'0')*100)||0;
      const bp = { voice: tone, about: brandProfile };
      const goals = { primary: primaryGoal };
      await api.post('/settings', { tenant_id: tid, brand_profile: bp, goals, avg_service_price_cents: priceCents, avg_service_minutes: Number(avgTime||'0')||0, monthly_rent_cents: rentCents });
      showToast({ title:'Saved', description:'Profile updated.' });
    } catch(e:any){ showToast({ title:'Save error', description:String(e?.message||e) }); }
    finally{ setSaving(false); }
  };
  if (loading) return <div className="rounded-xl bg-white p-3 border text-sm text-slate-600">Loading…</div>;
  return (
    <div className="rounded-xl bg-white shadow-sm p-3 border">
      <div className="text-sm font-semibold text-slate-900">Brand profile</div>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        <label className="grid gap-1">
          <span className="text-slate-600 text-xs">Tone</span>
          <input className="border rounded-md px-2 py-1" value={tone} onChange={e=>setTone(e.target.value)} placeholder="Warm, Editorial crisp…" />
        </label>
        <label className="grid gap-1">
          <span className="text-slate-600 text-xs">Primary goal</span>
          <input className="border rounded-md px-2 py-1" value={primaryGoal} onChange={e=>setPrimaryGoal(e.target.value)} placeholder="Fill Fridays, retain first‑timers…" />
        </label>
        <label className="md:col-span-2 grid gap-1">
          <span className="text-slate-600 text-xs">About / Brand profile</span>
          <textarea className="border rounded-md px-2 py-1" rows={3} value={brandProfile} onChange={e=>setBrandProfile(e.target.value)} placeholder="Short brand description, specialties, vibe…" />
        </label>
        <label className="grid gap-1">
          <span className="text-slate-600 text-xs">Avg service price ($)</span>
          <input className="border rounded-md px-2 py-1" inputMode="decimal" value={avgPrice} onChange={e=>setAvgPrice(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-slate-600 text-xs">Avg service time (min)</span>
          <input className="border rounded-md px-2 py-1" inputMode="numeric" value={avgTime} onChange={e=>setAvgTime(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-slate-600 text-xs">Monthly rent ($)</span>
          <input className="border rounded-md px-2 py-1" inputMode="decimal" value={monthlyRent} onChange={e=>setMonthlyRent(e.target.value)} />
        </label>
      </div>
      <div className="mt-2 flex justify-end">
        <button className="border rounded-md px-3 py-1 bg-white hover:shadow-sm text-xs" onClick={save} disabled={saving}>{saving? 'Saving…' : 'Save profile'}</button>
      </div>
    </div>
  );
}


