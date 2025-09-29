import { useEffect, useRef, useState, useCallback } from 'react';
// import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { startGuide } from '../lib/guide';
import { useToast } from '../components/ui/Toast';
import { track, trackEvent } from '../lib/analytics';
import { motion } from 'framer-motion';

type Msg = { role: 'user' | 'assistant'; content: string };
// Removed Action type and contextual actions

const numberFormatter = new Intl.NumberFormat('en-US');
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatCurrency = (cents?: number | null) => {
  const dollars = Number(cents || 0) / 100;
  return currencyFormatter.format(dollars || 0);
};
const buildStrategyMarkdownDoc = (options: {
  snapshot: any;
  planDays: Array<{ day_index: number; tasks: string[] }>;
  brandProfile?: { voice?: string; about?: string };
  goals?: { primary?: string };
  importSummary?: { imported?: number; updated?: number; provider?: string } | null;
}) => {
  const { snapshot, planDays, brandProfile, goals, importSummary } = options;
  const horizon = Number(snapshot?.horizon_days || 90);
  const imported = Number(importSummary?.imported || 0);
  const updated = Number(importSummary?.updated || 0);
  const totalContacts = imported + updated;
  const providerLabel = String(importSummary?.provider || '').toUpperCase();

  const lines: string[] = [];
  lines.push('# BrandVX 14-Day Strategy');
  lines.push('');
  lines.push(`Generated: ${new Date().toLocaleDateString()}`);
  lines.push('');
  lines.push('## Snapshot');
  lines.push(`- Revenue (last ${horizon} days): ${formatCurrency(snapshot?.revenue_cents)} (±$100)`);
  lines.push(`- Contacts synced: ${numberFormatter.format(totalContacts)}${providerLabel ? ` via ${providerLabel}` : ''}`);
  if (brandProfile?.voice) lines.push(`- Brand voice: ${brandProfile.voice}`);
  if (brandProfile?.about) lines.push(`- Brand profile: ${brandProfile.about}`);
  if (goals?.primary) lines.push(`- Primary goal: ${goals.primary}`);
  lines.push('');

  lines.push('## Top Clients');
  lines.push('- Revisit your top clients with thank-you outreach this week.');
  lines.push('');

  lines.push('## Day-by-day plan');
  if (!planDays.length) {
    lines.push('- Strategy plan not generated yet. Run the AskVX snapshot first.');
  } else {
    planDays.forEach((day) => {
      lines.push(`### Day ${day.day_index}`);
      const tasks = Array.isArray(day.tasks) && day.tasks.length ? day.tasks : ['Focus on client outreach and content.'];
      tasks.forEach((task) => {
        lines.push(`- ${task}`);
      });
      lines.push('');
    });
  }

  lines.push('## Next steps');
  lines.push('- Send the thank-you drafts above to keep your champions engaged.');
  lines.push('- Ask VX for daily guidance: “What should I tackle today from my 14-day plan?”');
  lines.push('- Update Train VX with new brand facts after each big win.');

  return lines.join('\n');
};

const clampLines = (text: string, maxLines: number) => {
  const lines = String(text || '').split('\n');
  if (lines.length <= maxLines) return lines.join('\n');
  return [...lines.slice(0, maxLines), '…'].join('\n');
};

const buildMemoryContextBlock = () => {
  try {
    const chunks: string[] = [];
    const mems = Array.isArray((window as any).__bvxMemories)
      ? (window as any).__bvxMemories.slice(0, 5)
      : [];
    if (mems.length) {
      const lines = mems.map((m: any) => {
        const key = String(m?.key || '').trim();
        const value = m?.value;
        const snippet = typeof value === 'string' ? clampLines(value, 4) : JSON.stringify(value);
        return `- ${key || 'memory'}: ${snippet}`;
      });
      chunks.push(`Recent brand memory:\n${lines.join('\n')}`);
    }
    const strategy = (window as any).__bvxStrategyDoc?.markdown;
    if (strategy) {
      chunks.push(`Current 14-day strategy draft:\n${clampLines(String(strategy), 40)}`);
    }
    return chunks.length ? `${chunks.join('\n\n')}\n\n` : '';
  } catch {
    return '';
  }
};

export default function Ask(){
  // const navigate = useNavigate();
  const { showToast } = useToast();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const messagesRef = useRef<Msg[]>(messages);
  useEffect(()=>{ messagesRef.current = messages; }, [messages]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const streamId = useRef<number | null>(null);
  const [smartAction, setSmartAction] = useState<{ label: string; tool: string; params?: any } | null>(null);
  const [toolRunning, setToolRunning] = useState<boolean>(false);
  const [toolResult, setToolResult] = useState<any>(null);
  const [digest, setDigest] = useState<any|null>(null);
  const [firstNoteShown, setFirstNoteShown] = useState<boolean>(() => {
    const k = 'bvx_first_prompt_note';
    return localStorage.getItem(k) === '1';
  });
  const [pendingInsights, setPendingInsights] = useState<string>('');
  const [pendingStrategy, setPendingStrategy] = useState<string>('');
  const [importSummary, setImportSummary] = useState<any|null>(()=>{
    try { return (window as any).__bvxLastImport || null; } catch { return null; }
  });
  const [skipImport, setSkipImport] = useState<boolean>(()=>{
    try { return Boolean((window as any).__bvxSkipImport); } catch { return false; }
  });
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyMarkdown, setStrategyMarkdown] = useState<string>('');
  const [strategyDownloadUrl, setStrategyDownloadUrl] = useState<string>('');
  const [strategySaved, setStrategySaved] = useState(false);
  const [trainerInput, setTrainerInput] = useState<string>('');
  const [trainerSaving, setTrainerSaving] = useState<boolean>(false);
  const [sessionSummary, setSessionSummary] = useState<string>('');
  const [summarizing, setSummarizing] = useState<boolean>(false);
  const [mode] = useState<string>(()=>{
    try { const sp = new URLSearchParams(window.location.search); return (sp.get('mode')||'').toLowerCase(); } catch { return ''; }
  });
  const [sessionId] = useState<string>(() => {
    const key = 'bvx_chat_session';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const sid = 's_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(key, sid);
    return sid;
  });
  const isOnboard = (()=>{
    try { return new URLSearchParams(window.location.search).get('onboard')==='1'; } catch { return false; }
  })();
  const lastAssistantText = String(messages.filter(m=>m.role==='assistant').slice(-1)[0]?.content||'');
  // removed getToolLabel
  const inputRef = useRef<HTMLTextAreaElement|null>(null);
  useEffect(()=>{ try{ inputRef.current?.focus(); } catch{} },[]);
  useEffect(()=>{ (async()=>{ try{ const since = Number(localStorage.getItem('bvx_last_digest_since')||'0'); const r = await api.get(`/ai/digest?since=${encodeURIComponent(String(since||0))}`); setDigest(r?.digest||null); localStorage.setItem('bvx_last_digest_since', String(Date.now()/1000|0)); } catch{} })(); },[]);
  useEffect(()=>{
    const handler = (event: Event) => {
      try {
        const detail = (event as CustomEvent).detail || {};
        setImportSummary(detail);
        const failed = Boolean(detail?.error);
        setSkipImport(failed);
        try { (window as any).__bvxSkipImport = failed; } catch {}
      } catch {}
    };
    window.addEventListener('bvx:flow:contacts-imported', handler as any);
    return () => window.removeEventListener('bvx:flow:contacts-imported', handler as any);
  }, []);
  useEffect(()=>{
    const handler = () => {
      setSkipImport(true);
      try { (window as any).__bvxSkipImport = true; } catch {}
    };
    window.addEventListener('bvx:onboarding:skip-import', handler as any);
    return () => window.removeEventListener('bvx:onboarding:skip-import', handler as any);
  }, []);
  useEffect(() => {
    return () => {
      if (strategyDownloadUrl) {
        try { URL.revokeObjectURL(strategyDownloadUrl); } catch {}
      }
    };
  }, [strategyDownloadUrl]);
  // Removed loadSessions

  // Removed computeContext

  const sendPrompt = useCallback(async (rawPrompt: string, overrides?: { mode?: string; context?: Record<string, unknown>, hidden?: string }) => {
    const visible = rawPrompt.trim();
    if (!visible || loading) return { text: '', error: 'empty' };
    try { trackEvent('ask.prompt_submitted', { onboard: isOnboard, length: visible.length }); } catch {}
    const hidden = overrides?.hidden ? `\n\n${overrides.hidden.trim()}` : '';
    const contextBlock = isOnboard ? buildMemoryContextBlock() : '';
    const prompt = `${contextBlock}${visible}${hidden}`;
    const next = [...messagesRef.current, { role: 'user' as const, content: prompt }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try{
      const onboardMode = (()=>{ try{ return new URLSearchParams(window.location.search).get('onboard')==='1'; } catch { return false; }})();
      const startT = performance.now();
      const modeToUse = overrides?.mode ?? (onboardMode ? 'onboard' : (mode || undefined));
      try { window.dispatchEvent(new CustomEvent('bvx:flow:askvx-user', { detail: { prompt, context: overrides?.context||{} } })); } catch {}
      const r = await api.post('/ai/chat/raw', {
        messages: next,
        session_id: sessionId,
        mode: modeToUse,
      }, { timeoutMs: 60000 });
      if (r?.error) {
        const msg = `Error: ${String(r.detail||r.error)}`;
        setMessages(curr => [...curr, { role:'assistant', content: msg }]);
        try { window.dispatchEvent(new CustomEvent('bvx:flow:askvx-response', { detail: { prompt, error: msg, context: overrides?.context||{} } })); } catch {}
        try { trackEvent('ask.response_error', { onboard: onboardMode, error: msg.slice(0, 120) }); } catch {}
        setLoading(false);
        return { text: '', error: msg };
      }
      const text = String(r?.text || '');
      if (!firstNoteShown) {
        setFirstNoteShown(true);
        localStorage.setItem('bvx_first_prompt_note', '1');
      }
      try { trackEvent('ask.response_stream_start', { onboard: onboardMode, chars: text.length }); } catch {}
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
          try { window.dispatchEvent(new CustomEvent('bvx:flow:askvx-response', { detail: { prompt, text, context: overrides?.context||{} } })); } catch {}
          try { trackEvent('ask.response_stream_complete', { onboard: onboardMode, chars: text.length, duration_ms: Math.max(0, Math.round(performance.now() - startT)) }); } catch {}
        }
      }, 20);
      return { text, error: '' };
    } catch(e:any){
      const error = String(e?.message||e);
      try { trackEvent('ask.response_error', { onboard: isOnboard, error: error.slice(0, 120) }); } catch {}
      setMessages(curr => [...curr, { role: 'assistant', content: error }]);
      try { window.dispatchEvent(new CustomEvent('bvx:flow:askvx-response', { detail: { prompt, error, context: overrides?.context||{} } })); } catch {}
      return { text: '', error };
    } finally {
      setLoading(false);
    }
  }, [loading, mode, sessionId, firstNoteShown, isOnboard]);

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;
    const overrides: { mode?: string; context?: Record<string, unknown>, hidden?: string } = {};
    if (isOnboard) overrides.mode = 'onboard';
    if (pendingInsights) {
      overrides.context = { onboardingInsights: pendingInsights };
      overrides.hidden = 'You are AskVX guiding onboarding. Do not ask clarifying questions. Answer first, list the revenue summary, highlight top clients using full names, and suggest exactly one next action.';
    }
    if (pendingStrategy) {
      overrides.context = { ...(overrides.context||{}), onboardingStrategy: pendingStrategy };
      const hiddenStrategy = 'Provide the 14-day strategy immediately without asking clarifying questions. Keep tone warm and confident; use full client names.';
      overrides.hidden = overrides.hidden ? `${overrides.hidden}\n${hiddenStrategy}` : hiddenStrategy;
    }
    const payload = Object.keys(overrides).length ? overrides : undefined;
    const result = await sendPrompt(prompt, payload);
    if (pendingInsights) {
      setPendingInsights('');
      try { window.dispatchEvent(new CustomEvent('bvx:onboarding:askvx-sent', { detail: { success: !result?.error } })); } catch {}
    }
    if (pendingStrategy) {
      if (!result?.error) {
        await prepareStrategyDocument();
        try { window.dispatchEvent(new CustomEvent('bvx:onboarding:strategy-ready', { detail: { success: true } })); } catch {}
      }
      setPendingStrategy('');
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
        setSmartAction({ label: 'Send a test SMS', tool: 'messages.send', params: { contact_id: 'c_demo', channel: 'sms', body: 'Hi from brandVX (demo)' } });
        return;
      }
      setSmartAction(null);
    } catch { setSmartAction(null); }
  }, [lastAssistantText]);

  // Cap clarifiers to 0–2 in onboarding mode by pre-seeding context
  useEffect(()=>{
    (async()=>{
      try{
        const sp = new URLSearchParams(window.location.search);
        const onboard = sp.get('onboard') === '1';
        if (!onboard) return;
        // Prime context with a succinct summary so follow-ups are minimal
        const seed = 'Context: Use best estimates from tenant data. Avoid more than two clarifying questions; if uncertain, compute a conservative estimate and state assumptions briefly.';
        await api.post('/ai/chat/raw', { session_id: sessionId, messages: [{ role:'user', content: seed }] });
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSmartAction = async () => {
    if (!smartAction || toolRunning) return;
    try{
      setToolRunning(true);
      setToolResult({ status: 'running' });
      const r = await api.post('/ai/tools/execute', {
        name: smartAction.tool,
        params: { ...(smartAction.params||{}) },
        require_approval: false,
        mode: mode || undefined,
      });
      setToolResult(r || { status: 'ok' });
      try { showToast({ title: 'Action executed', description: smartAction.label }); } catch {}
      try { trackEvent('ask.smart_action.run', { tool: smartAction.tool }); } catch {}
    } catch(e:any){
      setToolResult({ status: 'error', detail: String(e?.message||e) });
      try { showToast({ title: 'Action failed', description: String(e?.message||e) }); } catch {}
    } finally {
      setToolRunning(false);
    }
  };

  const handleRunInsights = useCallback(async () => {
    try {
      const res = await api.post('/onboarding/askvx/insights', {
        horizon_days: 90,
      }, { timeoutMs: 45000 });
      if (!res || res.status !== 'ok') {
        throw new Error(String(res?.detail || 'Unable to generate snapshot'));
      }
      const summary = res?.data || {};
      try { (window as any).__bvxAskInsights = { summary }; } catch {}
      showToast({ title: 'Snapshot ready', description: 'AskVX can pull from it on demand.' });
    } catch (e: any) {
      const message = String(e?.message || e);
      showToast({ title: 'Snapshot failed', description: message });
    } finally {
    }
  }, [showToast]);

  const injectStrategyPrompt = useCallback(async () => {
    try {
      await api.get(`/settings`);
    } catch {}
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      try {
        const detail = (event as CustomEvent).detail || {};
        const kind = String(detail.kind || '').toLowerCase();
        if (!kind) return;
        track('askvx_prefill', { kind, source: detail.source || 'tour' });
        if (kind === 'insights') {
          const prompt = String(detail.prompt || detail.visible || '');
          setPendingInsights(prompt);
          setInput(prompt);
        }
        if (kind === 'strategy') {
          const prompt = String(detail.prompt || detail.visible || '');
          setPendingStrategy(prompt);
          setInput(prompt);
        }
        try { inputRef.current?.focus(); } catch {}
      } catch {}
    };
    window.addEventListener('bvx:ask:prefill' as any, handler as any);
    return () => window.removeEventListener('bvx:ask:prefill' as any, handler as any);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      try {
        const detail = (event as CustomEvent).detail || {};
        const action = String(detail.action || '').toLowerCase();
        if (!action) return;
        track('askvx_flow_command', { action });
        if (action === 'askvx.send') {
          const prompt = String(detail.prompt || input).trim();
          if (!prompt) return;
          void sendPrompt(prompt, { mode: detail.mode, context: detail.context, hidden: detail.hidden });
        }
        if (action === 'askvx.tab') {
          const tab = String(detail.tab || 'chat').toLowerCase();
          setPageIdx(tab === 'profile' ? 1 : 0);
        }
        if (action === 'askvx.run-insights' || action === 'askvx.frontfill-insights') {
          void handleRunInsights();
        }
        if (action === 'askvx.frontfill-strategy') {
          void injectStrategyPrompt();
        }
      } catch {}
    };
    window.addEventListener('bvx:flow:askvx-command' as any, handler as any);
    return () => window.removeEventListener('bvx:flow:askvx-command' as any, handler as any);
  }, [handleRunInsights, injectStrategyPrompt, input, sendPrompt]);

  const prepareStrategyDocument = useCallback(async () => {
    if (strategyLoading) return;
    try{
      setStrategyLoading(true);
      const snapshot = (() => {
        const cached = (window as any).__bvxAskInsights?.summary;
        if (cached) return cached;
        return null;
      })() || {};
      try {
        await api.post('/plan/14day/generate', { step_key: 'onboarding' });
      } catch (err) {
        console.warn('plan generation warning', err);
      }
      const planRes = await api.get(`/plan/14day/all`);
      const planDays = Array.isArray(planRes?.days) ? planRes.days : [];
      const settings = await api.get(`/settings`);
      const brandProfile = settings?.data?.brand_profile || {};
      const goals = settings?.data?.goals || {};
      const markdown = buildStrategyMarkdownDoc({
        snapshot,
        planDays,
        brandProfile,
        goals,
        importSummary,
      });
      if (strategyDownloadUrl) {
        try { URL.revokeObjectURL(strategyDownloadUrl); } catch {}
      }
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      setStrategyMarkdown(markdown);
      setStrategyDownloadUrl(url);
      setStrategySaved(false);
      try {
        await api.post('/onboarding/strategy/document', {
          markdown,
          tags: ['plan', '14day', 'onboarding'],
        });
        setStrategySaved(true);
        try { localStorage.setItem('bvx_done_plan','1'); } catch {}
      } catch (err) {
        console.error('strategy document save failed', err);
      }
      try { (window as any).__bvxStrategyDoc = { markdown, planDays, snapshot }; } catch {}
      try { window.dispatchEvent(new CustomEvent('bvx:onboarding:strategy-ready', { detail: { saved: true } })); } catch {}
      showToast({ title: 'Strategy ready', description: 'Download your 14-day plan below.' });
    } catch(e:any){
      const message = String(e?.message||e);
      if (strategyDownloadUrl) {
        try { URL.revokeObjectURL(strategyDownloadUrl); } catch {}
      }
      setStrategyDownloadUrl('');
      setStrategyMarkdown('');
      setStrategySaved(false);
      showToast({ title: 'Strategy error', description: message });
    } finally {
      setStrategyLoading(false);
    }
  }, [strategyLoading, pendingInsights, showToast, strategyDownloadUrl, importSummary]);

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
      const r = await api.get(`/settings`);
      const current = String(r?.data?.training_notes||'');
      const next = (current ? current + '\n' : '') + trainerInput.trim();
      await api.post('/settings', { training_notes: next });
      setTrainerInput('');
      showToast({ title:'Saved', description:'Added to brand training notes.' });
      try { track('brand_trainer_saved'); } catch {}
      try { window.dispatchEvent(new CustomEvent('bvx:onboarding:trainvx-saved', { detail: { length: next.length } })); } catch {}
    } catch(e:any){ showToast({ title:'Save error', description:String(e?.message||e) }); }
    finally { setTrainerSaving(false); }
  };
  const summarizeSession = async () => {
    try{
      if (summarizing) return;
      setSummarizing(true);
      const prompt = 'Summarize this chat session for a beauty professional in 4 short bullets: focus on wins, next steps, and any data insights. Keep proper nouns. Avoid sensitive data.';
      const msgs = messages.length > 0 ? [...messages, { role:'user' as const, content: prompt }] : [{ role:'user' as const, content: prompt }];
      const r = await api.post('/ai/chat/raw', { session_id: sessionId, messages: msgs }, { timeoutMs: 45000 });
      const text = String(r?.text||'');
      if (!text) { showToast({ title:'No summary', description:'The model did not return text.' }); return; }
      setSessionSummary(text);
      // Persist summary to backend so it’s available on reopen
      try { await api.post('/ai/chat/session/summary', { session_id: sessionId, summary: text }); } catch {}
      try { track('ask_session_summarized'); } catch {}
    } catch(e:any){ showToast({ title:'Summary error', description:String(e?.message||e) }); }
    finally { setSummarizing(false); }
  };
  // removed goto helper

  useEffect(() => {
    return () => { if (streamId.current) { window.clearInterval(streamId.current); streamId.current = null; } };
  }, []);

  // Auto-summarize last session once on mount
  useEffect(()=>{
    if (isOnboard) return;
    (async()=>{ try{ await summarizeSession(); } catch{} })();
  }, [isOnboard]);

  const importedCount = Number(importSummary?.imported || 0);
  const updatedCount = Number(importSummary?.updated || 0);
  const totalSynced = importedCount + updatedCount;
  const providerLabel = String(importSummary?.provider || '').toUpperCase();
  const importError = String(importSummary?.error || '');
  const contactCardTitle = skipImport
    ? 'Import skipped'
    : totalSynced > 0
      ? `${numberFormatter.format(totalSynced)} contacts ready`
      : 'Contacts ready';
  const contactCardDetail = skipImport
    ? 'We’ll focus on strategy without importing contacts.'
    : totalSynced > 0
      ? `${numberFormatter.format(importedCount)} new • ${numberFormatter.format(updatedCount)} updated${providerLabel ? ` · ${providerLabel}` : ''}`
      : providerLabel
        ? `${providerLabel} connected — run insights to review.`
        : 'Import from booking to populate askVX insights.';
  const digestMetrics = {
    contactsAdded: Number(digest?.contacts_added || 0),
    contactsUpdated: Number(digest?.contacts_updated || 0),
    appointments: Number(digest?.appointments || 0),
    messagesSent: Number(digest?.messages_sent || 0),
    syncEvents: Number(digest?.sync_events || 0),
  };
  const digestEmpty = !digest || (digestMetrics.contactsAdded === 0 && digestMetrics.contactsUpdated === 0 && digestMetrics.appointments === 0 && digestMetrics.messagesSent === 0 && digestMetrics.syncEvents === 0);
  const topClients: Array<{ name: string }> = [];
  const sessionSummaryText = sessionSummary
    ? sessionSummary
    : (isOnboard ? 'Last session summary will appear on your next login.' : '—');
  const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const embedded = sp.get('embed') === '1';
  const askIsDemo = sp.get('demo') === '1';
  const initialPage = sp.get('page') === '2' ? 1 : 0;
  const [pageIdx, setPageIdx] = useState<number>(initialPage);
  const messagesBoxRef = useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    try{ messagesBoxRef.current?.scrollTo({ top: messagesBoxRef.current.scrollHeight, behavior: 'smooth' }); }catch{}
  }, [messages.length, streaming, loading]);
  // Deep link tour
  useEffect(()=>{ try{ if (new URLSearchParams(window.location.search).get('tour')==='1') startGuide('askvx'); } catch {} },[]);
  useEffect(()=>{
    try { window.dispatchEvent(new CustomEvent('bvx:onboarding:askvx-tab-active', { detail: { index: pageIdx } })); } catch {}
  }, [pageIdx]);

  // Signal: Ask page is ready for tour placement
  useEffect(() => {
    let cancelled = false;
    const signal = () => {
      if (cancelled) return;
      try {
        const el = (document.querySelector('[data-guide="ask-input"]') || inputRef.current) as HTMLElement | null;
        if (el) {
          const r = el.getBoundingClientRect?.();
          if (r && r.width > 0 && r.height > 0) {
            // Unified tour continues; no segmented resume on AskVX
            try { window.dispatchEvent(new CustomEvent('bvx:ask:ready')); } catch {}
            try { window.dispatchEvent(new CustomEvent('bvx:dbg', { detail: { type: 'ready', pane: 'askvx' } })); } catch {}
            return;
          }
        }
      } catch {}
      setTimeout(() => { try { requestAnimationFrame(signal); } catch { signal(); } }, 60);
    };
    try { requestAnimationFrame(() => { requestAnimationFrame(signal); }); } catch { setTimeout(signal, 60); }
    return () => { cancelled = true; };
  }, []);

  return (
    <div className={`h-full min-h-0 flex flex-col min-w-0 overflow-x-hidden overflow-y-hidden pb-3`}>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-slate-900" data-guide="askvx-heading" style={{fontFamily:'var(--font-display)'}}>AskVX</h3>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full bg-white overflow-hidden shadow-sm">
              <button className={`px-3 py-1 text-sm ${pageIdx===0? 'bg-slate-900 text-white':'text-slate-700'}`} onClick={()=> setPageIdx(0)}>Chat</button>
              <button className={`px-3 py-1 text-sm ${pageIdx===1? 'bg-slate-900 text-white':'text-slate-700'}`} onClick={()=> setPageIdx(1)}>Train & Profile</button>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <button className="px-2 py-1 text-xs border rounded-md bg-white" onClick={()=> setPageIdx(p=> Math.max(0, p-1))} disabled={pageIdx===0}>Prev</button>
              <button className="px-2 py-1 text-xs border rounded-md bg-white" onClick={()=> setPageIdx(p=> Math.min(1, p+1))} disabled={pageIdx===1}>Next</button>
            </div>
          </div>
        </div>
      )}
      {pageIdx===0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className={`rounded-xl border ${skipImport || importError ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-sky-200 bg-sky-50 text-slate-900'} p-3 shadow-sm`} data-guide="askvx-import-count">
            <div className="text-sm font-semibold">{contactCardTitle}</div>
            <div className="mt-1 text-sm text-slate-700">{importError ? importError : contactCardDetail}</div>
            {!skipImport && !importError && topClients.length > 0 && (
              <div className="mt-2 text-[11px] text-slate-500">Top contacts spotted: {topClients.map(c=>c.name).join(', ')}</div>
            )}
          </div>
          <div className="rounded-xl border bg-white p-3 shadow-sm text-sm" data-guide="askvx-digest">
            <div className="font-medium text-slate-900">Since your last visit</div>
            {digestEmpty ? (
              <div className="mt-1 text-xs text-slate-600">No changes since last visit.</div>
            ) : (
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-600">
                <span>Contacts: +{numberFormatter.format(digestMetrics.contactsAdded)} / {numberFormatter.format(digestMetrics.contactsUpdated)} updated</span>
                <span>Appointments: {numberFormatter.format(digestMetrics.appointments)}</span>
                <span>Messages: {numberFormatter.format(digestMetrics.messagesSent)}</span>
                <span>Sync events: {numberFormatter.format(digestMetrics.syncEvents)}</span>
              </div>
            )}
            {!!(digest?.recent_contacts||[]).length && (
              <div className="mt-1 text-[11px] text-slate-500">Recent: {(digest?.recent_contacts||[]).map((c:any)=> c.friendly_name||c.display_name||'Client').join(', ')}</div>
            )}
          </div>
        </div>
      )}
      {pageIdx===0 && isOnboard && (skipImport || importError) && (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-guide="askvx-insights-cta">
          Import is skipped for now. We’ll move ahead to your 14-day strategy next.
        </div>
      )}
      {pageIdx===0 && (
        <div className="mt-2 flex items-center justify-end text-xs text-slate-500">
          <span>Shift+Enter for newline</span>
        </div>
      )}
      {pageIdx===0 && (
      <div ref={messagesBoxRef} className={`rounded-xl bg-white shadow-sm p-3 border flex-1 min-h-0 overflow-y-auto min-w-0`} aria-live="polite" aria-atomic="false" role="log" data-guide="messages">
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
      {/* Audit PII button removed per spec */}
      {pageIdx===0 && isOnboard && (
        <div className="mt-2 rounded-xl border bg-white p-3 shadow-sm text-sm" data-guide="askvx-strategy">
          <div className="font-medium text-slate-900">14-day strategy</div>
          <div className="mt-1 text-xs text-slate-600">
            {strategyMarkdown
              ? 'Your strategy is saved. Download it or rebuild after you update data.'
              : skipImport
                ? 'We’ll craft a starter plan from your brand profile. Import contacts later for richer insights.'
                : 'Use your AskVX snapshot to build a 14-day plan you can act on immediately.'}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow disabled:opacity-60"
              onClick={prepareStrategyDocument}
              disabled={strategyLoading}
            >
              {strategyLoading ? 'Preparing…' : strategyMarkdown ? 'Rebuild strategy' : 'Generate strategy'}
            </button>
            {strategyDownloadUrl && (
              <a
                href={strategyDownloadUrl}
                download="brandvx-14-day-strategy.md"
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Download Markdown
              </a>
            )}
          </div>
          {strategySaved && (
            <div className="mt-2 text-[11px] text-slate-500">Saved to your brand memory. Ask VX will reference it on future chats.</div>
          )}
        </div>
      )}
      {pageIdx===0 && smartAction && (
        <div className="mt-2" data-guide="smart-action">
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
        <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={async()=>{ setInput('What can brandVX do for me? Keep it concise and tailored to beauty pros.'); await Promise.resolve(); void send(); }}>What can brandVX do?</button>
        <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={async()=>{ setInput('How do I get started? Give me the first 3 actions and where to click.'); await Promise.resolve(); void send(); }}>How do I get started?</button>
        <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={async()=>{ setInput('What was my revenue for last week?'); await Promise.resolve(); void send(); }}>What was my revenue for last week?</button>
      </div>
      )}
      {/* Last session summary moved to bottom and auto-populated */}
      {pageIdx===0 && (
      <div className={`flex gap-2 items-start ${embedded ? 'shrink-0' : 'shrink-0'} pb-[max(env(safe-area-inset-bottom,0px),0px)]`} data-guide="composer">
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
          <button data-guide="ask-send" className="border rounded-full px-4 py-2 bg-gradient-to-r from-blue-100 to-blue-300 hover:from-blue-200 hover:to-blue-400 shadow text-slate-900" onClick={send} disabled={loading || streaming}>
            {loading ? 'Sending…' : 'Send'}
          </button>
          <button className="text-sm text-slate-600 hover:underline" onClick={reset}>Clear</button>
        </div>
      </div>
      )}
      {/* Copy plan & Pin to Dashboard actions */}
      {pageIdx===0 && lastAssistantText && (
        <div className="mt-2 flex gap-2 text-xs">
          <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={async()=>{ try{ await navigator.clipboard.writeText(lastAssistantText); }catch{} }}>Copy plan</button>
          <button className="border rounded-md px-2 py-1 bg-white hover:shadow-sm" onClick={async()=>{
            try{
              // Persist last_session_summary memory for Dashboard surfacing
              await api.post('/ai/chat/session/summary', { session_id: sessionId, summary: lastAssistantText });
              setSessionSummary(lastAssistantText);
              try{ track('plan_pinned_dashboard'); }catch{}
              try{
                const u = new URL(window.location.href);
                u.pathname = '/workspace';
                u.search = '?pane=dashboard&refresh=summary';
                window.location.assign(u.toString());
              }catch{}
            }catch{}
          }}>Pin to Dashboard</button>
        </div>
      )}
      {!firstNoteShown && (
        <div className="text-xs text-slate-500 mt-1 shrink-0">(Responses may take a moment to ensure quality!)</div>
      )}
      {false && lastAssistantText && (<div />)}
      {pageIdx===1 && (
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl bg-white shadow-sm p-3 border" data-guide="trainvx-notes">
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
          <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap min-h-[48px]">{sessionSummaryText}</div>
        </div>
      )}
      {/* When onboarding, signal plan completion to hide Quick Start later */}
      {(() => { try{ if (new URLSearchParams(window.location.search).get('onboard')==='1' && sessionSummary) localStorage.setItem('bvx_done_plan','1'); }catch{} return null; })()}
    </div>
  );
}

function ProfileEditor(){
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tone, setTone] = useState('');
  const [brandProfile, setBrandProfile] = useState('');
  const [avgPrice, setAvgPrice] = useState<string>('');
  const [avgTime, setAvgTime] = useState<string>('');
  const [monthlyRent, setMonthlyRent] = useState<string>('');
  const [primaryGoal, setPrimaryGoal] = useState('');
  const [original, setOriginal] = useState({
    tone: '',
    brandProfile: '',
    avgPrice: '',
    avgTime: '',
    monthlyRent: '',
    primaryGoal: '',
  });
  useEffect(()=>{ (async()=>{
    try{
      const r = await api.get(`/settings`);
      const bp = r?.data?.brand_profile || {};
      const goals = r?.data?.goals || {};
      const toneVal = String(bp?.voice||'');
      const aboutVal = String(bp?.about||'');
      const avgPriceVal = String(r?.data?.avg_service_price_cents ? (Number(r.data.avg_service_price_cents)/100).toFixed(2) : '');
      const avgTimeVal = String(r?.data?.avg_service_minutes || '');
      const rentVal = String(r?.data?.monthly_rent_cents ? (Number(r.data.monthly_rent_cents)/100).toFixed(2) : '');
      const goalVal = String(goals?.primary||'');
      setTone(toneVal);
      setBrandProfile(aboutVal);
      setAvgPrice(avgPriceVal);
      setAvgTime(avgTimeVal);
      setMonthlyRent(rentVal);
      setPrimaryGoal(goalVal);
      setOriginal({
        tone: toneVal,
        brandProfile: aboutVal,
        avgPrice: avgPriceVal,
        avgTime: avgTimeVal,
        monthlyRent: rentVal,
        primaryGoal: goalVal,
      });
    } finally { setLoading(false); }
  })(); },[]);
  const save = async()=>{
    if (!editing) return;
    try{
      setSaving(true);
      const toneVal = tone.trim();
      const aboutVal = brandProfile.trim();
      const goalVal = primaryGoal.trim();
      const avgPriceVal = avgPrice.trim();
      const avgTimeVal = avgTime.trim();
      const monthlyRentVal = monthlyRent.trim();
      const priceCents = Math.round(Number(avgPriceVal||'0')*100)||0;
      const rentCents = Math.round(Number(monthlyRentVal||'0')*100)||0;
      const minutesVal = Number(avgTimeVal||'0')||0;
      const bp = { voice: toneVal, about: aboutVal };
      const goals = { primary: goalVal };
      await api.post('/settings', {
        brand_profile: bp,
        goals,
        avg_service_price_cents: priceCents,
        avg_service_minutes: minutesVal,
        monthly_rent_cents: rentCents,
      });
      setTone(toneVal);
      setBrandProfile(aboutVal);
      setPrimaryGoal(goalVal);
      setAvgPrice(avgPriceVal);
      setAvgTime(avgTimeVal);
      setMonthlyRent(monthlyRentVal);
      setOriginal({
        tone: toneVal,
        brandProfile: aboutVal,
        avgPrice: avgPriceVal,
        avgTime: avgTimeVal,
        monthlyRent: monthlyRentVal,
        primaryGoal: goalVal,
      });
      setEditing(false);
      showToast({ title:'Saved', description:'Profile updated.' });
    } catch(e:any){ showToast({ title:'Save error', description:String(e?.message||e) }); }
    finally{ setSaving(false); }
  };
  const cancel = () => {
    setTone(original.tone);
    setBrandProfile(original.brandProfile);
    setAvgPrice(original.avgPrice);
    setAvgTime(original.avgTime);
    setMonthlyRent(original.monthlyRent);
    setPrimaryGoal(original.primaryGoal);
    setEditing(false);
  };
  if (loading) return <div className="rounded-xl bg-white p-3 border text-sm text-slate-600">Loading…</div>;
  return (
    <div className={`rounded-xl bg-white shadow-sm p-3 border ${editing ? 'border-sky-300 shadow-md' : ''}`} data-guide="trainvx-profile">
      <div className="text-sm font-semibold text-slate-900">Brand profile</div>
      {editing && <div className="mt-1 text-[11px] text-sky-700">Editing mode • Save to lock in changes.</div>}
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        <label className="grid gap-1">
          <span className="text-slate-600 text-xs">Tone</span>
          <input className={`border rounded-md px-2 py-1 ${editing ? '' : 'bg-slate-50'}`} value={tone} onChange={e=>setTone(e.target.value)} placeholder="Warm, Editorial crisp…" disabled={!editing} />
        </label>
        <label className="grid gap-1">
          <span className="text-slate-600 text-xs">Primary goal</span>
          <input className={`border rounded-md px-2 py-1 ${editing ? '' : 'bg-slate-50'}`} value={primaryGoal} onChange={e=>setPrimaryGoal(e.target.value)} placeholder="Fill Fridays, retain first‑timers…" disabled={!editing} />
        </label>
        <label className="md:col-span-2 grid gap-1">
          <span className="text-slate-600 text-xs">About / Brand profile</span>
          <textarea className={`border rounded-md px-2 py-1 ${editing ? '' : 'bg-slate-50'}`} rows={3} value={brandProfile} onChange={e=>setBrandProfile(e.target.value)} placeholder="Short brand description, specialties, vibe…" disabled={!editing} />
        </label>
        <label className="grid gap-1">
          <span className="text-slate-600 text-xs">Avg service price ($)</span>
          <input className={`border rounded-md px-2 py-1 ${editing ? '' : 'bg-slate-50'}`} inputMode="decimal" value={avgPrice} onChange={e=>setAvgPrice(e.target.value)} disabled={!editing} />
        </label>
        <label className="grid gap-1">
          <span className="text-slate-600 text-xs">Avg service time (min)</span>
          <input className={`border rounded-md px-2 py-1 ${editing ? '' : 'bg-slate-50'}`} inputMode="numeric" value={avgTime} onChange={e=>setAvgTime(e.target.value)} disabled={!editing} />
        </label>
        <label className="grid gap-1">
          <span className="text-slate-600 text-xs">Monthly rent ($)</span>
          <input className={`border rounded-md px-2 py-1 ${editing ? '' : 'bg-slate-50'}`} inputMode="decimal" value={monthlyRent} onChange={e=>setMonthlyRent(e.target.value)} disabled={!editing} />
        </label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {editing ? (
          <>
            <button className="rounded-md border px-3 py-1 text-xs text-slate-600 hover:bg-slate-50" onClick={cancel} disabled={saving}>Cancel</button>
            <button className="rounded-md border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60" onClick={save} disabled={saving}>{saving? 'Saving…' : 'Save'}</button>
          </>
        ) : (
          <button className="rounded-md border px-3 py-1 text-xs text-slate-700 hover:bg-slate-50" onClick={()=> setEditing(true)}>Edit profile</button>
        )}
      </div>
    </div>
  );
}
