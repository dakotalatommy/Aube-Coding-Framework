import { useRef, useState } from 'react';
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
  const [saving, setSaving] = useState(false);
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
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setPreview(dataUrl);
      setSrcUrl('');
      const idx = dataUrl.indexOf(',');
      setB64(idx >= 0 ? dataUrl.slice(idx+1) : dataUrl);
      try{ const m = dataUrl.slice(5, dataUrl.indexOf(';')); if (m) setMime(m); }catch{}
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
    setOutput('');
    try{
      const r = await api.post('/ai/tools/execute', {
        tenant_id: await getTenant(),
        name: 'vision.inspect',
        params: { tenant_id: await getTenant(), ...(b64?{ inputImageBase64: b64, inputMime: mime }:{ imageUrl: srcUrl }), return: ['faces','lighting','colors','qualityFlags','safeSearch'] },
        require_approval: false,
      });
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
      setOutput(String(e?.message||e));
    } finally { setLoading(false); }
  };

  const runEdit = async (p: string) => {
    if (!b64 && !srcUrl) { setOutput('Upload or import an image first.'); return; }
    setLoading(true);
    setOutput('');
    try{
      const r = await api.post('/ai/tools/execute', {
        tenant_id: await getTenant(),
        name: 'image.edit',
        params: { tenant_id: await getTenant(), mode: 'edit', prompt: `${p}${notes?`\nAdditional notes: ${notes}`:''}`, ...(b64?{ inputImageBase64: b64, inputMime: mime }:{ imageUrl: srcUrl }), outputFormat: 'png', preserveDims },
        require_approval: false,
      });
      if (r?.data_url || r?.preview_url) {
        const next = String(r?.data_url || r?.preview_url || '');
        if (next) {
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
            }
          } catch {}
        }
        setOutput('Edit complete.');
        try { trackEvent('ask.smart_action.run', { tool: 'image.edit' }); } catch {}
      } else {
        setOutput(String(r?.detail||r?.status||'Edit failed'));
      }
    } catch(e:any){ setOutput(String(e?.message||e)); }
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
      const cid = (contactId || 'library').trim();
      await api.post('/client-images/save', { tenant_id: tid, contact_id: cid, url: preview, notes });
      setOutput('Saved to library.');
    } catch(e:any){ setOutput(String(e?.message||e)); }
    finally { setSaving(false); }
  };

  const loadLibrary = async () => {
    try{
      setLoading(true);
      const tid = await getTenant();
      const cid = (contactId || 'library').trim();
      const r = await api.get(`/client-images/list?tenant_id=${encodeURIComponent(tid)}&contact_id=${encodeURIComponent(cid)}`);
      const items = (r?.items || []).map((it:any)=> String(it?.url||'')).filter(Boolean);
      setIgItems(items);
      if (items.length) {
        setPreview(items[0]); setSrcUrl(items[0]); setB64('');
        setOutput('Loaded from library.');
      } else {
        setOutput('No saved images found for this contact.');
      }
    } catch(e:any){ setOutput(String(e?.message||e)); }
    finally { setLoading(false); }
  };

  // saveToClient handled elsewhere

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">brandVZN</h3>

      <div className="flex gap-3 items-start">
        <div className="w-64 h-64 border rounded-xl bg-white shadow-sm overflow-hidden flex items-center justify-center" data-guide="preview">
          {preview ? <img src={preview} alt="preview" className="object-contain w-full h-full"/> : <span className="text-slate-500 text-sm">No image</span>}
        </div>
        <div className="flex-1 space-y-3">
        <div className="flex gap-2">
          <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm" onClick={pick} data-guide="upload">Upload</button>
          <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.dng,image/*" className="hidden" onChange={onFile} />
          <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm disabled:opacity-50" disabled={(!b64 && !srcUrl) || loading} onClick={analyze} data-guide="analyze">{loading ? 'Analyzing…' : 'Analyze Photo'}</button>
          <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm disabled:opacity-50" disabled={(!b64 && !srcUrl) || loading} onClick={()=> runEdit(editPrompt)} data-guide="edit">{loading ? 'Editing…' : 'Run Edit'}</button>
          <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm disabled:opacity-50" disabled={loading} onClick={importInstagram}>Import IG</button>
        </div>

          <textarea className="w-full border rounded-md px-3 py-2" rows={3} value={editPrompt} onChange={e=>setEditPrompt(e.target.value)} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <label className="grid gap-1">
              <span className="text-xs text-slate-600">Contact ID (or "library")</span>
              <input className="border rounded-md px-3 py-2" value={contactId} onChange={e=>setContactId(e.target.value)} placeholder="client_123 or library" />
            </label>
            <label className="md:col-span-2 grid gap-1">
              <span className="text-xs text-slate-600">Notes (optional)</span>
              <input className="border rounded-md px-3 py-2" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Lighting edit, version A…" />
            </label>
          </div>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={preserveDims} onChange={e=>setPreserveDims(e.target.checked)} />
            <span className="text-xs text-slate-600">Preserve Original Dimensions</span>
          </label>
          <div className="flex gap-2">
            <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm disabled:opacity-50" disabled={saving || !preview} onClick={saveToLibrary}>{saving ? 'Saving…' : 'Save to Library'}</button>
            <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm disabled:opacity-50" disabled={loading} onClick={loadLibrary}>My Images</button>
          </div>
        </div>
      </div>

      <div className="border rounded-xl bg-white shadow-sm p-3 min-h-24 whitespace-pre-wrap text-sm">{output}</div>

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
