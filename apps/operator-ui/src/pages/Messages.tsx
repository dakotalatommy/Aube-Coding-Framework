import { useEffect, useState } from 'react';
import { getPersisted, setPersisted } from '../lib/state';
import { api, getTenant } from '../lib/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Table, THead, TR, TH, TD } from '../components/ui/Table';
import { startGuide } from '../lib/guide';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
// import { Link } from 'react-router-dom';

export default function Messages(){
  const recommendOnly = String((import.meta as any).env?.VITE_BETA_RECOMMEND_ONLY || localStorage.getItem('bvx_recommend_only') || '0') === '1';
  const [items, setItems] = useState<any[]>([]);
  const [filterContact, setFilterContact] = useState('');
  const [status, setStatus] = useState('');
  const [send, setSend] = useState(()=> getPersisted('msg_draft', { contact_id:'', channel:'sms', subject:'', body:'' }));
  const [loading, setLoading] = useState(true);
  const [quiet, setQuiet] = useState<{start?:string;end?:string}>({});
  const [suggestions, setSuggestions] = useState<Array<{id:string;name:string}>>([]);
  const [showSug, setShowSug] = useState(false);
  const [connected, setConnected] = useState<Record<string,string>>({});
  useEffect(()=>{ (async()=>{ try{ const r = await api.post('/onboarding/analyze', { tenant_id: await getTenant() }); if (r?.summary?.connected) setConnected(r.summary.connected); } catch{} })(); },[]);
  const twilioConnected = (connected['twilio']||'') === 'connected';

  // Prefill from querystring for Ask→Messages route
  useEffect(()=>{
    try{
      const sp = new URLSearchParams(window.location.search);
      const body = sp.get('body');
      const cid = sp.get('cid');
      if (body) setSend(s=> ({ ...s, body: decodeURIComponent(body) }));
      if (cid) setSend(s=> ({ ...s, contact_id: decodeURIComponent(cid) }));
    } catch {}
  },[]);

  const presets = [
    { label:'Reminder 24h', body:'Hey {FirstName} — see you tomorrow at {Time}. Need to change it? Tap here. Reply STOP/HELP to opt out.' },
    { label:'Waitlist open', body:'A spot opened for {Service} at {Time}. Want it? Reply YES and we’ll lock it in.' },
    { label:'Lead follow‑up', body:'Hi! I saw you were looking at {Service}. Happy to help you book — Soonest or Anytime?' },
  ];

  const load = async () => {
    const qs = filterContact ? `&contact_id=${encodeURIComponent(filterContact)}` : '';
    const res = await api.get(`/messages/list?tenant_id=${encodeURIComponent(await getTenant())}${qs}`);
    setItems(res.items || []);
  };
  useEffect(()=>{ (async()=>{ try { setLoading(true); await load(); } finally { setLoading(false); } })(); },[]);
  useEffect(()=>{ (async()=>{ try { const r = await api.get(`/settings?tenant_id=${encodeURIComponent(await getTenant())}`); setQuiet(r?.data?.quiet_hours||{}); } catch{} })(); },[]);
  useEffect(()=>{
    try{ const sp = new URLSearchParams(window.location.search); if (sp.get('tour')==='1') startGuide('messages'); } catch {}
  },[]);

  const simulate = async (channel:'sms'|'email') => {
    try {
      const r = await api.post('/messages/simulate', { tenant_id:'t1', contact_id: filterContact || 'c_demo', channel, generate: false });
      setStatus(JSON.stringify(r));
      await load();
    } catch(e:any){
      // retry once on transient network error
      try {
        await new Promise(res=> setTimeout(res, 600));
        const r2 = await api.post('/messages/simulate', { tenant_id:'t1', contact_id: filterContact || 'c_demo', channel, generate: false });
        setStatus(JSON.stringify(r2));
        await load();
      } catch(e2:any){ setStatus(String(e2?.message||e2)); }
    }
  };
  useEffect(()=>{ setPersisted('msg_draft', send); }, [send]);
  useEffect(()=>{
    const t = setTimeout(async () => {
      try {
        const q = (send.contact_id||'').trim();
        if (!q) { setSuggestions([]); return; }
        const r = await api.get(`/contacts/search?tenant_id=${encodeURIComponent(await getTenant())}&q=${encodeURIComponent(q)}&limit=8`);
        setSuggestions(Array.isArray(r?.items)? r.items : []);
      } catch { setSuggestions([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [send.contact_id]);
  const sendMsg = async () => {
    try {
      if (recommendOnly) { setStatus('Beta: recommend-only mode is enabled. Use Copy to send via your channel.'); return; }
      if (send.channel === 'sms' && !twilioConnected) { setStatus('Connect Twilio to send SMS.'); return; }
      const r = await api.post('/messages/send', { tenant_id:'t1', contact_id: send.contact_id, channel: send.channel, subject: send.subject || undefined, body: send.body || undefined });
      setStatus(JSON.stringify(r));
      await load();
    } catch(e:any){ setStatus(String(e?.message||e)); }
  };

  const copyRecipients = async () => {
    try{
      const txt = (send.contact_id||'').trim();
      if (!txt) { setStatus('No recipient selected.'); return; }
      await navigator.clipboard.writeText(txt);
      setStatus('Recipients copied');
    } catch(e:any){ setStatus('Copy failed: '+String(e?.message||e)); }
  };

  const copyMessage = async () => {
    try{
      const body = (send.body||'').trim();
      if (!body) { setStatus('No message body.'); return; }
      await navigator.clipboard.writeText(body);
      setStatus('Message copied');
    } catch(e:any){ setStatus('Copy failed: '+String(e?.message||e)); }
  };

  const saveSuggestion = async () => {
    try{
      const tid = await getTenant();
      const s = await api.get(`/settings?tenant_id=${encodeURIComponent(tid)}`);
      const data = s?.data || {};
      const list = Array.isArray(data.suggested_campaigns) ? data.suggested_campaigns : [];
      const item = { id: 'sc_'+Math.random().toString(36).slice(2,10), created_at: Date.now(), contact_id: send.contact_id, channel: send.channel, subject: send.subject||'', body: send.body||'', status: 'pending', title: 'Suggested Campaign' };
      const next = { ...data, suggested_campaigns: [item, ...list].slice(0, 200) };
      await api.post('/settings', { tenant_id: tid, ...next });
      setStatus('Saved to Approvals (pending)');
    } catch(e:any){ setStatus('Save failed: '+String(e?.message||e)); }
  };

  const markAsSent = async () => {
    try{
      const key = 'bvx_marked_sent';
      const list = JSON.parse(localStorage.getItem(key)||'[]');
      list.push({ ts: Date.now(), contact_id: send.contact_id, channel: send.channel });
      localStorage.setItem(key, JSON.stringify(list));
      setStatus('Marked as sent (local log)');
    } catch { setStatus('Marked as sent'); }
  };

  return (
    <div className="space-y-4">
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      )}
      {!loading && (
        <>
          <div className="flex flex-wrap gap-2 items-center" data-guide="toolbar">
            <Input placeholder="Filter by contact_id" value={filterContact} onChange={e=>setFilterContact(e.target.value)} />
            <Button variant="outline" onClick={load}>Refresh</Button>
            <Button variant="outline" onClick={()=>simulate('sms')}>Simulate SMS</Button>
            <Button variant="outline" onClick={()=>simulate('email')}>Simulate Email</Button>
            <Button variant="outline" className="ml-auto" onClick={()=> startGuide('messages')} aria-label="Open messages guide">Guide me</Button>
          </div>

          <div className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm" data-guide="compose">
            <div className="font-semibold mb-2">Send Message</div>
            {recommendOnly ? (
              <div className="mb-2 text-xs text-sky-800 bg-sky-50 border border-sky-100 rounded-md px-2 py-1 inline-block">Beta: recommend-only mode — preview and copy. BrandVX sending is coming soon.</div>
            ) : (
              <div className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">Some actions may require approval when auto-approve is off. Review in Approvals.</div>
            )}
            {!!quiet?.start && !!quiet?.end && (
              <div className="mb-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 inline-block" data-guide="quiet">Quiet hours: {quiet.start}–{quiet.end}. Sending will be disabled during this window.</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="form" aria-label="Send message form">
              <div className="relative">
                <Input placeholder="contact_id" value={send.contact_id} onFocus={()=>setShowSug(true)} onBlur={()=> setTimeout(()=>setShowSug(false), 120)} onChange={e=>setSend({...send,contact_id:e.target.value})} />
                {showSug && suggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-40 overflow-auto bg-white border rounded-md shadow-sm text-xs w-full">
                    {suggestions.map(s => (
                      <button key={s.id} className="block w-full text-left px-2 py-1 hover:bg-slate-50" onMouseDown={(ev)=>{ ev.preventDefault(); setSend({...send, contact_id: s.id}); setShowSug(false); }}>
                        {s.name || s.id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select className="border rounded-xl px-3 py-2 bg-white/80 backdrop-blur shadow-sm" value={send.channel} onChange={e=>setSend({...send,channel:e.target.value as any})}>
                <option value="sms">sms</option>
                <option value="email">email</option>
              </select>
              <Input placeholder="subject (email)" value={send.subject} onChange={e=>setSend({...send,subject:e.target.value})} />
              <Input placeholder="body" value={send.body} onChange={e=>setSend({...send,body:e.target.value})} />
            </div>
            <div className="mt-2 text-xs text-slate-700 flex flex-wrap items-center gap-2">
              <span className="font-medium">Quiet hours:</span>
              <Button variant="outline" size="sm" onClick={()=> setQuiet({ start:'21:00', end:'08:00' })}>Suggest 21:00–08:00</Button>
              <Button variant="outline" size="sm" onClick={async()=>{ try { await api.post('/settings', { tenant_id: await getTenant(), quiet_hours: quiet }); } catch{} }}>Save</Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs" data-guide="presets">
              {presets.map(p=> (
                <Button key={p.label} variant="outline" size="sm" onClick={()=>setSend(s=>({...s, body: p.body }))}>{p.label}</Button>
              ))}
            </div>
            <div className="mt-2 text-xs text-slate-600" aria-live="polite">Clients can reply STOP/HELP any time; we honor consent automatically.</div>
            {status.includes('rate_limited') && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">Rate limited — please try again shortly.</div>
            )}
            {recommendOnly ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" onClick={copyRecipients}>Copy recipients</Button>
                <Button variant="outline" onClick={copyMessage}>Copy message</Button>
                <Button variant="outline" onClick={saveSuggestion}>Save to Approvals</Button>
                <Button variant="primary" onClick={markAsSent}>Mark as sent</Button>
              </div>
            ) : (
              <Button variant="primary" className="mt-2" onClick={sendMsg} disabled={isWithinQuiet(quiet)} data-guide="send">Send</Button>
            )}
          </div>

          <pre className="whitespace-pre-wrap text-sm text-slate-700" data-guide="status">{status}</pre>
          {items.length === 0 ? (
            <EmptyState title="No messages yet" description="Try Simulate SMS to generate a sample that respects STOP/HELP and consent." />
          ) : (
            <Table data-guide="list">
              <THead>
                <TR><TH>ID</TH><TH>Contact</TH><TH>Channel</TH><TH>Status</TH><TH>Template</TH><TH>TS</TH></TR>
              </THead>
              <tbody className="divide-y">
                {items.map((r:any)=> (
                  <TR key={r.id}>
                    <TD>{r.id}</TD>
                    <TD>{r.contact_id}</TD>
                    <TD>{r.channel}</TD>
                    <TD className={String(r.status).includes('rate')? 'text-amber-700':''}>{r.status}</TD>
                    <TD>{r.template_id||''}</TD>
                    <TD>{r.ts}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
          <div className="flex gap-2 text-xs">
            {isWithinQuiet(quiet) && (
              <span className="px-2 py-1 rounded-md border bg-slate-50 border-slate-200 text-slate-700">Quiet hours active ({quiet.start}–{quiet.end})</span>
            )}
            {status.includes('rate_limited') && (
              <span className="px-2 py-1 rounded-md border bg-amber-50 border-amber-200 text-amber-700">Rate limited recently</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function isWithinQuiet(q?:{start?:string;end?:string}){
  try{
    const now = new Date();
    const toMin = (s:string)=>{ const [h,m] = s.split(':').map(Number); return h*60 + (m||0); };
    const cur = now.getHours()*60 + now.getMinutes();
    const start = q?.start ? toMin(q.start) : NaN;
    const end = q?.end ? toMin(q.end) : NaN;
    if (isNaN(start) || isNaN(end)) return false;
    if (start <= end) return cur >= start && cur < end; // same-day window
    return cur >= start || cur < end; // crosses midnight
  }catch{ return false; }
}

