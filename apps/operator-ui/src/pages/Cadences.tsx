import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, getTenant } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import * as Sentry from '@sentry/react';
import Button from '../components/ui/Button';
import { startGuide } from '../lib/guide';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import { Table, THead, TR, TH, TD } from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';

export default function Cadences(){
  const SHOW_WAITLIST = false;
  const loc = useLocation();
  const isDemo = new URLSearchParams(loc.search).get('demo') === '1';
  const [status, setStatus] = useState('');
  const [contactId, setContactId] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{id:string;name:string}>>([]);
  const [showSug, setShowSug] = useState(false);
  const [queue, setQueue] = useState<any>({ items: [] });
  const [vxPanel, setVxPanel] = useState<string>('');
  const [lastQueued, setLastQueued] = useState<string>('');
  const { toastSuccess } = useToast();
  const [selectedName, setSelectedName] = useState('');
  const [tab, setTab] = useState<'actions'|'queue'>('actions');

  const run = async (fn: ()=>Promise<any>) => {
    try{ setBusy(true); const r = await fn(); setStatus(JSON.stringify(r)); }
    catch(e:any){ setStatus(String(e?.message||e)); }
    finally { setBusy(false); }
  };
  
  // Contact typeahead
  React.useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const q = (contactId||'').trim();
        if (!q) { setSuggestions([]); return; }
        const r = await api.get(`/contacts/search?tenant_id=${encodeURIComponent(await getTenant())}&q=${encodeURIComponent(q)}&limit=8`);
        setSuggestions(Array.isArray(r?.items)? r.items : []);
      } catch { setSuggestions([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [contactId]);

  // Load cadence queue here (moved from Dashboard)
  useEffect(()=>{
    (async()=>{
      try{
        if (isDemo) { setQueue({ items: [] }); return; }
        const tid = await getTenant();
        const r = await api.get(`/cadences/queue?tenant_id=${encodeURIComponent(tid)}`);
        setQueue(r || { items: [] });
      } catch { setQueue({ items: [] }); }
    })();
  }, [isDemo]);

  // Auto-run guide on deep-link (?tour=1)
  React.useEffect(()=>{
    try{ const sp = new URLSearchParams(window.location.search); if (sp.get('tour')==='1') startGuide('cadences'); } catch {}
  },[]);

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h3 className="text-lg font-semibold">Follow‑ups</h3>
        <Button variant="outline" className="ml-auto" onClick={()=> startGuide('cadences')}>Guide me</Button>
      </div>
      <div className="grid gap-4">
        <div className="flex items-center gap-2">
          <button className={`px-3 py-1 rounded-full border text-sm ${tab==='actions'?'bg-white border-pink-200 text-slate-900':'bg-white border-slate-200 text-slate-600'}`} onClick={()=>setTab('actions')}>Actions</button>
          <button className={`px-3 py-1 rounded-full border text-sm ${tab==='queue'?'bg-white border-pink-200 text-slate-900':'bg-white border-slate-200 text-slate-600'}`} onClick={()=>setTab('queue')}>Queue{Array.isArray(queue.items)&&queue.items.length>0?` (${queue.items.length})`:''}</button>
        </div>
        {tab==='actions' && (
        <section className="border rounded-xl p-3 bg-white shadow-sm" aria-labelledby="start-cadence">
          <div className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">Beta: reminders only — SMS/Email sending is disabled. Actions create To‑Do items.</div>
          <div id="start-cadence" className="font-semibold mb-2">Start follow‑up</div>
          <div className="grid grid-cols-1 gap-2">
            <div className="relative">
              <Input placeholder="Search client by name" value={contactId} onFocus={()=>setShowSug(true)} onBlur={()=> setTimeout(()=>setShowSug(false), 120)} onChange={e=>{ setContactId(e.target.value); setSelectedName(''); }} />
              {showSug && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-40 overflow-auto bg-white border rounded-md shadow-sm text-xs w-full">
                  {suggestions.map(s => (
                    <button key={s.id} className="block w-full text-left px-2 py-1 hover:bg-slate-50" onMouseDown={(ev)=>{ ev.preventDefault(); setContactId(s.id); setSelectedName(s.name||''); setShowSug(false); }}>
                      {s.name || s.id}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {contactId && (
              <div className="text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-slate-50 border-slate-200 text-slate-700">
                  {selectedName || contactId}
                  <button className="ml-1" aria-label="Clear" onClick={()=>{ setContactId(''); setSelectedName(''); }}>×</button>
                </span>
              </div>
            )}
          </div>
          {/* Read‑only AskVX panel */}
          <div className="mt-3 rounded-xl border bg-white p-3 min-h-[120px] text-sm text-slate-700 whitespace-pre-wrap">{vxPanel || 'Results will appear here after you start.'}</div>
          {lastQueued && (<div className="mt-2 text-xs text-slate-600">{lastQueued}</div>)}
          <div className="mt-2">
            <Button variant="outline" disabled={busy || !contactId.trim()} onClick={async()=>{
              if (isDemo) { setVxPanel(`Demo: Follow‑up plan for ${contactId||'Client'}\n• Draft: "Hi! Just checking in — would you like to book your next visit?"`); return; }
              await run(async()=>{
                const tid = await getTenant();
                await api.post('/cadences/start',{ tenant_id: tid, contact_id: contactId });
                try{
                  const sim = await api.post('/messages/simulate',{ tenant_id: tid, contact_id: contactId, channel:'sms', generate:false });
                  setVxPanel(`Follow‑up plan for ${selectedName||contactId||'Client'}\n• Draft: ${sim?.body||'Draft prepared.'}`);
                }catch{ setVxPanel(`Follow‑up plan for ${selectedName||contactId||'Client'}\n• Draft: Hi {FirstName}! Would you like to book your next visit?`); }
              });
            }}>Start</Button>
          </div>
        </section>
        )}

        {tab==='actions' && (
        <section className="border rounded-xl p-3 bg-white shadow-sm" aria-labelledby="reminders">
          <div id="reminders" className="font-semibold mb-2">Who needs a reminder?</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button variant="outline" disabled={busy} onClick={async()=>{
              await run(async()=>{
                try{
                  const tid = await getTenant();
                  const r1 = await api.get(`/followups/candidates?tenant_id=${encodeURIComponent(tid)}&scope=tomorrow`);
                  const r2 = await api.get(`/followups/candidates?tenant_id=${encodeURIComponent(tid)}&scope=this_week`);
                  const items1 = Array.isArray(r1?.items)? r1.items: [];
                  const items2 = Array.isArray(r2?.items)? r2.items: [];
                  const items = [...items1, ...items2];
                  setVxPanel(`Reminders for tomorrow + this week\n• Clients: ${items.length}\n• Draft: "Hi {FirstName}! Quick reminder about your appointment — reply YES to confirm or text if you need a different time. See you soon!"`);
                  trackEvent('cadences.reminders.next_week', { count: items.length });
                  Sentry.addBreadcrumb({ category: 'cadences', level: 'info', message: 'enqueue next_week reminders', data: { count: items.length } });
                  await api.post('/followups/enqueue', { tenant_id: tid, contact_ids: items.map((c:any)=> c.contact_id), cadence_id: 'reminder' });
                  const toQueue = (items||[]).map((c:any)=> ({ contact_id: (c.contact_id||c.id||'Client'), cadence_id: 'reminder', step_index: 0, next_action_at: new Date().toISOString() }));
                  setQueue((q:any)=> ({ items: [...(q.items||[]), ...toQueue] }));
                  setLastQueued(`Queued ${items.length} To‑Do item(s) for tomorrow + this week.`);
                  toastSuccess('Queued reminders', `${items.length} To‑Do item(s) created`);
                } catch (e:any) { Sentry.captureException(e); }
              });
            }}>Tomorrow + this week</Button>
            <Button variant="outline" disabled={busy} onClick={async()=>{
              await run(async()=>{
                try{
                  const tid = await getTenant();
                  const res = await api.get(`/followups/candidates?tenant_id=${encodeURIComponent(tid)}&scope=reengage_30d`);
                  const items = Array.isArray(res?.items)? res.items : [];
                  setVxPanel(`Re‑engage 30‑day clients\n• Clients: ${items.length}\n• Draft: "Hey {FirstName}! It’s been about a month — I’d love to see you again. Want me to hold a spot this week?"`);
                  trackEvent('cadences.reminders.reengage_30d', { count: items.length });
                  Sentry.addBreadcrumb({ category: 'cadences', level: 'info', message: 'enqueue reengage_30d', data: { count: items.length } });
                  await api.post('/followups/enqueue', { tenant_id: tid, contact_ids: items.map((c:any)=> c.contact_id), cadence_id: 'reengage_30d' });
                  const toQueue = (items||[]).map((c:any)=> ({ contact_id: (c.contact_id||c.id||'Client'), cadence_id: 'reengage_30d', step_index: 0, next_action_at: new Date().toISOString() }));
                  setQueue((q:any)=> ({ items: [...(q.items||[]), ...toQueue] }));
                  setLastQueued(`Queued ${items.length} To‑Do item(s) for 30‑day re‑engage.`);
                  toastSuccess('Queued re‑engage', `${items.length} To‑Do item(s) created`);
                } catch (e:any) { Sentry.captureException(e); }
              });
            }}>Re‑engage at 30 days</Button>
            <Button variant="outline" disabled={busy} onClick={async()=>{
              await run(async()=>{
                try{
                  const tid = await getTenant();
                  const res = await api.get(`/followups/candidates?tenant_id=${encodeURIComponent(tid)}&scope=winback_45d`);
                  const items = Array.isArray(res?.items)? res.items : [];
                  setVxPanel(`Win‑back 45+ day clients\n• Clients: ${items.length}\n• Draft: "Hi {FirstName}! I’ve got a couple of times open — want to refresh your look? I can help you pick the perfect time."`);
                  trackEvent('cadences.reminders.winback_45d', { count: items.length });
                  Sentry.addBreadcrumb({ category: 'cadences', level: 'info', message: 'enqueue winback_45d', data: { count: items.length } });
                  await api.post('/followups/enqueue', { tenant_id: tid, contact_ids: items.map((c:any)=> c.contact_id), cadence_id: 'winback_45d_plus' });
                  const toQueue = (items||[]).map((c:any)=> ({ contact_id: (c.contact_id||c.id||'Client'), cadence_id: 'winback_45d_plus', step_index: 0, next_action_at: new Date().toISOString() }));
                  setQueue((q:any)=> ({ items: [...(q.items||[]), ...toQueue] }));
                  setLastQueued(`Queued ${items.length} To‑Do item(s) for 45+ day win‑back.`);
                  toastSuccess('Queued win‑back', `${items.length} To‑Do item(s) created`);
                } catch (e:any) { Sentry.captureException(e); }
              });
            }}>Win‑back 45+ days</Button>
          </div>
          <div className="mt-2 text-[11px] text-slate-600">Actions create To‑Do items for review before sending.</div>
        </section>
        )}

        {tab==='actions' && SHOW_WAITLIST && (
        <section className="border rounded-xl p-3 bg-white shadow-sm">
          <div className="font-semibold mb-2">Check waitlist</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button variant="outline" disabled={busy} onClick={()=>run(async()=>api.post('/ai/tools/execute',{
              tenant_id: await getTenant(), name:'notify_trigger_send', params:{ tenant_id: await getTenant(), max_candidates:5 }, require_approval:true
            }))}>Request Approval</Button>
            <Button variant="outline" disabled={busy} onClick={()=>run(async()=>api.post('/ai/tools/execute',{
              tenant_id: await getTenant(), name:'notify_trigger_send', params:{ tenant_id: await getTenant(), max_candidates:5 }, require_approval:false
            }))}>Send Now (respects auto-approve)</Button>
          </div>
        </section>
        )}
        {tab==='queue' && (
        <section className="border rounded-xl p-3 bg-white shadow-sm" aria-labelledby="cadence-queue">
          <div id="cadence-queue" className="font-semibold mb-2">Follow‑up queue</div>
          <Table>
            <THead>
              <TR><TH>Done</TH><TH>Contact</TH><TH>Type</TH><TH>Next Action</TH></TR>
            </THead>
            <tbody className="divide-y">
              {(queue.items||[]).map((r:any,i:number)=> (
                <TR key={i}>
                  <TD>
                    <input type="checkbox" aria-label="Mark done" onChange={()=> setQueue((q:any)=> ({ items: (q.items||[]).filter((_:any,idx:number)=> idx!==i) }))} />
                  </TD>
                  <TD>{r.contact_id}</TD>
                  <TD>{r.cadence_id||'reminder'}</TD>
                  <TD>{r.next_action_at}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>
        )}
      </div>
      {busy ? <Skeleton className="h-8" /> : <pre className="whitespace-pre-wrap text-sm text-slate-700">{status || 'No recent actions.'}</pre>}
    </div>
  );
}
