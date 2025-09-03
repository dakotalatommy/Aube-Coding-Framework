import { useEffect, useState } from 'react';
import { getPersisted, setPersisted } from '../lib/state';
import { api, getTenant } from '../lib/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Table, THead, TR, TH, TD } from '../components/ui/Table';
import { startGuide } from '../lib/guide';
import Skeleton from '../components/ui/Skeleton';
// import EmptyState from '../components/ui/EmptyState';
import Pager from '../components/ui/Pager';
import { useToast } from '../components/ui/Toast';
import { UI_STRINGS } from '../lib/strings';
// import { Link } from 'react-router-dom';

export default function Messages(){
  const { showToast } = useToast();
  const recommendOnly = String((import.meta as any).env?.VITE_BETA_RECOMMEND_ONLY || localStorage.getItem('bvx_recommend_only') || '0') === '1';
  // const isDemo = (()=>{ try{ return new URLSearchParams(window.location.search).get('demo')==='1'; } catch { return false; } })();
  // Add beta disclosure step to Guide me list
  const [items, setItems] = useState<any[]>([]);
  const [filterContact] = useState('');
  const [status, setStatus] = useState('');
  const [send, setSend] = useState(()=> getPersisted('msg_draft', { contact_id:'', channel:'sms', subject:'', body:'' }));
  const [loading, setLoading] = useState(true);
  const [quiet, setQuiet] = useState<{start?:string;end?:string}>({});
  const [limits, setLimits] = useState<Record<string, any>>({});
  const [suggestions, setSuggestions] = useState<Array<{id:string;name:string}>>([]);
  const [showSug, setShowSug] = useState(false);
  const [connected, setConnected] = useState<Record<string,string>>({});
  const [lastAnalyzed, setLastAnalyzed] = useState<number|undefined>(undefined);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  useEffect(()=>{ (async()=>{ try{ const r = await api.post('/onboarding/analyze', { tenant_id: await getTenant() }); if (r?.summary?.connected) setConnected(r.summary.connected); } catch{} })(); },[]);
  const twilioConnected = (connected['twilio']||'') === 'connected';

  const format12h = (hhmm?: string) => {
    try{
      if (!hhmm) return '';
      const [h,m] = hhmm.split(':').map(Number);
      const am = h < 12;
      const hr = ((h % 12) || 12);
      return `${hr}:${String(m||0).padStart(2,'0')} ${am?'AM':'PM'}`;
    }catch{ return String(hhmm||''); }
  };

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
    { label:'Lead follow‑up', body:"Hi! I saw you were looking at {Service}. I'd be happy to answer any questions or get you scheduled!" },
  ];

  const draftForMe = () => {
    const examples = presets.map(p=>p.body);
    const pick = examples[Math.floor(Math.random()*examples.length)] || examples[0];
    setSend(s=> ({ ...s, body: pick }));
    setStatus('Draft prepared');
  };

  const load = async () => {
    const qs = filterContact ? `&contact_id=${encodeURIComponent(filterContact)}` : '';
    const res = await api.get(`/messages/list?tenant_id=${encodeURIComponent(await getTenant())}${qs}`);
    setItems(res.items || []);
  };
  useEffect(()=>{ (async()=>{ try { setLoading(true); await load(); } finally { setLoading(false); } })(); },[]);
  useEffect(()=>{ (async()=>{ try { const r = await api.get(`/settings?tenant_id=${encodeURIComponent(await getTenant())}`); setQuiet(r?.data?.quiet_hours||{}); } catch{} })(); },[]);
  useEffect(()=>{ (async()=>{ try { const r = await api.get(`/limits/status?tenant_id=${encodeURIComponent(await getTenant())}&keys=msg:sms,msg:email`); setLimits(r?.items||{}); } catch{} })(); },[]);
  useEffect(()=>{
    try{ const sp = new URLSearchParams(window.location.search); if (sp.get('tour')==='1') startGuide('messages'); } catch {}
  },[]);
  useEffect(()=>{ (async()=>{ try{ const a = await api.post('/onboarding/analyze', { tenant_id: await getTenant() }); if (a?.summary?.ts) setLastAnalyzed(Number(a.summary.ts)); } catch{} })(); },[]);

  // simulate kept for dev; currently unused after UI simplification
  // simulate removed entirely in simplified UI
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
      const r = await api.post('/messages/send', { tenant_id: await getTenant(), contact_id: send.contact_id, channel: send.channel, subject: send.subject || undefined, body: send.body || undefined });
      const dev = new URLSearchParams(window.location.search).has('dev');
      setStatus(dev ? JSON.stringify(r) : '');
      if (String(r?.status||'').includes('rate_limited')) {
        showToast({ title: 'Rate limited', description: 'Try again shortly.' });
      }
      await load();
      try { showToast({ title: 'Message sent', description: send.channel.toUpperCase() }); } catch {}
    } catch(e:any){ setStatus(String(e?.message||e)); }
  };

  const copyRecipients = async () => {
    try{
      const txt = (send.contact_id||'').trim();
      if (!txt) { setStatus('No recipient selected.'); return; }
      await navigator.clipboard.writeText(txt);
      setStatus('Recipients copied');
      try { showToast({ title: 'Copied', description: 'Recipients' }); } catch {}
    } catch(e:any){ setStatus('Copy failed: '+String(e?.message||e)); }
  };

  const copyMessage = async () => {
    try{
      const body = (send.body||'').trim();
      if (!body) { setStatus('No message body.'); return; }
      await navigator.clipboard.writeText(body);
      setStatus('Message copied');
      try { showToast({ title: 'Copied', description: 'Message' }); } catch {}
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
      setStatus('Saved to To‑Do (pending)');
      try { showToast({ title: 'Saved to To‑Do' }); } catch {}
    } catch(e:any){ setStatus('Save failed: '+String(e?.message||e)); }
  };

  const markAsSent = async () => {
    try{
      const key = 'bvx_marked_sent';
      const list = JSON.parse(localStorage.getItem(key)||'[]');
      list.push({ ts: Date.now(), contact_id: send.contact_id, channel: send.channel });
      localStorage.setItem(key, JSON.stringify(list));
      setStatus('Marked as sent (local log)');
      try { showToast({ title: 'Marked as sent' }); } catch {}
    } catch { setStatus('Marked as sent'); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center px-1 py-1">
        <h3 className="text-lg font-semibold">Messages</h3>
        <Button variant="outline" className="ml-auto" onClick={()=> startGuide('messages')} aria-label={UI_STRINGS.a11y.buttons.guideMessages}>{UI_STRINGS.ctas.tertiary.guideMe}</Button>
      </div>
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      )}
      {!loading && (
        <>
          {/* Toolbar removed for simplicity; history has its own refresh */}
          {lastAnalyzed && (
            <div className="text-[11px] text-slate-500">Last analyzed: {new Date(lastAnalyzed*1000).toLocaleString()}</div>
          )}

          <div className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm" data-guide="compose">
            <div className="font-semibold mb-2">Compose</div>
            <div className="mb-2 text-xs">
              <Button variant="outline" size="sm" onClick={draftForMe}>{UI_STRINGS.ctas.secondary.draftForMe}</Button>
            </div>
            {recommendOnly ? (
              <div className="mb-2 text-xs text-sky-800 bg-sky-50 border border-sky-100 rounded-md px-2 py-1 inline-block">Beta: recommend-only mode — preview and copy. BrandVX sending is coming soon.</div>
            ) : (
              <div className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">Some actions may require review when auto-approve is off. Check your To‑Do.</div>
            )}
            {!!quiet?.start && !!quiet?.end && (
              <div className="mb-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 inline-block" data-guide="quiet">Quiet hours: {format12h(quiet.start)}–{format12h(quiet.end)}. Sending will be disabled during this window.</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="form" aria-label="Send message form">
              <div className="relative">
                {/* Recipient chip */}
                {Boolean((send.contact_id||'').trim()) && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-white text-xs">
                      <span className="truncate max-w-[14rem]">{(() => { try{
                        const found = suggestions.find(s=> s.id===send.contact_id);
                        return found?.name || send.contact_id;
                      }catch{ return send.contact_id; } })()}</span>
                      <button className="text-slate-500 hover:text-slate-700" onClick={()=> setSend(s=> ({ ...s, contact_id:'' }))} aria-label="Remove recipient">×</button>
                    </span>
                  </div>
                )}
                <Input placeholder="Search client" value={send.contact_id} onFocus={()=>setShowSug(true)} onBlur={()=> setTimeout(()=>setShowSug(false), 120)} onChange={e=>setSend({...send,contact_id:e.target.value})} />
                {showSug && suggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-40 overflow-auto bg-white border rounded-md shadow-sm text-xs w-full">
                    {suggestions.map(s => (
                      <button key={s.id} className="block w-full text-left px-2 py-1 hover:bg-slate-50" onMouseDown={(ev)=>{ ev.preventDefault(); setSend({...send, contact_id: s.id}); setShowSug(false); }}>
                        {s.name || 'Client'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select className="border rounded-xl px-3 py-2 bg-white/80 backdrop-blur shadow-sm" value={send.channel} onChange={e=>setSend({...send,channel:e.target.value as any})}>
                <option value="sms">sms</option>
                <option value="email">email</option>
              </select>
              {send.channel==='email' && (
                <Input placeholder="Subject" value={send.subject} onChange={e=>setSend({...send,subject:e.target.value})} />
              )}
              <Input placeholder="Message" value={send.body} onChange={e=>setSend({...send,body:e.target.value})} />
            </div>
            <div className="mt-2 text-xs text-slate-700 flex flex-wrap items-center gap-2">
              <span className="font-medium">Quiet hours:</span>
              <Button variant="outline" size="sm" onClick={()=> setQuiet({ start:'21:00', end:'08:00' })}>Suggest 9:00 PM–8:00 AM</Button>
              <Button variant="outline" size="sm" onClick={async()=>{ try { await api.post('/settings', { tenant_id: await getTenant(), quiet_hours: quiet }); } catch{} }} aria-label={UI_STRINGS.a11y.buttons.saveQuietHours}>{UI_STRINGS.ctas.secondary.save}</Button>
            </div>
            <div className="mt-2 text-[11px] font-medium text-slate-700">Client Messaging Templates</div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs" data-guide="presets">
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
                <Button variant="outline" onClick={copyRecipients}>{UI_STRINGS.ctas.secondary.copyRecipients}</Button>
                <Button variant="outline" onClick={copyMessage}>{UI_STRINGS.ctas.secondary.copyMessage}</Button>
                <Button variant="outline" onClick={saveSuggestion}>Save to To‑Do</Button>
                <Button variant="primary" onClick={markAsSent}>{UI_STRINGS.ctas.secondary.markAsSent}</Button>
              </div>
            ) : (
              <Button variant="primary" className="mt-2" onClick={sendMsg} disabled={isWithinQuiet(quiet)} data-guide="send" aria-label={UI_STRINGS.a11y.buttons.sendMessage}>{UI_STRINGS.ctas.primary.send}</Button>
            )}
          </div>

          <pre className="whitespace-pre-wrap text-sm text-slate-700" data-guide="status" aria-live="polite">{status}</pre>
          {items.length === 0 ? null : (
            <Table data-guide="list">
              <THead>
                <TR><TH>ID</TH><TH>Contact</TH><TH>Channel</TH><TH>Status</TH><TH>Template</TH><TH>Time</TH></TR>
              </THead>
              <tbody className="divide-y">
                {items.slice((page-1)*pageSize, page*pageSize).map((r:any)=> (
                  <TR key={r.id}>
                    <TD>{r.id}</TD>
                    <TD><span className="truncate inline-block max-w-[10rem]" title={r.contact_id}>{r.contact_id}</span></TD>
                    <TD>{r.channel}</TD>
                    <TD className={String(r.status).includes('rate')? 'text-amber-700':''}><span className="truncate inline-block max-w-[10rem]" title={r.status}>{r.status}</span></TD>
                    <TD><span className="truncate inline-block max-w-[12rem]" title={r.template_id||''}>{r.template_id||''}</span></TD>
                    <TD><span className="truncate inline-block max-w-[12rem]" title={String(r.ts||'')}>{r.ts}</span></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
          {items.length>0 && (
            <Pager page={page} pageSize={pageSize} total={items.length} onPrev={()=> setPage(p=> Math.max(1, p-1))} onNext={()=> setPage(p=> (p*pageSize<items.length? p+1: p))} />
          )}
          {/* Bottom counters: SMS/Email usage */}
          <div className="flex gap-2 text-xs">
            {limits && (limits['msg:sms'] || limits['msg:email']) && (
              <span className="px-2 py-1 rounded-md border bg-white text-slate-700">
                {(() => { try{
                  const s = limits['msg:sms']||{}; const e = limits['msg:email']||{};
                  const fmt = (x:any)=> `${x.count||0}/${(x.limit||0)+(x.burst||0)}`;
                  return `SMS ${fmt(s)} · Email ${fmt(e)}`;
                }catch{return 'SMS 0/0 · Email 0/0' } })()}
              </span>
            )}
          </div>
          {/* badges row moved to top */}
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

