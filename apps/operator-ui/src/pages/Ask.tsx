import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getTenant } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { startGuide, startWorkflowGuide } from '../lib/guide';
import { track } from '../lib/analytics';
import { motion } from 'framer-motion';

type Msg = { role: 'user' | 'assistant'; content: string };
type Action =
  | 'open_integrations'
  | 'connect_twilio'
  | 'tour_all'
  | 'open_inventory'
  | 'check_lowstock'
  | 'open_messages'
  | 'open_contacts'
  | 'import_contacts'
  | 'open_calendar'
  | 'open_approvals'
  | 'open_workflows'
  | 'open_cadences'
  | 'open_inbox'
  | 'open_onboarding'
  | 'guide_dashboard'
  | 'guide_integrations'
  | 'guide_onboarding'
  | 'guide_workflows'
  | 'admin_clear_cache';

export default function Ask(){
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const streamId = useRef<number | null>(null);
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
  const [sessions, setSessions] = useState<Array<{session_id:string; last_message_at:number}>>([]);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [contextActions, setContextActions] = useState<Action[]>([]);
  const lastAssistantText = String(messages.filter(m=>m.role==='assistant').slice(-1)[0]?.content||'');
  // Plan builder state: fetch plan, show steps as radio, execute selected or all
  const [planName, setPlanName] = useState<''|'crm_organization'|'book_filling'|'inventory_tracking'|'social_automation'>('');
  const [planSteps, setPlanSteps] = useState<any[]>([]);
  const [selectedStepIdx, setSelectedStepIdx] = useState<number>(0);
  // Friendly error surface for unknown plans or planner errors
  const [friendlyError, setFriendlyError] = useState<string>('');
  // Human-readable tool labels
  const [toolLabels, setToolLabels] = useState<Record<string,string>>({});
  const getToolLabel = (toolName: string): string => {
    const name = String(toolName||'');
    return toolLabels[name] || name;
  };
  const loadHistory = async () => {
    try{
      const tid = await getTenant();
      const r = await api.get(`/ai/chat/logs?tenant_id=${encodeURIComponent(tid)}&session_id=${encodeURIComponent(sessionId)}&limit=200`);
      setHistory(r?.items||[]);
    } catch{}
  };
  const loadSessions = async () => {
    try{
      const tid = await getTenant();
      const r = await api.get(`/ai/chat/sessions?tenant_id=${encodeURIComponent(tid)}&limit=50`);
      setSessions(Array.isArray(r?.items) ? r.items : []);
    } catch{}
  };

  const computeContext = (promptText: string, assistText?: string): Action[] => {
    try {
      const p = (promptText||'').toLowerCase();
      const t = (assistText||'').toLowerCase();
      const matches = (re: RegExp) => re.test(p) || (!!t && re.test(t));
      const acts: Action[] = [];
      if (matches(/integrations?|connect\s+tools?|connect\s+(square|acuity|hubspot|google|facebook|instagram|shopify|sms|twilio)/)) {
        acts.push('open_integrations');
        if (/twilio|sms/.test(p)) acts.push('connect_twilio');
        acts.push('guide_integrations');
      }
      if (matches(/inventory|stock|low\s*stock|out\s*of\s*stock|shopify\s*inventory|square\s*inventory/)) {
        acts.push('open_inventory', 'check_lowstock');
        acts.push('guide_workflows');
      }
      if (matches(/messages?|sms|email|send|inbox/)) {
        acts.push('open_messages');
        if (matches(/inbox/)) acts.push('open_inbox');
      }
      if (matches(/contacts?|clients?|import|dedupe|export/)) {
        acts.push('open_contacts');
        if (matches(/import|upload/)) acts.push('import_contacts');
        acts.push('guide_workflows');
      }
      if (matches(/calendar|booking|schedule|appointments?/)) {
        acts.push('open_calendar');
      }
      if (matches(/approvals?|review|pending/)) {
        acts.push('open_approvals');
      }
      if (matches(/cadences?|automation|follow[- ]?ups?/)) {
        acts.push('open_cadences');
      }
      if (matches(/workflows?|plan|automation/)) {
        acts.push('open_workflows', 'guide_workflows');
      }
      if (matches(/onboarding|setup|get\s+started/)) {
        acts.push('open_onboarding', 'guide_onboarding');
      }
      if (matches(/clear\s+cache|flush\s+cache|stale\s+data|refresh\s+(data|cache)/)) {
        acts.push('admin_clear_cache');
      }
      if (matches(/tour|walkthrough|guide\s+me/)) {
        acts.push('tour_all');
      }
      return acts;
    } catch { return []; }
  };

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;
    const next = [...messages, { role: 'user' as const, content: prompt }];
    setMessages(next);
    setInput('');
    setLoading(true);
    // Prompt-first suggestions
    setContextActions(computeContext(prompt));
    try{
      const r = await api.post('/ai/chat', {
        tenant_id: await getTenant(),
        messages: next,
        allow_tools: false,
        session_id: sessionId,
      }, { timeoutMs: 20000 });
      const text = String(r?.text || '');
      // Refine contextual actions with assistant text
      setContextActions(computeContext(prompt, text));
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
  const setShortcut = (text: string) => { setInput(text); };
  const clearTenantCache = async () => {
    try{
      const tid = await getTenant();
      const r = await api.post('/admin/cache/clear', { tenant_id: tid, scope: 'all' });
      showToast({ title: 'Cache cleared', description: `Cleared ${Number(r?.cleared||0)} keys.` });
    } catch(e:any) {
      showToast({ title: 'Cache error', description: String(e?.message||e) });
    }
  };
  const goto = (path: string) => {
    try {
      // Cache messages before navigating parent
      try { localStorage.setItem(`bvx_chat_cache_${sessionId}`, JSON.stringify(messages)); } catch {}
      // If Ask is embedded in the docked iframe, navigate the parent window
      const isEmbedded = (typeof window !== 'undefined') && (window.self !== window.top);
      if (isEmbedded && (window.parent && 'location' in window.parent)) {
        (window.parent as any).location.href = path;
        return;
      }
      navigate(path);
    } catch {
      window.location.href = path;
    }
  };
  const guideTo = (page: 'dashboard'|'integrations'|'onboarding') => {
    const map = { dashboard: '/workspace?pane=dashboard&tour=1', integrations: '/workspace?pane=integrations&tour=1', onboarding: '/onboarding?tour=1' } as const;
    goto(map[page]);
  };

  useEffect(() => {
    return () => { if (streamId.current) { window.clearInterval(streamId.current); streamId.current = null; } };
  }, []);

  // Load human-readable tool labels for AskVX plan/toasts
  useEffect(() => {
    (async () => {
      try{
        const schema = await api.get('/ai/tools/schema_human');
        // Accept either { tools: [{name,label|title}]} or { [name]: label }
        const map: Record<string,string> = {};
        if (schema && Array.isArray(schema.tools)) {
          for (const t of schema.tools) {
            const n = t?.name || t?.id || '';
            const lbl = t?.label || t?.title || t?.description || '';
            if (n && lbl) map[String(n)] = String(lbl);
          }
        } else if (schema && typeof schema === 'object') {
          for (const k of Object.keys(schema)) {
            const v = (schema as any)[k];
            if (typeof v === 'string') map[k] = v;
            else if (v && typeof v === 'object' && (v.label || v.title)) map[k] = String(v.label || v.title);
          }
        }
        if (Object.keys(map).length > 0) setToolLabels(map);
      } catch {}
    })();
  }, []);

  const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const embedded = sp.get('embed') === '1';
  const BOOKING_URL = (import.meta as any).env?.VITE_BOOKING_URL || '';

  const [running, setRunning] = useState<string>('');
  const [TENANT_ID, setTenantId] = useState<string>(localStorage.getItem('bvx_tenant') || 't1');
  useEffect(()=>{ (async()=>{ try{ setTenantId(await getTenant()); } catch{} })(); },[]);
  const planKey = (name?: string) => `bvx_plan_queue_${TENANT_ID}${name?`_${name}`:''}`;
  const getSavedQueue = () => {
    try { const v = localStorage.getItem(planKey()); return v? JSON.parse(v): null; } catch { return null; }
  };
  const saveQueue = (name: string, stepsLeft: any[]) => {
    try { localStorage.setItem(planKey(), JSON.stringify({ name, stepsLeft })); } catch {}
  };
  const clearQueue = () => { try { localStorage.removeItem(planKey()); } catch {} };
  const runPlan = async (name: 'crm_organization'|'book_filling'|'inventory_tracking'|'social_automation') => {
    if (running) return;
    setRunning(name);
    try{
      // Optionally kick off a tour on the workflows page in parallel
      try { startGuide('workflows'); } catch {}
      const plan = await api.post('/ai/workflow/plan', { tenant_id: TENANT_ID, name });
      try { track('ask_plan_start', { name }); } catch {}
      const steps = Array.isArray(plan?.steps) ? plan.steps : [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const tool = step.tool as string;
        const requires = Boolean(step.requiresApproval);
        // Handle pseudo-tools for link/oauth/import/preview
        if (tool === 'link.hubspot.signup') {
          window.open('https://app.hubspot.com/signup', '_blank');
          continue;
        }
        if (tool === 'oauth.hubspot.connect') {
          try {
            const j = await api.get(`/oauth/hubspot/login?tenant_id=${TENANT_ID}`);
            if (j?.url) window.open(j.url, '_blank');
            showToast({ title:'Connect HubSpot', description:'Opened HubSpot connect in a new tab.' });
          } catch {}
          continue;
        }
        if (tool === 'crm.hubspot.import') {
          try {
            const r = await api.post('/crm/hubspot/import', { tenant_id: TENANT_ID });
            showToast({ title:'Imported', description:`${Number(r?.imported||0)} contacts imported from HubSpot.` });
          } catch (e:any) { showToast({ title:'Import error', description:String(e?.message||e) }); }
          continue;
        }
        if (tool === 'segment.dormant.preview' || tool === 'campaigns.dormant.preview') {
          try {
            const r = await api.get(`/campaigns/dormant/preview?tenant_id=${TENANT_ID}&threshold_days=60`);
            showToast({ title:'Segment preview', description:`${Number(r?.count||0)} contacts dormant ≥60d.` });
          } catch {}
          continue;
        }
        const res = await api.post('/ai/tools/execute', {
          tenant_id: TENANT_ID,
          name: tool,
          params: { tenant_id: TENANT_ID },
          require_approval: requires,
        });
        if (res?.status === 'pending') {
          try { track('ask_plan_step_pending', { name, tool }); } catch {}
          showToast({ title: 'Approval required', description: `"${getToolLabel(tool)}" is pending. Review in Approvals.` });
          // Save remaining steps (including current) to resume later
          saveQueue(name, steps.slice(i));
          // Stop execution and guide the user to Approvals
          goto('/workspace?pane=approvals');
          return;
        }
        if (res?.status === 'error') {
          try { track('ask_plan_step_error', { name, tool }); } catch {}
          showToast({ title: 'Step failed', description: String(res?.message || res?.detail || getToolLabel(tool)) });
          return;
        }
        try { track('ask_plan_step_done', { name, tool }); } catch {}
        showToast({ title: 'Step complete', description: `${getToolLabel(tool)} → ${res?.status||'ok'}` });
      }
      try { track('ask_plan_done', { name }); } catch {}
      // Mark workflow as completed in settings progress map
      try { await api.post('/settings', { tenant_id: TENANT_ID, wf_progress: { [name]: true } }); } catch {}
      showToast({ title: 'Plan finished', description: 'All steps completed.' });
      clearQueue();
    } catch(e:any){
      showToast({ title: 'Plan error', description: String(e?.message||e) });
    } finally {
      setRunning('');
    }
  };

  const openPlan = async (name: 'crm_organization'|'book_filling'|'inventory_tracking'|'social_automation') => {
    if (running) return;
    try {
      setPlanName(name);
      const plan = await api.post('/ai/workflow/plan', { tenant_id: TENANT_ID, name });
      const steps = Array.isArray(plan?.steps) ? plan.steps : [];
      setPlanSteps(steps);
      setSelectedStepIdx(0);
      if (steps.length === 0) {
        setFriendlyError('I couldn’t map that request to a known workflow. Try one of the preset plans below or ask me again in different words.');
      } else {
        setFriendlyError('');
      }
      try { track('ask_plan_builder_open', { name, steps: steps.length }); } catch {}
    } catch (e:any) {
      showToast({ title: 'Plan error', description: String(e?.message||e) });
      setPlanName(''); setPlanSteps([]);
      setFriendlyError('Something went wrong generating the plan. Please try again, or pick a preset below — we’ll guide you.');
    }
  };

  const executeOneStep = async () => {
    if (running || !planName || !Array.isArray(planSteps) || planSteps.length === 0) return;
    const idx = Math.max(0, Math.min(selectedStepIdx || 0, planSteps.length - 1));
    const step = planSteps[idx];
    await executeStepInternal(planName, step, idx, true);
  };

  const executeAllSteps = async () => {
    if (running || !planName || !Array.isArray(planSteps) || planSteps.length === 0) return;
    setRunning(planName);
    try {
      for (let i = 0; i < planSteps.length; i++) {
        const step = planSteps[i];
        const cont = await executeStepInternal(planName, step, i, false);
        if (!cont) return; // stopped due to approval or error
      }
      showToast({ title: 'Plan finished', description: 'All steps completed.' });
      clearQueue();
    } catch(e:any){
      showToast({ title: 'Plan error', description: String(e?.message||e) });
    } finally {
      setRunning('');
    }
  };

  const executeStepInternal = async (name: string, step: any, index: number, single: boolean): Promise<boolean> => {
    const tool = String(step?.tool||'');
    const requires = Boolean(step?.requiresApproval);
    try {
      // Same pseudo-tools handling as runPlan
      if (tool === 'link.hubspot.signup') { window.open('https://app.hubspot.com/signup','_blank'); showToast({ title:'Open HubSpot', description:'Sign up in the new tab, then return.' }); return true; }
      if (tool === 'oauth.hubspot.connect') {
        try { const j = await api.get(`/oauth/hubspot/login?tenant_id=${TENANT_ID}`); if (j?.url) window.open(j.url,'_blank'); showToast({ title:'Connect HubSpot', description:'Opened HubSpot connect in a new tab.' }); } catch {}
        return true;
      }
      if (tool === 'crm.hubspot.import') {
        try { const r = await api.post('/crm/hubspot/import', { tenant_id: TENANT_ID }); showToast({ title:'Imported', description:`${Number(r?.imported||0)} contacts imported from HubSpot.` }); } catch(e:any){ showToast({ title:'Import error', description:String(e?.message||e) }); }
        return true;
      }
      if (tool === 'segment.dormant.preview' || tool === 'campaigns.dormant.preview') {
        try { const r = await api.get(`/campaigns/dormant/preview?tenant_id=${TENANT_ID}&threshold_days=60`); showToast({ title:'Segment preview', description:`${Number(r?.count||0)} contacts dormant ≥60d.` }); } catch {}
        return true;
      }
      // Execute real tool
      const res = await api.post('/ai/tools/execute', { tenant_id: TENANT_ID, name: tool, params: { tenant_id: TENANT_ID }, require_approval: requires });
      if (res?.status === 'pending') {
        showToast({ title: 'Approval required', description: `"${getToolLabel(tool)}" is pending. Review in Approvals.` });
        saveQueue(name, single ? [step] : planSteps.slice(index));
        goto('/workspace?pane=approvals');
        return false;
      }
      if (res?.status === 'error') {
        showToast({ title: 'Step failed', description: String(res?.message||res?.detail||getToolLabel(tool)) });
        return false;
      }
      showToast({ title: 'Step complete', description: `${getToolLabel(tool)} → ${res?.status||'ok'}` });
      return true;
    } catch(e:any) {
      showToast({ title: 'Step error', description: String(e?.message||e) });
      return false;
    }
  };

  const resumePlan = async () => {
    if (running) return;
    const saved = getSavedQueue();
    if (!saved?.name || !Array.isArray(saved.stepsLeft) || saved.stepsLeft.length === 0) {
      showToast({ title: 'Nothing to resume', description: 'No pending plan was found.' });
      return;
    }
    const name = saved.name as 'crm_organization'|'book_filling'|'inventory_tracking'|'social_automation';
    setRunning(name);
    try {
      for (let i = 0; i < saved.stepsLeft.length; i++) {
        const step = saved.stepsLeft[i];
        const tool = step.tool as string;
        const requires = Boolean(step.requiresApproval);
        if (tool === 'link.hubspot.signup') { window.open('https://app.hubspot.com/signup','_blank'); continue; }
        if (tool === 'oauth.hubspot.connect') {
          try { const j = await api.get(`/oauth/hubspot/login?tenant_id=${TENANT_ID}`); if (j?.url) window.open(j.url,'_blank'); showToast({ title:'Connect HubSpot', description:'Opened HubSpot connect in a new tab.' }); } catch {}
          continue;
        }
        if (tool === 'crm.hubspot.import') { try { const r = await api.post('/crm/hubspot/import', { tenant_id: TENANT_ID }); showToast({ title:'Imported', description:`${Number(r?.imported||0)} contacts imported from HubSpot.` }); } catch(e:any){ showToast({ title:'Import error', description:String(e?.message||e) }); } continue; }
        if (tool === 'segment.dormant.preview' || tool === 'campaigns.dormant.preview') { try { const r = await api.get(`/campaigns/dormant/preview?tenant_id=${TENANT_ID}&threshold_days=60`); showToast({ title:'Segment preview', description:`${Number(r?.count||0)} contacts dormant ≥60d.` }); } catch{} continue; }
        const res = await api.post('/ai/tools/execute', {
          tenant_id: TENANT_ID,
          name: tool,
          params: { tenant_id: TENANT_ID },
          require_approval: requires,
        });
        if (res?.status === 'pending') {
          saveQueue(name, saved.stepsLeft.slice(i));
          showToast({ title: 'Still pending', description: `"${getToolLabel(tool)}" requires approval. Review in Approvals.` });
          goto('/workspace?pane=approvals');
          return;
        }
        if (res?.status === 'error') {
          showToast({ title: 'Step failed', description: String(res?.message || res?.detail || getToolLabel(tool)) });
          return;
        }
        showToast({ title: 'Step complete', description: `${getToolLabel(tool)} → ${res?.status||'ok'}` });
      }
      clearQueue();
      showToast({ title: 'Plan finished', description: 'All steps completed.' });
    } catch(e:any){
      showToast({ title: 'Resume error', description: String(e?.message||e) });
    } finally {
      setRunning('');
    }
  };
  const isDemo = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('demo') === '1';
  return (
    <div className={`${embedded ? 'h-full min-h-0 flex flex-col min-w-0 overflow-x-hidden' : 'space-y-3'} ${embedded ? '' : ''}`}>
      {isDemo && (
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
            {BOOKING_URL && <a href={BOOKING_URL} target="_blank" rel="noreferrer" className="inline-flex items-center px-3 py-2 rounded-full text-sm border bg-white">Book onboarding</a>}
            <a href="/onboarding" className="inline-flex items-center px-3 py-2 rounded-full text-sm text-white shadow bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600">Get started</a>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 items-center gap-2 text-sm">
        <div className="flex items-center gap-2">
          <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={()=>{ setHistoryOpen(h=>!h); if (!historyOpen) void loadHistory(); }}>{historyOpen ? 'Hide history' : 'Show history'}</button>
          <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={()=>{ const sid = 's_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('bvx_chat_session', sid); window.location.reload(); }}>New session</button>
          <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={()=>{ void loadSessions(); }}>Sessions</button>
        </div>
        <div className="flex items-center">
          <div className="font-semibold" style={{fontFamily:'var(--font-display)'}}>Ask VX</div>
        </div>
        <div className="flex items-center justify-end">
          <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={async()=>{
          try{
            const tid = await getTenant();
            const last = messages.filter(m=>m.role==='assistant').slice(-1)[0]?.content || messages.slice(-1)[0]?.content || 'Shared from BrandVX';
            const title = (last || 'BrandVX').slice(0, 80);
            const r = await api.post('/share/create', { tenant_id: tid, title, description: last, image_url: '', caption: '', kind: 'ask_share' });
            const url = String(r?.url || '');
            if (url) {
              setShareUrl(url);
              try { await navigator.clipboard.writeText(url); } catch {}
            }
          } catch {}
        }}>Share</button>
        </div>
      </div>
      {shareUrl && (
        <div className="text-xs text-slate-600 mt-1">Share link copied: <a className="underline" href={shareUrl} target="_blank" rel="noreferrer">{shareUrl}</a></div>
      )}
      {sessions.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm p-3 max-h-32 overflow-auto text-xs text-slate-700 mt-2 border">
          <ul className="space-y-1">
            {sessions.map(s => (
              <li key={s.session_id}>
                <button className="underline" onClick={() => { localStorage.setItem('bvx_chat_session', s.session_id); window.location.reload(); }}>
                  {s.session_id}
                </button>
                <span className="text-slate-500 ml-2">{new Date((s.last_message_at<1e12? s.last_message_at*1000 : s.last_message_at)).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!embedded && friendlyError && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 p-3 text-sm">
          <div className="font-medium">Let’s try a preset</div>
          <div className="mt-1">{friendlyError}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=>openPlan('crm_organization')}>CRM Organization</button>
            <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=>openPlan('book_filling')}>Book‑Filling</button>
            <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=>openPlan('inventory_tracking')}>Inventory Tracking</button>
            <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=>openPlan('social_automation')}>Social (14‑day)</button>
          </div>
        </div>
      )}
      {historyOpen && (
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
      <div className={`rounded-xl bg-white shadow-sm p-3 border ${embedded ? 'shrink-0 max-h-24 overflow-y-auto overflow-x-hidden' : 'h-64 overflow-auto'} min-w-0`} aria-live="polite" aria-atomic="false" role="log">
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
                <span>BrandVX is typing</span>
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
          {/* Contextual actions directly under the assistant reply */}
          {contextActions.length > 0 && (
            <div className="pt-2 mt-1 border-t border-slate-100">
              <div className="flex flex-wrap gap-2 text-xs">
                {contextActions.includes('open_integrations') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=integrations') }>Open Integrations</button>
                )}
                {contextActions.includes('connect_twilio') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=integrations&tour=twilio') }>Connect SMS (Twilio)</button>
                )}
                {contextActions.includes('open_messages') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=messages') }>Open Messages</button>
                )}
                {contextActions.includes('open_inbox') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=messages') }>Open Inbox</button>
                )}
                {contextActions.includes('open_contacts') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=contacts') }>Open Contacts</button>
                )}
                {contextActions.includes('import_contacts') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=contacts&tour=1') }>Import contacts</button>
                )}
                {contextActions.includes('open_inventory') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=inventory') }>Open Inventory</button>
                )}
                {contextActions.includes('check_lowstock') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=inventory&tour=1') }>Check low stock</button>
                )}
                {contextActions.includes('open_calendar') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=calendar') }>Open Calendar</button>
                )}
                {contextActions.includes('open_approvals') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=approvals') }>Open Approvals</button>
                )}
                {contextActions.includes('open_cadences') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=cadences') }>Open Cadences</button>
                )}
                {contextActions.includes('open_workflows') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=workflows') }>Open Workflows</button>
                )}
                {contextActions.includes('open_onboarding') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/onboarding?tour=1') }>Open Onboarding</button>
                )}
                {contextActions.includes('guide_dashboard') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=dashboard&tour=1') }>Guide: Dashboard</button>
                )}
                {contextActions.includes('guide_integrations') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=integrations&tour=1') }>Guide: Integrations</button>
                )}
                {contextActions.includes('guide_onboarding') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/onboarding?tour=1') }>Guide: Onboarding</button>
                )}
                {contextActions.includes('guide_workflows') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workflows?tour=1') }>Guide: Workflows</button>
                )}
                {contextActions.includes('admin_clear_cache') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={clearTenantCache}>Clear tenant cache</button>
                )}
                {contextActions.includes('tour_all') && (
                  <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=dashboard&demo=1&tour=all') }>Run full demo tour</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {!embedded && (
      <div className="flex flex-wrap gap-2 text-xs">
        <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={()=>setShortcut('Create a 30‑day content plan for a balayage specialist posting 3x/week.')}>Content Plan</button>
        <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={()=>setShortcut('Draft a price‑increase announcement and client FAQ for a luxury but friendly tone.')}>Price Increase</button>
        <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={()=>setShortcut('Make a pre‑appointment text and aftercare card for brow lamination with placeholders.')}>Pre/Post Visit</button>
        <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={()=>setShortcut('Compute effective hourly given price $225, product cost $28, service time 210 minutes.')}>Pricing Model</button>
      </div>
      )}
      <div className={`flex gap-2 items-start ${embedded ? 'flex-1 min-h-0 items-stretch' : 'shrink-0'} pb-[max(env(safe-area-inset-bottom,0px),8px)]`}>
        <textarea
          className={`flex-1 border rounded-md px-3 py-2 ${embedded ? 'h-full min-h-[180px]' : ''}`}
          rows={3}
          placeholder="How can I save you time today?"
          value={input}
          onFocus={()=>{ if (!input) setInput(''); }}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="flex flex-col gap-2">
          <button className="border rounded-full px-4 py-2 bg-gradient-to-r from-blue-100 to-blue-300 hover:from-blue-200 hover:to-blue-400 shadow text-slate-900" onClick={send} disabled={loading || streaming}>
            {loading ? 'Sending…' : 'Send'}
          </button>
          <button className="text-sm text-slate-600 hover:underline" onClick={reset}>Clear</button>
        </div>
      </div>
      {!firstNoteShown && (
        <div className="text-xs text-slate-500 mt-1 shrink-0">(Responses may take a moment to ensure quality!)</div>
      )}
      {(!embedded && (messages.length > 0 && messages[messages.length - 1]?.role === 'assistant')) && (
        <div className="mt-2">
          <button onClick={()=> guideTo('onboarding')} className="inline-flex items-center gap-2">
            <span className="px-3 py-2 border rounded-full bg-white hover:shadow-sm text-sm text-slate-800">Get Started!</span>
          </button>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {!!lastAssistantText && (
              <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto(`/workspace?pane=messages&body=${encodeURIComponent(lastAssistantText)}`)}>Use this text in Messages</button>
            )}
            <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=>guideTo('dashboard')}>Guide me: Dashboard</button>
            <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=>guideTo('integrations')}>Guide me: Integrations</button>
            <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=>guideTo('onboarding')}>Guide me: Onboarding</button>
            <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> goto('/workspace?pane=integrations&tour=twilio') }>Connect SMS (Twilio)</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button disabled={!!running} className="px-2 py-1 border rounded-md bg-white hover:shadow-sm disabled:opacity-50" onClick={()=>runPlan('crm_organization')}>{running==='crm_organization' ? 'Running…' : 'Run plan: CRM Organization'}</button>
            <button disabled={!!running} className="px-2 py-1 border rounded-md bg-white hover:shadow-sm disabled:opacity-50" onClick={()=>runPlan('book_filling')}>{running==='book_filling' ? 'Running…' : 'Run plan: Book-Filling'}</button>
            <button disabled={!!running} className="px-2 py-1 border rounded-md bg-white hover:shadow-sm disabled:opacity-50" onClick={()=>runPlan('social_automation')}>{running==='social_automation' ? 'Running…' : 'Run plan: Social (14‑day)'}</button>
            {getSavedQueue() && (
              <button disabled={!!running} className="px-2 py-1 border rounded-md bg-white hover:shadow-sm disabled:opacity-50" onClick={resumePlan}>{running ? 'Running…' : 'Resume last plan'}</button>
            )}
            {/* Plan Builder: select steps and execute without navigating */}
            <button disabled={!!running} className="px-2 py-1 border rounded-md bg-white hover:shadow-sm disabled:opacity-50" onClick={()=>openPlan('crm_organization')}>Plan builder: CRM</button>
            <button disabled={!!running} className="px-2 py-1 border rounded-md bg-white hover:shadow-sm disabled:opacity-50" onClick={()=>openPlan('book_filling')}>Plan builder: Book‑Filling</button>
            <button disabled={!!running} className="px-2 py-1 border rounded-md bg-white hover:shadow-sm disabled:opacity-50" onClick={()=>openPlan('social_automation')}>Plan builder: Social</button>
            {planName && (
              <button className="px-2 py-1 border rounded-md bg-white hover:shadow-sm" onClick={()=> startWorkflowGuide(planName)}>Guide this plan</button>
            )}
          </div>
          {planName && Array.isArray(planSteps) && planSteps.length > 0 && (
            <div className="mt-3 rounded-xl border bg-white p-3">
              <div className="text-sm font-medium text-slate-800">Plan steps ({planName})</div>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {planSteps.map((s, idx) => (
                  <li key={idx} className="flex flex-col gap-1">
                    <input id={`step_${idx}`} type="radio" name="plan_step" checked={selectedStepIdx===idx} onChange={()=>setSelectedStepIdx(idx)} />
                    <label htmlFor={`step_${idx}`} className="cursor-pointer">
                      {getToolLabel(String(s?.tool||''))}
                    </label>
                    {s?.params && (
                      <pre className="ml-5 mt-0.5 rounded-md border bg-slate-50 p-2 text-[11px] text-slate-700 whitespace-pre-wrap">{JSON.stringify(s.params, null, 2)}</pre>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <button disabled={!!running} className="px-2 py-1 border rounded-md bg-white hover:shadow-sm disabled:opacity-50" onClick={executeOneStep}>Run selected step</button>
                <button disabled={!!running} className="px-2 py-1 border rounded-md bg-white hover:shadow-sm disabled:opacity-50" onClick={executeAllSteps}>Run all steps</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


