import { useEffect, useState } from 'react';
import { api, getTenant } from '../lib/api';
import Button from '../components/ui/Button';
import { Table, THead, TR, TH, TD } from '../components/ui/Table';
import Skeleton from '../components/ui/Skeleton';
import ConfirmDialog from '../components/ui/ConfirmDialog';

export default function Approvals(){
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmAll, setConfirmAll] = useState<null | 'approve' | 'reject'>(null);
  const [q, setQ] = useState('');
  const [onlyPending, setOnlyPending] = useState(true);
  const [selected, setSelected] = useState<any|null>(null);
  const load = async () => {
    try{
      const r = await api.get(`/approvals?tenant_id=${encodeURIComponent(await getTenant())}`);
      // API returns an array; also support {items: []}
      setItems(Array.isArray(r) ? r : (r.items||[]));
    } catch(e:any){ setStatus(String(e?.message||e)); }
  };
  useEffect(()=>{ (async()=>{ try { setLoading(true); await load(); } finally { setLoading(false); } })(); },[]);
  const act = async (id:string, decision:'approve'|'reject') => {
    try{
      const r = await api.post('/approvals/action',{ tenant_id: await getTenant(), approval_id: Number(id), action: decision });
      setStatus(JSON.stringify(r));
      await load();
    } catch(e:any){ setStatus(String(e?.message||e)); }
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

  const humanTool = (r:any) => r.tool || r.tool_name || r.kind || r.type || 'tool';
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
    return (
      <div className="rounded-2xl p-4 bg-white/70 backdrop-blur border border-white/70 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-slate-900 font-medium">Approval #{row.id}</div>
            <div className="text-xs text-slate-600">{tool} • {row.status||'pending'}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={()=>act(row.id,'approve')}>Approve</Button>
            <Button variant="outline" onClick={()=>act(row.id,'reject')}>Reject</Button>
          </div>
        </div>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
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
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Approvals</h3>
      <div className="text-xs text-slate-600">When BrandVX needs your OK for an action, it shows up here. Review the details and Approve or Reject.</div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input className="border rounded-md px-2 py-1 bg-white" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={onlyPending} onChange={e=>setOnlyPending(e.target.checked)} /> Show only pending</label>
      </div>
      <pre className="whitespace-pre-wrap text-sm text-slate-700">{status}</pre>
      {!loading && items.length > 0 && (
        <div className="flex gap-2">
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
      (items.filter(f=> (onlyPending ? (f.status||'pending')==='pending' : true) && (q? JSON.stringify(f).toLowerCase().includes(q.toLowerCase()): true)).length === 0) ? (
        <div className="rounded-xl border bg-white shadow-sm p-6 text-center text-slate-600">
          No approvals waiting. New actions that affect clients will appear here for your review.
        </div>
      ) : (
        <>
          <Table>
            <THead>
              <TR><TH>ID</TH><TH>Status</TH><TH>Type</TH><TH>Payload</TH><TH>Action</TH></TR>
            </THead>
            <tbody>
              {items.filter(f=> (onlyPending ? (f.status||'pending')==='pending' : true) && (q? JSON.stringify(f).toLowerCase().includes(q.toLowerCase()): true)).map((r:any)=> (
                <TR key={r.id} onClick={()=> setSelected(r)} className={selected?.id===r.id ? 'bg-pink-50/50' : undefined}>
                  <TD>{r.id}</TD>
                  <TD>{r.status||'pending'}</TD>
                  <TD>{humanTool(r)}</TD>
                  <TD><code className="text-xs">{JSON.stringify(r.params||r.payload)}</code></TD>
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
          {selected && (
            <div className="mt-4">
              <ItemDetails row={selected} />
            </div>
          )}
        </>
      )
      )}
    </div>
  );
}

