import { useEffect, useRef, useState } from 'react';
import InlineStatus from '../components/ui/InlineStatus';
import Button from '../components/ui/Button';
import * as Sentry from '@sentry/react';
import { api, getTenant } from '../lib/api';
import { startGuide } from '../lib/guide';
import { trackEvent } from '../lib/analytics';

export default function Vision(){
  // Single-flow UI: Upload & Edit only (Instagram hidden)
  const [preview, setPreview] = useState<string>('');
  const [b64, setB64] = useState<string>('');
  const [srcUrl, setSrcUrl] = useState<string>('');
  // const [prompt] = useState<string>('Give concise, actionable feedback on lighting, framing, and clarity for beauty portfolio quality.');
  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [mime, setMime] = useState<string>('image/jpeg');
  // const [linkContactId] = useState<string>('');
  const [editPrompt, setEditPrompt] = useState<string>('Reduce specular highlights on T-zone; keep texture; neutralize warm cast.');
  const [igItems, setIgItems] = useState<string[]>([]);
  const [contactId, setContactId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [preserveDims, setPreserveDims] = useState<boolean>(true);
  const [policy, setPolicy] = useState<'pad'|'crop'|'scale-down'>(()=>{
    try { return (localStorage.getItem('bvx_vision_policy') as any) || 'pad'; } catch { return 'pad'; }
  });
  const [saving, setSaving] = useState(false);
  const [lastEditAt, setLastEditAt] = useState<number | null>(null);
  const [baselinePreview, setBaselinePreview] = useState<string>(''); // input used for last edit
  const [showBefore, setShowBefore] = useState<boolean>(false);
  const [versions, setVersions] = useState<string[]>([]); // recent prior states (max 3)
  const [intensity, setIntensity] = useState<number>(60);
  const [origW, setOrigW] = useState<number>(0);
  const [origH, setOrigH] = useState<number>(0);
  const [currW, setCurrW] = useState<number>(0);
  const [currH, setCurrH] = useState<number>(0);
  const [currFmt, setCurrFmt] = useState<string>('');
  const [objectUrl, setObjectUrl] = useState<string>('');
  const [lastError, setLastError] = useState<string>('');
  // const [errorRaw, setErrorRaw] = useState<any>(null);
  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);
  const starterPrompts = [
    'Change eye color to blue; keep iris texture; no halo.',
    'Reduce forehead shine; preserve skin texture; neutral tone.',
    'Brighten background subtly; keep subject contrast natural.'
  ];

  const [clientName, setClientName] = useState<string>('');
  const [clientSuggestions, setClientSuggestions] = useState<Array<{contact_id:string; display_name:string}>>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  useEffect(()=>{
    const t = setTimeout(async()=>{
      try{
        const q = clientName.trim();
        if (q.length < 2) { setClientSuggestions([]); return; }
        const tid = await getTenant();
        const r = await api.get(`/contacts/search?tenant_id=${encodeURIComponent(tid)}&q=${encodeURIComponent(q)}&limit=8`);
        const items = (r?.items||[]).map((it:any)=> ({ contact_id: String(it.contact_id||''), display_name: String(it.display_name||'Client')}));
        setClientSuggestions(items);
        // auto-select if exact match
        const exact = items.find(it=> it.display_name.toLowerCase() === q.toLowerCase());
        setSelectedContactId(exact ? exact.contact_id : '');
      } catch { setClientSuggestions([]); }
    }, 220);
    return ()=> clearTimeout(t);
  }, [clientName]);

  // Hydrate recent prompts/history from localStorage
  useEffect(()=>{
    try {
      const p = JSON.parse(localStorage.getItem('bvx_vision_prompts') || '[]');
      if (Array.isArray(p)) setRecentPrompts(p.slice(0,5));
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
        const tid = await getTenant();
        const r = await api.get(`/settings?tenant_id=${encodeURIComponent(tid)}`);
        const v = (r?.data?.vision || {}) as any;
        if (typeof v?.preserve_dims === 'boolean') setPreserveDims(!!v.preserve_dims);
        if (typeof v?.policy === 'string') setPolicy((v.policy as any) || 'pad');
      } catch{}
      try{
        const ls = localStorage.getItem('bvx_preserve_dims');
        if (ls != null) setPreserveDims(ls === '1');
        const pol = localStorage.getItem('bvx_vision_policy');
        if (pol) setPolicy((pol as any));
      } catch{}
    })();
  }, []);

  const persistPrefs = async (nextPreserve = preserveDims, nextPolicy = policy) => {
    try{
      const tid = await getTenant();
      await api.post('/settings', { tenant_id: tid, vision: { preserve_dims: nextPreserve, policy: nextPolicy } });
    } catch {}
    try{
      localStorage.setItem('bvx_preserve_dims', nextPreserve ? '1' : '0');
      localStorage.setItem('bvx_vision_policy', nextPolicy);
    } catch {}
  };
  // const [tryPrimary] = useState<string>('Soft glam: satin skin; neutral-peach blush; soft brown wing; keep freckles.');
  // const [tryDay] = useState<string>('No-makeup makeup: sheer base, correct under-eye only, groom brows, clear gloss.');
  // const [tryNight] = useState<string>('Evening: deepen crease +10%, warm shimmer center lid, richer lip; preserve texture.');
  const inputRef = useRef<HTMLInputElement|null>(null);
  // Deep link tour
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(()=>{ try{ if (new URLSearchParams(window.location.search).get('tour')==='1') setTimeout(()=> startGuide('vision'), 200); } catch {} return 0; });

  const pick = () => inputRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setOutput('File too large (max 10MB).'); return; }
    const ok = ['image/jpeg','image/png','image/dng','image/x-adobe-dng'];
    if (f.type && !ok.includes(f.type)) {
      // Allow common image/*; warn but continue
    }
    // Show preview immediately via object URL
    try {
      const url = URL.createObjectURL(f);
      if (objectUrl) { try { URL.revokeObjectURL(objectUrl); } catch {} }
      setObjectUrl(url);
      setPreview(url);
      setBaselinePreview(url);
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
            // Downscale only when preserveDims is OFF and image is very large
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
      // Also notify AskVX chat that an image was uploaded with the current edit prompt
      try {
        const note = `I uploaded an image in brandVZN. Analyze it and, if appropriate, edit it using Gemini 2.5 (nano banana). Edit prompt: "${editPrompt}"`;
        let sid = localStorage.getItem('bvx_chat_session') || '';
        if (!sid) { sid = 's_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('bvx_chat_session', sid); }
        (async()=>{ try { await api.post('/ai/chat/raw', { tenant_id: await getTenant(), session_id: sid, messages: [{ role:'user', content: note }] }); } catch {} })();
      } catch {}
    };
    reader.readAsDataURL(f);
  };

  const analyze = async () => {
    if (!b64 && !srcUrl) return;
    setLoading(true);
    setOutput(''); setLastError('');
    try{
      try { trackEvent('vision.analyze', { hasB64: !!b64, mime }); } catch {}
      const span = Sentry.startInactiveSpan?.({ name: 'vision.analyze' });
      const r = await api.post('/ai/tools/execute', {
        tenant_id: await getTenant(),
        name: 'vision.inspect',
        params: { tenant_id: await getTenant(), ...(b64?{ inputImageBase64: b64, inputMime: mime }:{ imageUrl: srcUrl }), return: ['faces','lighting','colors','qualityFlags','safeSearch'] },
        require_approval: false,
      });
      try { span?.end?.(); } catch {}
      const brief = String(r?.brief || '');
      const text = brief;
      let i = 0; const step = Math.max(2, Math.floor(text.length / 200));
      const timer = window.setInterval(() => {
        i = Math.min(text.length, i + step);
        setOutput(text.slice(0, i));
        if (i >= text.length) window.clearInterval(timer);
      }, 20);
      try { trackEvent('integrations.reanalyze.click', { area: 'brandvx.analyze' }); } catch {}
    } catch(e:any){
      try { Sentry.captureException(e); } catch {}
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
      const span = Sentry.startInactiveSpan?.({ name: 'vision.run_edit' });
      const t0 = performance.now ? performance.now() : Date.now();
      const r = await api.post('/ai/tools/execute', {
        tenant_id: await getTenant(),
        name: 'image.edit',
        params: { tenant_id: await getTenant(), mode: 'edit', prompt: `${p}\nRefinement intensity: ${intensity}/100.${notes?`\nAdditional notes: ${notes}`:''}\nCanvas policy: ${policy}.`, ...(b64?{ inputImageBase64: b64, inputMime: mime }:{ imageUrl: srcUrl }), outputFormat: 'png', preserveDims },
        require_approval: false,
      });
      if (r?.data_url || r?.preview_url) {
        setLastError('');
        const next = String(r?.data_url || r?.preview_url || '');
        if (next) {
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
        // Persist prompt and history
        try {
          setRecentPrompts(pv => {
            const arr = [p, ...pv.filter(x => x !== p)].slice(0,5);
            localStorage.setItem('bvx_vision_prompts', JSON.stringify(arr));
            return arr;
          });
          setVersions(v => { localStorage.setItem('bvx_vision_history', JSON.stringify(v)); return v; });
        } catch {}
        setOutput('Edit complete.');
        try { setLastEditAt(Date.now()); } catch {}
        try {
          const ms = Math.round((performance.now ? performance.now() : Date.now()) - t0);
          trackEvent('vision.run_edit', { ms, preserveDims, policy, mime: mime||'', intensity });
          if (ms > 8000) {
            try { Sentry.captureMessage('vision.run_edit.slow', { level: 'warning' } as any); } catch {}
          }
        } catch {}
        try { span?.end?.(); } catch {}
      } else {
        const friendly = humanizeError(r);
        setOutput(friendly);
        setLastError(friendly);
      }
    } catch(e:any){ try { Sentry.captureException(e); } catch {}; const friendly = humanizeError(e); setOutput(String(friendly||e?.message||e)); setLastError(friendly); }
    finally { setLoading(false); }
  };

  // Brand analysis available on Instagram tab (flows added separately)

  const importInstagram = async () => {
    setLoading(true);
    setOutput('');
    try {
      const j = await api.get(`/instagram/media?tenant_id=${encodeURIComponent(await getTenant())}&limit=12`);
      const items = (j?.items || []).map((it:any)=> String(it?.url||'' )).filter(Boolean);
      setIgItems(items);
      if (items.length) {
        setPreview(items[0]);
        setBaselinePreview(items[0]);
        setSrcUrl(items[0]);
        setB64('');
        setOutput('Imported first image. Click another thumbnail to switch.');
      } else {
        setOutput('No Instagram media found.');
      }
    } catch(e:any){ setOutput(String(e?.message||e)); }
    finally { setLoading(false); }
  };

  const saveToLibrary = async () => {
    try{
      if (!preview) { setOutput('Nothing to save — upload or import first.'); return; }
      setSaving(true);
      const tid = await getTenant();
      const cid = (selectedContactId || (clientName ? clientName : 'library')).trim();
      await api.post('/client-images/save', { tenant_id: tid, contact_id: cid, url: preview, notes });
      setOutput('Saved to library.');
    } catch(e:any){ setOutput(String(e?.message||e)); }
    finally { setSaving(false); }
  };

  const loadLibrary = async () => {
    try{
      setLoading(true);
      const tid = await getTenant();
      const cid = (selectedContactId || (clientName ? clientName : 'library')).trim();
      const r = await api.get(`/client-images/list?tenant_id=${encodeURIComponent(tid)}&contact_id=${encodeURIComponent(cid)}`);
      const items = (r?.items || []).map((it:any)=> String(it?.url||'')).filter(Boolean);
      setIgItems(items);
      if (items.length) {
        setPreview(items[0]); setSrcUrl(items[0]); setB64('');
        setBaselinePreview(items[0]);
        setOutput('Loaded from library.');
      } else {
        setOutput('No saved images found for this contact.');
      }
    } catch(e:any){ setOutput(String(e?.message||e)); }
    finally { setLoading(false); }
  };

  // saveToClient handled elsewhere

  const canRun = (!!b64 || !!srcUrl) && !loading;

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

  const revertToLastGood = async () => {
    try {
      if (versions.length > 0) {
        const v = versions[0];
        setPreview(v); setBaselinePreview(v);
        if (v.startsWith('data:')) {
          const comma = v.indexOf(','); const body = v.slice(comma+1);
          const m = v.slice(5, v.indexOf(';')) || 'image/png';
          setB64(body); setMime(m); setSrcUrl('');
        } else {
          const resp = await fetch(v); const blob = await resp.blob();
          const reader = new FileReader();
          const dataUrl: string = await new Promise((resolve, reject) => {
            reader.onerror = () => reject(new Error('read failed'));
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.readAsDataURL(blob);
          });
          const comma = dataUrl.indexOf(','); const body = dataUrl.slice(comma+1);
          const m = (()=>{ try{ return dataUrl.slice(5, dataUrl.indexOf(';')) || (blob.type||'image/png'); }catch{ return blob.type||'image/png'; }})();
          setPreview(dataUrl); setB64(body); setMime(m); setSrcUrl('');
        }
        setLastError('');
        return;
      }
      if (baselinePreview) {
        setPreview(baselinePreview);
        if (baselinePreview.startsWith('data:')) {
          const comma = baselinePreview.indexOf(','); const body = baselinePreview.slice(comma+1);
          const m = baselinePreview.slice(5, baselinePreview.indexOf(';')) || 'image/png';
          setB64(body); setMime(m); setSrcUrl('');
        }
        setLastError('');
      }
    } catch {}
  };

  return (
    <div className="space-y-4">
      {/* Sticky primary action bar */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-2 sm:px-3 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="font-medium">brandVZN</span>
            {lastEditAt && (
              <span className="text-slate-500">Last edited {new Date(lastEditAt).toLocaleTimeString()}</span>
            )}
            <InlineStatus state={loading ? 'loading' : lastError ? 'error' : 'idle'} message={loading ? (output||'Working…') : lastError || ''} onRetry={loading ? undefined : ()=> runEdit(editPrompt)} />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => runEdit(editPrompt)} disabled={!canRun} aria-label="Run edit">
              {loading ? 'Editing…' : 'Run Edit'}
            </Button>
            <Button variant="outline" onClick={() => runEdit(editPrompt)} disabled={!canRun || !lastEditAt} title={!lastEditAt ? 'Run an edit first' : 'Refine using the same prompt'} aria-label="Refine again">
              Refine again
            </Button>
            {lastError && (
              <Button variant="outline" onClick={revertToLastGood} title="Revert to the last good version" aria-label="Use last good version">Use last good version</Button>
            )}
          </div>
        </div>
      </div>
      <h3 className="text-lg font-semibold">brandVZN</h3>

      <div className="flex flex-col md:flex-row gap-3 items-start pb-16 md:pb-0">
        <div
          className="w-full h-64 md:w-64 md:h-64 border rounded-xl bg-white shadow-sm overflow-hidden flex items-center justify-center relative select-none"
          data-guide="preview"
          onMouseDown={() => setShowBefore(true)}
          onMouseUp={() => setShowBefore(false)}
          onMouseLeave={() => setShowBefore(false)}
          onTouchStart={() => setShowBefore(true)}
          onTouchEnd={() => setShowBefore(false)}
        >
          {preview ? (
            <img src={showBefore && baselinePreview ? baselinePreview : preview} alt="preview" className="object-contain w-full h-full"/>
          ) : (
            <span className="text-slate-500 text-sm">No image</span>
          )}
          {preview && baselinePreview && (
            <div className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white">
              {showBefore ? 'Before' : 'After'}
            </div>
          )}
        </div>
        <div className="flex-1 space-y-3">
        <div className="flex gap-2 items-center">
          <Button variant="outline" onClick={pick} data-guide="upload" aria-label="Upload image">Upload</Button>
          <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.dng,image/*" className="hidden" onChange={onFile} />
          <Button variant="outline" disabled={(!b64 && !srcUrl) || loading} onClick={analyze} data-guide="analyze" aria-label="Analyze photo">{loading ? 'Analyzing…' : 'Analyze Photo'}</Button>
          <Button variant="outline" disabled={(!b64 && !srcUrl) || loading} onClick={()=> runEdit(editPrompt)} data-guide="edit" aria-label="Run edit">{loading ? 'Editing…' : 'Run Edit'}</Button>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Intensity</span>
            <input type="range" min={10} max={100} value={intensity} onChange={e=> setIntensity(parseInt(e.target.value))} aria-label="Refinement intensity" />
            <span>{intensity}</span>
          </div>
          {/* Import IG temporarily removed */}
        </div>

          <textarea className="w-full border rounded-md px-3 py-2" rows={3} value={editPrompt} onChange={e=>setEditPrompt(e.target.value)} />
          <div className="mt-1 flex flex-wrap gap-2 text-xs" aria-label="Starter prompts">
            {starterPrompts.map((sp, i)=>(
              <Button key={i} variant="outline" size="sm" onClick={()=> setEditPrompt(sp)}>{sp}</Button>
            ))}
          </div>
          {recentPrompts.length>0 && (
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              {recentPrompts.map((rp,i)=> (
                <button key={i} className="px-2 py-1 rounded border bg-white hover:bg-slate-50" onClick={()=> setEditPrompt(rp)}>{rp.slice(0,80)}</button>
              ))}
            </div>
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
              <input type="checkbox" checked={preserveDims} onChange={async e=>{ const v=e.target.checked; setPreserveDims(v); await persistPrefs(v, policy); }} aria-label="Preserve original dimensions"/>
              <span className="text-xs text-slate-600">Preserve Original Dimensions</span>
            </label>
            <label className="inline-flex items-center gap-2" title="How to fit the canvas when sizes differ">
              <span className="text-xs text-slate-600">Policy</span>
              <select className="text-xs border rounded-md px-2 py-1 bg-white"
                value={policy}
                onChange={async e=>{ const v=e.target.value as any; setPolicy(v); await persistPrefs(preserveDims, v); }}
                aria-label="Canvas policy">
                <option value="pad">Pad</option>
                <option value="crop">Crop</option>
                <option value="scale-down">Scale‑down</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={saving || !preview} onClick={saveToLibrary}>{saving ? 'Saving…' : 'Save to Library'}</Button>
            <Button variant="outline" disabled={loading} onClick={loadLibrary}>My Images</Button>
          </div>
          {/* Version stack */}
          {versions.length > 0 && (
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
          {/* Dimensions chip */}
          {(origW>0 && currW>0) && (
            <div className="mt-2 inline-flex items-center gap-2">
              <div className={`inline-flex items-center text-xs px-2 py-1 rounded border ${origW===currW && origH===currH ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                <span>{currW}×{currH} {currFmt?.replace('image/','').toUpperCase()}</span>
                <span className="ml-2">{origW===currW && origH===currH ? 'Preserved' : 'Adjusted'}</span>
              </div>
              <div className="inline-flex items-center text-xs px-2 py-1 rounded border bg-white text-slate-700 border-slate-200" title="Canvas fit policy">
                Policy: <span className="ml-1 font-medium">{policy}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border rounded-xl bg-white shadow-sm p-3 min-h-24 whitespace-pre-wrap text-sm">{output}</div>

      {/* Mobile bottom toolbar for primary actions */}
      <div className="fixed md:hidden left-0 right-0 bottom-[calc(var(--bvx-commandbar-height,64px)+env(safe-area-inset-bottom,0px))] z-30">
        <div className="mx-3 mb-2 rounded-xl border bg-white/95 backdrop-blur shadow flex items-center justify-between px-2 py-2">
          <Button variant="outline" onClick={pick} aria-label="Upload image">Upload</Button>
          <Button variant="outline" disabled={(!b64 && !srcUrl) || loading} onClick={analyze} aria-label="Analyze photo">Analyze</Button>
          <Button onClick={()=> runEdit(editPrompt)} disabled={!canRun} aria-label="Run edit">{loading?'Editing…':'Run Edit'}</Button>
        </div>
      </div>

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
