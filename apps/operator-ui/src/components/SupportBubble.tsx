import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import OverlayPortal from './OverlayPortal';
import { api, getTenant } from '../lib/api';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';

type BugAttachment = {
  file: File;
  error?: string;
};

type ChatMsg = { role: 'user' | 'assistant'; content: string };

function formatAssistant(text: string): string {
  try {
    const t = String(text || '').trim();
    if (!t) return '';
    // Simple readability: break long lines, promote bullets, bold labels
    const lines = t
      .replace(/\r/g, '')
      .split(/\n{2,}/)
      .map(chunk => chunk.trim())
      .filter(Boolean)
      .map(chunk => {
        // Convert "1) ..." or "- ..." into bullets
        if (/^(\d+\)|•|-|\*)\s+/.test(chunk)) return chunk;
        // Insert soft line breaks after sentences > 140 chars
        if (chunk.length > 160) {
          return chunk.replace(/([\.!?])\s+/g, '$1\n');
        }
        return chunk;
      });
    // Join with blank lines to create paragraphs
    let out = lines.join('\n\n');
    // Humanize: strip raw placeholders/variables and prefer beauty‑friendly language
    try {
      // Remove inline code backticks
      out = out.replace(/`([^`]+)`/g, '$1');
      // Replace common placeholder syntaxes with friendly wording
      out = out.replace(/\{\{[^}]+\}\}/g, 'this detail');
      out = out.replace(/\[[^\]]+\]/g, (m) => {
        const inner = m.slice(1, -1);
        // Keep dates like [2025-09-01]
        if (/^\d{4}-\d{2}-\d{2}$/.test(inner)) return inner;
        return 'this detail';
      });
      out = out.replace(/<[^>]+>/g, 'this detail');
      // De-jargonize common tech words
      out = out.replace(/\b(var|vars|variable|variables|param|params|parameter|parameters|arg|args)\b/gi, 'detail');
      // Collapse stray single-letter placeholders like P/N
      out = out.replace(/\b(P|N)\b/g, 'detail');
      // Normalize excessive whitespace from replacements
      out = out.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    } catch {}
    return out;
  } catch {
    return text || '';
  }
}

type SupportBubbleProps = {
  hideTrigger?: boolean;
};

export default function SupportBubble({ hideTrigger }: SupportBubbleProps){
  const BOOKING_URL = (import.meta as any).env?.VITE_BOOKING_URL || '';
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('bvx_support_open') === '1'; } catch { return false; }
  });
  const [sessionId] = useState<string>(() => {
    try {
      const cached = sessionStorage.getItem('bvx_support_session') || '';
      if (cached) return cached;
      const sid = 'sup_' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('bvx_support_session', sid);
      return sid;
    } catch {
      return 'sup_' + Math.random().toString(36).slice(2, 10);
    }
  });
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const scrollerRef = useRef<HTMLDivElement|null>(null);
  const [debugVisible, setDebugVisible] = useState<boolean>(false);
  const [bugModalOpen, setBugModalOpen] = useState(false);
  const [bugSubmitting, setBugSubmitting] = useState(false);
  const [bugError, setBugError] = useState<string | null>(null);
  const [bugSuccess, setBugSuccess] = useState<string | null>(null);
  const [bugForm, setBugForm] = useState({
    name: '',
    email: '',
    phone: '',
    description: '',
  });
  const [bugFiles, setBugFiles] = useState<BugAttachment[]>([]);
  const appVersion = useMemo(() => {
    try {
      const env = (import.meta as any).env || {};
      const candidates = [env?.VITE_APP_VERSION, env?.VITE_COMMIT, env?.VITE_BUILD_ID, env?.VITE_GIT_SHA];
      for (const candidate of candidates) {
        if (candidate) return String(candidate);
      }
      if (typeof window !== 'undefined') {
        const globals = [(window as any).__APP_VERSION__, (window as any).__COMMIT_SHA__, (window as any).APP_VERSION];
        for (const g of globals) {
          if (g) return String(g);
        }
      }
    } catch {}
    return 'dev';
  }, []);

  // Runtime guard & debug
  useEffect(()=>{
    try {
      // Signal mount
      window.dispatchEvent(new CustomEvent('bvx:support:mounted'));
      // Console breadcrumb
      // eslint-disable-next-line no-console
      console.info('[SupportBubble] mounted', { path: window.location.pathname });
      // Probe element
      let probe = document.getElementById('bvx-support-probe');
      if (!probe) {
        probe = document.createElement('div');
        probe.id = 'bvx-support-probe';
        probe.setAttribute('data-bvx', 'support-bubble');
        Object.assign(probe.style, {
          position: 'fixed', right: '4px', bottom: '4px', width: '1px', height: '1px',
          opacity: '0', zIndex: '4001', pointerEvents: 'none'
        } as CSSStyleDeclaration);
        document.body.appendChild(probe);
      }
      // Optional debug chip
      const debug = (()=>{ try{ const sp=new URLSearchParams(window.location.search); if(sp.get('supportDebug')==='1') return true; return localStorage.getItem('bvx_support_debug')==='1'; }catch{return false;} })();
      if (debug) {
        setDebugVisible(true);
        window.setTimeout(()=> setDebugVisible(false), 2600);
      }
      // Style snapshot for diagnostics
      window.setTimeout(()=>{
        try {
          const btn = document.querySelector('[data-bvx="support-bubble-button"]') as HTMLElement | null;
          if (btn) {
            const cs = window.getComputedStyle(btn);
            // eslint-disable-next-line no-console
            console.info('[SupportBubble] button styles', { display: cs.display, visibility: cs.visibility, opacity: cs.opacity, zIndex: cs.zIndex });
          } else {
            // eslint-disable-next-line no-console
            console.warn('[SupportBubble] button not found at mount');
          }
        } catch {}
      }, 0);
      return () => { try { const p = document.getElementById('bvx-support-probe'); p?.remove(); } catch {} };
    } catch {}
    return undefined;
  }, []);

  useEffect(()=>{ try{ localStorage.setItem('bvx_support_open', open ? '1' : '0'); } catch{} }, [open]);

  useEffect(() => {
    const handleOpen = (event?: Event) => {
      try {
        const detail = (event as CustomEvent | undefined)?.detail || {};
        const prefill = typeof detail?.prefill === 'string' ? detail.prefill : '';
        if (prefill) setInput(prefill);
      } catch {}
      setOpen(true);
    };
    const handleClose = () => setOpen(false);
    const handleToggle = () => setOpen((curr) => !curr);
    window.addEventListener('bvx:support:open', handleOpen as any);
    window.addEventListener('bvx:support:close', handleClose as any);
    window.addEventListener('bvx:support:toggle', handleToggle as any);
    return () => {
      window.removeEventListener('bvx:support:open', handleOpen as any);
      window.removeEventListener('bvx:support:close', handleClose as any);
      window.removeEventListener('bvx:support:toggle', handleToggle as any);
    };
  }, []);

  // Greet when opening for the first time in a session
  useEffect(()=>{
    if (!open) return;
    if (messages.length === 0) {
      setMessages([{ role:'assistant', content: "hey — this is support from brandVX. what can i help you with?" }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-scroll on new message
  useEffect(()=>{
    try{ scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' }); } catch{}
  }, [messages.length]);

  useMemo(()=> !needsAuth, [needsAuth]);

  const ensureAuth = async () => {
    try{
      // Use legacy session-based authentication (no explicit token checks needed)
      setNeedsAuth(false);
      return true;
    } catch {
      setNeedsAuth(true);
      return null;
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const next = [...messages, { role:'user' as const, content: text }];
    setMessages(next);
    setBusy(true);
    try{
      const sess = await ensureAuth();
      if (!sess) {
        setMessages(curr=> [...curr, { role:'assistant', content: 'please sign in to continue the chat. you can also email support@brandvx.io.' }]);
        return;
      }
      const tid = await getTenant();
      const r = await api.post('/ai/chat/raw', {
        tenant_id: tid,
        session_id: sessionId,
        mode: 'support',
        messages: next,
      }, { timeoutMs: 45000 });
      const reply = String(r?.text || '').trim();
      const formatted = formatAssistant(reply);
      setMessages(curr=> [...curr, { role:'assistant', content: formatted || 'thanks — how else can i help?' }]);
    } catch(e:any){
      setMessages(curr=> [...curr, { role:'assistant', content: String(e?.message||e) }]);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  const onBugField = (field: keyof typeof bugForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setBugForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const onBugFilesChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBugError(null);
    setBugSuccess(null);
    const next: BugAttachment[] = [...bugFiles];
    for (const file of files) {
      if (next.length >= 3) break;
      const sizeOk = file.size <= 10 * 1024 * 1024; // 10MB per submission constraint
      const typeOk = /^(image\/(png|jpeg)|application\/pdf)$/i.test(file.type);
      next.push({
        file,
        error: !sizeOk ? 'File exceeds 10MB limit' : (!typeOk ? 'Only PNG, JPEG, or PDF allowed' : undefined),
      });
    }
    setBugFiles(next.slice(0, 3));
    e.target.value = '';
  };

  const removeBugFile = useCallback((idx: number) => {
    setBugFiles(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const resetBugForm = useCallback(() => {
    setBugForm({ name: '', email: '', phone: '', description: '' });
    setBugFiles([]);
    setBugError(null);
    setBugSuccess(null);
  }, []);

  const openBugModal = useCallback(() => {
    setBugModalOpen(true);
    setBugError(null);
    setBugSuccess(null);
  }, []);

  const closeBugModal = useCallback(() => {
    if (bugSubmitting) return;
    setBugModalOpen(false);
    resetBugForm();
  }, [bugSubmitting, resetBugForm]);

  const submitBug = useCallback(async () => {
    if (bugSubmitting) return;
    const email = bugForm.email.trim();
    const description = bugForm.description.trim();
    if (!email || !description) {
      setBugError('Email and description are required.');
      return;
    }
    const attachments = bugFiles.filter(item => !item.error).slice(0, 3);
    const totalBytes = attachments.reduce((sum, item) => sum + (item.file.size || 0), 0);
    if (totalBytes > 10 * 1024 * 1024) {
      setBugError('Attachments cannot exceed 10MB combined.');
      return;
    }
    setBugSubmitting(true);
    setBugError(null);
    try {
      const fd = new FormData();
      const tenantId = await getTenant();
      if (tenantId) fd.append('tenant_id', tenantId);
      fd.append('name', bugForm.name.trim());
      fd.append('email', email);
      fd.append('phone', bugForm.phone.trim());
      fd.append('description', description);
      fd.append('url', typeof window !== 'undefined' ? window.location.href : '');
      fd.append('pathname', typeof window !== 'undefined' ? window.location.pathname : '');
      fd.append('user_agent', typeof navigator !== 'undefined' ? navigator.userAgent : '');
      fd.append('app_version', appVersion);
      try {
        const tourPage = localStorage.getItem('bvx_last_tour_page') || '';
        const tourStep = localStorage.getItem('bvx_last_tour_step') || '';
        if (tourPage) fd.append('tour_page', tourPage);
        if (tourStep) fd.append('tour_step', tourStep);
      } catch {}
      fd.append('context_source', 'support-bubble');
      attachments.forEach(item => {
        fd.append('attachments', item.file, item.file.name);
      });
      // Get Supabase session for authentication
      const session = (await supabase.auth.getSession()).data.session;
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await api.post(`/support/send`, fd, {
        headers,
      });
      if (res.status === 401) {
        setNeedsAuth(true);
        setBugError('Please sign in to send bug reports.');
        return;
      }
      if (res.status === 429) {
        setBugError('Too many bug reports recently. Please try again in a few minutes.');
        return;
      }
      const payload = await res.json().catch(async () => {
        const text = await res.text();
        return { status: 'error', detail: text };
      });
      if (!res.ok || payload?.status === 'error') {
        const detail = payload?.detail || payload?.message || `Request failed (${res.status})`;
        throw new Error(detail);
      }
      const ticketId = payload?.ticket_id ? String(payload.ticket_id) : '';
      const successMessage = ticketId
        ? `Thanks! Ticket ${ticketId} is on the way.`
        : 'Thanks! We received your report.';
      setBugSuccess(successMessage);
      try { track('support.bug.submit', { ticket_id: ticketId || undefined }); } catch {}
      setBugForm(prev => ({ ...prev, description: '' }));
      setBugFiles([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setBugError(message || 'Something went wrong sending your report.');
    } finally {
      setBugSubmitting(false);
    }
  }, [appVersion, bugFiles, bugForm, bugSubmitting, track, setNeedsAuth, getTenant]);

  useEffect(() => {
    const openSupport = () => setOpen(true);
    const openBug = () => {
      setOpen(true);
      openBugModal();
    };
    const closeSupport = () => setOpen(false);
    window.addEventListener('bvx:support:open', openSupport);
    window.addEventListener('bvx:support:open-bug', openBug);
    window.addEventListener('bvx:support:close', closeSupport);
    return () => {
      window.removeEventListener('bvx:support:open', openSupport);
      window.removeEventListener('bvx:support:open-bug', openBug);
      window.removeEventListener('bvx:support:close', closeSupport);
    };
  }, [openBugModal]);

  useEffect(() => {
    const api = {
      open: () => setOpen(true),
      close: () => setOpen(false),
      reportBug: () => {
        setOpen(true);
        openBugModal();
      },
    };
    try {
      (window as any).brandvxSupport = api;
    } catch {}
    return () => {
      try {
        if ((window as any).brandvxSupport === api) {
          delete (window as any).brandvxSupport;
        }
      } catch {}
    };
  }, [openBugModal]);

  const renderBugModal = () => {
    if (!bugModalOpen) return null;
    const totalBytes = bugFiles.reduce((sum, item) => sum + (item.file?.size || 0), 0);
    const totalSizeExceeded = totalBytes > 10 * 1024 * 1024;
    const anyErrors = bugFiles.some(item => item.error);
    const disableSubmit = bugSubmitting || totalSizeExceeded || anyErrors || !bugForm.description.trim() || !bugForm.email.trim();
    return (
      <div className="absolute inset-0 z-[4005] bg-white/95 backdrop-blur-md flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Report a bug</div>
          <button
            className="px-2 py-1 text-xs rounded-md border bg-white"
            onClick={closeBugModal}
            disabled={bugSubmitting}
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm text-slate-800">
          <p className="text-xs text-slate-600">
            Share what went wrong and we’ll follow up inside 1 business day. Attach screenshots or PDFs if helpful.
          </p>
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-slate-600">Name</span>
            <input
              className="w-full border rounded-md px-2 py-1"
              placeholder="Your name"
              value={bugForm.name}
              onChange={onBugField('name')}
              disabled={bugSubmitting}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-slate-600">Email*</span>
            <input
              className="w-full border rounded-md px-2 py-1"
              placeholder="you@example.com"
              type="email"
              value={bugForm.email}
              onChange={onBugField('email')}
              disabled={bugSubmitting}
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-slate-600">Phone</span>
            <input
              className="w-full border rounded-md px-2 py-1"
              placeholder="Optional"
              value={bugForm.phone}
              onChange={onBugField('phone')}
              disabled={bugSubmitting}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-slate-600">What happened?*</span>
            <textarea
              className="w-full border rounded-md px-2 py-2 min-h-[96px]"
              placeholder="Tell us what you expected and what you saw instead"
              value={bugForm.description}
              onChange={onBugField('description')}
              disabled={bugSubmitting}
              required
            />
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Attachments (up to 3 · PNG/JPEG/PDF · 10MB total)</span>
              <button
                className="px-2 py-1 border rounded-md bg-white"
                onClick={() => {
                  const input = document.getElementById('bvx-support-bug-files');
                  (input as HTMLInputElement | null)?.click();
                }}
                type="button"
                disabled={bugSubmitting || bugFiles.length >= 3}
              >
                {bugFiles.length >= 3 ? 'Limit reached' : 'Add files'}
              </button>
              <input
                id="bvx-support-bug-files"
                type="file"
                multiple
                accept="image/png,image/jpeg,application/pdf"
                className="hidden"
                onChange={onBugFilesChange}
                disabled={bugSubmitting}
              />
            </div>
            {bugFiles.length === 0 && (
              <div className="text-xs text-slate-500">No files attached.</div>
            )}
            <ul className="space-y-1">
              {bugFiles.map((item, idx) => (
                <li key={`${item.file.name}-${idx}`} className="flex items-center justify-between text-xs rounded-md border px-2 py-1 bg-white">
                  <div>
                    <div className="font-medium text-slate-700">{item.file.name}</div>
                    <div className={`text-[11px] ${item.error ? 'text-rose-600' : 'text-slate-500'}`}>
                      {item.error ? item.error : `${Math.round(item.file.size/1024)} KB`}
                    </div>
                  </div>
                  <button
                    className="px-1.5 py-0.5 text-[11px] border rounded-md bg-white"
                    onClick={() => removeBugFile(idx)}
                    disabled={bugSubmitting}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            {totalSizeExceeded && (
              <div className="text-xs text-rose-600">Combined file size can’t exceed 10MB.</div>
            )}
          </div>
          {bugError && (
            <div className="text-xs text-rose-600">{bugError}</div>
          )}
          {bugSuccess && (
            <div className="text-xs text-emerald-600">{bugSuccess}</div>
          )}
        </div>
        <div className="px-4 py-3 border-t flex items-center gap-2">
          <button
            className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm disabled:bg-slate-400"
            onClick={submitBug}
            disabled={disableSubmit}
          >
            Submit bug
          </button>
          <button
            className="px-3 py-2 text-sm rounded-md border bg-white"
            onClick={resetBugForm}
            type="button"
            disabled={bugSubmitting}
          >
            Reset
          </button>
        </div>
      </div>
    );
  };

  const bookingHref = BOOKING_URL || '/workspace?pane=calendar';
  const bookingExternal = Boolean(BOOKING_URL);

  return (
    <>
      {/* Floating pill bubble */}
      {!hideTrigger && !open && (
        <OverlayPortal>
        <div className="fixed inset-0 pointer-events-none">
          <button
            aria-label="Open support"
            onClick={()=> setOpen(true)}
            className="pointer-events-auto absolute right-4 bottom-4 rounded-full border bg-white px-4 py-2 shadow-md text-sm text-slate-900 hover:shadow-lg"
            data-bvx="support-bubble-button"
          >
            support
          </button>
        </div>
        </OverlayPortal>
      )}
      {open && (
        <OverlayPortal>
        <div className="fixed inset-0 pointer-events-none">
          {/* Click catcher to close when clicking outside */}
          <div className="absolute inset-0" onClick={()=> setOpen(false)} />
          <div className="absolute right-4 bottom-4 w-[min(36vw,420px)] max-w-[92vw] h-[min(48vh,560px)] max-h-[78vh] pointer-events-auto">
            <div className="flex h-full w-full flex-col rounded-2xl border bg-white shadow-2xl" style={{ backgroundColor: 'rgba(255,255,255,1)' }}>
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <div className="text-sm font-semibold text-slate-900">brandVX support</div>
                <button className="px-2 py-1 text-xs rounded-md border bg-white" onClick={()=> setOpen(false)}>Close</button>
              </div>
              <div className="px-3 py-2 border-b bg-slate-50">
                <div className="text-[11px] text-slate-600 mb-2">Pick an option below or keep chatting with our team.</div>
                <div className="grid grid-cols-1 gap-1.5">
                  <a
                    href="https://discord.gg/FDGaphZ4"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 hover:border-slate-400 transition"
                  >
                    <span>Join the Support Discord</span>
                    <span className="text-xs text-slate-500">new window</span>
                  </a>
                  <a
                    href={bookingHref}
                    {...(bookingExternal ? { target: '_blank', rel: 'noreferrer' } : {})}
                    className="inline-flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 hover:border-slate-400 transition"
                  >
                    <span>Book onboarding</span>
                    <span className="text-xs text-slate-500">already set up</span>
                  </a>
                  <button
                    className="inline-flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 hover:border-slate-400 transition"
                    onClick={openBugModal}
                  >
                    <span>Report a bug</span>
                    <span className="text-xs text-slate-500">share details</span>
                  </button>
                </div>
              </div>
              <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto p-3 text-sm text-slate-800">
                <div className="space-y-2">
                  {messages.map((m,i)=> (
                    <div key={i} className={m.role==='user' ? 'text-right' : 'text-left'}>
                      {m.role==='user' ? (
                        <span className="inline-block px-3 py-2 rounded-full bg-sky-50 text-slate-900 max-w-[90%] whitespace-pre-wrap break-words">{m.content}</span>
                      ) : (
                        <div className="inline-block px-2 py-1 rounded-lg bg-slate-50 text-slate-900 max-w-[96%] whitespace-pre-wrap break-words">{m.content}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-3 py-2 border-t">
                {needsAuth && (
                  <div className="mb-2 text-[11px] text-slate-600">sign in to chat with brandVX support. <a className="underline" href="/login">Sign in</a></div>
                )}
                <div className="flex items-start gap-2">
                  <textarea
                    className="flex-1 border rounded-md px-2 py-1 text-sm"
                    rows={2}
                    placeholder={busy ? 'Sending…' : 'Type your question and press Enter'}
                    value={input}
                    onChange={e=> setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    disabled={busy}
                  />
                  <button className="px-3 py-1.5 rounded-md border bg-white text-sm" onClick={send} disabled={busy}>Send</button>
                </div>
              </div>
            </div>
            {renderBugModal()}
          </div>
        </div>,
        </OverlayPortal>
      )}
      {/* Optional debug chip (2.6s) */}
      {debugVisible && createPortal(
        <div className="fixed right-4 bottom-16 z-[4001] pointer-events-none select-none">
          <div className="px-2 py-1 rounded-full border bg-white text-[11px] text-slate-900 shadow">support ready</div>
        </div>,
        document.body
      )}
    </>
  );
}
