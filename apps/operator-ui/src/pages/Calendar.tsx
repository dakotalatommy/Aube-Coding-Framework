import { useEffect, useState } from 'react';
import { api, getTenant } from '../lib/api';
import { startGuide } from '../lib/guide';
import { UI_STRINGS } from '../lib/strings';
import Skeleton from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';

export default function Calendar(){
  const { showToast } = useToast();
  const [events, setEvents] = useState<any[]>([]);
  const [lastSync, setLastSync] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState<string>('all');
  const [merged, setMerged] = useState<number>(0);
  const [lastAnalyzed, setLastAnalyzed] = useState<number|undefined>(undefined);
  const [showApple, setShowApple] = useState<boolean>(true);
  useEffect(()=>{
    (async()=>{ try{ const r = await api.get(`/calendar/list?tenant_id=${encodeURIComponent(await getTenant())}`); setEvents(r?.events||[]); setLastSync(r?.last_sync||{}); } finally{ setLoading(false); } })();
  },[]);
  useEffect(()=>{ try{ const sp = new URLSearchParams(window.location.search); if (sp.get('tour')==='1') startGuide('calendar'); } catch {} },[]);
  useEffect(()=>{ (async()=>{ try{ const a = await api.post('/onboarding/analyze', { tenant_id: await getTenant() }); if (a?.summary?.ts) setLastAnalyzed(Number(a.summary.ts)); } catch{} })(); },[]);
  // Hide Apple option when not configured
  useEffect(()=>{
    try {
      const appleConfigured = Boolean((lastSync as any)?.apple || (events||[]).some(e=> (e as any)?.provider==='apple'));
      setShowApple(appleConfigured);
    } catch {}
  }, [lastSync, JSON.stringify(events)]);
  const syncNow = async (prov?: string) => {
    const r = await api.post('/calendar/sync', { tenant_id: await getTenant(), provider: prov });
    setStatus(JSON.stringify(r));
    const l = await api.get(`/calendar/list?tenant_id=${encodeURIComponent(await getTenant())}`);
    setEvents(l?.events||[]); setLastSync(l?.last_sync||{});
    try { showToast({ title:'Sync started', description: prov || 'all' }); } catch {}
  };
  const mergeDupes = async () => {
    const r = await api.post('/calendar/merge', { tenant_id: await getTenant() });
    setMerged((r as any)?.merged ?? 0);
    const l = await api.get(`/calendar/list?tenant_id=${encodeURIComponent(await getTenant())}`);
    setEvents(l?.events||[]);
    try { showToast({ title:'Merged bookings' }); } catch {}
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
      {/* Simple weekly grid (visual aid) */}
      <div className="rounded-xl border bg-white p-3" role="table" aria-label="Weekly calendar">
        <div className="grid grid-cols-7 gap-2 text-xs text-slate-600">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> <div key={d} className="text-center font-medium">{d}</div>)}
          {Array.from({length:7}).map((_,i)=> (
            <div key={i} className="min-h-[56px] rounded-md border bg-white/70" aria-label={`Day ${i+1}`}></div>
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
          <div className="text-sm text-slate-600">{UI_STRINGS.emptyStates.calendar.title}. {UI_STRINGS.emptyStates.calendar.body}</div>
        ) : (
          <ul className="list-disc ml-5 text-sm text-slate-700">
            {events.filter(e=> provider==='all' ? true : (e.provider||'')===provider).map((e,i)=> {
              const raw = (e as any)?.start_ts;
              const tsNum = typeof raw === 'number' ? raw : Number(raw);
              const dateStr = isFinite(tsNum) && tsNum > 0 ? new Date(tsNum * (tsNum < 1e12 ? 1000 : 1)).toLocaleString() : String(raw||'');
              return (<li key={i}>{e.title} — {dateStr}{e.provider ? ` · ${e.provider}` : ''}</li>);
            })}
          </ul>
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
      <div className="text-[11px] text-amber-700">Some actions may require approval when auto-approve is off. Review in Approvals.</div>
      {status && <pre aria-live="polite" className="text-xs text-slate-700 whitespace-pre-wrap">{status}</pre>}
    </div>
  );
}


