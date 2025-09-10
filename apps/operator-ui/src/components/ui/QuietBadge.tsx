import { useEffect, useState } from 'react';
import { api, getTenant } from '../../lib/api';

export default function QuietBadge(){
  const [q, setQ] = useState<{start?:string;end?:string}>({});
  useEffect(()=>{ (async()=>{ try{ const r = await api.get(`/settings?tenant_id=${encodeURIComponent(await getTenant())}`); setQ(r?.data?.quiet_hours||{}); } catch{} })(); },[]);
  if (!q?.start || !q?.end) return null;
  const fmt = (s:string)=>{ try{ const [h,m]=s.split(':').map(Number); const am=h<12; const hr=((h%12)||12); return `${hr}:${String(m||0).padStart(2,'0')} ${am?'AM':'PM'}`; }catch{return s;} };
  return (
    <div className="fixed bottom-16 right-3 text-[11px] px-2 py-1 rounded-full bg-slate-900/80 text-white border border-white/10 shadow">
      Quiet: {fmt(q.start!)}–{fmt(q.end!)}
    </div>
  );
}


