import { useEffect, useState, useRef } from 'react';
import { api, getTenant } from '../lib/api';

type Item = { client_id: string; visits: number; services: string[]; total_minutes: number; revenue: number };

export default function Curation(){
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastAction, setLastAction] = useState<{ client_id:string; decision:'keep'|'discard'}|null>(null);
  const [stats, setStats] = useState<{ kept:number; discarded:number }>({ kept:0, discarded:0 });
  const load = async () => {
    try{ const r = await api.post('/curation/list', { tenant_id: await getTenant(), limit: 10 }); setItems(r?.items||[]); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ void load(); },[]);

  const decide = async (client_id: string, decision: 'keep'|'discard') => {
    await api.post('/curation/decide', { tenant_id: await getTenant(), client_id, decision });
    setItems(curr => curr.filter(i => i.client_id !== client_id));
    setLastAction({ client_id, decision });
    setStats(s => ({ kept: s.kept + (decision==='keep'?1:0), discarded: s.discarded + (decision==='discard'?1:0) }));
  };
  const undo = async () => {
    if (!lastAction) return;
    await api.post('/curation/undo', { tenant_id: await getTenant(), client_id: lastAction.client_id });
    setItems(curr => [{ client_id: lastAction.client_id, visits:0, services:[], total_minutes:0, revenue:0 }, ...curr]);
    setStats(s => ({ kept: Math.max(0, s.kept - (lastAction.decision==='keep'?1:0)), discarded: Math.max(0, s.discarded - (lastAction.decision==='discard'?1:0)) }));
    setLastAction(null);
  };

  if (loading) return <div>Loading…</div>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Client Curation</h3>
        <div className="text-xs text-slate-700 bg-white/70 border border-white/70 rounded-md px-2 py-1">Kept: {stats.kept} · Discarded: {stats.discarded}</div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map((i)=> (
          <SwipeCard key={i.client_id} onKeep={()=>decide(i.client_id,'keep')} onDiscard={()=>decide(i.client_id,'discard')}>
            <div className="flex items-center justify-between">
              <div className="font-medium text-slate-900">{i.client_id}</div>
              <div className="text-xs text-slate-600">Visits: {i.visits} · Minutes: {i.total_minutes} · Revenue: ${i.revenue}</div>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={()=>decide(i.client_id,'discard')}>Discard</button>
              <button className="px-3 py-2 rounded-md bg-pink-500 text-white shadow-sm hover:bg-pink-600" onClick={()=>decide(i.client_id,'keep')}>Keep</button>
            </div>
          </SwipeCard>
        ))}
      </div>
      {lastAction && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
          <div className="rounded-full border bg-white shadow px-3 py-2 text-xs text-slate-800 flex items-center gap-3">
            <span>Decision saved.</span>
            <button className="px-2 py-1 rounded-md border bg-white hover:shadow-sm" onClick={undo}>Undo</button>
          </div>
        </div>
      )}
      {items.length === 0 && <div className="text-sm text-slate-600">No clients pending curation. Import contacts or connect booking to continue.</div>}
    </div>
  );
}

function SwipeCard({ children, onKeep, onDiscard }:{ children: React.ReactNode; onKeep: ()=>void; onDiscard: ()=>void }){
  const ref = useRef<HTMLDivElement|null>(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{x:number;y:number}>({x:0,y:0});
  const onDown = (e: React.MouseEvent) => { setDragging(true); start.current = { x: e.clientX, y: e.clientY }; };
  const onMove = (e: React.MouseEvent) => { if (!dragging) return; setDx(e.clientX - start.current.x); };
  const onUp = () => {
    if (Math.abs(dx) > 120) {
      if (dx > 0) onKeep(); else onDiscard();
    }
    setDragging(false); setDx(0);
  };
  return (
    <div
      ref={ref}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={()=>{ if (dragging) onUp(); }}
      className="rounded-2xl p-4 bg-white/70 backdrop-blur border border-white/70 shadow-sm select-none"
      style={{ transform: `translateX(${dx}px) rotate(${dx/40}deg)`, transition: dragging ? 'none' : 'transform 0.2s ease' }}
    >
      <div className="pointer-events-none absolute -mt-3 -ml-3 text-xs">
        {(dx > 40) ? (<span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">Keep</span>) : null}
        {(dx < -40) ? (<span className="px-2 py-1 rounded-md bg-rose-100 text-rose-700 border border-rose-200">Discard</span>) : null}
      </div>
      {children}
    </div>
  );
}


