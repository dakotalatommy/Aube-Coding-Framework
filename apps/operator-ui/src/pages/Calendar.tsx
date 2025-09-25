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
  // const [merged, setMerged] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const pageSize = 12;
  const [lastAnalyzed, setLastAnalyzed] = useState<number|undefined>(undefined);
  const [connected, setConnected] = useState<Record<string,string>>({});
  const [showApple, setShowApple] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [actionBusy, setActionBusy] = useState<boolean>(false);
  const isDemo = (()=>{ try{ return new URLSearchParams(window.location.search).get('demo')==='1'; } catch { return false; } })();
  // Month view cells (6x7 grid)
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstWeekday = firstOfMonth.getDay(); // 0..6 (Sun..Sat)
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstWeekday);
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate()+i); return d; });
  const byDay = (events||[]).reduce((acc:any, ev:any)=>{
    try{
      const raw = ev.start_ts; const ts = typeof raw==='number'? raw : Number(raw);
      const dt = isFinite(ts) && ts>0 ? new Date(ts * (ts<1e12? 1000 : 1)) : null;
      const key = dt ? new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).toISOString().slice(0,10) : 'other';
      (acc[key] = acc[key] || []).push(ev);
    } catch { (acc.other = acc.other || []).push(ev); }
    return acc;
  }, {} as Record<string, any[]>);
  const fmtTime = (raw:any)=>{ try{ const n = typeof raw==='number'? raw: Number(raw); const d = new Date(n*(n<1e12?1000:1)); return d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}); } catch { return String(raw||''); } };
  useEffect(()=>{
    (async()=>{ try{ const r = await api.get(`/calendar/events?tenant_id=${encodeURIComponent(await getTenant())}`); setEvents(Array.isArray(r?.items)? r.items : []); setLastSync({}); setLastUpdated(Date.now()); } finally{ setLoading(false); } })();
  },[]);
  useEffect(()=>{ try{ const sp = new URLSearchParams(window.location.search); if (sp.get('tour')==='1') startGuide('calendar'); } catch {} },[]);
  // Ensure weekly appointments are fresh on open
  useEffect(()=>{
    (async()=>{
      try{
        const now = new Date();
        const day = now.getDay();
        const diffToMonday = (day === 0 ? -6 : 1) - day; // Monday as start
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMonday);
        monday.setHours(0,0,0,0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23,59,59,999);
        await api.post('/ai/tools/execute', {
          tenant_id: await getTenant(),
          name: 'calendar.sync',
          params: { tenant_id: await getTenant(), range_start: Math.floor(monday.getTime()/1000), range_end: Math.floor(sunday.getTime()/1000) },
          require_approval: false
        });
        // Refresh list after kick-off
        const l = await api.get(`/calendar/events?tenant_id=${encodeURIComponent(await getTenant())}`);
        setEvents(Array.isArray(l?.items)? l.items : []); setLastSync({}); setLastUpdated(Date.now());
      } catch {}
    })();
  }, []);
  useEffect(()=>{ (async()=>{ try{ const a = await api.post('/onboarding/analyze', { tenant_id: await getTenant() }); if (a?.summary?.ts) setLastAnalyzed(Number(a.summary.ts)); if (a?.summary?.connected) setConnected(a.summary.connected); } catch{} })(); },[]);
  // Hide Apple calendar until ready (always off for now)
  useEffect(()=>{ try { setShowApple(false); } catch {} }, [lastSync, JSON.stringify(events)]);
  const syncNow = async (prov?: string) => {
    const r = await api.post('/ai/tools/execute', { tenant_id: await getTenant(), name:'calendar.sync', params:{ tenant_id: await getTenant(), provider: prov }, require_approval: false });
    try{ if (r?.status === 'ok' || r?.status === 'pending') toastSuccess('Calendar sync started', prov ? `Provider: ${prov}` : undefined); else toastError('Calendar sync failed', r?.error || r?.status); } catch {}
    setStatus(new URLSearchParams(window.location.search).has('dev') ? JSON.stringify(r) : '');
    const l = await api.get(`/calendar/events?tenant_id=${encodeURIComponent(await getTenant())}`);
    setEvents(Array.isArray(l?.items)? l.items : []); setLastSync({});
    try { showToast({ title:'Sync started', description: prov || 'all' }); } catch {}
    setLastUpdated(Date.now());
  };
  // merge action is available via backend but button removed from UI; keep for potential future use
  // mergeDupes temporarily removed from UI and code to avoid unused var error
  const connectGoogle = async () => {
    try{
      const r = await api.get(`/oauth/google/login?tenant_id=${encodeURIComponent(await getTenant())}&return=workspace`);
      if (r?.url) { try{ window.location.href = r.url; } catch { window.location.assign(r.url); } }
    } catch {}
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
      const l = await api.get(`/calendar/events?tenant_id=${encodeURIComponent(await getTenant())}`);
      setEvents(Array.isArray(l?.items)? l.items : []); setLastUpdated(Date.now());
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
      const l = await api.get(`/calendar/events?tenant_id=${encodeURIComponent(await getTenant())}`);
      setEvents(Array.isArray(l?.items)? l.items : []); setLastUpdated(Date.now());
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
        <div className="ml-auto flex items-center gap-2">
          <button className="text-sm text-slate-600 hover:underline" aria-label={UI_STRINGS.a11y.buttons.guideCalendar} onClick={()=> startGuide('calendar')}>{UI_STRINGS.ctas.tertiary.guideMe}</button>
          <button className="px-2 py-1 rounded-md border bg-white text-xs" onClick={()=>{ window.location.href='/ask'; }}>AskVX</button>
        </div>
      </div>
      {(() => {
        try{
          // Stale banner if last sync older than 15 minutes for any provider
          const lastTs = Math.max(0, ...Object.values(lastSync||{}).map((v:any)=> Number((v?.ts)||0)));
          if (lastTs>0 && (Date.now()/1000 - lastTs) > (15*60)) {
            return (
              <div className="rounded-md border bg-amber-50 border-amber-200 text-amber-900 text-xs px-2 py-1">
                Calendar may be out of date. Click Sync now to refresh.
              </div>
            );
          }
        } catch {}
        return null;
      })()}
      <div className="text-[11px] text-slate-600">Note: Scheduling from BrandVX is disabled. Calendar merges are read‑only.</div>
      {lastAnalyzed && (
        <div className="text-[11px] text-slate-500">Last analyzed: {new Date(lastAnalyzed*1000).toLocaleString()}</div>
      )}
      {!!lastUpdated && (
        <div className="text-[11px] text-slate-500">Updated {new Date(lastUpdated).toLocaleTimeString()}</div>
      )}
      {/* Month grid */}
      <div className="rounded-xl border bg-white/90 backdrop-blur p-3 shadow-sm" role="region" aria-label="Month view">
        <div className="grid grid-cols-7 gap-2 text-xs text-slate-600 mb-2">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> <div key={d} className="text-center font-medium">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((d, i) => {
            const key = d.toISOString().slice(0,10);
            const list = (byDay[key]||[]).filter((e:any)=> provider==='all'? true : (e.provider||'')===provider);
            const inMonth = d.getMonth() === today.getMonth();
            return (
              <div key={i} className={`min-h-[120px] border rounded-md bg-white ${inMonth? '':'opacity-60'}`}>
                <div className="sticky top-0 z-10 px-2 py-1 text-xs font-medium border-b bg-slate-50 flex items-center justify-between">
                  <span>{d.getDate()}</span>
                </div>
                <div className="p-2 space-y-1 text-xs">
                  {list.length===0 ? <div className="text-slate-400">—</div> : list.slice(0,3).map((e:any, idx:number)=> (
                    <div key={idx} className="px-2 py-1 rounded border bg-white flex items-center justify-between gap-2" title={e.title}>
                      <div className="truncate"><span className="text-slate-500 mr-1">{fmtTime(e.start_ts)}</span>{e.title}</div>
                    </div>
                  ))}
                  {list.length>3 && (
                    <div className="text-[11px] text-slate-500">+{list.length-3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Demo-only recommendations */}
      {isDemo && (
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
      )}
      <div className="flex items-center gap-2 text-sm" data-guide="filters">
        <span className="text-slate-600">Filter:</span>
        <select className="border rounded-md px-2 py-1 bg-white" value={provider} onChange={e=>setProvider(e.target.value)}>
          <option value="all">All</option>
          <option value="google">Google</option>
          {showApple && <option value="apple">Apple</option>}
          <option value="square">Square</option>
          <option value="acuity">Acuity</option>
        </select>
        {String(connected['google']||'')==='connected' && (
          <button className="px-3 py-1.5 rounded-md border bg-white hover:shadow-sm" onClick={async()=>{
            try{
              setActionBusy(true);
              const r = await api.post('/ai/tools/execute', { tenant_id: await getTenant(), name:'calendar.push.google', params:{ tenant_id: await getTenant() }, require_approval: true });
              showToast({ title: 'Push started', description: `${Number(r?.pushed||0)} events mirrored` });
            } catch(e:any){ showToast({ title:'Push failed', description:String(e?.message||e) }); } finally{ setActionBusy(false); }
          }}>Push to Google</button>
        )}
      </div>
      <div className="rounded-xl border bg-white p-3 shadow-sm" data-guide="list">
        {events.length === 0 ? (
          <EmptyState title={UI_STRINGS.emptyStates.calendar.title} description={UI_STRINGS.emptyStates.calendar.body}>
            <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={()=>{ const isConn = String(connected['google']||'')==='connected'; isConn ? syncNow('google') : connectGoogle(); }}>{String(connected['google']||'')==='connected' ? UI_STRINGS.ctas.secondary.syncNowGoogle : 'Connect Google Calendar'}</button>
          </EmptyState>
        ) : (
          <div className="hidden md:grid grid-cols-7 gap-2">
            {/* Month grid rendered above; keep weekly block removed */}
            {[]}
          </div>
        )}
        {/* Mobile list */}
        <div className="md:hidden">
          {(events||[]).filter(e=> provider==='all' ? true : (e.provider||'')===provider).slice((page-1)*pageSize, page*pageSize).map((e,i)=>{
            const raw = e.start_ts; const tsNum = typeof raw==='number'? raw: Number(raw);
            const dateStr = isFinite(tsNum) && tsNum>0 ? new Date(tsNum*(tsNum<1e12?1000:1)).toLocaleString() : String(raw||'');
            return (
              <div key={i} className="px-2 py-1 rounded border bg-white flex items-center justify-between gap-2 mb-2" title={`${e.title} — ${dateStr}`}>
                <div className="truncate"><span className="text-slate-500 mr-1">{fmtTime(e.start_ts)}</span>{e.title}</div>
                <div className="flex items-center gap-1">
                  <button disabled={actionBusy} className="px-1.5 py-0.5 rounded-md border bg-white disabled:opacity-50 text-[11px]" onClick={()=> reschedule(e, 15)}>+15</button>
                  <button disabled={actionBusy} className="px-1.5 py-0.5 rounded-md border bg-white disabled:opacity-50 text-[11px]" onClick={()=> reschedule(e, -15)}>-15</button>
                  <button disabled={actionBusy} className="px-1.5 py-0.5 rounded-md border bg-white disabled:opacity-50 text-[11px]" onClick={()=> cancel(e)}>X</button>
                </div>
              </div>
            );
          })}
          {(events||[]).filter(e=> provider==='all' ? true : (e.provider||'')===provider).length>pageSize && (
            <Pager page={page} pageSize={pageSize} total={events.filter(e=> provider==='all' ? true : (e.provider||'')===provider).length} onPrev={()=> setPage(p=> Math.max(1, p-1))} onNext={()=> setPage(p=> ((p*pageSize) < events.filter(e=> provider==='all' ? true : (e.provider||'')===provider).length ? p+1 : p))} />
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-slate-700">
        {Object.entries(lastSync).map(([prov, info])=> {
          const ts = (info as any)?.ts ? new Date(((info as any)?.ts||0)*1000).toLocaleTimeString() : '';
          return <span key={prov} className="px-2 py-1 rounded-md border bg-white">{prov}: {(info as any)?.status} {ts && `· ${ts}`}</span>
        })}
      </div>
      {/* Dedupe banner hidden until merge action is reintroduced */}
      <div className="text-[11px] text-amber-700">Some actions may require review when auto-approve is off. Check your To‑Do.</div>
      {status && <pre aria-live="polite" className="text-xs text-slate-700 whitespace-pre-wrap">{status}</pre>}
    </div>
  );
}
