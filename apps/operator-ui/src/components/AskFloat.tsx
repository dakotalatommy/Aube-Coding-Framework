// imports removed (legacy component disabled)

// type Position = { x: number; y: number; w: number; h: number };

// Legacy dock retained but returns null to avoid rendering; use CommandBar instead.
export default function AskFloat(){
  return null;
}
/**
  const loc = useLocation();
  const sp = new URLSearchParams(loc.search);
  const onDashboard = loc.pathname === '/dashboard' || loc.pathname.startsWith('/dashboard/');
  const onWorkspace = loc.pathname === '/workspace' || loc.pathname.startsWith('/workspace/');
  const onDemoRoute = loc.pathname.startsWith('/demo') || loc.pathname.startsWith('/ask-vx-demo');
  const inDemo = sp.get('demo') === '1';
  const dockHeight = 'clamp(220px, 26vh, 300px)';
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

  // Force docked, full-width, and open on dashboard/workspace/demo for a stable footer panel
  useEffect(()=>{
    if (onDashboard || onWorkspace || inDemo) {
      try {
        const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        setOpen(true);
        setDocked(true);
        setPos({ x: 0, y: 0, w: vw, h: 320 });
        try {
          document.documentElement.style.setProperty('--askvx-target-height', dockHeight);
        } catch {}
      } catch {
        setOpen(true); setDocked(true);
      }
    }
  }, [onDashboard, onWorkspace, inDemo]);

  // Initialize target height variable; reserved height is measured below.
  useEffect(()=>{
    try { document.documentElement.style.setProperty('--askvx-target-height', dockHeight); } catch {}
  }, [onDashboard, onWorkspace, inDemo]);

  // Keep the reserved height CSS var in sync with the actual dock height
  useEffect(()=>{
    try{
      const el = document.getElementById('bvx-ask-float');
      if (!el) return;
      const update = () => {
        try{
          const rect = el.getBoundingClientRect();
          const px = Math.max(0, Math.round(rect.height));
          document.documentElement.style.setProperty('--askvx-reserved-height', `${px}px`);
        }catch{}
      };
      update();
      const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(()=> update()) : null as any;
      if (ro) ro.observe(el);
      window.addEventListener('resize', update);
      window.addEventListener('orientationchange', update as any);
      return ()=>{ try{ window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update as any); if (ro) ro.disconnect(); }catch{} };
    }catch{}
  }, [onDashboard, onWorkspace, inDemo, docked]);

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

  // Hard guard: never render on demo routes
  if (onDemoRoute) return null;

  return (
    <>
      {!open && !(onDashboard || onWorkspace || inDemo) && (
        <button
          onClick={()=> setOpen(true)}
          title="Ask VX"
          className="fixed z-40 bottom-4 left-4 px-4 py-3 rounded-full text-white shadow-lg bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600"
        >Ask VX</button>
      )}
      {open && (
        <div id="bvx-ask-float"
          className={`fixed z-[200] ${(docked || onDashboard || onWorkspace || inDemo) ? 'left-0 right-0' : ''} ${(onDashboard || onWorkspace || inDemo) ? 'rounded-none' : 'rounded-2xl'} ${(onDashboard || onWorkspace || inDemo) ? '' : 'border'} bg-white`}
          style={(docked || onDashboard || onWorkspace || inDemo) ? { left: 0, right: 0, bottom: 'env(safe-area-inset-bottom,0px)', height: 'var(--askvx-target-height)' } : { left: pos.x, bottom: pos.y, width: pos.w, height: pos.h }}
        >
          <div
            className={`select-none flex items-center justify-between px-3 py-2 text-sm text-slate-800 bg-white ${!(onDashboard || onWorkspace || inDemo) ? 'border-b border-slate-200' : ''}`}
            style={{ WebkitBackdropFilter: 'none', backdropFilter: 'none' }}
            onMouseDown={onMouseDown}
          >
            <div />
            <div className="flex items-center gap-2">
              {!(onDashboard || onWorkspace || inDemo) && !docked && <button className="px-2 py-1 rounded-md border text-xs bg-white hover:shadow-sm" onClick={dockWide}>Dock bottom</button>}
              {!(onDashboard || onWorkspace || inDemo) && docked && <button className="px-2 py-1 rounded-md border text-xs bg-white hover:shadow-sm" onClick={undock}>Undock</button>}
              {!(onDashboard || onWorkspace || inDemo) && <button className="px-2 py-1 rounded-md border text-xs bg-white hover:shadow-sm" onClick={()=> setOpen(false)}>Close</button>}
            </div>
          </div>
          <div className="w-full h-[calc(100%-44px)] overflow-hidden">
            <iframe title="AskVX" src="/ask?embed=1" className="block w-full h-full" sandbox="allow-scripts allow-top-navigation-by-user-activation" />
          </div>
        </div>
      )}
    </>
  );
*/


