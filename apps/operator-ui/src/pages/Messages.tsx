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
  const [items, setItems] = useState<any[]>([]);
  const [filterContact] = useState('');
  const [status, setStatus] = useState('');
  const [send, setSend] = useState(()=> getPersisted('msg_draft', { contact_id:'', channel:'sms', subject:'', body:'' }));
  const [loading, setLoading] = useState(true);
  const [quiet, setQuiet] = useState<{start?:string;end?:string}>({});
  const [lastAnalyzed, setLastAnalyzed] = useState<number|undefined>(undefined);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  // Recipient search: preload clients and filter locally
  const [allClients, setAllClients] = useState<Array<{ id:string; name:string }>>([]);
  const [recipientQuery, setRecipientQuery] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<{ id:string; name:string }|null>(null);
  const [suggestions, setSuggestions] = useState<Array<{id:string;name:string}>>([]);
  const [showSug, setShowSug] = useState(false);

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

  // legacy local draft maker kept for reference (unused after smart draft)

  const load = async () => {
    const qs = filterContact ? `&contact_id=${encodeURIComponent(filterContact)}` : '';
    const res = await api.get(`/messages/list?tenant_id=${encodeURIComponent(await getTenant())}${qs}`);
    setItems(res.items || []);
  };
  useEffect(()=>{ (async()=>{ try { setLoading(true); await load(); } finally { setLoading(false); } })(); },[]);
  useEffect(()=>{ (async()=>{ try { const r = await api.get(`/settings?tenant_id=${encodeURIComponent(await getTenant())}`); setQuiet(r?.data?.quiet_hours||{}); } catch{} })(); },[]);
  // Preload clients for local typeahead (first 500)
  useEffect(()=>{ (async()=>{
    try{
      const r = await api.get(`/contacts/list?tenant_id=${encodeURIComponent(await getTenant())}&limit=500&offset=0`);
      const arr = Array.isArray(r?.items) ? r.items : [];
      const mapped = arr.map((c:any)=> ({ id: String(c.contact_id), name: String(c.friendly_name||c.display_name||`${c.first_name||''} ${c.last_name||''}`||'Client').trim() || 'Client' }));
      setAllClients(mapped);
    } catch {}
  })(); },[]);
  useEffect(()=>{
    try{ const sp = new URLSearchParams(window.location.search); if (sp.get('tour')==='1') startGuide('messages'); } catch {}
  },[]);
  useEffect(()=>{ (async()=>{ try{ const a = await api.post('/onboarding/analyze', { tenant_id: await getTenant() }); if (a?.summary?.ts) setLastAnalyzed(Number(a.summary.ts)); } catch{} })(); },[]);

  // simulate kept for dev; currently unused after UI simplification
  // simulate removed entirely in simplified UI
  useEffect(()=>{ setPersisted('msg_draft', send); }, [send]);
  useEffect(()=>{
    const t = setTimeout(() => {
      try{
        const q = recipientQuery.trim().toLowerCase();
        if (!q) { setSuggestions([]); return; }
        const matches = allClients.filter(c=> c.name.toLowerCase().includes(q)).slice(0, 8);
        setSuggestions(matches);
      } catch { setSuggestions([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [recipientQuery, allClients]);
  const draftSmart = async () => {
    try{
      if (!selectedRecipient?.id) { setStatus('Pick a client first.'); showToast({ title:'Choose a client', description:'Search and select a client to draft for.' }); return; }
      const r = await api.post('/ai/tools/execute', {
        tenant_id: await getTenant(),
        name: 'draft_message',
        params: { tenant_id: await getTenant(), contact_id: selectedRecipient.id, channel: 'sms' },
        require_approval: false,
      });
      const body = String(r?.draft || r?.text || r?.message || '').trim();
      if (body) {
        setSend(s=> ({ ...s, body, contact_id: selectedRecipient.id, channel: 'sms' }));
        setStatus('Draft generated');
      } else {
        setStatus('No draft returned');
      }
    } catch(e:any){ setStatus(String(e?.message||e)); }
  };

  // copyRecipients removed in simplified draft-only mode

  // copyMessage removed in simplified draft-only mode

  // saveSuggestion removed in simplified draft-only mode

  // markAsSent removed in simplified draft-only mode

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
              <Button variant="outline" size="sm" onClick={draftSmart}>Draft for me</Button>
            </div>
            <div className="mb-2 text-xs text-sky-800 bg-sky-50 border border-sky-100 rounded-md px-2 py-1 inline-block">Draft‑only for now — sending will enable after setup.</div>
            {!!quiet?.start && !!quiet?.end && (
              <div className="mb-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 inline-block" data-guide="quiet">Quiet hours: {format12h(quiet.start)}–{format12h(quiet.end)}. Sending will be disabled during this window.</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="form" aria-label="Send message form">
              <div className="relative">
                {/* Recipient chip */}
                {selectedRecipient && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-white text-xs">
                      <span className="truncate max-w-[14rem]">{selectedRecipient.name}</span>
                      <button className="text-slate-500 hover:text-slate-700" onClick={()=> { setSelectedRecipient(null); setRecipientQuery(''); setSend(s=> ({ ...s, contact_id:'' })); }} aria-label="Remove recipient">×</button>
                    </span>
                  </div>
                )}
                <Input placeholder="Search client" value={selectedRecipient ? '' : recipientQuery} onFocus={()=>setShowSug(true)} onBlur={()=> setTimeout(()=>setShowSug(false), 120)} onChange={e=>{ setRecipientQuery(e.target.value); setSelectedRecipient(null); }} />
                {showSug && suggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-40 overflow-auto bg-white border rounded-md shadow-sm text-xs w-full">
                    {suggestions.map(s => (
                      <button key={s.id} className="block w-full text-left px-2 py-1 hover:bg-slate-50" onMouseDown={(ev)=>{ ev.preventDefault(); setSelectedRecipient(s); setSend({...send, contact_id: s.id, channel:'sms' }); setShowSug(false); }}>
                        {s.name || 'Client'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-600">Channel: SMS</div>
              <div className="sm:col-span-2">
                <textarea className="w-full min-h-[120px] border rounded-md px-3 py-2" placeholder="Type your message or tap Draft for me" value={send.body} onChange={e=>setSend({...send, body: e.target.value})} />
              </div>
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
            {status.includes('rate_limited') && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">Rate limited — please try again shortly.</div>
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
          {/* badges row moved to top; counters removed */}
        </>
      )}
    </div>
  );
}


