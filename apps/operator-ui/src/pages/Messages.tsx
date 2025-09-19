import { useEffect, useState } from 'react';
import { getPersisted, setPersisted } from '../lib/state';
import { api, getTenant } from '../lib/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Table, THead, TR, TH, TD } from '../components/ui/Table';
import { startGuide } from '../lib/guide';
import Skeleton from '../components/ui/Skeleton';
import InlineStatus from '../components/ui/InlineStatus';
// import EmptyState from '../components/ui/EmptyState';
import Pager from '../components/ui/Pager';
import { useToast } from '../components/ui/Toast';
import { UI_STRINGS } from '../lib/strings';
import { trackEvent } from '../lib/analytics';
import * as Sentry from '@sentry/react';
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
  const [selectedRecipients, setSelectedRecipients] = useState<Array<{ id:string; name:string }>>([]);
  const [suggestions, setSuggestions] = useState<Array<{id:string;name:string}>>([]);
  const [showSug, setShowSug] = useState(false);
  const [inboxFilter/* , setInboxFilter */] = useState<'all'|'unread'|'needs_reply'|'scheduled'|'failed'>(()=>{
    try{ return (localStorage.getItem('bvx_messages_filter') as any) || 'all'; }catch{ return 'all'; }
  });
  const [showSlash, setShowSlash] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [bucket, setBucket] = useState<string>('lead_followup');
  const [mdUrl, setMdUrl] = useState<string>('');
  const [followupsInfo, setFollowupsInfo] = useState<{ bucket:string; ids:string[]; ts:number }|null>(null);

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
    const qs = [
      filterContact ? `contact_id=${encodeURIComponent(filterContact)}` : '',
      inboxFilter ? `filter=${encodeURIComponent(inboxFilter)}` : '',
    ].filter(Boolean).join('&');
    const res = await api.get(`/messages/list?tenant_id=${encodeURIComponent(await getTenant())}${qs ? '&'+qs : ''}`);
    setItems(res.items || []);
  };
  useEffect(()=>{ (async()=>{ try { setLoading(true); await load(); setPage(1); } finally { setLoading(false); } })(); }, [inboxFilter]);
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
  useEffect(()=>{ try{ localStorage.setItem('bvx_messages_filter', inboxFilter); }catch{} }, [inboxFilter]);
  useEffect(()=>{ try{ localStorage.setItem('bvx_messages_recipient', JSON.stringify(selectedRecipient||null)); }catch{} }, [selectedRecipient]);
  useEffect(()=>{ return ()=> { try{ if (mdUrl) URL.revokeObjectURL(mdUrl); }catch{} }; }, [mdUrl]);

  // Detect follow-ups handoff
  useEffect(()=>{
    try{
      const raw = sessionStorage.getItem('bvx_followups_bundle');
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && Array.isArray(obj.ids)) {
          setFollowupsInfo({ bucket: String(obj.bucket||'lead_followup'), ids: obj.ids.map(String), ts: Number(obj.ts||Date.now()) });
          // Prefill SMS body based on bucket
          const baseMap: Record<string,string> = {
            reminder_24h: 'Hey {FirstName} — see you tomorrow. Need to change it? Tap here.',
            waitlist_open: 'A spot opened for {Service} at {Time}. Want it? Reply YES and I’ll lock it in.',
            lead_followup: 'Hi! I saw you were looking at {Service}. I’d be happy to help or get you scheduled!',
            reengage_30d: 'Hey {FirstName}! It’s been about a month — want me to hold a spot this week?',
            winback_45d: 'Hi {FirstName}! I’ve got a couple of times open — want to refresh your look?',
            no_show_followup: 'We missed you! Want to pick a new time? I can share options.',
            first_time_nurture: 'Welcome! I’d love to see you again — want me to send a few dates?'
          };
          setBucket(String(obj.bucket||'lead_followup'));
          const body = baseMap[String(obj.bucket||'lead_followup')] || baseMap.lead_followup;
          setSend(s=> ({ ...s, channel:'sms', body }));
        }
        // Clear after reading to avoid duplication on back/forward
        sessionStorage.removeItem('bvx_followups_bundle');
      }
    } catch {}
  },[]);

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
      const group = selectedRecipients.length > 0 ? selectedRecipients : (selectedRecipient ? [selectedRecipient] : []);
      if (group.length === 0) { setStatus('Pick at least one client.'); showToast({ title:'Choose clients', description:'Search and select one or more clients to draft for.' }); return; }
      const span = Sentry.startInactiveSpan?.({ name: 'messages.draft' });
      const t0 = performance.now();
      try{ trackEvent('messages.draft', { count: group.length, bucket, bulk: true }); } catch{}
      // Ask GPT-5 for a combined Markdown document
      const tenant = await getTenant();
      const names = group.map(g=> g.name).join(', ');
      const prompt = [
        'Create a concise, friendly set of SMS drafts for beauty clients. Use beauty-friendly language and avoid jargon.',
        `Bucket: ${bucket}`,
        `Clients: ${names}`,
        'Output as a Markdown document with one section per client:',
        '- Heading as the client name',
        '- 1–2 sentence SMS draft personalized for the client',
        '- No code fences, no variables like {FirstName} — use the given name directly',
      ].join('\n');
      const r = await api.post('/ai/chat/raw', { tenant_id: tenant, messages: [{ role:'user', content: prompt }], mode: 'messages' }, { timeoutMs: 60000 });
      try {
        const ms = Math.round(performance.now() - t0);
        trackEvent('messages.draft', { ms, count: group.length });
        span?.end?.();
      } catch {}
      const text = String(r?.text || '').trim();
      if (!text) { setStatus('No draft returned'); return; }
      // Copy to clipboard
      try{ await navigator.clipboard.writeText(text); showToast({ title:'Copied', description:'Markdown copied to clipboard' }); }catch{}
      // Create download URL
      try{ if (mdUrl) URL.revokeObjectURL(mdUrl); }catch{}
      try{
        const blob = new Blob([text], { type:'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob); setMdUrl(url);
      }catch{}
      setStatus('Bulk draft ready');
    } catch(e:any){ setStatus(String(e?.message||e)); }
  };

  const matchesFilter = (r:any): boolean => {
    const st = String(r?.status||'').toLowerCase();
    switch (inboxFilter) {
      case 'unread':
        return st.includes('unread') || st.includes('new') || st.includes('received');
      case 'needs_reply':
        return st.includes('await') || st.includes('no_reply') || st.includes('pending') || st.includes('needs');
      case 'scheduled':
        return st.includes('scheduled') || st.includes('queued') || st.includes('delayed');
      case 'failed':
        return st.includes('fail') || st.includes('error') || st.includes('bounce');
      default:
        return true;
    }
  };
  const itemsFiltered = (items||[]).filter(matchesFilter);
  const slashOptions = presets.filter(p=> (p.label+p.body).toLowerCase().includes(slashQuery.toLowerCase()));

  // copyRecipients removed in simplified draft-only mode

  // copyMessage removed in simplified draft-only mode

  // saveSuggestion removed in simplified draft-only mode

  // markAsSent removed in simplified draft-only mode

  return (
    <>
    <div className="space-y-4">
      {/* Sticky primary action bar */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-2 sm:px-3 py-2 flex items-center gap-3">
          <h3 className="text-sm font-semibold">Messages</h3>
          <div className="ml-auto flex items-center gap-2">
            <InlineStatus state={loading ? 'loading':'idle'} message={loading ? 'Loading messages…' : ''} />
            <Button variant="outline" onClick={()=> startGuide('messages')} aria-label={UI_STRINGS.a11y.buttons.guideMessages}>{UI_STRINGS.ctas.tertiary.guideMe}</Button>
          </div>
        </div>
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
          {followupsInfo && (
            <div className="rounded-md border bg-sky-50 text-sky-900 border-sky-200 text-xs px-2 py-1 inline-block">Follow-ups loaded ({followupsInfo.ids.length})</div>
          )}
          {/* Toolbar removed for simplicity; history has its own refresh */}
          {lastAnalyzed && (
            <div className="text-[11px] text-slate-500">Last analyzed: {new Date(lastAnalyzed*1000).toLocaleString()}</div>
          )}

          <div className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm" data-guide="compose">
            <div className="font-semibold mb-2">Compose</div>
            <div className="text-[11px] text-slate-600 mb-1">Pick one or more clients, choose a template, then Draft for me.</div>
            <div className="mb-2 text-xs flex items-center gap-2">
              <label className="inline-flex items-center gap-2">Template
                <select className="border rounded-md px-2 py-1 text-xs" value={bucket} onChange={e=> setBucket(e.target.value)}>
                  <option value="reminder_24h">Reminder 24h</option>
                  <option value="waitlist_open">Waitlist open</option>
                  <option value="lead_followup">Lead follow‑up</option>
                  <option value="reengage_30d">Re‑engage 30d</option>
                  <option value="winback_45d">Win‑back 45d</option>
                  <option value="no_show_followup">No‑show follow‑up</option>
                  <option value="first_time_nurture">First‑time guest nurture</option>
                </select>
              </label>
              <Button variant="outline" size="sm" onClick={draftSmart}>Draft for me</Button>
              {mdUrl && (
                <a href={mdUrl} download={`followups_${bucket}_${new Date().toISOString().slice(0,10)}.md`} className="px-3 py-1.5 rounded-md border bg-white text-xs">Download Markdown</a>
              )}
            </div>
            <div className="mb-2 text-xs text-sky-800 bg-sky-50 border border-sky-100 rounded-md px-2 py-1 inline-block">Draft‑only for now — sending will enable after setup.</div>
            {!!quiet?.start && !!quiet?.end && (
              <div className="mb-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 inline-block" data-guide="quiet">Quiet hours: {format12h(quiet.start)}–{format12h(quiet.end)}. Sending will be disabled during this window.</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="form" aria-label="Send message form">
              <div className="relative" role="combobox" aria-expanded={showSug} aria-owns="recipient-listbox" aria-haspopup="listbox">
                {/* Recipient chips */}
                {(selectedRecipients.length>0 || selectedRecipient) && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {[...(selectedRecipients||[]), ...(selectedRecipient? [selectedRecipient]: [])].map((chip)=> (
                      <span key={chip.id} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-white text-xs">
                        <span className="truncate max-w-[14rem]">{chip.name}</span>
                        <button className="text-slate-500 hover:text-slate-700" onClick={()=> {
                          setSelectedRecipients(arr=> arr.filter(x=> x.id!==chip.id));
                          if (selectedRecipient && selectedRecipient.id===chip.id) setSelectedRecipient(null);
                          if (send.contact_id===chip.id) setSend(s=> ({ ...s, contact_id:'' }));
                        }} aria-label="Remove recipient">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <Input placeholder="Search client" value={selectedRecipient ? '' : recipientQuery} onFocus={()=>setShowSug(true)} onBlur={()=> setTimeout(()=>setShowSug(false), 120)} onChange={e=>{ setRecipientQuery(e.target.value); setSelectedRecipient(null); }} aria-autocomplete="list" aria-controls="recipient-listbox" aria-label="Search client" />
                {showSug && suggestions.length > 0 && (
                  <div id="recipient-listbox" role="listbox" className="absolute z-10 mt-1 max-h-40 overflow-auto bg-white border rounded-md shadow-sm text-xs w-full">
                    {suggestions.map((s) => {
                      const added = selectedRecipients.some(x=> x.id===s.id) || (selectedRecipient?.id===s.id);
                      return (
                        <button role="option" aria-selected={false} key={s.id} className={`block w-full text-left px-2 py-1 hover:bg-slate-50 ${added? 'opacity-60':''}`} onMouseDown={(ev)=>{ ev.preventDefault();
                          if (added) return;
                          setSelectedRecipients(arr=> [...arr, s]);
                          setSend({...send, contact_id: s.id, channel:'sms' });
                          setShowSug(false);
                        }}>
                          {s.name || 'Client'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-600">Channel: SMS</div>
              <div className="sm:col-span-2 relative">
                <textarea
                  className="w-full min-h-[120px] border rounded-md px-3 py-2"
                  placeholder="Type your message or type / for templates"
                  value={send.body}
                  onChange={e=>setSend({...send, body: e.target.value})}
                  onKeyDown={(e)=>{
                    if (e.key === '/') { setShowSlash(true); setSlashQuery(''); return; }
                    if (showSlash && e.key === 'Escape') { setShowSlash(false); return; }
                    if (showSlash && e.key === 'Backspace') { setSlashQuery(q=> q.slice(0, -1)); return; }
                    if (showSlash && e.key === 'Enter') {
                      e.preventDefault();
                      const pick = slashOptions[0];
                      if (pick) setSend(s=> ({ ...s, body: pick.body }));
                      setShowSlash(false);
                      return;
                    }
                    if (showSlash && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
                      setSlashQuery(q=> q + e.key.toLowerCase());
                      return;
                    }
                  }}
                  aria-label="Message body"
                />
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" size="sm" onClick={async()=>{ try{ await navigator.clipboard.writeText(send.body||''); showToast({ title:'Copied', description:'Message copied to clipboard' }); }catch{} }}>Copy</Button>
                </div>
                {showSlash && (
                  <div role="listbox" className="absolute z-10 left-0 right-0 mt-1 max-h-40 overflow-auto bg-white border rounded-md shadow-sm text-xs">
                    {slashOptions.length === 0 && (
                      <div className="px-2 py-1 text-slate-500">No matches</div>
                    )}
                    {slashOptions.map((p)=> (
                      <button role="option" key={p.label} className="block w-full text-left px-2 py-1 hover:bg-slate-50" onMouseDown={(ev)=>{ ev.preventDefault(); setSend(s=> ({ ...s, body: p.body })); setShowSlash(false); }}>
                        <span className="font-medium mr-2">/{p.label}</span>
                        <span className="text-slate-500 truncate inline-block max-w-[60%] align-middle">{p.body}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-700 flex flex-wrap items-center gap-2">
              <span className="font-medium">Quiet hours:</span>
              <Button variant="outline" size="sm" onClick={()=> setQuiet({ start:'21:00', end:'08:00' })}>Suggest 9:00 PM–8:00 AM</Button>
              <Button variant="outline" size="sm" onClick={async()=>{ try { await api.post('/settings', { tenant_id: await getTenant(), quiet_hours: quiet }); trackEvent('integrations.guide.open', { area: 'messages.save_quiet_hours' }); } catch{} }} aria-label={UI_STRINGS.a11y.buttons.saveQuietHours}>{UI_STRINGS.ctas.secondary.save}</Button>
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
          {/* Inbox filters hidden per spec */}
          {itemsFiltered.length === 0 ? null : (
            <Table data-guide="list">
              <THead>
                <TR><TH>ID</TH><TH>Contact</TH><TH>Channel</TH><TH>Status</TH><TH>Template</TH><TH>Time</TH></TR>
              </THead>
              <tbody className="divide-y">
                {itemsFiltered.slice((page-1)*pageSize, page*pageSize).map((r:any)=> (
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
          {itemsFiltered.length>0 && (
            <Pager page={page} pageSize={pageSize} total={itemsFiltered.length} onPrev={()=> setPage(p=> Math.max(1, p-1))} onNext={()=> setPage(p=> (p*pageSize<itemsFiltered.length? p+1: p))} />
          )}
          {/* badges row moved to top; counters removed */}
        </>
      )}
    </div>
    {/* Mobile bottom toolbar */}
    <div className="fixed md:hidden left-0 right-0 bottom-[calc(env(safe-area-inset-bottom,0px))] z-30">
      <div className="mx-3 mb-2 rounded-xl border bg-white/95 backdrop-blur shadow flex items-center justify-between px-2 py-2">
        <Button variant="outline" size="sm" onClick={draftSmart} aria-label="Draft for me">Draft</Button>
        <Button variant="outline" size="sm" onClick={async()=>{ try { await api.post('/settings', { tenant_id: await getTenant(), quiet_hours: quiet }); trackEvent('integrations.guide.open', { area: 'messages.save_quiet_hours' }); } catch{} }} aria-label="Save quiet hours">Save quiet</Button>
      </div>
    </div>
    </>
  );
}

