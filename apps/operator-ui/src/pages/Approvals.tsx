import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import Button from '../components/ui/Button';
import { startGuide } from '../lib/guide';
import { Table, THead, TR, TH, TD } from '../components/ui/Table';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pager from '../components/ui/Pager';

export default function Approvals(){
  const [items, setItems] = useState<any[]>([]);
  const [todoItems, setTodoItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmAll, setConfirmAll] = useState<null | 'approve' | 'reject'>(null);
  // Search removed in simplified To‑Do view
  // const [q] = useState('');
  const [onlyPending, setOnlyPending] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  // labels removed in simplified view
  const [suggested, setSuggested] = useState<any[]>([]);
  const [todoStatus, setTodoStatus] = useState<'pending'|'all'>('pending');
  const [todoType, setTodoType] = useState<string>('all');
  const loadSuggested = async () => {
    try{
      const s = await api.get(`/settings`);
      const arr = Array.isArray(s?.data?.suggested_campaigns) ? s.data.suggested_campaigns : [];
      setSuggested(arr);
    } catch {}
  };
  const load = async () => {
    try{
      const r = await api.get(`/approvals`);
      // API returns an array; also support {items: []}
      setItems(Array.isArray(r) ? r : (r.items||[]));
      setStatus('');
    } catch(e:any){ setStatus('Unable to load approvals right now. Please retry.'); }
  };
  const loadTodo = async () => {
    try{
      const qs = [
        `status=${encodeURIComponent(todoStatus)}`,
        (todoType && todoType !== 'all') ? `type=${encodeURIComponent(todoType)}` : ''
      ].filter(Boolean).join('&');
      const r = await api.get(`/todo/list${qs? '?' + qs:''}`);
      setTodoItems(Array.isArray(r?.items)? r.items : []);
    } catch { setTodoItems([]); }
  };
  useEffect(()=>{ (async()=>{ try { setLoading(true); await Promise.all([load(), loadSuggested(), loadTodo()]); } finally { setLoading(false); } })(); },[]);
  useEffect(()=>{ (async()=>{ try { setLoading(true); await loadTodo(); setPage(1);} finally { setLoading(false); } })(); }, [todoStatus, todoType]);
  // schema labels fetch removed
  // action wiring trimmed in simplified view
  const removeSuggested = async (sid: string) => {
    try{
      const s = await api.get(`/settings`);
      const data = s?.data || {};
      const list = Array.isArray(data.suggested_campaigns) ? data.suggested_campaigns : [];
      const next = { ...data, suggested_campaigns: list.filter((x:any)=> x?.id !== sid) };
      await api.post('/settings', next);
      await loadSuggested();
    } catch(e:any){ setStatus('Update failed: '+String(e?.message||e)); }
  };
  const bulk = async (decision:'approve'|'reject') => {
    try{
      setStatus('');
      for (const it of items) {
        await api.post('/approvals/action',{ approval_id: Number(it.id), action: decision });
      }
      await load();
      setStatus(`Bulk ${decision} completed`);
    } catch(e:any){ setStatus(String(e?.message||e)); }
  };

  const ackTodo = async (id:number) => {
    try{
      await api.post('/todo/ack', { id });
      await loadTodo();
    } catch(e:any){ setStatus(String(e?.message||e)); }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center">
        <h3 className="text-lg font-semibold">To‑Do</h3>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={()=> startGuide('approvals')}>Guide me</Button>
          <Button variant="outline" size="sm" onClick={()=>{ window.location.href='/ask'; }}>AskVX</Button>
        </div>
      </div>
      <div className="text-xs text-slate-600">When BrandVX needs your OK for an action, it shows up here. Review the details and Approve or Reject.</div>
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
                  <TD>{r.friendly_name || r.display_name || (r.contact_id ? 'Client' : '')}</TD>
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
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <div className="inline-flex rounded-full bg-white overflow-hidden border">
              {(['pending','all'] as const).map(s=> (
                <button key={s} className={`px-3 py-1 ${todoStatus===s?'bg-slate-900 text-white':'text-slate-700'}`} onClick={()=> setTodoStatus(s)}>{s}</button>
              ))}
            </div>
            <select className="text-xs border rounded-md px-2 py-1 bg-white" value={todoType} onChange={e=> setTodoType(e.target.value)} aria-label="Filter by type">
              <option value="all">All types</option>
              <option value="approval">Approval</option>
              <option value="followup">Follow‑up</option>
              <option value="import">Import</option>
              <option value="calendar">Calendar</option>
              <option value="billing">Billing</option>
            </select>
          </div>
          {todoItems.length === 0 ? (
            <div className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
              <EmptyState title="Nothing pending" description="When VX needs your OK, items will appear here." />
            </div>
          ) : (
            <>
              <Table data-guide="table">
                <THead>
                  <TR><TH>ID</TH><TH>Type</TH><TH>Title</TH><TH>Created</TH><TH>Actions</TH></TR>
                </THead>
                <tbody className="divide-y">
                  {todoItems.slice((page-1)*pageSize, page*pageSize).map((r:any)=> (
                    <TR key={r.id}>
                      <TD>{r.id}</TD>
                      <TD>{r.type}</TD>
                      <TD className="truncate max-w-[16rem]"><span title={r.title}>{r.title}</span></TD>
                      <TD>{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</TD>
                      <TD><Button variant="outline" size="sm" onClick={()=> ackTodo(Number(r.id))}>Mark done</Button></TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
              <Pager page={page} pageSize={pageSize} total={todoItems.length} onPrev={()=> setPage(p=> Math.max(1, p-1))} onNext={()=> setPage(p=> (p*pageSize<todoItems.length? p+1: p))} />
            </>
          )}
        </>
      )}
    </div>
  );
}
