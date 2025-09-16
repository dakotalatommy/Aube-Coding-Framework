import { useEffect } from 'react';

type PaneItem = { key: string; label: string };

export default function PaneManager({ pane, items, setPane }: { pane: string; items: PaneItem[]; setPane: (k: any)=> void }){
  useEffect(()=>{
    function onKey(e: KeyboardEvent){
      if (e.key === 'ArrowRight') {
        const i = Math.max(0, items.findIndex(p=>p.key===pane));
        const n = (i+1) % items.length;
        setPane(items[n].key);
      }
      if (e.key === 'ArrowLeft') {
        const i = Math.max(0, items.findIndex(p=>p.key===pane));
        const n = (i-1+items.length) % items.length;
        setPane(items[n].key);
      }
    }
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [pane, items, setPane]);

  return (
    <div className="pointer-events-none select-none" aria-hidden>
      <div className="fixed right-6 bottom-[20px] z-30 flex gap-2">
        <div className="pointer-events-auto">
          <button className="rounded-full border bg-white/95 backdrop-blur p-2 shadow" onClick={()=>{
            const i = Math.max(0, items.findIndex(p=>p.key===pane));
            const n = (i-1+items.length) % items.length;
            setPane(items[n].key);
          }} aria-label="Previous">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
        </div>
        <div className="pointer-events-auto">
          <button className="rounded-full border bg-white/95 backdrop-blur p-2 shadow" onClick={()=>{
            const i = Math.max(0, items.findIndex(p=>p.key===pane));
            const n = (i+1) % items.length;
            setPane(items[n].key);
          }} aria-label="Next">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      </div>
    </div>
  );
}


