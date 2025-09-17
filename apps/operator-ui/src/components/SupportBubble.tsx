import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, getTenant } from '../lib/api';
import { supabase } from '../lib/supabase';

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
    return lines.join('\n\n');
  } catch {
    return text || '';
  }
}

export default function SupportBubble(){
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
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) { setNeedsAuth(true); return null; }
      setNeedsAuth(false);
      return session;
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

  return (
    <>
      {/* Floating pill bubble */}
      {!open && createPortal(
        <button
          aria-label="Open support"
          onClick={()=> setOpen(true)}
          className="fixed right-4 bottom-4 z-[4000] rounded-full border bg-white px-4 py-2 shadow-md text-sm text-slate-900 hover:shadow-lg"
          data-bvx="support-bubble-button"
        >
          support
        </button>,
        document.body
      )}
      {open && createPortal(
        <div className="fixed inset-0 z-[4000] pointer-events-none">
          {/* Click catcher to close when clicking outside */}
          <div className="absolute inset-0" onClick={()=> setOpen(false)} />
          <div className="absolute right-4 bottom-4 w-[min(36vw,420px)] max-w-[92vw] h-[min(48vh,560px)] max-h-[78vh] pointer-events-auto">
            <div className="flex h-full w-full flex-col rounded-2xl border bg-white shadow-2xl">
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <div className="text-sm font-semibold text-slate-900">brandVX support</div>
                <button className="px-2 py-1 text-xs rounded-md border bg-white" onClick={()=> setOpen(false)}>Close</button>
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
          </div>
        </div>,
        document.body
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


