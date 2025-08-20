import { useRef, useState } from 'react';
import { api, getTenant } from '../lib/api';

export default function Vision(){
  const [preview, setPreview] = useState<string>('');
  const [b64, setB64] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('Give concise, actionable feedback on lighting, framing, and clarity for beauty portfolio quality.');
  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement|null>(null);

  const pick = () => inputRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setPreview(dataUrl);
      const idx = dataUrl.indexOf(',');
      setB64(idx >= 0 ? dataUrl.slice(idx+1) : dataUrl);
    };
    reader.readAsDataURL(f);
  };

  const analyze = async () => {
    if (!b64) return;
    setLoading(true);
    setOutput('');
    try{
      const r = await api.post('/ai/vision', { tenant_id: await getTenant(), image_b64: b64, prompt });
      const text = String(r?.text || '');
      // simple streaming-like reveal
      let i = 0; const step = Math.max(2, Math.floor(text.length / 200));
      const timer = window.setInterval(() => {
        i = Math.min(text.length, i + step);
        setOutput(text.slice(0, i));
        if (i >= text.length) window.clearInterval(timer);
      }, 20);
    } catch(e:any){
      setOutput(String(e?.message||e));
    } finally { setLoading(false); }
  };

  const generate = async () => {
    const p = prompt.trim();
    if (!p) return;
    setLoading(true);
    setOutput('');
    try{
      const r = await api.post('/ai/image', { tenant_id: await getTenant(), prompt: p, size: '1024x1024' });
      const b64img = String(r?.b64 || '');
      if (b64img) {
        const dataUrl = 'data:image/png;base64,' + b64img;
        setPreview(dataUrl);
        const idx = dataUrl.indexOf(',');
        setB64(idx >= 0 ? dataUrl.slice(idx+1) : dataUrl);
        setOutput('Image generated.');
      } else {
        setOutput('Image generation failed.');
      }
    } catch(e:any){
      setOutput(String(e?.message||e));
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Vision Analysis</h3>
      <div className="flex gap-3 items-start">
        <div className="w-64 h-64 border rounded-xl bg-white shadow-sm overflow-hidden flex items-center justify-center">
          {preview ? <img src={preview} alt="preview" className="object-cover w-full h-full"/> : <span className="text-slate-500 text-sm">No image</span>}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm" onClick={pick}>Upload Image</button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm disabled:opacity-50" disabled={!b64 || loading} onClick={analyze}>{loading ? 'Analyzing…' : 'Analyze'}</button>
            <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm disabled:opacity-50" disabled={loading} onClick={generate}>{loading ? 'Working…' : 'Generate image'}</button>
          </div>
          <textarea className="w-full border rounded-md px-3 py-2" rows={3} value={prompt} onChange={e=>setPrompt(e.target.value)} />
        </div>
      </div>
      <div className="border rounded-xl bg-white shadow-sm p-3 min-h-24 whitespace-pre-wrap text-sm">{output}</div>
    </div>
  );
}


