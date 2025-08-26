import { useEffect, useState } from 'react';
import { api, getTenant } from '../lib/api';
import { startGuide } from '../lib/guide';
import EmptyState from '../components/ui/EmptyState';

export default function Inventory(){
  const [summary, setSummary] = useState<any>({});
  const [lastSync, setLastSync] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [lastAnalyzed, setLastAnalyzed] = useState<number|undefined>(undefined);
  const [lowThreshold, setLowThreshold] = useState<number>(()=>{
    try { return parseInt(localStorage.getItem('bvx_low_threshold')||'5')||5; } catch { return 5; }
  });
  useEffect(()=>{
    (async()=>{
      try{ const r = await api.get(`/inventory/metrics?tenant_id=${encodeURIComponent(await getTenant())}`); setSummary(r?.summary||{}); setLastSync(r?.last_sync||{}); setItems(r?.items||[]); } finally{ setLoading(false); }
    })();
  },[]);
  useEffect(()=>{
    try{
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('tour') === '1') startGuide('inventory');
    } catch {}
  },[]);
  useEffect(()=>{ (async()=>{ try{ const a = await api.post('/onboarding/analyze', { tenant_id: await getTenant() }); if (a?.summary?.ts) setLastAnalyzed(Number(a.summary.ts)); } catch{} })(); },[]);
  const syncNow = async (provider?: string) => {
    const r = await api.post('/inventory/sync', { tenant_id: await getTenant(), provider });
    setStatus(JSON.stringify(r));
    // Refresh metrics/items
    const m = await api.get(`/inventory/metrics?tenant_id=${encodeURIComponent(await getTenant())}`);
    setSummary(m?.summary||{}); setLastSync(m?.last_sync||{}); setItems(m?.items||[]);
  };
  if (loading) return <div>Loading…</div>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Inventory</h3>
        <button className="text-sm text-slate-600 hover:underline" aria-label="Open inventory guide" onClick={()=> startGuide('inventory')}>Guide me</button>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <label className="flex items-center gap-2">Low‑stock threshold
          <input type="number" min={0} className="border rounded-md px-2 py-1 bg-white w-20" value={lowThreshold} onChange={(e)=>{
            const v = Math.max(0, parseInt(e.target.value||'0')||0);
            setLowThreshold(v);
            try { localStorage.setItem('bvx_low_threshold', String(v)); } catch {}
          }} />
        </label>
        <span className="text-xs text-slate-500">Used by low‑stock checks</span>
      </div>
      <div className="rounded-xl border bg-white p-3 shadow-sm grid sm:grid-cols-2 lg:grid-cols-4 gap-3" data-guide="kpis">
        <Stat label="Products" value={summary.products ?? 0} />
        <Stat label="Low stock" value={summary.low_stock ?? 0} />
        <Stat label="Out of stock" value={summary.out_of_stock ?? 0} />
        <Stat label="Top SKU" value={summary.top_sku ?? '—'} />
      </div>
      <div className="text-sm text-slate-600">Connect Shopify/Square or add products manually to see inventory here.</div>
      {lastAnalyzed && (
        <div className="text-[11px] text-slate-500">Last analyzed: {new Date(lastAnalyzed*1000).toLocaleString()}</div>
      )}
      <div className="flex flex-wrap gap-2 text-xs text-slate-700">
        {Object.entries(lastSync).map(([prov, info])=> {
          const ts = (info as any)?.ts ? new Date(((info as any)?.ts||0)*1000).toLocaleTimeString() : '';
          return <span key={prov} className="px-2 py-1 rounded-md border bg-white">{prov}: {(info as any)?.status} {ts && `· ${ts}`}</span>
        })}
      </div>
      <div className="flex gap-2">
        <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={()=>syncNow('shopify')}>Sync now (Shopify)</button>
        <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={()=>syncNow('square')}>Sync now (Square)</button>
        <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={()=>syncNow('manual')}>Recompute (Manual)</button>
      </div>
      <div className="text-[11px] text-amber-700">Some actions may require approval when auto-approve is off. Review in Approvals.</div>
      {items.length === 0 ? (
        <EmptyState title="No inventory yet" description="Connect Shopify/Square and sync to see items here." />
      ) : (
        <div className="rounded-xl border bg-white p-0 shadow-sm overflow-hidden" role="region" aria-label="Inventory table" data-guide="table">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">SKU</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Stock</th><th className="px-3 py-2 text-left">Cost</th><th className="px-3 py-2 text-left">Price</th><th className="px-3 py-2 text-left">Provider</th></tr></thead>
            <tbody className="divide-y">
              {items.map((it,i)=> (
                <tr key={i} className={`hover:bg-slate-50 ${Number(it.stock)<=0? 'bg-rose-50': Number(it.stock)<=5? 'bg-amber-50':''}`}>
                  <td className="px-3 py-2">{it.sku}</td>
                  <td className="px-3 py-2">{it.name}</td>
                  <td className="px-3 py-2">
                    {it.stock}
                    {Number(it.stock)<=0 && <span className="ml-2 text-[11px] text-rose-700">Out</span>}
                    {Number(it.stock)>0 && Number(it.stock)<=5 && <span className="ml-2 text-[11px] text-amber-700">Low</span>}
                  </td>
                  <td className="px-3 py-2">${'{'}it.cost{'}'}</td>
                  <td className="px-3 py-2">${'{'}it.price{'}'}</td>
                  <td className="px-3 py-2">{it.provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3 text-[11px] text-slate-600">Low‑stock threshold is 5 by default.</div>
        </div>
      )}
      {status && <pre className="text-xs text-slate-700 whitespace-pre-wrap">{status}</pre>}
    </div>
  );
}

function Stat({label, value}:{label:string;value:any}){
  return (
    <div className="rounded-lg bg-white border p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold text-slate-900">{String(value)}</div>
    </div>
  );
}


