import { useEffect, useRef, useState } from 'react';

type Position = { x: number; y: number; w: number; h: number };

export default function AskFloat(){
  const [open, setOpen] = useState<boolean>(()=> localStorage.getItem('bvx-ask-open') === '1');
  const [pos, setPos] = useState<Position>(()=>{
    try{ const j = JSON.parse(localStorage.getItem('bvx-ask-pos')||''); if (j && typeof j==='object') return j; }catch{}
    return { x: 16, y: 16, w: 380, h: 520 };
  });
  const drag = useRef<{ dx:number; dy:number; dragging:boolean }>({ dx:0, dy:0, dragging:false });

  useEffect(()=>{ localStorage.setItem('bvx-ask-open', open ? '1':'0'); },[open]);
  useEffect(()=>{ localStorage.setItem('bvx-ask-pos', JSON.stringify(pos)); },[pos]);

  const onMouseDown = (e: React.MouseEvent) => {
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
    if (vw >= 1200) setPos({ x: 16, y: vh - 360, w: vw - 64, h: 320 });
  };

  return (
    <>
      {!open && (
        <button
          onClick={()=> setOpen(true)}
          title="Ask VX"
          className="fixed z-40 bottom-4 right-4 px-4 py-3 rounded-full text-white shadow-lg bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600"
        >Ask VX</button>
      )}
      {open && (
        <div
          className="fixed z-40 rounded-xl border bg-white shadow-xl overflow-hidden"
          style={{ left: pos.x, bottom: pos.y, width: pos.w, height: pos.h }}
        >
          <div
            className="cursor-move select-none flex items-center justify-between px-3 py-2 text-sm text-slate-800 bg-gradient-to-r from-pink-50 to-sky-50 border-b"
            onMouseDown={onMouseDown}
          >
            <div className="font-medium">Ask VX</div>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 rounded-md border text-xs bg-white hover:shadow-sm" onClick={dockWide}>Dock wide</button>
              <button className="px-2 py-1 rounded-md border text-xs bg-white hover:shadow-sm" onClick={()=> setOpen(false)}>Close</button>
            </div>
          </div>
          <div className="w-full h-full">
            <iframe title="AskVX" src="/ask?embed=1" className="w-full h-full" />
          </div>
        </div>
      )}
    </>
  );
}


