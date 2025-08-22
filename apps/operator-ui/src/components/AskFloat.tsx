import { useEffect, useRef, useState } from 'react';

type Position = { x: number; y: number; w: number; h: number };

export default function AskFloat(){
  const [open, setOpen] = useState<boolean>(()=> localStorage.getItem('bvx-ask-open') === '1');
  const [pos, setPos] = useState<Position>(()=>{
    try{ const j = JSON.parse(localStorage.getItem('bvx-ask-pos')||''); if (j && typeof j==='object') return j; }catch{}
    return { x: 16, y: 16, w: 380, h: 520 };
  });
  const [docked, setDocked] = useState<boolean>(()=> localStorage.getItem('bvx-ask-docked') === '1');
  const drag = useRef<{ dx:number; dy:number; dragging:boolean }>({ dx:0, dy:0, dragging:false });

  useEffect(()=>{ localStorage.setItem('bvx-ask-open', open ? '1':'0'); },[open]);
  useEffect(()=>{ localStorage.setItem('bvx-ask-pos', JSON.stringify(pos)); },[pos]);
  useEffect(()=>{ localStorage.setItem('bvx-ask-docked', docked ? '1':'0'); },[docked]);

  // Listen for global open events so header button can summon the floater
  useEffect(()=>{
    const onOpen = (e: Event) => {
      setOpen(true);
      try{
        const ce = e as CustomEvent<any>;
        if (ce?.detail?.dock) {
          // Dock wide at the bottom immediately
          const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
          const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
          setDocked(true);
          setPos({ x: 16, y: 0, w: vw - 64, h: Math.max(220, Math.round(vh * 0.24)) });
        }
      } catch {}
    };
    window.addEventListener('bvx:ask:open', onOpen as any);
    return ()=> window.removeEventListener('bvx:ask:open', onOpen as any);
  },[]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (docked) return; // no drag in docked mode
    drag.current.dragging = true;
    drag.current.dx = e.clientX - pos.x;
    drag.current.dy = e.clientY - pos.y;
    window.addEventListener('mousemove', onMouseMove as any);
    window.addEventListener('mouseup', onMouseUp as any, { once: true });
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!drag.current.dragging) return;
    setPos(p=> ({ ...p, x: Math.max(8, e.clientX - drag.current.dx), y: Math.max(8, e.clientY - drag.current.dy) }));
  };
  const onMouseUp = () => {
    drag.current.dragging = false;
    window.removeEventListener('mousemove', onMouseMove as any);
  };

  const dockWide = () => {
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    setDocked(true);
    setPos({ x: 16, y: 0, w: vw - 64, h: Math.max(240, Math.round(vh * 0.25)) });
  };

  const undock = () => setDocked(false);

  return (
    <>
      {!open && (
        <button
          onClick={()=> setOpen(true)}
          title="Ask VX"
          className="fixed z-40 bottom-4 left-4 px-4 py-3 rounded-full text-white shadow-lg bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600"
        >Ask VX</button>
      )}
      {open && (
        <div
          className={`fixed z-40 rounded-2xl border border-white/70 bg-white/90 backdrop-blur shadow-[0_10px_40px_rgba(0,0,0,.08)] ${docked? 'left-8 right-8' : ''}`}
          style={docked ? { bottom: 12, height: pos.h } : { left: pos.x, bottom: pos.y, width: pos.w, height: pos.h }}
        >
          <div
            className="select-none flex items-center justify-between px-3 py-2 text-sm text-slate-800 bg-white/70 backdrop-blur border-b border-white/70"
            onMouseDown={onMouseDown}
          >
            <div className="font-medium">Ask VX</div>
            <div className="flex items-center gap-2">
              {!docked && <button className="px-2 py-1 rounded-md border text-xs bg-white hover:shadow-sm" onClick={dockWide}>Dock bottom</button>}
              {docked && <button className="px-2 py-1 rounded-md border text-xs bg-white hover:shadow-sm" onClick={undock}>Undock</button>}
              <button className="px-2 py-1 rounded-md border text-xs bg-white hover:shadow-sm" onClick={()=> setOpen(false)}>Close</button>
            </div>
          </div>
          <div className="w-full h-full overflow-hidden">
            <iframe title="AskVX" src="/ask?embed=1" className="w-full h-full" sandbox="allow-scripts allow-same-origin" />
          </div>
        </div>
      )}
    </>
  );
}


