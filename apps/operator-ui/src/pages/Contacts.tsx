import { useState } from 'react';
import { api, getTenant } from '../lib/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';

export default function Contacts(){
  const [status, setStatus] = useState('');
  const [importJson, setImportJson] = useState('[{"contact_id":"c_demo","phone":"+15551234567","email":"demo@example.com","name":"Demo"}]');
  const [contactId, setContactId] = useState('c_demo');
  const [busy, setBusy] = useState(false);

  const run = async (fn: ()=>Promise<any>) => {
    try{ setBusy(true); const r = await fn(); setStatus(JSON.stringify(r)); }
    catch(e:any){ setStatus(String(e?.message||e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Contacts</h3>
      <div className="grid gap-4">
        <section className="border rounded-xl p-3 bg-white shadow-sm">
          <div className="font-semibold mb-2">Import Contacts (JSON array)</div>
          <textarea className="w-full font-mono border rounded-xl p-2 shadow-sm" value={importJson} onChange={e=>setImportJson(e.target.value)} rows={6} />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" disabled={busy} onClick={()=>run(async()=>api.post('/import/contacts',{ tenant_id: await getTenant(), contacts: JSON.parse(importJson) }))}>Import</Button>
            <Button variant="outline" disabled={busy} onClick={()=>run(async()=>api.get(`/exports/contacts?tenant_id=${encodeURIComponent(await getTenant())}`))}>Export</Button>
          </div>
        </section>

        <section className="border rounded-xl p-3 bg-white shadow-sm">
          <div className="font-semibold mb-2">Consent & Data</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input placeholder="contact_id" value={contactId} onChange={e=>setContactId(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={()=>run(async()=>api.post('/consent/stop',{ tenant_id: await getTenant(), contact_id: contactId }))}>STOP</Button>
              <Button variant="outline" disabled={busy} onClick={()=>run(async()=>api.post('/data/erase',{ tenant_id: await getTenant(), contact_id: contactId }))}>Erase</Button>
            </div>
          </div>
        </section>
      </div>

      {busy ? <Skeleton className="h-8" /> : <pre className="whitespace-pre-wrap text-sm text-slate-700">{status || 'No recent actions.'}</pre>}
    </div>
  );
}


