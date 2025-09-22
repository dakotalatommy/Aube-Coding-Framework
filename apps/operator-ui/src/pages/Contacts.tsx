import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { readNumberParam, syncParamToState } from '../lib/url';
import { api, getTenant, API_BASE } from '../lib/api';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
// import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Pager from '../components/ui/Pager';
import { startGuide } from '../lib/guide';
import { useToast } from '../components/ui/Toast';
import { UI_STRINGS } from '../lib/strings';
import { trackEvent } from '../lib/analytics';

export default function Contacts(){
  const loc = useLocation();
  const { showToast } = useToast();
  const isDemo = (()=>{ try{ return new URLSearchParams(window.location.search).get('demo')==='1'; } catch { return false; } })();
  const isOnboard = (()=>{ try{ return new URLSearchParams(window.location.search).get('onboard')==='1'; } catch { return false; } })();
  const [status, setStatus] = useState('');
  const [importBanner, setImportBanner] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const [importReport, setImportReport] = useState<{ provider?: string; imported?: number; updated?: number; skipped?: number; reasonTop?: string }|null>(null);
  // contactId/search typeahead removed in simplified UI
  const [busy, setBusy] = useState(false);
  // Typeahead removed
  const [items, setItems] = useState<Array<{ contact_id:string; display_name?:string; friendly_name?:string; first_name?:string; last_name?:string; first_visit?:number; last_visit?:number; txn_count?:number; lifetime_cents?:number; birthday?:string; creation_source?:string }>>([]);
  const [total, setTotal] = useState<number>(0);
  const [listBusy, setListBusy] = useState(false);
  const [dupePreview, setDupePreview] = useState<Array<{ key:string; count:number; items:Array<{contact_id?:string; display_name?:string; first_name?:string; last_name?:string; lifetime_cents?:number; txn_count?:number}>}>>([]);
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
  // Signal: Contacts page is ready and in view for tour placement
  useEffect(() => {
    let cancelled = false;
    const signalReady = () => {
      if (cancelled) return;
      try {
        const target = (document.querySelector('[data-guide="clients-import-status"]') || document.querySelector('[data-guide="clients-list"]')) as HTMLElement | null;
        if (target) {
          // Ensure it is visible inside our inner scroller
          try {
            const scroller = document.querySelector('main .overflow-y-auto') as HTMLElement | null;
            target.scrollIntoView?.({ block: 'center' });
            scroller?.scrollBy?.(0, 1); scroller?.scrollBy?.(0, -1);
          } catch {}
          try { window.dispatchEvent(new CustomEvent('bvx:contacts:ready')); } catch {}
          try { window.dispatchEvent(new CustomEvent('bvx:dbg', { detail: { type: 'ready', pane: 'contacts' } })); } catch {}
          return;
        }
      } catch {}
      setTimeout(() => { try { requestAnimationFrame(signalReady); } catch { signalReady(); } }, 60);
    };
    try { requestAnimationFrame(() => { requestAnimationFrame(signalReady); }); } catch { setTimeout(signalReady, 60); }
    return () => { cancelled = true; };
  }, [loc.search]);


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

  const handleImport = async () => {
    if (isDemo) { setStatus('Demo: import disabled.'); return; }
    try {
      setImporting(true); setImportReport(null);
      try { trackEvent('contacts.import_booking'); } catch {}
      try { window.dispatchEvent(new CustomEvent('bvx:flow:contacts-import-started')); } catch {}
      const analyze = await api.post('/onboarding/analyze', { tenant_id: await getTenant() });
      const connected = (analyze?.summary?.connected || {}) as Record<string,string>;
      const provider = String(connected.square||'')==='connected' ? 'square' : (String(connected.acuity||'')==='connected' ? 'acuity' : 'auto');
      let imported = 0; let updated = 0; let skipped = 0; let reasonTop = '';
      try {
        if (provider === 'square') {
          const r = await api.post('/ai/tools/execute', { tenant_id: await getTenant(), name:'contacts.import.square', params:{ tenant_id: await getTenant() }, require_approval: false, idempotency_key: `square_import_${Date.now()}` });
          imported = Number(r?.imported||0); updated = Number(r?.updated||0); skipped = Number(r?.skipped||0); reasonTop = String(r?.top_reason||'');
          try{ await api.post('/integrations/booking/square/backfill-metrics', { tenant_id: await getTenant() }); }catch{}
        } else if (provider === 'acuity') {
          const r = await api.post('/integrations/booking/acuity/import', { tenant_id: await getTenant(), since:'0', until:'', cursor:'' });
          imported = Number(r?.imported||0); updated = Number(r?.updated||0);
        } else {
          await api.post('/calendar/sync',{ tenant_id: await getTenant(), provider: 'auto' });
        }
        setImportReport({ provider, imported, updated, skipped, reasonTop });
        try{ showToast({ title:'Import complete', description: `${imported} contacts imported` }); }catch{}
        if (isOnboard) {
          setImportBanner({ status: 'success', message: `${imported} contacts imported • ${updated} updated` });
        }
        try{ await api.post('/onboarding/complete_step', { tenant_id: await getTenant(), step_key: 'contacts_imported', context: { provider, imported, updated, skipped } }); }catch{}
        try{ if (isOnboard) localStorage.setItem('bvx_done_contacts','1'); }catch{}
        try{ await loadList(); }catch{}
        try { window.dispatchEvent(new CustomEvent('bvx:flow:contacts-imported', { detail: { provider, imported, updated, skipped } })); } catch {}
        try {
          const d = document.createElement('div');
          d.className = 'fixed z-[100] bottom-20 left-1/2 -translate-x-1/2 rounded-full border bg-white shadow px-3 py-2 text-xs text-slate-800';
          d.textContent = 'Next: Train VX with top client feedback or draft a dormant re‑engage.';
          document.body.appendChild(d);
          setTimeout(()=>{ try{ document.body.removeChild(d); }catch{} }, 5000);
        }catch{}
      } catch (err) {
        const message = String((err as any)?.message || err);
        setStatus(message);
        try { window.dispatchEvent(new CustomEvent('bvx:flow:contacts-imported', { detail: { error: message } })); } catch {}
        if (isOnboard) {
          setImportBanner({ status: 'error', message });
        }
        try { window.dispatchEvent(new CustomEvent('bvx:onboarding:skip-import')); } catch {}
      }
    } finally {
      setImporting(false);
    }
  };

  useEffect(()=>{
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail?.action === 'contacts.import' && !importing && !busy) {
        void handleImport();
      }
    };
    window.addEventListener('bvx:flow:contacts-command' as any, handler as any);
    return () => window.removeEventListener('bvx:flow:contacts-command' as any, handler as any);
  }, [importing, busy]);

  // Removed contact search side panel; keeping list-only for clarity

  return (
    <div className="space-y-2">
      <div className="flex items-center px-1 py-0.5">
        <h3 className="text-lg font-semibold">Clients</h3>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={()=> startGuide('contacts')}>{UI_STRINGS.ctas.tertiary.guideMe}</Button>
          <Button variant="outline" size="sm" onClick={()=>{ window.location.href='/ask'; }}>AskVX</Button>
        </div>
      </div>
      {importBanner && (
        <div
          data-guide="clients-import-status"
          className={`rounded-xl border px-3 py-2 text-xs shadow-sm flex items-center gap-2 ${importBanner.status === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}
        >
          <span className="font-medium">{importBanner.status === 'success' ? 'Import successful' : 'Import failed'}</span>
          <span className="truncate">{importBanner.message}</span>
        </div>
      )}
      <div className="grid gap-4">
        {/* Who to reach out to */}
        {/* Removed old import/HubSpot section per spec */}

        <section className="border rounded-xl p-3 bg-white shadow-sm" data-guide="clients-list">
          <div className="flex items-center gap-1 mb-1">
            <Button variant="outline" size="sm" data-guide="clients-import" disabled={busy || importing} onClick={()=> handleImport()}>Import from booking</Button>
            <Button variant="outline" size="sm" onClick={async()=>{
              try{
                setListBusy(true);
                const r = await api.post('/ai/tools/execute', { tenant_id: await getTenant(), name:'contacts.dedupe.preview', params:{ tenant_id: await getTenant() }, require_approval: false });
                const groups = Array.isArray(r?.groups)? r.groups: [];
                setDupePreview(groups);
                setStatus(`Found ${groups.length} duplicate groups`);
              } catch(e:any){ setStatus(String(e?.message||e)); }
              finally{ setListBusy(false); }
            }}>Preview duplicates</Button>
            {dupePreview.length>0 && (
              <Button variant="outline" size="sm" onClick={async()=>{
                try{
                  setBusy(true);
                  const r = await api.post('/ai/tools/execute', { tenant_id: await getTenant(), name:'contacts.dedupe', params:{ tenant_id: await getTenant() }, require_approval: true });
                  try{ showToast({ title:'Dedupe completed', description: `${Number(r?.removed||0)} removed` }); }catch{}
                  await loadList();
                  setDupePreview([]);
                } catch(e:any){ setStatus(String(e?.message||e)); }
                finally{ setBusy(false); }
              }}>Run dedupe</Button>
            )}
            <Button variant="outline" size="sm" data-guide="clients-export" onClick={async()=>{
              try{
                const tid = await getTenant();
                const sess = (await supabase.auth.getSession()).data.session;
                const headers: Record<string,string> = sess?.access_token ? { Authorization: `Bearer ${sess.access_token}` } : {};
                // Fetch in pages to avoid backend changes; cap at 10k for safety
                let offset = 0; const limit = 1000; const max = 10000; const rows: any[] = [];
                for (; offset < max; offset += limit) {
                  const url = `${API_BASE}/contacts/list?tenant_id=${encodeURIComponent(tid)}&limit=${limit}&offset=${offset}`;
                  const res = await fetch(url, { headers });
                  if (!res.ok) break;
                  const j = await res.json().catch(() => ({}));
                  const pageItems = Array.isArray(j?.items) ? j.items : [];
                  rows.push(...pageItems);
                  if (pageItems.length < limit) break;
                }
                const head = ['first_name','last_name','display_name','email','phone','total_revenue','total_appointments','first_visit_at','last_visit_at','tags','sms_consent','email_consent'];
                const csvLines = [head.join(',')];
                const esc = (v: any) => {
                  const s = (v==null? '' : String(v));
                  return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
                };
                rows.forEach((r:any)=>{
                  const first = String(r?.first_name||'').trim();
                  const last = String(r?.last_name||'').trim();
                  const disp = String(r?.display_name||'').trim();
                  const email = String(r?.email||'').trim();
                  const phone = String(r?.phone||'').trim();
                  const total_revenue = Number(r?.lifetime_cents||0)/100;
                  const total_appointments = Number(r?.txn_count||0);
                  const first_visit_at = Number(r?.first_visit||0) ? new Date((Number(r.first_visit)<1e12? Number(r.first_visit)*1000 : Number(r.first_visit))).toISOString() : '';
                  const last_visit_at = Number(r?.last_visit||0) ? new Date((Number(r.last_visit)<1e12? Number(r.last_visit)*1000 : Number(r.last_visit))).toISOString() : '';
                  const tags = Array.isArray(r?.tags) ? r.tags.join(',') : '';
                  const sms_consent = typeof r?.sms_consent==='boolean' ? (r.sms_consent?'yes':'no') : '';
                  const email_consent = typeof r?.email_consent==='boolean' ? (r.email_consent?'yes':'no') : '';
                  csvLines.push([
                    esc(first), esc(last), esc(disp), esc(email), esc(phone), esc(total_revenue.toFixed(2)), esc(total_appointments), esc(first_visit_at), esc(last_visit_at), esc(tags), esc(sms_consent), esc(email_consent)
                  ].join(','));
                });
                const csv = csvLines.join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'contacts.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                try { showToast({ title: 'Export ready', description: 'contacts.csv downloaded' }); } catch {}
              } catch(e:any){ setStatus(String(e?.message||e)); }
            }}>Export CSV</Button>
            <Button variant="outline" size="sm" data-guide="clients-refresh" disabled={listBusy} onClick={async()=>{
              try{
                setListBusy(true);
                // Detect provider
                const a = await api.post('/onboarding/analyze', { tenant_id: await getTenant() });
                const connected = (a?.summary?.connected || {}) as Record<string,string>;
                const provider = String(connected.square||'')==='connected' ? 'square' : (String(connected.acuity||'')==='connected' ? 'acuity' : 'square');
                await api.post('/integrations/refresh', { tenant_id: await getTenant(), provider });
                await loadList();
                try { showToast({ title:'Refreshed', description: provider.toUpperCase() }); } catch {}
              } catch(e:any){ setStatus(String(e?.message||e)); }
              finally { setListBusy(false); }
            }}>Refresh</Button>
          </div>
          <div className="overflow-auto rounded-md border" style={{ maxHeight: 'calc(100dvh - 220px)' }}>
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
                      <div className="flex items-center gap-2" data-guide="clients-actions">
                        <button className="underline truncate max-w-[14rem]" title={nameOf(r)} onClick={()=> setExpert({open:true, contact:r})}>{nameOf(r)}</button>
                        <Button variant="outline" size="sm" className="ml-1" aria-label="Text client" onClick={async()=>{
                          try{
                            // Build a friendly, tone-only draft (no explicit numbers)
                            const name = nameOf(r).split(' ')[0] || 'there';
                            const now = Math.floor(Date.now()/1000);
                            const daysSince = r.last_visit ? Math.max(0, Math.floor((now - Number(r.last_visit))/86400)) : 0;
                            const recency = daysSince > 60 ? "It's been a while — " : daysSince > 30 ? "Just a quick check‑in — " : "";
                            const draft = `Hi ${name}! ${recency}I have a couple openings coming up and thought of you. Want me to send a few times?`;
                            try{ await navigator.clipboard.writeText(draft); } catch {}
                            // Best effort: try to fetch phone via search (may be masked in this environment)
                          try{
                            const tid = await getTenant();
                              const s = await api.get(`/contacts/search?tenant_id=${encodeURIComponent(tid)}&q=${encodeURIComponent(r.contact_id)}&limit=1`);
                              const phone = String((s?.items||[])[0]?.phone||'').trim();
                              if (phone) { try{ await navigator.clipboard.writeText(phone); showToast({ title:'Phone copied' }); } catch {} }
                            } catch {}
                            const qs = new URLSearchParams({ cid: r.contact_id, body: draft });
                            window.location.assign(`/messages?${qs.toString()}`);
                          }catch(e:any){ setStatus(String(e?.message||e)); }
                        }}>Text</Button>
                        <Button variant="outline" size="sm" aria-label="Email client" onClick={async()=>{
                          try{
                            // Try to fetch email (may be masked); copy if present
                            let copied = false;
                          try{
                            const tid = await getTenant();
                              const s = await api.get(`/contacts/search?tenant_id=${encodeURIComponent(tid)}&q=${encodeURIComponent(r.contact_id)}&limit=1`);
                              const email = String((s?.items||[])[0]?.email||'').trim();
                              if (email) { await navigator.clipboard.writeText(email); copied = true; }
                            } catch {}
                            showToast({ title: copied ? 'Email copied' : 'Email copied', description: copied ? undefined : 'Best‑effort: address may be masked.' });
                          }catch(e:any){ setStatus(String(e?.message||e)); }
                        }}>Email</Button>
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
                    <div className="max-w-md"><EmptyState title="No clients yet" description="Import from Booking to see clients here.">
                      
                      <Button variant="outline" size="sm" onClick={()=> startGuide('contacts')}>{UI_STRINGS.ctas.tertiary.guideMe}</Button>
                    </EmptyState></div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div data-guide="clients-pagination">
            <Pager page={page} pageSize={PAGE_SIZE} total={total||items.length} onPrev={()=> setPage(p=> Math.max(1, p-1))} onNext={()=> setPage(p=> Math.min(Math.ceil((total||items.length)/PAGE_SIZE)||1, p+1))} />
          </div>
        </section>

        {/* Consent & Data and FAQ removed per spec to simplify the pane */}
      </div>

      {busy ? <Skeleton className="h-8" /> : <pre className="whitespace-pre-wrap text-sm text-slate-700" data-guide="status">{status || 'No recent actions.'}</pre>}
      {dupePreview.length>0 && (
        <div className="mt-2 rounded-2xl border bg-white p-3 text-sm">
          <div className="font-medium">Duplicate groups</div>
          <div className="text-[11px] text-slate-600 mb-1">Preview only — Run dedupe to remove duplicates.</div>
          <div className="grid gap-2 max-h-64 overflow-auto">
            {dupePreview.slice(0,20).map((g,i)=>(
              <div className="rounded-md border bg-slate-50 p-2" key={i}>
                <div className="text-xs font-medium text-slate-800">Group {i+1}: {g.count} records</div>
                <ul className="mt-1 text-xs list-disc ml-5">
                  {g.items.slice(0,5).map((it,j)=>(
                    <li key={j}>{(it.display_name||`${it.first_name||''} ${it.last_name||''}`||'Client').trim()} · Txns {Number(it.txn_count||0)} · LTV ${(Number(it.lifetime_cents||0)/100).toFixed(2)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {importing && (
        <div className="fixed inset-0 z-30 grid place-items-center">
          <div aria-hidden className="absolute inset-0 bg-black/20" />
          <div className="relative rounded-2xl border border-[var(--border)] bg-white p-4 shadow-soft text-sm">
            Importing booking data… This usually finishes in under a minute.
          </div>
        </div>
      )}
      {importReport && (
        <div className="mt-2 rounded-2xl border bg-white p-3 text-sm">
          <div className="font-medium">Import summary</div>
          <div className="text-slate-700 text-xs mt-1">Provider: {importReport.provider||'auto'}</div>
          <div className="text-slate-700 text-xs">Imported: {Number(importReport.imported||0)}, Updated: {Number(importReport.updated||0)}{typeof importReport.skipped==='number' ? `, Skipped: ${importReport.skipped}`:''}</div>
          {importReport.reasonTop && <div className="text-slate-600 text-[11px] mt-1">Top skip reason: {importReport.reasonTop}</div>}
          <div className="mt-2">
            <Button variant="outline" size="sm" onClick={async()=>{
              try{
                const lines = [
                  `Provider: ${importReport?.provider||'auto'}`,
                  `Imported: ${Number(importReport?.imported||0)}`,
                  `Updated: ${Number(importReport?.updated||0)}`,
                  typeof importReport?.skipped==='number' ? `Skipped: ${importReport?.skipped}` : '',
                  importReport?.reasonTop ? `Top reason: ${importReport?.reasonTop}` : ''
                ].filter(Boolean).join('\n');
                await navigator.clipboard.writeText(lines);
                showToast({ title:'Copied', description:'Import summary copied' });
              }catch{}
            }}>Copy report</Button>
          </div>
        </div>
      )}
      {expert.open && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/20" onClick={()=> setExpert({open:false})} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl border-l p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-ink-900">Client Expert</div>
              <button className="text-slate-600 hover:text-slate-800" onClick={()=> setExpert({open:false})}>Close</button>
            </div>
            <div className="text-xs text-slate-700">Selected: {expert.contact?.display_name || expert.contact?.contact_id}</div>
            <div className="mt-2 border rounded-md overflow-hidden" style={{height: '60vh'}}>
              <iframe title="AskVX" src={`/ask?embed=1&mode=support`} className="w-full h-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
