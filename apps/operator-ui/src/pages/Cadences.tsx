import { useState } from 'react';
import { api, getTenant } from '../lib/api';
import Button from '../components/ui/Button';
import { startGuide } from '../lib/guide';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';

export default function Cadences(){
  const [status, setStatus] = useState('');
  const [contactId, setContactId] = useState('c_demo');
  const [cadenceId, setCadenceId] = useState('warm_lead_default');
  const [busy, setBusy] = useState(false);

  const run = async (fn: ()=>Promise<any>) => {
    try{ setBusy(true); const r = await fn(); setStatus(JSON.stringify(r)); }
    catch(e:any){ setStatus(String(e?.message||e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Cadences</h3>
      <div><Button variant="outline" onClick={()=> startGuide('cadences')}>Guide me</Button></div>
      <div className="grid gap-4">
        <section className="border rounded-xl p-3 bg-white shadow-sm" aria-labelledby="start-cadence">
          <div id="start-cadence" className="font-semibold mb-2">Start Cadence</div>
          <div className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">Some actions may require approval when auto-approve is off. Review in Approvals.</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <Input placeholder="contact_id" value={contactId} onChange={e=>setContactId(e.target.value)} />
            <Input placeholder="cadence_id" value={cadenceId} onChange={e=>setCadenceId(e.target.value)} />
            <Button variant="outline" disabled={busy} onClick={()=>run(async()=>api.post('/cadences/start',{ tenant_id: await getTenant(), contact_id: contactId, cadence_id: cadenceId }))}>Start</Button>
            <Button variant="outline" disabled={busy} onClick={()=>run(async()=>api.post(`/cadences/stop?tenant_id=${encodeURIComponent(await getTenant())}&contact_id=${encodeURIComponent(contactId)}&cadence_id=${encodeURIComponent(cadenceId)}`, {} as any))}>Stop</Button>
          </div>
        </section>

        <section className="border rounded-xl p-3 bg-white shadow-sm" aria-labelledby="scheduler-tick">
          <div id="scheduler-tick" className="font-semibold mb-2">Scheduler Tick</div>
          <Button variant="outline" disabled={busy} onClick={()=>run(async()=>api.post('/scheduler/tick',{ tenant_id: await getTenant() }))}>Run Tick</Button>
        </section>

        <section className="border rounded-xl p-3 bg-white shadow-sm">
          <div className="font-semibold mb-2">Waitlist Ping (Gated)</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button variant="outline" disabled={busy} onClick={()=>run(async()=>api.post('/ai/tools/execute',{
              tenant_id: await getTenant(), name:'notify_trigger_send', params:{ tenant_id: await getTenant(), max_candidates:5 }, require_approval:true
            }))}>Request Approval</Button>
            <Button variant="outline" disabled={busy} onClick={()=>run(async()=>api.post('/ai/tools/execute',{
              tenant_id: await getTenant(), name:'notify_trigger_send', params:{ tenant_id: await getTenant(), max_candidates:5 }, require_approval:false
            }))}>Send Now (respects auto-approve)</Button>
          </div>
        </section>
      </div>
      {busy ? <Skeleton className="h-8" /> : <pre className="whitespace-pre-wrap text-sm text-slate-700">{status || 'No recent actions.'}</pre>}
    </div>
  );
}


