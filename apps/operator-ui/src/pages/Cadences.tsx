import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, getTenant } from '../lib/api';
import Button from '../components/ui/Button';
import { startGuide } from '../lib/guide';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import { Table, THead, TR, TH, TD } from '../components/ui/Table';

export default function Cadences(){
  const loc = useLocation();
  const isDemo = new URLSearchParams(loc.search).get('demo') === '1';
  const [status, setStatus] = useState('');
  const [contactId, setContactId] = useState('c_demo');
  const [cadenceId, setCadenceId] = useState('warm_lead_default');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{id:string;name:string}>>([]);
  const [showSug, setShowSug] = useState(false);
  const [queue, setQueue] = useState<any>({ items: [] });

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
        <section className="border rounded-xl p-3 bg-white shadow-sm" aria-labelledby="start-cadence">
          <div id="start-cadence" className="font-semibold mb-2">Start follow‑up</div>
          <div className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">Beta: reminders only — SMS/Email sending is disabled. Actions generate recommendations in Approvals.</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="relative">
              <Input placeholder="client_search" value={contactId} onFocus={()=>setShowSug(true)} onBlur={()=> setTimeout(()=>setShowSug(false), 120)} onChange={e=>setContactId(e.target.value)} />
              {showSug && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-40 overflow-auto bg-white border rounded-md shadow-sm text-xs w-full">
                  {suggestions.map(s => (
                    <button key={s.id} className="block w-full text-left px-2 py-1 hover:bg-slate-50" onMouseDown={(ev)=>{ ev.preventDefault(); setContactId(s.id); setShowSug(false); }}>
                      {s.name || s.id}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input placeholder="cadence_id" value={cadenceId} onChange={e=>setCadenceId(e.target.value)} />
            <Button variant="outline" disabled={busy} onClick={()=> isDemo ? setStatus('Demo: created recommendations for '+contactId+' in Approvals') : run(async()=>api.post('/cadences/start',{ tenant_id: await getTenant(), contact_id: contactId, cadence_id: cadenceId }))}>Start</Button>
            <Button variant="outline" disabled={busy} onClick={()=> isDemo ? setStatus('Demo: stopped cadence for '+contactId) : run(async()=>api.post(`/cadences/stop?tenant_id=${encodeURIComponent(await getTenant())}&contact_id=${encodeURIComponent(contactId)}&cadence_id=${encodeURIComponent(cadenceId)}`, {} as any))}>Stop</Button>
          </div>
        </section>

        <section className="border rounded-xl p-3 bg-white shadow-sm" aria-labelledby="scheduler-tick">
          <div id="scheduler-tick" className="font-semibold mb-2">Update follow‑ups</div>
          <Button variant="outline" disabled={busy} onClick={()=> isDemo ? setStatus('Demo: updated follow‑ups') : run(async()=>api.post('/scheduler/tick',{ tenant_id: await getTenant() }))}>Run update</Button>
        </section>

        <section className="border rounded-xl p-3 bg-white shadow-sm" aria-labelledby="dormant">
          <div id="dormant" className="font-semibold mb-2">Dormant campaigns</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button data-guide="dormant-preview" variant="outline" disabled={busy} onClick={async()=>{
              if (isDemo) { setStatus('Demo: ~8 dormant clients (preview).'); return; }
              try{
                const tid = await getTenant();
                const r = await api.post('/ai/tools/execute', { tenant_id: tid, name: 'campaigns.dormant.preview', params:{ tenant_id: tid, threshold_days: 60 }, require_approval: false });
                setStatus(JSON.stringify(r));
              } catch(e:any){ setStatus(String(e?.message||e)); }
            }}>Preview dormant (≥60d)</Button>
            <Button data-guide="dormant-start" variant="outline" disabled={busy} onClick={async()=>{
              if (isDemo) { setStatus('Demo: dormant campaign queued for approval.'); return; }
              try{
                const tid = await getTenant();
                const r = await api.post('/ai/tools/execute', { tenant_id: tid, name: 'campaigns.dormant.start', params:{ tenant_id: tid, threshold_days: 60 }, require_approval: true });
                setStatus(JSON.stringify(r));
              } catch(e:any){ setStatus(String(e?.message||e)); }
            }}>Start campaign (approval)</Button>
            <Button variant="outline" disabled={busy} onClick={async()=>{
              if (isDemo) { setStatus('Demo: scheduled reminders.'); return; }
              try{
                const tid = await getTenant();
                const r = await api.post('/ai/tools/execute', { tenant_id: tid, name: 'appointments.schedule_reminders', params:{ tenant_id: tid }, require_approval: false });
                setStatus(JSON.stringify(r));
              } catch(e:any){ setStatus(String(e?.message||e)); }
            }}>Schedule reminders</Button>
          </div>
          <div className="mt-2 text-[11px] text-slate-600">Approval may be required if auto‑approve is off (see Approvals).</div>
        </section>

        <section className="border rounded-xl p-3 bg-white shadow-sm">
          <div className="font-semibold mb-2">Check waitlist (Gated)</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button variant="outline" disabled={busy} onClick={()=>run(async()=>api.post('/ai/tools/execute',{
              tenant_id: await getTenant(), name:'notify_trigger_send', params:{ tenant_id: await getTenant(), max_candidates:5 }, require_approval:true
            }))}>Request Approval</Button>
            <Button variant="outline" disabled={busy} onClick={()=>run(async()=>api.post('/ai/tools/execute',{
              tenant_id: await getTenant(), name:'notify_trigger_send', params:{ tenant_id: await getTenant(), max_candidates:5 }, require_approval:false
            }))}>Send Now (respects auto-approve)</Button>
          </div>
        </section>

        <section className="border rounded-xl p-3 bg-white shadow-sm" aria-labelledby="cadence-queue">
          <div id="cadence-queue" className="font-semibold mb-2">Follow‑up queue</div>
          <Table>
            <THead>
              <TR><TH>Contact</TH><TH>Cadence</TH><TH>Step</TH><TH>Next Action</TH></TR>
            </THead>
            <tbody className="divide-y">
              {(queue.items||[]).map((r:any,i:number)=> (
                <TR key={i}>
                  <TD>{r.contact_id}</TD>
                  <TD>{r.cadence_id}</TD>
                  <TD>{r.step_index}</TD>
                  <TD>{r.next_action_at}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>
      </div>
      {busy ? <Skeleton className="h-8" /> : <pre className="whitespace-pre-wrap text-sm text-slate-700">{status || 'No recent actions.'}</pre>}
    </div>
  );
}


