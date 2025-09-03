import { useRef, useState } from 'react';
import { api, getTenant } from '../lib/api';
import { startGuide } from '../lib/guide';
import { trackEvent } from '../lib/analytics';

export default function Vision(){
  // Single-flow UI: Upload & Edit only (Instagram hidden)
  const [preview, setPreview] = useState<string>('');
  const [b64, setB64] = useState<string>('');
  // const [prompt] = useState<string>('Give concise, actionable feedback on lighting, framing, and clarity for beauty portfolio quality.');
  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [mime, setMime] = useState<string>('image/jpeg');
  // const [linkContactId] = useState<string>('');
  const [editPrompt, setEditPrompt] = useState<string>('Reduce specular highlights on T-zone; keep texture; neutralize warm cast.');
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
    if (!b64) return;
    setLoading(true);
    setOutput('');
    try{
      const r = await api.post('/ai/tools/execute', {
        tenant_id: await getTenant(),
        name: 'vision.inspect',
        params: { tenant_id: await getTenant(), inputImageBase64: b64, inputMime: mime, return: ['faces','lighting','colors','qualityFlags','safeSearch'] },
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
    if (!b64) { setOutput('Upload an image first.'); return; }
    setLoading(true);
    setOutput('');
    try{
      const r = await api.post('/ai/tools/execute', {
        tenant_id: await getTenant(),
        name: 'image.edit',
        params: { tenant_id: await getTenant(), mode: 'edit', prompt: p, inputImageBase64: b64, inputMime: mime, outputFormat: 'png' },
        require_approval: false,
      });
      if (r?.preview_url) {
        setPreview(r.preview_url);
        setOutput('Edit complete.');
        try { trackEvent('ask.smart_action.run', { tool: 'image.edit' }); } catch {}
      } else {
        setOutput(String(r?.detail||r?.status||'Edit failed'));
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
            <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm disabled:opacity-50" disabled={!b64 || loading} onClick={analyze} data-guide="analyze">{loading ? 'Analyzing…' : 'Analyze'}</button>
            <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm disabled:opacity-50" disabled={!b64 || loading} onClick={()=> runEdit(editPrompt)} data-guide="edit">{loading ? 'Editing…' : 'Run Edit'}</button>
          </div>

          <textarea className="w-full border rounded-md px-3 py-2" rows={3} value={editPrompt} onChange={e=>setEditPrompt(e.target.value)} />
        </div>
      </div>

      <div className="border rounded-xl bg-white shadow-sm p-3 min-h-24 whitespace-pre-wrap text-sm">{output}</div>
    </div>
  );
}


