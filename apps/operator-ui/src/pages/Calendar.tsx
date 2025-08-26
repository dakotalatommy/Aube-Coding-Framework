import { useEffect, useState } from 'react';
import { api, getTenant } from '../lib/api';
import { startGuide } from '../lib/guide';
import Skeleton from '../components/ui/Skeleton';

export default function Calendar(){
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
  };
  const mergeDupes = async () => {
    const r = await api.post('/calendar/merge', { tenant_id: await getTenant() });
    setMerged((r as any)?.merged ?? 0);
    const l = await api.get(`/calendar/list?tenant_id=${encodeURIComponent(await getTenant())}`);
    setEvents(l?.events||[]);
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
        <button className="ml-auto text-sm text-slate-600 hover:underline" aria-label="Open calendar guide" onClick={()=> startGuide('calendar')}>Guide me</button>
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
        <div className="text-xs text-slate-600 mb-2">A 7‑day reach‑out plan based on approvals and suggested actions.</div>
        <ul className="list-disc ml-5 text-sm text-slate-700">
          {Array.from({length:7}).map((_,i)=> (
            <li key={i}>Day {i+1}: Suggested contacts to reach out (demo)</li>
          ))}
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
          <div className="text-sm text-slate-600">No events yet. Connect Google/Apple and Booking to see your unified calendar.</div>
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
        <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={()=>syncNow('google')}>Sync now (Google)</button>
        <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={()=>syncNow('apple')}>Sync now (Apple)</button>
        <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={()=>syncNow()}>Merge bookings</button>
        <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={mergeDupes}>Deduplicate</button>
      </div>
      {merged>0 && <div className="text-xs text-emerald-700">Removed {merged} duplicates.</div>}
      <div className="text-[11px] text-amber-700">Some actions may require approval when auto-approve is off. Review in Approvals.</div>
      {status && <pre aria-live="polite" className="text-xs text-slate-700 whitespace-pre-wrap">{status}</pre>}
    </div>
  );
}


