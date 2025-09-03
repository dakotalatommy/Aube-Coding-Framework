import { useEffect, useState } from 'react';
import { api, getTenant } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import Button from '../components/ui/Button';
import { startGuide } from '../lib/guide';
import { Table, THead, TR, TH, TD } from '../components/ui/Table';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pager from '../components/ui/Pager';

export default function Approvals(){
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmAll, setConfirmAll] = useState<null | 'approve' | 'reject'>(null);
  // Search removed in simplified To‑Do view
  // const [q] = useState('');
  const [onlyPending, setOnlyPending] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selected, setSelected] = useState<any|null>(null);
  const [labels, setLabels] = useState<Record<string,string>>({});
  const [authHint, setAuthHint] = useState<string>('');
  const [suggested, setSuggested] = useState<any[]>([]);
  const loadSuggested = async () => {
    try{
      const tid = await getTenant();
      const s = await api.get(`/settings?tenant_id=${encodeURIComponent(tid)}`);
      const arr = Array.isArray(s?.data?.suggested_campaigns) ? s.data.suggested_campaigns : [];
      setSuggested(arr);
    } catch {}
  };
  const load = async () => {
    try{
      const tid = await getTenant();
      if (!tid) { setAuthHint('Sign in to view your To‑Do.'); setItems([]); return; }
      const r = await api.get(`/approvals?tenant_id=${encodeURIComponent(tid)}`);
      // API returns an array; also support {items: []}
      setItems(Array.isArray(r) ? r : (r.items||[]));
      setStatus('');
    } catch(e:any){ setStatus('Unable to load approvals right now. Please retry.'); }
  };
  useEffect(()=>{ (async()=>{ try { setLoading(true); await Promise.all([load(), loadSuggested()]); } finally { setLoading(false); } })(); },[]);
  useEffect(()=>{ (async()=>{ try { const s = await api.get('/ai/tools/schema_human'); const map:Record<string,string>={}; if (Array.isArray(s?.tools)) { for (const t of s.tools) { map[String(t?.id||t?.name||'')] = String(t?.label||t?.title||''); } } setLabels(map);} catch {} })(); },[]);
  const act = async (id:string, decision:'approve'|'reject') => {
    try{
      try { (window as any).Sentry?.addBreadcrumb?.({ category:'todo', level:'info', message:`${decision} ${id}` }); } catch {}
      const r = await api.post('/approvals/action',{ tenant_id: await getTenant(), approval_id: Number(id), action: decision });
      setStatus(JSON.stringify(r));
      try { trackEvent(decision==='approve' ? 'todo.approve' : 'todo.reject', { id: Number(id) }); } catch {}
      await load();
    } catch(e:any){ setStatus(String(e?.message||e)); }
  };
  const removeSuggested = async (sid: string) => {
    try{
      const tid = await getTenant();
      const s = await api.get(`/settings?tenant_id=${encodeURIComponent(tid)}`);
      const data = s?.data || {};
      const list = Array.isArray(data.suggested_campaigns) ? data.suggested_campaigns : [];
      const next = { ...data, suggested_campaigns: list.filter((x:any)=> x?.id !== sid) };
      await api.post('/settings', { tenant_id: tid, ...next });
      await loadSuggested();
    } catch(e:any){ setStatus('Update failed: '+String(e?.message||e)); }
  };
  const bulk = async (decision:'approve'|'reject') => {
    if (!window.confirm(`Are you sure you want to ${decision} all (${items.length})?`)) return;
    try{
      setStatus('');
      for (const it of items) {
        await api.post('/approvals/action',{ tenant_id: await getTenant(), approval_id: Number(it.id), action: decision });
      }
      await load();
      setStatus(`Bulk ${decision} completed`);
    } catch(e:any){ setStatus(String(e?.message||e)); }
  };

  const humanTool = (r:any) => {
    const n = r.tool || r.tool_name || r.kind || r.type || 'tool';
    return labels[n] || n;
  };
  const groupOf = (r:any): string => {
    try{
      const raw = String(r.tool || r.tool_name || r.kind || r.type || '').toLowerCase();
      if (!raw) return 'other';
      if (raw.startsWith('todo.')) {
        const seg = raw.split('.')[1]||'';
        if (['billing','integration','reminder','security'].includes(seg)) return seg;
        if (seg.startsWith('billing')) return 'billing';
        if (seg.startsWith('integration')) return 'integration';
        if (seg.startsWith('reminder')) return 'reminder';
        if (seg.startsWith('security')) return 'security';
        return 'other';
      }
      if (raw.includes('billing') || raw.includes('stripe')) return 'billing';
      if (raw.includes('oauth') || raw.includes('integration') || raw.includes('connectors')) return 'integration';
      if (raw.includes('remind') || raw.startsWith('appointments.')) return 'reminder';
      if (raw.includes('security') || raw.includes('pii') || raw.includes('audit')) return 'security';
      return 'other';
    }catch{ return 'other'; }
  };
  const parseParams = (r:any) => {
    try{
      if (r.params && typeof r.params !== 'string') return r.params;
      const raw = r.params_json || r.params || r.payload || '{}';
      return JSON.parse(typeof raw === 'string' ? raw : String(raw));
    } catch{ return {}; }
  };

  const ItemDetails = ({ row }: { row:any }) => {
    const tool = humanTool(row);
    const params = parseParams(row);
    const result = (()=>{ try{ return typeof row.result === 'string' ? JSON.parse(row.result) : (row.result||{});}catch{ return row.result||{} }})();
    const diff = (()=>{
      try{
        const before = params?.before || params?.old || null;
        const after = params?.after || params?.new || null;
        if (!before || !after) return null;
        const out: Array<{key:string; from:any; to:any}> = [];
        const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
        for (const k of keys){
          const a = (before as any)[k];
          const b = (after as any)[k];
          if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ key: k, from: a, to: b });
        }
        return out;
      } catch { return null; }
    })();
    return (
      <div className="rounded-2xl p-4 bg-white/70 backdrop-blur border border-white/70 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-slate-900 font-medium">To‑Do #{row.id}</div>
            <div className="text-xs text-slate-600">{tool} • {row.status||'pending'}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={()=>act(row.id,'approve')}>Approve</Button>
            <Button variant="outline" onClick={()=>act(row.id,'reject')}>Reject</Button>
          </div>
        </div>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          {diff && diff.length>0 && (
            <div className="rounded-xl border bg-white p-3 sm:col-span-2">
              <div className="font-medium text-slate-800 text-sm">Preview changes</div>
              <div className="mt-2 text-xs text-slate-700">
                {diff.map((d,i)=> (
                  <div key={i} className="grid grid-cols-3 gap-2 items-start border-t first:border-t-0 py-1">
                    <div className="text-slate-600">{d.key}</div>
                    <pre className="col-span-1 whitespace-pre-wrap bg-rose-50/60 border border-rose-100 rounded px-2 py-1">{JSON.stringify(d.from, null, 2)}</pre>
                    <pre className="col-span-1 whitespace-pre-wrap bg-emerald-50/60 border border-emerald-100 rounded px-2 py-1">{JSON.stringify(d.to, null, 2)}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}
          {row.explain && (
            <div className="rounded-xl border bg-white p-3 sm:col-span-2">
              <div className="font-medium text-slate-800 text-sm">Explanation</div>
              <div className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{String(row.explain)}</div>
            </div>
          )}
          <div className="rounded-xl border bg-white p-3">
            <div className="font-medium text-slate-800 text-sm">Summary</div>
            <div className="text-sm text-slate-700 mt-1">
              {tool === 'social.schedule.14days' && (
                <div>
                  This will draft a 14‑day social posting plan for Instagram and Facebook. No posts will be published until you confirm the scheduled items.
                </div>
              )}
              {tool === 'contacts.dedupe' && (
                <div>Deduplicate contacts by email/phone hashes for tenant {params.tenant_id || 'current'}.</div>
              )}
              {tool === 'campaigns.dormant.start' && (
                <div>Start a dormant reactivation campaign for inactive clients.</div>
              )}
              {!['social.schedule.14days','contacts.dedupe','campaigns.dormant.start'].includes(tool) && (
                <div>Review and approve this action.</div>
              )}
            </div>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <div className="font-medium text-slate-800 text-sm">Params</div>
            <pre className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{JSON.stringify(params, null, 2)}</pre>
          </div>
          {result && Object.keys(result||{}).length>0 && (
            <div className="rounded-xl border bg-white p-3">
              <div className="font-medium text-slate-800 text-sm">Result (last run)</div>
              <pre className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
          {/* Milestone share slot */}
          <div className="rounded-xl border bg-white p-3 sm:col-span-2">
            <div className="font-medium text-slate-800 text-sm">Shareable milestone</div>
            <div className="text-sm text-slate-700 mt-1">When this action succeeds, celebrate it with your audience.</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <button className="px-2 py-1 rounded-md border bg-white" onClick={()=>{ try{ navigator.clipboard.writeText('We just approved our first 14‑day plan — gentle, human messages only. #BrandVX'); }catch{} }}>Copy caption</button>
              <button className="px-2 py-1 rounded-md border bg-white" onClick={()=>{ try{ navigator.clipboard.writeText(window.location.origin+'/s/demo'); }catch{} }}>Copy share link</button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center">
        <h3 className="text-lg font-semibold">To‑Do</h3>
        <Button variant="outline" size="sm" className="ml-auto" onClick={()=> startGuide('approvals')}>Guide me</Button>
      </div>
      <div className="text-xs text-slate-600">When BrandVX needs your OK for an action, it shows up here. Review the details and Approve or Reject.</div>
      {authHint && (
        <div className="rounded-md border bg-amber-50 text-amber-800 px-2 py-1 text-xs inline-block">{authHint}</div>
      )}
      {suggested.length > 0 && (
        <div className="mt-3 rounded-xl border bg-white p-3">
          <div className="text-sm font-medium text-slate-800">Suggested Campaigns (beta)</div>
          <div className="text-xs text-slate-600">Saved from Messages in recommend‑only mode — review or remove.</div>
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Contact</TH>
                <TH>Channel</TH>
                <TH>Subject</TH>
                <TH>Body</TH>
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <tbody className="divide-y">
              {suggested.map((r:any)=> (
                <TR key={r.id}>
                  <TD>{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</TD>
                  <TD>{r.contact_id||''}</TD>
                  <TD>{r.channel||''}</TD>
                  <TD>{r.subject||''}</TD>
                  <TD className="max-w-[22rem] truncate">{r.body||''}</TD>
                  <TD><Button variant="outline" size="sm" onClick={()=> removeSuggested(r.id)}>Remove</Button></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm" data-guide="filters">
        <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={onlyPending} onChange={e=>setOnlyPending(e.target.checked)} /> Show only pending</label>
        <select className="text-xs border rounded-md px-2 py-1 bg-white" value={typeFilter} onChange={e=>{ setTypeFilter(e.target.value); setPage(1); }} aria-label="Filter by type">
          <option value="all">All types</option>
          <option value="billing">Billing</option>
          <option value="integration">Integrations</option>
          <option value="reminder">Reminders</option>
          <option value="security">Security</option>
        </select>
      </div>
      <pre className="whitespace-pre-wrap text-sm text-slate-700">{status}</pre>
      {!loading && items.length > 0 && (
        <div className="flex gap-2" data-guide="actions">
          <Button variant="outline" onClick={()=>setConfirmAll('approve')}>Approve All</Button>
          <Button variant="outline" onClick={()=>setConfirmAll('reject')}>Reject All</Button>
        </div>
      )}
      <ConfirmDialog
        open={!!confirmAll}
        onOpenChange={(o)=> setConfirmAll(o ? confirmAll : null)}
        title={confirmAll === 'approve' ? 'Approve all pending items?' : 'Reject all pending items?'}
        description={`This will ${confirmAll||''} ${items.length} item(s). You can’t undo this action.`}
        confirmText={confirmAll === 'approve' ? 'Approve all' : 'Reject all'}
        onConfirm={()=> confirmAll && bulk(confirmAll)}
      />
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-32" />
        </div>
      ) : (
      (items.filter(f=> (onlyPending ? (f.status||'pending')==='pending' : true) && (typeFilter==='all' ? true : groupOf(f)===typeFilter)).length === 0) ? (
        <div className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <EmptyState title="No To‑Do items" description="When VX needs your OK, items will appear here." />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-end gap-2 text-xs mb-2">
            <button className="px-2 py-1 rounded-md border bg-white disabled:opacity-50" onClick={()=> setPage(p=> Math.max(0, p-1))} disabled={page<=0}>&larr; Prev</button>
            <button className="px-2 py-1 rounded-md border bg-white disabled:opacity-50" onClick={()=> setPage(p=> p+1)} disabled={(page+1)*pageSize >= items.length}>Next &rarr;</button>
          </div>
          <Table data-guide="table">
            <THead>
              <TR><TH>ID</TH><TH>Status</TH><TH>Type</TH><TH>Payload</TH><TH>Action</TH></TR>
            </THead>
            <tbody>
              {items.filter(f=> (onlyPending ? (f.status||'pending')==='pending' : true) && (typeFilter==='all' ? true : groupOf(f)===typeFilter)).slice((page-1)*pageSize, page*pageSize).map((r:any)=> (
                <TR key={r.id} onClick={()=> setSelected(r)} className={selected?.id===r.id ? 'bg-pink-50/50' : undefined}>
                  <TD>{r.id}</TD>
                  <TD>{r.status||'pending'}</TD>
                  <TD>
                    <span className="inline-flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full border text-[10px] bg-slate-50 border-slate-200 text-slate-700">{humanTool(r)}</span>
                      {/* severity chip if present */}
                      {(()=>{ try{ const p = parseParams(r); const sev = String(p?.severity||''); if(!sev) return null; const cls = sev==='error' ? 'bg-red-50 border-red-200 text-red-800' : (sev==='warn' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'); return <span className={`px-2 py-0.5 rounded-full border text-[10px] ${cls}`}>{sev}</span>; }catch{return null} })()}
                    </span>
                  </TD>
                  <TD>
                    <code className="text-xs truncate block max-w-[22rem]" title={JSON.stringify(r.params||r.payload)}>{JSON.stringify(r.params||r.payload)}</code>
                  </TD>
                  <TD>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={()=>act(r.id,'approve')}>Approve</Button>
                      <Button variant="outline" onClick={()=>act(r.id,'reject')}>Reject</Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <Pager
            page={page}
            pageSize={pageSize}
            total={items.filter(f=> (onlyPending ? (f.status||'pending')==='pending' : true) && (typeFilter==='all' ? true : groupOf(f)===typeFilter)).length}
            onPrev={()=> setPage(p=> Math.max(1, p-1))}
            onNext={()=> setPage(p=> ((p*pageSize) < items.filter(f=> (onlyPending ? (f.status||'pending')==='pending' : true)).length ? p+1 : p))}
          />
          {selected && (
            <div className="mt-4" data-guide="details">
              <ItemDetails row={selected} />
            </div>
          )}
        </>
      )
      )}
    </div>
  );
}

