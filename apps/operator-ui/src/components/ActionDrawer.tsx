import { useEffect, useRef, useState } from 'react';

export default function ActionDrawer(){
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<Array<{ id: string; status: string; at: number; payload?: any }>>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const onLog = (e: any) => {
      const d = e?.detail || {}; // { id, status, at, result|error }
      setLogs(prev=> [{ id: String(d.id||'action'), status: String(d.status||'ok'), at: Number(d.at||Date.now()), payload: d.result||d.error }, ...prev].slice(0, 100));
      setOpen(true);
    };
    window.addEventListener('bvx:action-log' as any, onLog as any);
    return ()=> window.removeEventListener('bvx:action-log' as any, onLog as any);
  }, []);

  useEffect(()=>{
    function onKey(e: KeyboardEvent){ if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div aria-live="polite" aria-atomic="false">
      {open && (
        <div className="fixed inset-0 z-50">
          <div aria-hidden className="absolute inset-0 bg-black/20" onClick={()=> setOpen(false)} />
          <div ref={ref} className="absolute left-1/2 -translate-x-1/2 bottom-[env(safe-area-inset-bottom,0px)] w-full max-w-3xl rounded-2xl border border-[var(--border)] bg-white/95 backdrop-blur shadow-soft p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-ink-900">Action details</div>
              <button className="text-sm px-2 py-1 rounded-md border bg-white hover:bg-slate-50" onClick={()=> setOpen(false)}>Close</button>
            </div>
            <div className="max-h-[40vh] overflow-auto rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-2 py-1">When</th>
                    <th className="px-2 py-1">Action</th>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1">Info</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l, i)=> (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1 text-slate-500">{new Date(l.at).toLocaleTimeString()}</td>
                      <td className="px-2 py-1">{l.id}</td>
                      <td className={`px-2 py-1 ${l.status==='ok'?'text-emerald-600':'text-rose-600'}`}>{l.status}</td>
                      <td className="px-2 py-1 text-slate-600 truncate max-w-[320px]" title={typeof l.payload==='string'? l.payload: JSON.stringify(l.payload||{})}>
                        {typeof l.payload==='string'? l.payload: JSON.stringify(l.payload||{})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


