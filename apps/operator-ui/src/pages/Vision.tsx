import { useRef, useState } from 'react';
import { api, getTenant } from '../lib/api';
import { startGuide } from '../lib/guide';
import { trackEvent } from '../lib/analytics';

export default function Vision(){
  const [tab, setTab] = useState<'analyze'|'edit'|'tryon'>('analyze');
  const [preview, setPreview] = useState<string>('');
  const [b64, setB64] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('Give concise, actionable feedback on lighting, framing, and clarity for beauty portfolio quality.');
  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [mime, setMime] = useState<string>('image/jpeg');
  const [socialUrl, setSocialUrl] = useState<string>('');
  const [social, setSocial] = useState<{profile?:any; posts?:string[]}>({});
  const [linkContactId, setLinkContactId] = useState<string>('');
  const [editPrompt, setEditPrompt] = useState<string>('Reduce specular highlights on T-zone; keep texture; neutralize warm cast.');
  const [tryPrimary, setTryPrimary] = useState<string>('Soft glam: satin skin; neutral-peach blush; soft brown wing; keep freckles.');
  const [tryDay, setTryDay] = useState<string>('No-makeup makeup: sheer base, correct under-eye only, groom brows, clear gloss.');
  const [tryNight, setTryNight] = useState<string>('Evening: deepen crease +10%, warm shimmer center lid, richer lip; preserve texture.');
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

  const fetchSocial = async () => {
    if (!socialUrl.trim()) return;
    setLoading(true); setOutput(''); setSocial({});
    try{
      const prof = await api.post('/ai/tools/execute', { tenant_id: await getTenant(), name: 'social.fetch_profile', params: { tenant_id: await getTenant(), url: socialUrl }, require_approval: false });
      const posts = await api.post('/ai/tools/execute', { tenant_id: await getTenant(), name: 'social.scrape_posts', params: { tenant_id: await getTenant(), url: socialUrl, limit: 12 }, require_approval: false });
      setSocial({ profile: prof?.profile||{}, posts: Array.isArray(posts?.items)? posts.items : [] });
      setOutput('Social fetched.');
    } catch(e:any){ setOutput(String(e?.message||e)); }
    finally { setLoading(false); }
  };

  const saveToClient = async () => {
    if (!preview || !linkContactId.trim()) { setOutput('Select a client and generate/edit an image first.'); return; }
    try{
      setLoading(true);
      const url = preview.startsWith('data:') ? '' : preview;
      const r = await api.post('/client-images/save', { tenant_id: await getTenant(), contact_id: linkContactId.trim(), url: url || preview, kind: 'vision', notes: '' });
      setOutput(r?.status==='ok' ? 'Saved to client.' : String(r?.status||'Save failed'));
      try { trackEvent('vision.save_to_client', { ok: r?.status==='ok' }); } catch {}
    } catch(e:any){ setOutput(String(e?.message||e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">BrandVX</h3>
      <div className="flex gap-2">
        <button className={`px-3 py-1 rounded-md border ${tab==='analyze'?'bg-slate-900 text-white':'bg-white'}`} onClick={()=> setTab('analyze')}>Analyze</button>
        <button className={`px-3 py-1 rounded-md border ${tab==='edit'?'bg-slate-900 text-white':'bg-white'}`} onClick={()=> setTab('edit')}>Edit</button>
        <button className={`px-3 py-1 rounded-md border ${tab==='tryon'?'bg-slate-900 text-white':'bg-white'}`} onClick={()=> setTab('tryon')}>Try‑on</button>
      </div>

      <div className="flex gap-3 items-start">
        <div className="w-64 h-64 border rounded-xl bg-white shadow-sm overflow-hidden flex items-center justify-center" data-guide="preview">
          {preview ? <img src={preview} alt="preview" className="object-contain w-full h-full"/> : <span className="text-slate-500 text-sm">No image</span>}
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex gap-2">
            <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm" onClick={pick} data-guide="upload">Upload</button>
            <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.dng,image/*" className="hidden" onChange={onFile} />
            {tab==='analyze' && (
              <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm disabled:opacity-50" disabled={!b64 || loading} onClick={analyze} data-guide="analyze">{loading ? 'Analyzing…' : 'Analyze'}</button>
            )}
            {tab==='edit' && (
              <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm disabled:opacity-50" disabled={!b64 || loading} onClick={()=> runEdit(editPrompt)} data-guide="edit">{loading ? 'Editing…' : 'Run Step 1'}</button>
            )}
            {tab==='tryon' && (
              <div className="flex gap-2">
                <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm disabled:opacity-50" disabled={!b64 || loading} onClick={()=> runEdit(tryPrimary)} data-guide="edit">{loading ? 'Editing…' : 'Primary'}</button>
                <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm disabled:opacity-50" disabled={!b64 || loading} onClick={()=> runEdit(tryDay)} data-guide="edit">{loading ? 'Editing…' : 'Day‑safe'}</button>
                <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm disabled:opacity-50" disabled={!b64 || loading} onClick={()=> runEdit(tryNight)} data-guide="edit">{loading ? 'Editing…' : 'Evening'}</button>
              </div>
            )}
          </div>

          {tab==='analyze' && (
            <>
              <textarea className="w-full border rounded-md px-3 py-2" rows={3} value={prompt} onChange={e=>setPrompt(e.target.value)} />
              <div className="flex gap-2 items-center" data-guide="social">
                <input className="border rounded-md px-2 py-1 flex-1" placeholder="Instagram profile URL" value={socialUrl} onChange={e=>setSocialUrl(e.target.value)} />
                <button className="border rounded-md px-3 py-1 bg-white hover:shadow-sm" onClick={fetchSocial}>Fetch</button>
              </div>
              {social.profile && (
                <div className="text-xs text-slate-700">{String(social.profile.title||'')} — {String(social.profile.bio||'')}</div>
              )}
              {social.posts && social.posts.length>0 && (
                <div className="grid grid-cols-6 gap-1">
                  {social.posts.slice(0,12).map((u,i)=> (<img key={i} src={u} alt="post" className="w-full h-16 object-cover rounded"/>))}
                </div>
              )}
              <div className="flex gap-2 items-center mt-2" data-guide="save">
                <input className="border rounded-md px-2 py-1 flex-1" placeholder="Link to client_id (optional)" value={linkContactId} onChange={e=>setLinkContactId(e.target.value)} />
                <button className="border rounded-md px-3 py-1 bg-white hover:shadow-sm disabled:opacity-50" disabled={!preview || !linkContactId} onClick={saveToClient}>Save to client</button>
              </div>
            </>
          )}

          {tab==='edit' && (
            <textarea className="w-full border rounded-md px-3 py-2" rows={3} value={editPrompt} onChange={e=>setEditPrompt(e.target.value)} />
          )}

          {tab==='tryon' && (
            <div className="grid gap-2">
              <textarea className="w-full border rounded-md px-3 py-2" rows={2} value={tryPrimary} onChange={e=>setTryPrimary(e.target.value)} />
              <textarea className="w-full border rounded-md px-3 py-2" rows={2} value={tryDay} onChange={e=>setTryDay(e.target.value)} />
              <textarea className="w-full border rounded-md px-3 py-2" rows={2} value={tryNight} onChange={e=>setTryNight(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      <div className="border rounded-xl bg-white shadow-sm p-3 min-h-24 whitespace-pre-wrap text-sm">{output}</div>
    </div>
  );
}


