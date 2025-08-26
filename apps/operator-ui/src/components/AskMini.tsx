import { useEffect, useRef, useState } from 'react';
import { api, getTenant } from '../lib/api';

export default function AskMini(){
  const [messages, setMessages] = useState<Array<{role:'user'|'assistant';content:string}>>([
    { role:'assistant', content: 'I\'m here to help you get set up. What brings you to BrandVX today?' }
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement|null>(null);

  useEffect(()=>{ try{ textareaRef.current?.focus(); } catch{} },[]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role:'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try{
      const r = await api.post('/ai/chat', {
        tenant_id: await getTenant(),
        messages: next,
        allow_tools: false,
        session_id: 'onboarding_sales',
        mode: 'sales_onboarding',
      });
      const reply = String(r?.text || '').trim();
      setMessages(curr=> [...curr, { role:'assistant', content: reply || 'Thanks! Let\'s continue.' }]);
      setTurns(t=> t+1);
    } catch(e:any) {
      setMessages(curr=> [...curr, { role:'assistant', content: String(e?.message||e) }]);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const maxed = turns >= 5;

  return (
    <div className="rounded-xl border bg-white/70 p-3">
      <div className="text-sm font-medium text-slate-800">Quick chat</div>
      <div className="mt-2 h-48 overflow-auto rounded-lg border bg-white p-2 text-sm" aria-live="polite">
        {messages.map((m,i)=> (
          <div key={i} className={m.role==='user' ? 'text-right' : 'text-left'}>
            <span className={`inline-block px-2 py-1 rounded-md ${m.role==='user' ? 'bg-sky-50' : 'bg-slate-100'}`}>{m.content}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-start gap-2">
        <textarea ref={textareaRef} className="flex-1 border rounded-md px-2 py-1 text-sm" rows={2} placeholder={maxed? 'Chat complete — thanks!': 'Type and press Enter'} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKeyDown} disabled={busy||maxed} />
        <button className="px-3 py-1.5 rounded-md border bg-white text-sm" onClick={send} disabled={busy||maxed}>Send</button>
      </div>
      {maxed && <div className="mt-1 text-xs text-slate-600">Thanks — that was helpful! You can continue in Ask VX later.</div>}
    </div>
  );
}
