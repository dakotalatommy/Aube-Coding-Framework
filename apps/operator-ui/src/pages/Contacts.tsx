import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { readNumberParam, syncParamToState } from '../lib/url';
import { api, getTenant } from '../lib/api';
import Button from '../components/ui/Button';
// import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Pager from '../components/ui/Pager';
import { startGuide } from '../lib/guide';
import { useToast } from '../components/ui/Toast';
import { UI_STRINGS } from '../lib/strings';

export default function Contacts(){
  const loc = useLocation();
  const { showToast } = useToast();
  const isDemo = (()=>{ try{ return new URLSearchParams(window.location.search).get('demo')==='1'; } catch { return false; } })();
  const [status, setStatus] = useState('');
  // contactId/search typeahead removed in simplified UI
  const [busy, setBusy] = useState(false);
  // Typeahead removed
  const [items, setItems] = useState<Array<{ contact_id:string; display_name?:string; friendly_name?:string; first_name?:string; last_name?:string; first_visit?:number; last_visit?:number; txn_count?:number; lifetime_cents?:number; birthday?:string; creation_source?:string }>>([]);
  const [total, setTotal] = useState<number>(0);
  const [listBusy, setListBusy] = useState(false);
  const [page, setPage] = useState(()=> readNumberParam('page', 1));
  const PAGE_SIZE = 10;
  // Reach suggestions panel removed in cleanup
  const [expert, setExpert] = useState<{open:boolean; contact?:any}>({open:false});

  const nameOf = (r: { friendly_name?: string; display_name?: string; first_name?: string; last_name?: string; contact_id?: string; }) => {
    try{
      const friendly = (r.friendly_name||'').toString().trim();
      if (friendly && !/^sq[:_]/i.test(friendly)) return friendly;
      const first = (r.first_name||'').toString().trim();
      const last  = (r.last_name||'').toString().trim();
      const full  = `${first} ${last}`.trim();
      if (full) return full;
      const dn = (r.display_name||'').toString().trim();
      const looksLikeSquareId = /^sq[:_]/i.test(dn) || /^sq[^\s]{6,}$/i.test(dn) || /^sq[:_]/i.test((r.contact_id||''));
      if (dn && !looksLikeSquareId) return dn;
      return 'Client';
    } catch { return 'Client'; }
  };

  const run = async (fn: ()=>Promise<any>) => {
    try{ setBusy(true); const r = await fn(); setStatus(JSON.stringify(r)); }
    catch(e:any){ setStatus(String(e?.message||e)); }
    finally { setBusy(false); }
  };

  // Removed consent/faq fetch; section no longer shown
  useEffect(()=>{ try{ const sp = new URLSearchParams(window.location.search); if (sp.get('tour')==='1') startGuide('contacts'); } catch {} },[]);

  const loadList = async () => {
    if (isDemo) { setItems([]); return; }
    try{
      setListBusy(true);
      const r = await api.get(`/contacts/list?tenant_id=${encodeURIComponent(await getTenant())}&limit=${encodeURIComponent(String(PAGE_SIZE))}&offset=${encodeURIComponent(String((page-1)*PAGE_SIZE))}`, { timeoutMs: 20000 });
      setItems(Array.isArray(r?.items)? r.items: []);
      setTotal(Number(r?.total||0));
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

  // Removed contact search side panel; keeping list-only for clarity

  return (
    <div className="space-y-3">
      <div className="flex items-center px-1 py-1">
        <h3 className="text-lg font-semibold">Contacts</h3>
      </div>
      <div className="grid gap-4">
        {/* Who to reach out to */}
        {/* Removed old import/HubSpot section per spec */}

        <section className="border rounded-xl p-3 bg-white shadow-sm" data-guide="list">
          <div className="flex items-center gap-2 mb-2">
            <div className="font-semibold">Clients</div>
            <Button variant="outline" size="sm" disabled={busy} onClick={async()=>{ if (isDemo) { setStatus('Demo: import disabled.'); return; } await run(async()=>api.post('/calendar/sync',{ tenant_id: await getTenant(), provider: 'auto' })); try{ showToast({ title:'Import queued', description:'Booking' }); }catch{} }}>Import from booking</Button>
            <Button variant="outline" size="sm" disabled={listBusy} onClick={()=> loadList()}>Refresh</Button>
          </div>
          <div className="overflow-auto rounded-md border" style={{ maxHeight: 'calc(100dvh - var(--bvx-commandbar-height,64px) - 220px)' }}>
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
                        <button className="underline truncate max-w-[14rem]" title={nameOf(r)} onClick={()=> setExpert({open:true, contact:r})}>{nameOf(r)}</button>
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
                    <td className="px-2 py-1 truncate max-w-[10rem]" title={r.creation_source||'-'}>{r.creation_source || '-'}</td>
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
          <Pager page={page} pageSize={PAGE_SIZE} total={total||items.length} onPrev={()=> setPage(p=> Math.max(1, p-1))} onNext={()=> setPage(p=> Math.min(Math.ceil((total||items.length)/PAGE_SIZE)||1, p+1))} />
        </section>

        {/* Consent & Data and FAQ removed per spec to simplify the pane */}
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


