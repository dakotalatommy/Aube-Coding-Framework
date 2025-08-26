import { useEffect } from 'react';

export type Step = { key: string; label: string };

export default function StepPager({ steps, index, onChange, persistKey, queryParam = 'step' }:{ steps: Step[]; index: number; onChange: (i:number)=>void; persistKey?: string; queryParam?: string }){
  useEffect(()=>{
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onChange(Math.max(0, index - 1));
      if (e.key === 'ArrowRight') onChange(Math.min(steps.length - 1, index + 1));
    };
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [index, steps.length, onChange]);

  useEffect(()=>{
    try{
      const sp = new URLSearchParams(window.location.search);
      sp.set(queryParam, String(index+1));
      const url = window.location.pathname + '?' + sp.toString();
      window.history.replaceState({}, '', url);
      if (persistKey) localStorage.setItem(persistKey, String(index));
    } catch {}
  }, [index, queryParam, persistKey]);

  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <button aria-label="Previous" className="px-3 py-1.5 rounded-md border bg-white disabled:opacity-50" disabled={index<=0} onClick={()=> onChange(Math.max(0,index-1))}>&larr;</button>
      <div className="flex items-center gap-3">
        <div className="text-sm font-medium">Step {index+1} of {steps.length}</div>
        <div className="flex items-center gap-1" aria-label="Steps">
          {steps.map((s, i)=> (
            <button key={s.key} aria-label={s.label} title={s.label} onClick={()=> onChange(i)} className={`w-2 h-2 rounded-full ${i===index? 'bg-slate-900':'bg-slate-300'}`} />
          ))}
        </div>
      </div>
      <button aria-label="Next" className="px-3 py-1.5 rounded-md border bg-white disabled:opacity-50" disabled={index>=steps.length-1} onClick={()=> onChange(Math.min(steps.length-1,index+1))}>&rarr;</button>
    </div>
  );
}


