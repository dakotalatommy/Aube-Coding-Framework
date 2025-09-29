import { useEffect, useRef, useState } from 'react';
// import InlineStatus from '../components/ui/InlineStatus';
import Button from '../components/ui/Button';
import * as Sentry from '@sentry/react';
import { api } from '../lib/api';
import { startGuide } from '../lib/guide';
import { trackEvent } from '../lib/analytics';

export default function Vision(){
  // Single-flow UI: Upload & Edit only (Instagram hidden)
  const isOnboard = (()=>{ try{ return new URLSearchParams(window.location.search).get('onboard')==='1'; }catch{ return false }})();
  const [preview, setPreview] = useState<string>('');
  const [b64, setB64] = useState<string>('');
  const [srcUrl, setSrcUrl] = useState<string>('');
  // const [prompt] = useState<string>('Give concise, actionable feedback on lighting, framing, and clarity for beauty portfolio quality.');
  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [mime, setMime] = useState<string>('image/jpeg');
  // const [linkContactId] = useState<string>('');
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [igItems] = useState<string[]>([]);
  // const [contactId, setContactId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [preserveDims, setPreserveDims] = useState<boolean>(true);
  // Removed Save-to-Library UI; keep minimal state only as needed
  const [lastEditAt, setLastEditAt] = useState<number | null>(null);
  const [baselinePreview, setBaselinePreview] = useState<string>(''); // input used for last edit
  const [comparePos, setComparePos] = useState<number>(50); // before/after slider position (0..100)
  const [_slowHint, setSlowHint] = useState<boolean>(false);
  const prefersReducedMotion = (()=>{ try{ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch{ return false; } })();
  const [showBefore, setShowBefore] = useState<boolean>(false);
  const [versions, setVersions] = useState<string[]>([]); // recent prior states (max 3)
  const [intensity] = useState<number>(60);
  const [origW, setOrigW] = useState<number>(0);
  const [_origH, setOrigH] = useState<number>(0);
  const [currW, setCurrW] = useState<number>(0);
  const [_currH, setCurrH] = useState<number>(0);
  const [_currFmt, setCurrFmt] = useState<string>('');
  const [objectUrl, setObjectUrl] = useState<string>('');
  const [_lastError, setLastError] = useState<string>('');
  // const [errorRaw, setErrorRaw] = useState<any>(null);
  // starter prompt seeds removed from UI

  const [clientName, setClientName] = useState<string>('');
  const [clientSuggestions, setClientSuggestions] = useState<Array<{contact_id:string; display_name:string}>>([]);
  useEffect(()=>{
    const t = setTimeout(async()=>{
      try{
        const q = clientName.trim();
        if (q.length < 2) { setClientSuggestions([]); return; }
        const r = await api.get(`/contacts/search?q=${encodeURIComponent(q)}&limit=8`);
        const items = (r?.items||[]).map((it: any)=> ({ contact_id: String(it.contact_id||''), display_name: String(it.display_name||'Client')}));
        setClientSuggestions(items);
      } catch { setClientSuggestions([]); }
    }, 220);
    return ()=> clearTimeout(t);
  }, [clientName]);

  useEffect(()=>{
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const action = String(detail?.action || '');
      if (action === 'vision.run-edit') {
        const prompt = String(detail.prompt || '').trim();
        if (!prompt) return;
        setEditPrompt(prompt);
        if (!loading) void runEdit(prompt);
        return;
      }
      if (action === 'vision.prefill-prompt') {
        const prompt = String(detail.prompt || '').trim();
        if (!prompt) return;
        setEditPrompt(prompt);
        try { inputRef.current?.focus(); } catch {}
      }
    };
    window.addEventListener('bvx:flow:vision-command' as any, handler as any);
    return () => window.removeEventListener('bvx:flow:vision-command' as any, handler as any);
  }, [loading]);

  // Hydrate history from localStorage
  useEffect(()=>{
    try {
      const hist = JSON.parse(localStorage.getItem('bvx_vision_history') || '[]');
      if (Array.isArray(hist) && hist.length) setVersions(hist.slice(0,3));
    } catch {}
  },[]);
  // Keyboard shortcuts: U upload, E edit, B hold before/after
  useEffect(()=>{
    const down = (e: KeyboardEvent) => {
      try{
        if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
        if ((e.key==='u'||e.key==='U')) { e.preventDefault(); pick(); }
        if ((e.key==='e'||e.key==='E')) { e.preventDefault(); runEdit(editPrompt); }
        if ((e.key==='b'||e.key==='B')) { setShowBefore(true); }
      }catch{}
    };
    const up = (e: KeyboardEvent) => { try{ if ((e.key==='b'||e.key==='B')) setShowBefore(false); }catch{} };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return ()=> { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [editPrompt]);

  // Load sticky preferences from settings
  useEffect(()=>{
    (async()=>{
      try{
        const r = await api.get(`/settings`);
        const v = (r?.data?.vision || {}) as any;
        if (typeof v?.preserve_dims === 'boolean') setPreserveDims(!!v.preserve_dims);
      } catch{}
      try{
        const ls = localStorage.getItem('bvx_preserve_dims');
        if (ls != null) setPreserveDims(ls === '1');
      } catch{}
    })();
  }, []);

  const persistPrefs = async (nextPreserve = preserveDims) => {
    try{
      await api.post('/settings', { vision: { preserve_dims: nextPreserve } });
    } catch {}
    try{
      localStorage.setItem('bvx_preserve_dims', nextPreserve ? '1' : '0');
    } catch {}
  };
  // const [tryPrimary] = useState<string>('Soft glam: satin skin; neutral-peach blush; soft brown wing; keep freckles.');
  // const [tryDay] = useState<string>('No-makeup makeup: sheer base, correct under-eye only, groom brows, clear gloss.');
  // const [tryNight] = useState<string>('Evening: deepen crease +10%, warm shimmer center lid, richer lip; preserve texture.');
  const inputRef = useRef<HTMLInputElement|null>(null);
  const dropRef = useRef<HTMLDivElement|null>(null);
  // Deep link tour: only fire when explicitly requested, not during unified dashboard walkthrough
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(()=>{
    try {
      const sp = new URLSearchParams(window.location.search);
      const tour = sp.get('tour');
      const tourPage = sp.get('tourPage');
      if (tour === '1' && tourPage === 'vision') {
        setTimeout(()=> startGuide('vision'), 200);
      }
    } catch {}
    return 0;
  });

  // Signal: Vision page is fully ready for guided step placement
  useEffect(() => {
    let cancelled = false;
    const signalReady = () => {
      if (cancelled) return;
      try {
        const el = document.querySelector('[data-guide="upload"]') as HTMLElement | null;
        if (el) {
          const r = el.getBoundingClientRect?.();
          if (r && r.width > 0 && r.height > 0) {
            // Unified tour continues from Dashboard; no segmented resume here
            try { window.dispatchEvent(new CustomEvent('bvx:vision:ready')); } catch {}
            try { window.dispatchEvent(new CustomEvent('bvx:dbg', { detail: { type: 'ready', pane: 'vision' } })); } catch {}
            return;
          }
        }
      } catch {}
      setTimeout(() => { try { requestAnimationFrame(signalReady); } catch { signalReady(); } }, 60);
    };
    try { requestAnimationFrame(() => { requestAnimationFrame(signalReady); }); } catch { setTimeout(signalReady, 60); }
    return () => { cancelled = true; };
  }, []);

  const pick = () => inputRef.current?.click();
  const processFile = (f: File) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setOutput('File too large (max 10MB).'); return; }
    // Show preview immediately via object URL
    try {
      const url = URL.createObjectURL(f);
      if (objectUrl) { try { URL.revokeObjectURL(objectUrl); } catch {} }
      setObjectUrl(url);
      setPreview(url);
      // Defer any DOM attributes until next frame to ensure image paints
      try { requestAnimationFrame(()=>{ try { dropRef.current?.setAttribute('data-vision-has-preview','1'); } catch {} }); } catch {}
      try { window.dispatchEvent(new CustomEvent('bvx:flow:vision-uploaded')); } catch {}
      // Do NOT set baseline until first successful edit (prevents overlay clipping)
      setComparePos(50);
      try { trackEvent('vision.upload', { size: f.size, type: f.type }); } catch {}
    } catch {}
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      try {
        const im = new Image();
        im.onload = async () => {
          try {
            const w = im.width, h = im.height;
            setOrigW(w); setOrigH(h); setCurrW(w); setCurrH(h); setCurrFmt((im as any).type || (mime || ''));
            const MAX_PIXELS = 12_000_000; // 12MP
            const pixels = w * h;
            let sendDataUrl = dataUrl;
            if (!preserveDims && pixels > MAX_PIXELS) {
              const scale = Math.sqrt(MAX_PIXELS / pixels);
              const nw = Math.max(1, Math.floor(w * scale));
              const nh = Math.max(1, Math.floor(h * scale));
              const canvas = document.createElement('canvas');
              canvas.width = nw; canvas.height = nh;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(im, 0, 0, nw, nh);
                const outMime = f.type && f.type.startsWith('image/') ? f.type : 'image/jpeg';
                sendDataUrl = canvas.toDataURL(outMime, 0.92);
              }
            }
      setSrcUrl('');
            const idx = sendDataUrl.indexOf(',');
            setB64(idx >= 0 ? sendDataUrl.slice(idx+1) : sendDataUrl);
            try{ const m = sendDataUrl.slice(5, sendDataUrl.indexOf(';')); if (m) setMime(m); }catch{}
          } catch {}
        };
        im.src = dataUrl;
      } catch {}
      // Notify AskVX chat
      try {
        const note = `I uploaded an image in brandVZN. Analyze it and, if appropriate, edit it. Current prompt: "${editPrompt||''}"`;
        let sid = localStorage.getItem('bvx_chat_session') || '';
        if (!sid) { sid = 's_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('bvx_chat_session', sid); }
        (async()=>{ try { await api.post('/ai/chat/raw', { session_id: sid, messages: [{ role:'user', content: note }] }); } catch {} })();
      } catch {}
    };
    reader.readAsDataURL(f);
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  // Drag & drop upload
  useEffect(()=>{
    const el = dropRef.current;
    if (!el) return;
    const onDragOver = (e: DragEvent) => { try{ e.preventDefault(); }catch{} };
    const onDrop = (e: DragEvent) => {
      try{
        e.preventDefault();
        const f = e.dataTransfer?.files?.[0];
        if (f) processFile(f);
      }catch{}
    };
    el.addEventListener('dragover', onDragOver as any);
    el.addEventListener('drop', onDrop as any);
    return ()=>{
      try{ el.removeEventListener('dragover', onDragOver as any); }catch{}
      try{ el.removeEventListener('drop', onDrop as any); }catch{}
    };
  }, []);

  // Paste-to-upload
  useEffect(()=>{
    const onPaste = (e: ClipboardEvent) => {
      try{
        const items = e.clipboardData?.items || [] as any;
        for (let i=0;i<items.length;i++){
          const it = items[i];
          if (it.kind === 'file') {
            const f = it.getAsFile();
            if (f) { processFile(f); break; }
          }
        }
      }catch{}
    };
    window.addEventListener('paste', onPaste as any);
    return ()=> window.removeEventListener('paste', onPaste as any);
  }, []);

  const analyze = async () => {
    if (!b64 && !srcUrl) return;
    setLoading(true);
    setOutput(''); setLastError('');
    setSlowHint(false);
    const slowTimer = window.setTimeout(()=> setSlowHint(true), 2500);
    try{
      try { trackEvent('vision.analyze', { hasB64: !!b64, mime }); } catch {}
      const span = Sentry.startInactiveSpan?.({ name: 'vision.analyze.gpt5' });
      const r = await api.post('/ai/tools/execute', {
        name: 'vision.analyze.gpt5',
        params: { ...(b64?{ inputImageBase64: b64, inputMime: mime }:{ imageUrl: srcUrl }), question: (notes||'').trim() || undefined },
        require_approval: false,
      }, { timeoutMs: 60000 });
      try { span?.end?.(); } catch {}
      try { window.clearTimeout(slowTimer); } catch {}
      const brief = String(r?.brief || '');
      const text = brief;
      let i = 0; const step = Math.max(2, Math.floor(text.length / 200));
      const timer = window.setInterval(() => {
        i = Math.min(text.length, i + step);
        setOutput(text.slice(0, i));
        if (i >= text.length) window.clearInterval(timer);
      }, 20);
      try { trackEvent('integrations.reanalyze.click', { area: 'brandvx.analyze.gpt5' }); } catch {}
    } catch(e:any){
      try { Sentry.captureException(e); } catch {}
      try { window.clearTimeout(slowTimer); } catch {}
      setLastError(humanizeError(e));
      setOutput(String(e?.message||e));
    } finally { setLoading(false); }
  };

  const runEdit = async (p: string) => {
    if (!b64 && !srcUrl) { setOutput('Upload or import an image first.'); return; }
    try { setBaselinePreview(preview); } catch {}
    setLoading(true);
    setOutput(''); setLastError('');
    try{
      setSlowHint(false);
      const slowTimer = window.setTimeout(()=> setSlowHint(true), 2500);
      // Hard watchdog: if nothing returns in 45s, surface timeout and stop spinner
      const editWatchdog = window.setTimeout(() => {
        try {
          if (loading) {
            setLoading(false);
            setLastError('timeout');
            setOutput('This edit is taking too long. Please retry, reduce size, or toggle Preserve Dimensions off.');
          }
        } catch {}
      }, 45000);
      const span = Sentry.startInactiveSpan?.({ name: 'vision.run_edit' });
      const t0 = performance.now ? performance.now() : Date.now();
      const r = await api.post('/ai/tools/execute', {
        name: 'image.edit',
        params: { mode: 'edit', prompt: `${p}\nRefinement intensity: ${intensity}/100.${notes?`\nAdditional notes: ${notes}`:''}`, ...(b64?{ inputImageBase64: b64, inputMime: mime }:{ imageUrl: srcUrl }), outputFormat: 'png', preserveDims },
        require_approval: false,
      }, { timeoutMs: 90000 });
      if (r?.data_url || r?.preview_url) {
        setLastError('');
        const next = String(r?.data_url || r?.preview_url || '');
        if (next) {
          // Set baseline only on first edit to enable compare; push history
          try { if (!baselinePreview) setBaselinePreview(preview); } catch {}
          // push current preview into versions (history), max 3
          try { setVersions(v => [preview, ...v].slice(0,3)); } catch {}
          setPreview(next);
          // Iterative refinement: if we received a data URL, use it as the next input
          try {
            if (next.startsWith('data:')) {
              const comma = next.indexOf(',');
              const head = next.slice(0, comma);
              const body = next.slice(comma + 1);
              const m = (() => { try { return head.slice(5, head.indexOf(';')) || 'image/png'; } catch { return 'image/png'; }})();
              setB64(body);
              setMime(m);
              setSrcUrl('');
              try { const im = new Image(); im.onload = () => { setCurrW(im.width); setCurrH(im.height); setCurrFmt(m); }; im.src = next; } catch {}
            } else {
              // Convert preview URL to data URL so subsequent edits refine the latest image
              const resp = await fetch(next);
              const blob = await resp.blob();
              const reader = new FileReader();
              const dataUrl: string = await new Promise((resolve, reject) => {
                reader.onerror = () => reject(new Error('read failed'));
                reader.onloadend = () => resolve(String(reader.result || ''));
                reader.readAsDataURL(blob);
              });
              const comma = dataUrl.indexOf(',');
              const head = dataUrl.slice(0, comma);
              const body = dataUrl.slice(comma + 1);
              const m = (() => { try { return head.slice(5, head.indexOf(';')) || (blob.type || 'image/png'); } catch { return blob.type || 'image/png'; }})();
              setPreview(dataUrl);
              setB64(body);
              setMime(m);
              setSrcUrl('');
              try { const im = new Image(); im.onload = () => { setCurrW(im.width); setCurrH(im.height); setCurrFmt(m); }; im.src = dataUrl; } catch {}
            }
          } catch {}
        }
        try {
          const el = dropRef.current as any;
          const prev = Number(el?.getAttribute?.('data-vision-edits')||'0')||0;
          el?.setAttribute?.('data-vision-edits', String(prev+1));
          el?.setAttribute?.('data-vision-lastedit', String(Date.now()));
        } catch {}
        try { window.dispatchEvent(new CustomEvent('bvx:flow:vision-edit-complete', { detail: { prompt: p } })); } catch {}
        // Persist prompt and history
        try { setVersions(v => { localStorage.setItem('bvx_vision_history', JSON.stringify(v)); return v; }); } catch {}
        setOutput('Edit complete.');
        try { setLastEditAt(Date.now()); } catch {}
        try {
          const ms = Math.round((performance.now ? performance.now() : Date.now()) - t0);
          trackEvent('vision.run_edit', { ms, preserveDims, mime: mime||'', intensity });
          if (ms > 8000) {
            try { Sentry.captureMessage('vision.run_edit.slow', { level: 'warning' } as any); } catch {}
          }
        } catch {}
        try { span?.end?.(); } catch {}
        try { window.clearTimeout(slowTimer); } catch {}
        try { window.clearTimeout(editWatchdog); } catch {}
      } else {
        const friendly = humanizeError(r);
        // Surface exact backend error details to aid debugging (status/detail/body/rid)
        try {
          const rawDetail = String(r?.detail || r?.message || r?.status || '');
          const extra = [
            rawDetail ? `detail: ${rawDetail}` : '',
            r?.rid ? `rid: ${String(r.rid)}` : '',
            r?.content_type ? `type: ${String(r.content_type)}` : '',
          ].filter(Boolean).join(' | ');
          const body = String(r?.body || '');
          const snippet = body ? `\n${body.slice(0, 400)}` : '';
          setOutput(`${friendly}${extra ? `\n(${extra})` : ''}${snippet}`);
        } catch {
          setOutput(friendly);
        }
        setLastError(friendly);
        try { window.dispatchEvent(new CustomEvent('bvx:flow:vision-edit-complete', { detail: { prompt: p, error: friendly } })); } catch {}
        try {
          const detail = String((r?.detail||r?.status||'')||'').toLowerCase();
          if (detail.includes('subscription_required') || friendly.toLowerCase().includes('subscription')) {
            try {
              const u = new URL(window.location.href);
              u.searchParams.set('billing','prompt');
              window.history.pushState({}, '', u.toString());
              window.dispatchEvent(new PopStateEvent('popstate'));
            } catch {}
          }
        } catch {}
      }
    } catch(e:any){ try { Sentry.captureException(e); } catch {}; const friendly = humanizeError(e);
      try {
        const rawDetail = String(e?.detail || e?.status || e?.message || '');
        setOutput(`${friendly}${rawDetail ? `\n(detail: ${rawDetail.slice(0,200)})` : ''}`);
      } catch {
        setOutput(String(friendly||e?.message||e));
      }
      setLastError(friendly);
      try {
        const detail = String((e?.detail||e?.status||e?.message||'')||'').toLowerCase();
        if (detail.includes('subscription_required') || friendly.toLowerCase().includes('subscription')) {
          const u = new URL(window.location.href);
          u.searchParams.set('billing','prompt');
          window.history.pushState({}, '', u.toString());
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      } catch {}
    }
    finally { try { setLoading(false); } catch {} }
  };

  // Brand analysis available on Instagram tab (flows added separately)

  // const importInstagram = async () => {};

  // saveToLibrary / loadLibrary helpers removed with UI

  // saveToClient handled elsewhere

  const canRun = (!!b64 || !!srcUrl) && !loading;

  // When onboarding, mark vision step as completed after first successful edit
  try { if (new URLSearchParams(window.location.search).get('onboard')==='1' && (Number((dropRef.current as any)?.getAttribute?.('data-vision-edits')||'0')||0) > 0) localStorage.setItem('bvx_done_vision','1'); } catch {}

  function humanizeError(err: any): string {
    try {
      const detail = String(err?.detail || err?.status || err?.message || err || '').toLowerCase();
      if (!detail) return 'Something went wrong.';
      if (detail.includes('rate_limited')) return 'Too many requests. Please wait a few seconds and try again.';
      if (detail.includes('invalid_image') || detail.includes('missing_image')) return 'Please upload a JPG or PNG (≤10MB) and try again.';
      if (detail.includes('gemini') && detail.includes('http_400')) return 'The image edit was not accepted. Try a shorter, clearer prompt (e.g., “Make eyes blue”).';
      if (detail.includes('vertex_http_400')) return 'Cloud model rejected this request. Try simplifying the prompt or re‑uploading as JPG.';
      if (detail.includes('no_image_returned')) return 'No image was returned. Try re‑running, or toggle Preserve Dimensions off and retry.';
      if (detail.includes('http_5')) return 'The model is temporarily unavailable. Please retry in a moment.';
      if (detail.includes('timeout')) return 'This took too long. Please retry. Large images can slow things down.';
      return 'Edit failed. Try a simpler prompt or re‑upload the image.';
    } catch { return 'Edit failed. Please try again.'; }
  }

  // revertToLastGood removed from header; history controls remain

  return (
    <div className="space-y-4 overflow-y-auto pb-3 h-full">
      {/* Simplified header: no loading/error banner */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-2 sm:px-3 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            {lastEditAt && (
              <span className="text-slate-500">Last edited {new Date(lastEditAt).toLocaleTimeString()}</span>
            )}
          </div>
          <div className="flex items-center gap-2" />
        </div>
      </div>
      <div className="flex items-center">
      <h3 className="text-lg font-semibold">brandVZN</h3>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={()=>{ window.location.href='/ask'; }}>AskVX</Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 items-start pb-16 md:pb-0">
        <div
          ref={dropRef}
          className="w-full h-[420px] md:h-[460px] border rounded-xl bg-white shadow-sm overflow-hidden relative select-none z-10"
          data-guide="preview"
          onMouseDown={() => setShowBefore(true)}
          onMouseUp={() => setShowBefore(false)}
          onMouseLeave={() => setShowBefore(false)}
          onTouchStart={() => setShowBefore(true)}
          onTouchEnd={() => setShowBefore(false)}
          title="Drop an image here or paste (Cmd/Ctrl+V)"
        >
          {!preview && (
            <div className="absolute inset-0 grid place-items-center text-slate-500 text-sm p-2 text-center">
              <div>
                <div>Drop or paste an image to start</div>
                <div className="text-[11px] mt-1">or click Upload below</div>
              </div>
            </div>
          )}
          {preview && (
            <>
              {/* Base (Before) — only after first edit */}
              {baselinePreview && baselinePreview !== preview && (
                <img src={baselinePreview} alt="before" className="absolute inset-0 object-contain w-full h-full"/>
              )}
              {/* Overlay (After) */}
              <img
                src={preview}
                alt="after"
                className="absolute inset-0 object-contain w-full h-full"
                style={(baselinePreview && baselinePreview !== preview) ? { clipPath: `inset(0 ${Math.max(0, 100-comparePos)}% 0 0)`, transition: prefersReducedMotion ? undefined : 'clip-path 120ms ease' } : undefined}
              />
              {(baselinePreview && baselinePreview !== preview) && (
                <div className="absolute left-0 right-0 bottom-1 flex items-center justify-center px-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={comparePos}
                    onChange={e=> setComparePos(parseInt(e.target.value))}
                    aria-label="Compare before/after"
                    className="w-full"
                  />
                </div>
              )}
              {baselinePreview && (
                <div className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white">
                  {showBefore ? 'Before' : 'After'}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex-1 space-y-3">
          {/* Compact 3‑column row: textarea | actions | brief */}
          <div className="grid gap-3 items-start grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            {/* Col 1: Prompt textarea */}
            <textarea
              className="w-full border rounded-md px-3 py-2"
              rows={3}
              value={editPrompt}
              onChange={e=>setEditPrompt(e.target.value)}
              placeholder={preview ? 'Type an edit prompt (e.g., “Change hair color to copper”)' : 'Click here to start editing or upload a photo to begin'}
            />
            {/* Col 2: Vertical actions */}
            <div className="shrink-0 flex flex-col gap-2">
              <Button variant="outline" onClick={pick} data-guide="upload" aria-label="Upload image">Upload</Button>
              <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.dng,image/*" className="hidden" onChange={onFile} />
              <Button variant="outline" disabled={(!b64 && !srcUrl) || loading} onClick={analyze} data-guide="analyze" aria-label="Analyze photo">{loading ? 'Analyzing…' : 'Analyze Photo'}</Button>
              <Button variant="outline" disabled={(!b64 && !srcUrl) || loading} onClick={()=> runEdit(editPrompt)} data-guide="edit" aria-label="Run edit">{loading ? 'Editing…' : 'Run Edit'}</Button>
            </div>
            {/* Col 3: Brief panel */}
            <div className="rounded-xl border bg-white p-3 text-sm min-h-[96px] min-w-[260px] md:min-w-[320px]" aria-live="polite">
              {output ? (
                <div className="whitespace-pre-wrap">{output}</div>
              ) : (
                <div className="text-xs text-slate-500">Run Analyze to see a brief here.</div>
              )}
            </div>
          </div>

          {/* Hair / Eye color quick chips — onboarding only */}
          {isOnboard && (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-slate-600">Hair:</span>
                {['copper','espresso brown','platinum blonde','rose gold','jet black'].map(c=> (
                  <Button key={c} variant="outline" size="sm" onClick={()=>{ const p=`Change hair color to ${c}`; setEditPrompt(p); if (canRun) runEdit(p); }}>{c}</Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-slate-600">Eyes:</span>
                {['blue','green','hazel','amber','gray'].map(c=> (
                  <Button key={c} variant="outline" size="sm" onClick={()=>{ const p=`Change eye color to ${c}`; setEditPrompt(p); if (canRun) runEdit(p); }}>{c}</Button>
                ))}
              </div>
            </div>
          )}
          {false && !isOnboard && (
            <div className="mt-1 flex flex-wrap gap-2 text-xs" aria-label="Starter prompts" />
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <label className="grid gap-1">
              <span className="text-xs text-slate-600">Client name</span>
              <input list="client-suggest" className="border rounded-md px-3 py-2" value={clientName} onChange={e=>{ setClientName(e.target.value); }} placeholder="Jane Doe" />
              <datalist id="client-suggest">
                {clientSuggestions.map(s=> (
                  <option key={s.contact_id} value={s.display_name} />
                ))}
              </datalist>
            </label>
            <label className="md:col-span-2 grid gap-1">
              <span className="text-xs text-slate-600">Notes (optional)</span>
              <input className="border rounded-md px-3 py-2" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Lighting edit, version A…" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2" title="Keep output size the same as the original">
              <input type="checkbox" checked={preserveDims} onChange={async e=>{ const v=e.target.checked; setPreserveDims(v); await persistPrefs(v); }} aria-label="Preserve original dimensions"/>
              <span className="text-xs text-slate-600">Preserve Original Dimensions</span>
            </label>
          </div>
          {/* Save/My Images moved to top control row */}
          {/* Version stack (hidden for beta) */}
          {false && versions.length > 0 && (
            <div className="pt-2">
              <div className="text-xs text-slate-600 mb-1">History</div>
        <div className="flex gap-2">
                {versions.map((v, i) => (
                  <button key={i} className="relative w-16 h-16 border rounded overflow-hidden hover:ring-2 ring-pink-300" onClick={async ()=>{
                    try {
                      const current = preview;
                      setPreview(v);
                      setBaselinePreview(v);
                      // update input for next edit
                      if (v.startsWith('data:')) {
                        const comma = v.indexOf(',');
                        const body = v.slice(comma+1);
                        const m = v.slice(5, v.indexOf(';')) || 'image/png';
                        setB64(body); setMime(m); setSrcUrl('');
                        try { const im = new Image(); im.onload = () => { setCurrW(im.width); setCurrH(im.height); setCurrFmt(m); }; im.src = v; } catch {}
                      }
                      setVersions(arr => [current, ...arr.filter((_,idx)=> idx!==i)].slice(0,3));
                    } catch {}
                  }}>
                    <img src={v} alt={`v${i+1}`} className="object-cover w-full h-full"/>
                    <span className="absolute bottom-0 right-0 text-[10px] bg-black/50 text-white px-1">V{i+1}</span>
                  </button>
                ))}
              </div>
        </div>
          )}
          {/* Dimensions chip hidden */}
          {false && (origW>0 && currW>0) && (<div />)}

          {/* Controls moved to bottom */}
          <div className="mt-3 flex flex-wrap items-center gap-2" />
        </div>
      </div>

      {false && (
      <div className="border rounded-xl bg-white shadow-sm p-3 min-h-24 whitespace-pre-wrap text-sm">{output}</div>
      )}

      {/* Download original+edited */}
      {preview && (
        <div className="mt-2">
          <Button variant="outline" size="sm" onClick={async()=>{
            try{
              // Download edited
              const a1 = document.createElement('a');
              a1.href = preview;
              a1.download = 'edited.png';
              document.body.appendChild(a1); a1.click(); document.body.removeChild(a1);
              // Download original/baseline if available
              if (baselinePreview) {
                const a2 = document.createElement('a');
                a2.href = baselinePreview;
                a2.download = 'original.png';
                document.body.appendChild(a2); a2.click(); document.body.removeChild(a2);
              }
            } catch {}
          }}>Download original + edited</Button>
          {false && (
            <Button variant="outline" size="sm" className="ml-2">Download ZIP</Button>
          )}
          {!preview && (
            <Button variant="outline" size="sm" className="ml-2" onClick={async()=>{
              try{
                // Generate a small sample image via canvas (no network dependency)
                const c = document.createElement('canvas'); c.width = 512; c.height = 512;
                const ctx = c.getContext('2d'); if (!ctx) return;
                const g = ctx.createLinearGradient(0,0,512,512);
                g.addColorStop(0,'#fce7f3'); g.addColorStop(1,'#e0e7ff');
                ctx.fillStyle = g; ctx.fillRect(0,0,512,512);
                ctx.fillStyle = '#111827'; ctx.font = 'bold 28px system-ui, sans-serif';
                ctx.fillText('brandVZN sample', 130, 260);
                const dataUrl = c.toDataURL('image/png');
                const url = dataUrl; if (objectUrl) { try { URL.revokeObjectURL(objectUrl); } catch {} }
                setObjectUrl(url); setPreview(url); setBaselinePreview(url);
                const idx = dataUrl.indexOf(','); setB64(idx>=0? dataUrl.slice(idx+1): dataUrl);
                try{ setMime('image/png'); }catch{}
              }catch{}
            }}>Use sample image</Button>
          )}
        </div>
      )}

      {/* Mobile bottom toolbar removed to avoid duplicate controls */}

      {igItems.length > 0 && (
        <div className="mt-2 grid grid-cols-6 gap-2">
          {igItems.map((u, i)=> (
            <button key={i} className="aspect-square overflow-hidden border rounded hover:ring-2 ring-pink-300" onClick={()=>{ setPreview(u); setSrcUrl(u); setB64(''); }}>
              <img src={u} alt={`ig_${i}`} className="object-cover w-full h-full"/>
            </button>
          ))}
        </div>
      )}
      {/* Quick edit removed for simplified flow */}
    </div>
  );
}
