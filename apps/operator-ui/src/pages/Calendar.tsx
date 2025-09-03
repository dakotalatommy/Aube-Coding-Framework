import { useEffect, useState } from 'react';
import { api, getTenant } from '../lib/api';
import { startGuide } from '../lib/guide';
import { UI_STRINGS } from '../lib/strings';
import Skeleton from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import EmptyState from '../components/ui/EmptyState';
import Pager from '../components/ui/Pager';

export default function Calendar(){
  const { toastSuccess, toastError, showToast } = useToast();
  const [events, setEvents] = useState<any[]>([]);
  const [lastSync, setLastSync] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState<string>('all');
  const [merged, setMerged] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const pageSize = 12;
  const [lastAnalyzed, setLastAnalyzed] = useState<number|undefined>(undefined);
  const [showApple, setShowApple] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [actionBusy, setActionBusy] = useState<boolean>(false);
  useEffect(()=>{
    (async()=>{ try{ const r = await api.get(`/calendar/list?tenant_id=${encodeURIComponent(await getTenant())}`); setEvents(r?.events||[]); setLastSync(r?.last_sync||{}); setLastUpdated(Date.now()); } finally{ setLoading(false); } })();
  },[]);
  useEffect(()=>{ try{ const sp = new URLSearchParams(window.location.search); if (sp.get('tour')==='1') startGuide('calendar'); } catch {} },[]);
  useEffect(()=>{ (async()=>{ try{ const a = await api.post('/onboarding/analyze', { tenant_id: await getTenant() }); if (a?.summary?.ts) setLastAnalyzed(Number(a.summary.ts)); } catch{} })(); },[]);
  // Hide Apple calendar until ready (always off for now)
  useEffect(()=>{ try { setShowApple(false); } catch {} }, [lastSync, JSON.stringify(events)]);
  const syncNow = async (prov?: string) => {
    const r = await api.post('/ai/tools/execute', { tenant_id: await getTenant(), name:'calendar.sync', params:{ tenant_id: await getTenant(), provider: prov }, require_approval: false });
    try{ if (r?.status === 'ok' || r?.status === 'pending') toastSuccess('Calendar sync started', prov ? `Provider: ${prov}` : undefined); else toastError('Calendar sync failed', r?.error || r?.status); } catch {}
    setStatus(new URLSearchParams(window.location.search).has('dev') ? JSON.stringify(r) : '');
    const l = await api.get(`/calendar/list?tenant_id=${encodeURIComponent(await getTenant())}`);
    setEvents(l?.events||[]); setLastSync(l?.last_sync||{});
    try { showToast({ title:'Sync started', description: prov || 'all' }); } catch {}
    setLastUpdated(Date.now());
  };
  const mergeDupes = async () => {
    const r = await api.post('/ai/tools/execute', { tenant_id: await getTenant(), name:'calendar.merge', params:{ tenant_id: await getTenant() }, require_approval: false });
    setMerged((r as any)?.merged ?? 0);
    const l = await api.get(`/calendar/list?tenant_id=${encodeURIComponent(await getTenant())}`);
    setEvents(l?.events||[]);
    try { showToast({ title:'Merged bookings' }); } catch {}
    setLastUpdated(Date.now());
  };
  const reschedule = async (evt:any, deltaMin:number) => {
    try{
      setActionBusy(true);
      const start = Number(evt.start_ts||0) + deltaMin*60;
      const payload:any = { tenant_id: await getTenant(), start_ts: start };
      if (evt.provider && evt.id) { payload.provider = String(evt.provider); payload.provider_event_id = String(evt.id); }
      else if (evt.external_ref) { payload.external_ref = String(evt.external_ref); }
      const r = await api.post('/ai/tools/execute', { tenant_id: await getTenant(), name:'calendar.reschedule', params: payload, require_approval: true });
      if (r?.status==='ok' || r?.status==='pending') { try { toastSuccess('Rescheduled', 'Queued'); } catch {} }
      else { try { toastError('Reschedule failed', String(r?.status||'error')); } catch {} }
      const l = await api.get(`/calendar/list?tenant_id=${encodeURIComponent(await getTenant())}`);
      setEvents(l?.events||[]); setLastUpdated(Date.now());
    }catch(e:any){ try{ toastError('Reschedule failed', String(e?.message||e)); }catch{} }
    finally{ setActionBusy(false); }
  };
  const cancel = async (evt:any) => {
    try{
      setActionBusy(true);
      const payload:any = { tenant_id: await getTenant() };
      if (evt.provider && evt.id) { payload.provider = String(evt.provider); payload.provider_event_id = String(evt.id); }
      else if (evt.external_ref) { payload.external_ref = String(evt.external_ref); }
      const r = await api.post('/ai/tools/execute', { tenant_id: await getTenant(), name:'calendar.cancel', params: payload, require_approval: true });
      if (r?.status==='ok' || r?.status==='pending') { try { toastSuccess('Canceled', 'Queued'); } catch {} }
      else { try { toastError('Cancel failed', String(r?.status||'error')); } catch {} }
      const l = await api.get(`/calendar/list?tenant_id=${encodeURIComponent(await getTenant())}`);
      setEvents(l?.events||[]); setLastUpdated(Date.now());
    }catch(e:any){ try{ toastError('Cancel failed', String(e?.message||e)); }catch{} }
    finally{ setActionBusy(false); }
  };
  if (loading) return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-8" />
      <Skeleton className="h-40" />
      <Skeleton className="h-8" />
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center">
        <h3 className="text-lg font-semibold">Calendar</h3>
        <button className="ml-auto text-sm text-slate-600 hover:underline" aria-label={UI_STRINGS.a11y.buttons.guideCalendar} onClick={()=> startGuide('calendar')}>{UI_STRINGS.ctas.tertiary.guideMe}</button>
      </div>
      <div className="text-[11px] text-slate-600">Note: Scheduling from BrandVX is disabled. Calendar merges are read‑only.</div>
      {lastAnalyzed && (
        <div className="text-[11px] text-slate-500">Last analyzed: {new Date(lastAnalyzed*1000).toLocaleString()}</div>
      )}
      {!!lastUpdated && (
        <div className="text-[11px] text-slate-500">Updated {new Date(lastUpdated).toLocaleTimeString()}</div>
      )}
      {/* Weekly plan band: 7 vertical sections with dividers (compact height) */}
      <div className="rounded-xl border bg-white/90 backdrop-blur p-3 shadow-sm" role="region" aria-label="Weekly plan">
        <div className="grid grid-cols-7 gap-2 text-xs text-slate-600 mb-2">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> <div key={d} className="text-center font-medium">{d}</div>)}
        </div>
        <div className="relative rounded-lg border bg-white overflow-hidden" style={{ height: 'min(14vh, 140px)' }}>
          {Array.from({length:6}).map((_, i)=> (
            <div
              key={i}
              aria-hidden
              className="absolute top-0 bottom-0 bg-slate-400/50"
              style={{ left: `${((i+1) * (100/7))}%`, width: '1px' }}
            />
          ))}
        </div>
      </div>
      {/* Demo: 7-day recommendations view */}
      <div className="rounded-xl border bg-white p-3" aria-label="7-day recommendations" data-guide="list">
        <div className="text-sm font-medium text-slate-800 mb-2">Recommendations (demo)</div>
        <div className="text-xs text-slate-600 mb-2">A 7‑day plan to get momentum quickly.</div>
        <ul className="list-disc ml-5 text-sm text-slate-700">
          <li>Day 1: Send 5 warm‑lead follow‑ups</li>
          <li>Day 2: Confirm Friday appointments</li>
          <li>Day 3: Post 1 service tip on Instagram</li>
          <li>Day 4: Text no‑shows a friendly rebook link</li>
          <li>Day 5: Share before/after from this week</li>
          <li>Day 6: Message 2 dormant clients</li>
          <li>Day 7: Review next week’s openings</li>
        </ul>
      </div>
      {/* Live: first 3 days quick start */}
      <div className="rounded-xl border bg-white p-3" aria-label="first 3 days" data-guide="first3">
        <div className="text-sm font-medium text-slate-800 mb-2">Your first 3 days</div>
        <ul className="list-disc ml-5 text-sm text-slate-700">
          <li>Day 1 (10‑Minute Wow): confirm this week’s bookings</li>
          <li>Day 2: send 3 warm‑lead follow‑ups</li>
          <li>Day 3: draft next week’s social (14‑day plan ready)</li>
        </ul>
      </div>
      <div className="flex items-center gap-2 text-sm" data-guide="filters">
        <span className="text-slate-600">Filter:</span>
        <select className="border rounded-md px-2 py-1 bg-white" value={provider} onChange={e=>setProvider(e.target.value)}>
          <option value="all">All</option>
          <option value="google">Google</option>
          {showApple && <option value="apple">Apple</option>}
          <option value="square">Square</option>
          <option value="acuity">Acuity</option>
        </select>
      </div>
      <div className="rounded-xl border bg-white p-3 shadow-sm" data-guide="list">
        {events.length === 0 ? (
          <EmptyState title={UI_STRINGS.emptyStates.calendar.title} description={UI_STRINGS.emptyStates.calendar.body}>
            <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={()=>syncNow('google')}>{UI_STRINGS.ctas.secondary.syncNowGoogle}</button>
            <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={()=>mergeDupes()}>{UI_STRINGS.ctas.secondary.deduplicate}</button>
          </EmptyState>
        ) : (
          <ul className="list-disc ml-5 text-sm text-slate-700">
            {events.filter(e=> provider==='all' ? true : (e.provider||'')===provider).slice((page-1)*pageSize, page*pageSize).map((e,i)=> {
              const raw = (e as any)?.start_ts;
              const tsNum = typeof raw === 'number' ? raw : Number(raw);
              const dateStr = isFinite(tsNum) && tsNum > 0 ? new Date(tsNum * (tsNum < 1e12 ? 1000 : 1)).toLocaleString() : String(raw||'');
              return (
                <li key={i} className="truncate flex items-center gap-2" title={`${e.title} — ${dateStr}`}>
                  <span className="flex-1 min-w-0">{e.title} — {dateStr}{e.provider ? ` · ${e.provider}` : ''}</span>
                  <button disabled={actionBusy} className="px-2 py-0.5 rounded-md border bg-white disabled:opacity-50" onClick={()=> reschedule(e, 15)}>+15m</button>
                  <button disabled={actionBusy} className="px-2 py-0.5 rounded-md border bg-white disabled:opacity-50" onClick={()=> reschedule(e, -15)}>-15m</button>
                  <button disabled={actionBusy} className="px-2 py-0.5 rounded-md border bg-white disabled:opacity-50" onClick={()=> cancel(e)}>Cancel</button>
                </li>
              );
            })}
          </ul>
        )}
        {events.filter(e=> provider==='all' ? true : (e.provider||'')===provider).length>pageSize && (
          <Pager
            page={page}
            pageSize={pageSize}
            total={events.filter(e=> provider==='all' ? true : (e.provider||'')===provider).length}
            onPrev={()=> setPage(p=> Math.max(1, p-1))}
            onNext={()=> setPage(p=> ((p*pageSize) < events.filter(e=> provider==='all' ? true : (e.provider||'')===provider).length ? p+1 : p))}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-slate-700">
        {Object.entries(lastSync).map(([prov, info])=> {
          const ts = (info as any)?.ts ? new Date(((info as any)?.ts||0)*1000).toLocaleTimeString() : '';
          return <span key={prov} className="px-2 py-1 rounded-md border bg-white">{prov}: {(info as any)?.status} {ts && `· ${ts}`}</span>
        })}
      </div>
      <div className="flex gap-2">
        <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={()=>syncNow('google')}>{UI_STRINGS.ctas.secondary.syncNowGoogle}</button>
        <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={()=>syncNow('apple')}>{UI_STRINGS.ctas.secondary.syncNowApple}</button>
        <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={()=>syncNow()}>{UI_STRINGS.ctas.secondary.mergeBookings}</button>
        <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={mergeDupes}>{UI_STRINGS.ctas.secondary.deduplicate}</button>
      </div>
      {merged>0 && <div className="text-xs text-emerald-700">Removed {merged} duplicates.</div>}
      <div className="text-[11px] text-amber-700">Some actions may require review when auto-approve is off. Check your To‑Do.</div>
      {status && <pre aria-live="polite" className="text-xs text-slate-700 whitespace-pre-wrap">{status}</pre>}
    </div>
  );
}


