import { useEffect, useState } from 'react';
import { api, getTenant } from '../lib/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import { startGuide } from '../lib/guide';
import { useToast } from '../components/ui/Toast';
import { UI_STRINGS } from '../lib/strings';

export default function Contacts(){
  const { showToast } = useToast();
  const isDemo = (()=>{ try{ return new URLSearchParams(window.location.search).get('demo')==='1'; } catch { return false; } })();
  const [status, setStatus] = useState('');
  const [contactId, setContactId] = useState('');
  const [busy, setBusy] = useState(false);
  const [policyHtml, setPolicyHtml] = useState<string>('');
  const [faqItems, setFaqItems] = useState<Array<{q:string;a:string}>>([]);
  const [sug, setSug] = useState<Array<{id:string;name?:string}>>([]);
  const [showSug, setShowSug] = useState(false);

  const run = async (fn: ()=>Promise<any>) => {
    try{ setBusy(true); const r = await fn(); setStatus(JSON.stringify(r)); }
    catch(e:any){ setStatus(String(e?.message||e)); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (isDemo) return; // skip policy/faq in demo
    (async () => {
      try { const p = await api.get('/consent/policy'); setPolicyHtml(String(p?.html || '')); } catch {}
      try { const f = await api.get('/consent/faq'); setFaqItems(Array.isArray(f?.items) ? f.items : []); } catch {}
    })();
  }, [isDemo]);
  useEffect(()=>{ try{ const sp = new URLSearchParams(window.location.search); if (sp.get('tour')==='1') startGuide('contacts'); } catch {} },[]);

  useEffect(()=>{
    const t = setTimeout(async()=>{
      try{
        const q = (contactId||'').trim();
        if (!q) { setSug([]); return; }
        if (isDemo) {
          setSug([{ id:'c_demo1', name:'Demo A' }, { id:'c_demo2', name:'Demo B' }]);
          return;
        }
        const r = await api.get(`/contacts/search?tenant_id=${encodeURIComponent(await getTenant())}&q=${encodeURIComponent(q)}&limit=8`);
        setSug(Array.isArray(r?.items)? r.items : []);
      } catch { setSug([]); }
    }, 180);
    return ()=> clearTimeout(t);
  }, [contactId, isDemo]);

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h3 className="text-lg font-semibold">Contacts</h3>
        <Button variant="outline" size="sm" className="ml-auto" onClick={()=> startGuide('contacts')} aria-label={UI_STRINGS.a11y.buttons.guideContacts}>{UI_STRINGS.ctas.tertiary.guideMe}</Button>
      </div>
      <div className="grid gap-4">
        <section className="border rounded-xl p-3 bg-white shadow-sm" data-guide="import">
          <div className="font-semibold mb-1">Import contacts</div>
          <div className="text-xs text-slate-600">Bring your clients from booking or CRM — no CSV needed.</div>
          <div className="flex flex-wrap gap-2 mt-2 items-center">
            <Button variant="outline" disabled={busy} onClick={async()=>{ if (isDemo) { setStatus('Demo: import disabled. Use Guide me for steps.'); return; } await run(async()=>api.post('/calendar/sync',{ tenant_id: await getTenant(), provider: 'auto' })); try{ showToast({ title:'Import queued', description:'Booking' }); }catch{} }}>{UI_STRINGS.ctas.secondary.importFromBooking}</Button>
            <Button variant="outline" disabled={busy} onClick={async()=>{ if (isDemo) { setStatus('Demo: CRM sync disabled.'); return; } await run(async()=>api.post('/crm/hubspot/import',{ tenant_id: await getTenant() })); try{ showToast({ title:'Import queued', description:'HubSpot' }); }catch{} }}>{UI_STRINGS.ctas.secondary.syncFromHubSpot}</Button>
            <span className="text-xs text-slate-600">
              When your booking is connected, it will automatically sync your data here, your calendar, and your CRM once connected. We handle everything else.
            </span>
            <Button variant="outline" size="sm" onClick={()=> startGuide('contacts')} className="ml-auto">{UI_STRINGS.ctas.tertiary.guideMe}</Button>
          </div>
        </section>

        <section className="border rounded-xl p-3 bg-white shadow-sm" data-guide="consent">
          <div className="font-semibold mb-2">Consent & Data</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <Input placeholder="contact_id" value={contactId} onFocus={()=> setShowSug(true)} onBlur={()=> setTimeout(()=> setShowSug(false), 120)} onChange={e=>setContactId(e.target.value)} />
              {showSug && sug.length>0 && (
                <div className="absolute z-10 mt-1 max-h-40 overflow-auto bg-white border rounded-md shadow-sm text-xs w-full">
                  {sug.map(s => (
                    <button key={s.id} className="block w-full text-left px-2 py-1 hover:bg-slate-50" onMouseDown={(ev)=>{ ev.preventDefault(); setContactId(s.id); setShowSug(false); }}>
                      {s.name || s.id}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={async()=>{ await run(async()=>api.post('/consent/stop',{ tenant_id: await getTenant(), contact_id: contactId })); try { showToast({ title:'STOP sent' }); } catch {} }}>{UI_STRINGS.ctas.secondary.stop}</Button>
              <Button variant="outline" disabled={busy} onClick={async()=>{ await run(async()=>api.post('/data/erase',{ tenant_id: await getTenant(), contact_id: contactId })); try { showToast({ title:'Erasure requested' }); } catch {} }}>{UI_STRINGS.ctas.secondary.erase}</Button>
            </div>
          </div>
          {(policyHtml || (faqItems && faqItems.length > 0)) && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {policyHtml && (
                <div className="rounded-xl border bg-white p-3">
                  <div className="font-medium text-slate-800 text-sm">Policy</div>
                  <div className="text-xs text-slate-700 mt-1" dangerouslySetInnerHTML={{ __html: policyHtml }} />
                </div>
              )}
              {faqItems && faqItems.length > 0 && (
                <div className="rounded-xl border bg-white p-3">
                  <div className="font-medium text-slate-800 text-sm">FAQ</div>
                  <ul className="text-xs text-slate-700 mt-1 space-y-2">
                    {faqItems.map((it, idx) => (
                      <li key={idx}>
                        <div className="font-medium">{it.q}</div>
                        <div className="text-slate-600">{it.a}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {busy ? <Skeleton className="h-8" /> : <pre className="whitespace-pre-wrap text-sm text-slate-700" data-guide="status">{status || 'No recent actions.'}</pre>}
    </div>
  );
}


