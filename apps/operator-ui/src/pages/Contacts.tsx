import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { readNumberParam, syncParamToState } from '../lib/url';
import { api, getTenant } from '../lib/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import { startGuide } from '../lib/guide';
import { useToast } from '../components/ui/Toast';
import { UI_STRINGS } from '../lib/strings';

export default function Contacts(){
  const loc = useLocation();
  const { showToast } = useToast();
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const isDemo = (()=>{ try{ return new URLSearchParams(window.location.search).get('demo')==='1'; } catch { return false; } })();
  const [status, setStatus] = useState('');
  const [contactId, setContactId] = useState('');
  const [busy, setBusy] = useState(false);
  const [policyHtml, setPolicyHtml] = useState<string>('');
  const [faqItems, setFaqItems] = useState<Array<{q:string;a:string}>>([]);
  const [sug, setSug] = useState<Array<{id:string;name?:string}>>([]);
  const [showSug, setShowSug] = useState(false);
  const [items, setItems] = useState<Array<{ contact_id:string; display_name?:string; first_name?:string; last_name?:string; first_visit?:number; last_visit?:number; txn_count?:number; lifetime_cents?:number; birthday?:string; creation_source?:string }>>([]);
  const [total, setTotal] = useState<number>(0);
  const [listBusy, setListBusy] = useState(false);
  const [page, setPage] = useState(()=> readNumberParam('page', 1));
  const PAGE_SIZE = 20;
  const [reach, setReach] = useState<Array<{contact_id:string; label:string}>>([]);
  const [expert, setExpert] = useState<{open:boolean; contact?:any}>({open:false});

  const nameOf = (r: { display_name?: string; first_name?: string; last_name?: string; contact_id?: string; }) => {
    try{
      const full = `${(r.first_name||'').toString().trim()} ${(r.last_name||'').toString().trim()}`.trim();
      if (full) return full;
      const dn = (r.display_name||'').toString().trim();
      if (dn) return dn;
      return 'Client';
    } catch { return 'Client'; }
  };

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

  const loadList = async () => {
    if (isDemo) { setItems([]); return; }
    try{
      setListBusy(true);
      const r = await api.get(`/contacts/list?tenant_id=${encodeURIComponent(await getTenant())}&limit=${encodeURIComponent(String(PAGE_SIZE))}&offset=${encodeURIComponent(String((page-1)*PAGE_SIZE))}`, { timeoutMs: 20000 });
      setItems(Array.isArray(r?.items)? r.items: []);
      setTotal(Number(r?.total||0));
      setLastUpdated(Date.now());
    } catch(e:any){ try{ showToast({ title:'Load failed', description:String(e?.message||e) }); }catch{} }
    finally { setListBusy(false); }
  };
  useEffect(()=>{ void loadList(); }, [isDemo, page]);

  // Sync page -> URL (replace to avoid history spam)
  useEffect(()=>{ try{ syncParamToState('page', String(page), true); } catch {} }, [page]);

  // Sync URL -> page (for back/forward buttons)
  useEffect(()=>{
    try{ const sp = new URLSearchParams(loc.search); const p = parseInt(sp.get('page')||'1', 10); if (Number.isFinite(p) && p>0 && p !== page) setPage(p); } catch {}
  }, [loc.search]);

  const fmtTs = (ts?: number) => {
    try{ const n = Number(ts||0); if (!n) return '-'; const d = new Date((n<1e12? n*1000 : n)); return d.toLocaleDateString(); } catch { return '-'; }
  };
  const fmtMoney = (c?: number) => {
    try{ const n = Number(c||0); return `$${(n/100).toFixed(2)}`; } catch { return '$0.00'; }
  };

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
      <div className="flex items-center sticky top-[var(--sticky-offset,64px)] z-10 bg-white/70 backdrop-blur rounded-md px-1 py-1">
        <h3 className="text-lg font-semibold">Contacts</h3>
        {!!lastUpdated && (
          <span className="ml-2 text-[11px] text-slate-500">Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
        )}
        <Button variant="outline" size="sm" className="ml-auto" onClick={()=> startGuide('contacts')} aria-label={UI_STRINGS.a11y.buttons.guideContacts}>{UI_STRINGS.ctas.tertiary.guideMe}</Button>
      </div>
      <div className="grid gap-4">
        {/* Who to reach out to */}
        <section className="border rounded-xl p-3 bg-white shadow-sm" data-guide="status">
          <div className="flex items-center gap-2 mb-2">
            <div className="font-semibold">Who to reach out to</div>
            <Button variant="outline" size="sm" disabled={busy} onClick={async()=>{
              if (isDemo) { setReach([{contact_id:'c_demo1', label:'Dormant 90d'}, {contact_id:'c_demo2', label:'No rebook 12w'}]); return; }
              try{
                setBusy(true);
                const tid = await getTenant();
                const r = await api.get(`/campaigns/dormant/preview?tenant_id=${encodeURIComponent(tid)}&threshold_days=90`);
                const out = Array.isArray(r?.items) ? r.items.slice(0,8).map((c:any)=>({ contact_id:c.contact_id, label:'Dormant 90d' })) : [];
                setReach(out);
              } catch(e:any){ setStatus(String(e?.message||e)); }
              finally{ setBusy(false); }
            }}>Refresh</Button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {reach.length===0 ? <span className="text-slate-600">No suggestions yet.</span> : reach.map((c)=> {
              const rec = items.find(i=> i.contact_id===c.contact_id);
              return (
                <button key={c.contact_id} className="px-2 py-1 rounded-full border bg-white hover:shadow-sm" onClick={()=> setExpert({open:true, contact: rec || { contact_id:c.contact_id } })}>
                  {c.label}: {rec ? nameOf(rec) : 'Client'}
                </button>
              );
            })}
          </div>
        </section>
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

        <section className="border rounded-xl p-3 bg-white shadow-sm" data-guide="list">
          <div className="flex items-center gap-2 mb-2">
            <div className="font-semibold">Clients (enriched)</div>
            <Button variant="outline" size="sm" disabled={listBusy} onClick={()=> loadList()}>Refresh</Button>
          </div>
          <div className="overflow-auto rounded-md border" style={{ maxHeight: 'calc(100vh - 260px)' }}>
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left px-2 py-2">Client</th>
                  <th className="text-left px-2 py-2">First visit</th>
                  <th className="text-left px-2 py-2">Last visit</th>
                  <th className="text-left px-2 py-2">Txns</th>
                  <th className="text-left px-2 py-2">Lifetime</th>
                  <th className="text-left px-2 py-2">Birthday</th>
                  <th className="text-left px-2 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r)=> (
                  <tr key={r.contact_id} className="border-t">
                    <td className="px-2 py-1 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <button className="underline" onClick={()=> setExpert({open:true, contact:r})}>{nameOf(r)}</button>
                        <button className="ml-1 px-2 py-0.5 border rounded-md" onClick={async()=>{
                          try{
                            const tid = await getTenant();
                            const resp = await api.post('/messages/send',{ tenant_id: tid, contact_id: r.contact_id, channel: 'sms', body: 'Hi! Just checking in—would you like to book your next appointment?' });
                            if (resp?.status === 'rate_limited') {
                              showToast({ title:'Daily SMS limit reached', description:'Try again tomorrow or upgrade plan.' });
                            } else {
                              showToast({ title:'SMS sent', description:'If messaging is enabled' });
                            }
                          }catch(e:any){ setStatus(String(e?.message||e)); }
                        }}>Text</button>
                        <button className="px-2 py-0.5 border rounded-md" onClick={async()=>{
                          try{
                            const tid = await getTenant();
                            const resp = await api.post('/messages/send',{ tenant_id: tid, contact_id: r.contact_id, channel: 'email', subject: 'Quick check‑in', body: '<p>Would you like to book your next visit?</p>' });
                            if (resp?.status === 'rate_limited') {
                              showToast({ title:'Daily email limit reached', description:'Try again tomorrow or upgrade plan.' });
                            } else {
                              showToast({ title:'Email sent', description:'If email is enabled' });
                            }
                          }catch(e:any){ setStatus(String(e?.message||e)); }
                        }}>Email</button>
                      </div>
                    </td>
                    <td className="px-2 py-1">{fmtTs(r.first_visit)}</td>
                    <td className="px-2 py-1">{fmtTs(r.last_visit)}</td>
                    <td className="px-2 py-1">{Number(r.txn_count||0)}</td>
                    <td className="px-2 py-1">{fmtMoney(r.lifetime_cents)}</td>
                    <td className="px-2 py-1">{r.birthday || '-'}</td>
                    <td className="px-2 py-1">{r.creation_source || '-'}</td>
                  </tr>
                ))}
                {items.length===0 && (
                  <tr><td className="px-2 py-2" colSpan={7}>
                    <div className="max-w-md"><EmptyState title="No clients yet" description="Import from booking or CRM to see clients here.">
                      <Button variant="outline" size="sm" onClick={()=>{ if (isDemo){ setStatus('Demo: import disabled'); return; } void run(async()=> api.post('/calendar/sync',{ tenant_id: await getTenant(), provider: 'auto' })); }}>Import from booking</Button>
                      <Button variant="outline" size="sm" onClick={()=> startGuide('contacts')}>{UI_STRINGS.ctas.tertiary.guideMe}</Button>
                    </EmptyState></div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600 mt-2">
            <div>Total: {total||items.length}</div>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 border rounded-md" disabled={page<=1} onClick={()=> setPage(p=> Math.max(1, p-1))}>Prev</button>
              <span>Page {page} / {Math.max(1, Math.ceil((total||items.length) / PAGE_SIZE))}</span>
              <button className="px-2 py-1 border rounded-md" disabled={page>=Math.ceil((total||items.length)/PAGE_SIZE)} onClick={()=> setPage(p=> Math.min(Math.ceil((total||items.length)/PAGE_SIZE)||1, p+1))}>Next</button>
            </div>
          </div>
        </section>

        <section className="border rounded-xl p-3 bg-white shadow-sm" data-guide="consent">
          <div className="font-semibold mb-2">Consent & Data</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <Input placeholder="Search by name" value={contactId} onFocus={()=> setShowSug(true)} onBlur={()=> setTimeout(()=> setShowSug(false), 120)} onChange={e=>setContactId(e.target.value)} />
              {showSug && sug.length>0 && (
                <div className="absolute z-10 mt-1 max-h-40 overflow-auto bg-white border rounded-md shadow-sm text-xs w-full">
                  {sug.map(s => (
                    <button key={s.id} className="block w-full text-left px-2 py-1 hover:bg-slate-50" onMouseDown={(ev)=>{ ev.preventDefault(); setContactId(s.id); setShowSug(false); }}>
                      {s.name || 'Client'}
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
      {expert.open && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/20" onClick={()=> setExpert({open:false})} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl border-l p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Client Expert</div>
              <button className="text-slate-500 hover:text-slate-700" onClick={()=> setExpert({open:false})}>Close</button>
            </div>
            <div className="text-xs text-slate-700">Selected: {expert.contact?.display_name || expert.contact?.contact_id}</div>
            <div className="mt-2 border rounded-md overflow-hidden" style={{height: '60vh'}}>
              <iframe title="AskVX" src={`/ask?embed=1`} className="w-full h-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


