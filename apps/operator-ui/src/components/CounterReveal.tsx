import { useEffect, useState } from 'react';

type Props = {
  label?: string;
  value?: number; // hours
  durationMs?: number;
  align?: 'left'|'center';
  className?: string;
};

export default function CounterReveal({ label = 'Time Saved / week', value = 6.2, durationMs = 800, align = 'center', className }: Props){
  const [v, setV] = useState(0);
  useEffect(()=>{
    const start = performance.now();
    const target = value;
    let raf = 0;
    const tick = (t:number)=>{
      const p = Math.min(1, (t - start) / durationMs);
      setV(Number((target * p).toFixed(1)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return ()=> cancelAnimationFrame(raf);
  },[value, durationMs]);
  const cls = align === 'center' ? 'text-center' : 'text-left';
  return (
    <div className={`rounded-2xl border bg-white/70 p-4 shadow-sm ${cls} ${className||''}`}>
      <div className="text-2xl font-semibold text-slate-900">{v}h</div>
      <div className="text-xs text-slate-600">{label}</div>
    </div>
  );
}


