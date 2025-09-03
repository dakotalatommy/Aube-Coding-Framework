import { useMemo, useRef, useState } from 'react';
import { listActions, getAction } from '../lib/actions';
import { track } from '../lib/analytics';
import ConfirmDialog from './ui/ConfirmDialog';

type CommandResult = { id: string; status: 'ok' | 'error'; message?: string; time: number };

export default function CommandBar(){
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState<{ open: boolean; actionId?: string; args?: any[] }>({ open: false });
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResult|null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const allActionIds = useMemo(()=> listActions(), []);
  const suggestions = useMemo(()=>{
    const q = query.trim().toLowerCase();
    if (!q) return [] as string[]; // Disable automatic suggestions
    const ids = allActionIds
      .filter(id=> id.toLowerCase().includes(q))
      .slice(0, 50);
    const filtered = ids.filter(id=> id !== 'workflows.run.wow10');
    return filtered.slice(0, 6);
  }, [allActionIds, query]);

  function requiresApproval(id: string): boolean {
    if (id.startsWith('nav.') || id.startsWith('guide.') || id.startsWith('messages.copy') || id.startsWith('messages.open.')) return false;
    return true;
  }

  async function run(id: string, ...args: any[]){
    try{
      const action = getAction(id);
      if (!action) {
        setLastResult({ id, status:'error', message:'Unknown action', time: Date.now() });
        return;
      }
      if (requiresApproval(id)) {
        setConfirm({ open: true, actionId: id, args });
        return;
      }
      setBusy(true);
      try { track('ui_action_start', { id }); } catch {}
      const r = await Promise.resolve(action.run(...args));
      try { track('ui_action_result', { id, status:'ok' }); } catch {}
      setLastResult({ id, status:'ok', time: Date.now(), message: typeof r === 'string' ? r : undefined });
      try { window.dispatchEvent(new CustomEvent('bvx:action-log', { detail: { id, status:'ok', at: Date.now(), result: r } })); } catch {}
    } catch(e:any){
      try { track('ui_action_result', { id, status:'error', error:String(e?.message||e) }); } catch {}
      setLastResult({ id, status:'error', time: Date.now(), message: String(e?.message||e) });
      try { window.dispatchEvent(new CustomEvent('bvx:action-log', { detail: { id, status:'error', at: Date.now(), error: String(e?.message||e) } })); } catch {}
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={containerRef} className="fixed left-1/2 -translate-x-1/2 bottom-[env(safe-area-inset-bottom,0px)] z-40 w-full px-4 md:px-6 pb-4" id="bvx-commandbar" style={{ minHeight: 64 }}>
      <div className="mx-auto max-w-3xl rounded-2xl border bg-white/95 backdrop-blur shadow-lg">
        <div className="flex items-center gap-2 px-3 py-2">
          <input
            value={query}
            onChange={e=> setQuery(e.target.value)}
            onKeyDown={(e)=>{
              if (e.key === 'Enter' && suggestions[0]) {
                run(suggestions[0]);
              }
            }}
            placeholder="Ask for help or type a command (e.g., nav.dashboard)"
            className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
            aria-label="AskVX command input"
            disabled={busy}
          />
          <div className="flex items-center gap-2">
            <button
              className="text-[11px] px-2 py-1 rounded-md border bg-white hover:shadow-sm"
              onClick={()=>{ try{ window.location.assign('/workspace?pane=askvx'); } catch { window.location.href='/workspace?pane=askvx'; } }}
              aria-label="Open Ask VX"
            >Ask VX</button>
            <div className="text-[11px] text-slate-500">{busy? 'Working…' : lastResult? (lastResult.status==='ok'?'Ready':'Check') : 'Ready'}</div>
          </div>
        </div>
        {suggestions.length>0 && (
          <div className="px-3 pb-2 flex flex-wrap gap-2">
            {suggestions.map(id=> (
              <button key={id} onClick={()=> run(id)} className="text-xs px-2 py-1 rounded-full border bg-white hover:shadow-sm" aria-label={`Run ${id}`}>{id}</button>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirm.open}
        title="Allow this action?"
        description="AskVX will perform this step for you. You can change approvals in settings later."
        confirmText="Allow"
        cancelText="Cancel"
        onOpenChange={(o)=>{ if (!o) setConfirm({ open:false }); }}
        onConfirm={async()=>{
          const id = confirm.actionId as string;
          const args = confirm.args || [];
          setConfirm({ open:false });
          await run(id, ...(args as any[]));
        }}
      />
    </div>
  );
}

// Measure and expose Command Bar height for layout reservation
useEffectHookInstall();

function useEffectHookInstall(){
  if (typeof window === 'undefined') return;
  try {
    const install = () => {
      const el = document.getElementById('bvx-commandbar');
      if (!el) return;
      const apply = () => {
        try{
          const rect = el.getBoundingClientRect();
          const px = Math.max(0, Math.round(rect.height));
          document.documentElement.style.setProperty('--bvx-commandbar-height', `${px}px`);
        }catch{}
      };
      apply();
      const RO = (window as any).ResizeObserver as any;
      const ro = RO ? new RO(() => apply()) : null;
      if (ro) ro.observe(el);
      window.addEventListener('resize', apply);
      window.addEventListener('orientationchange', apply);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', install, { once: true } as any);
    } else {
      install();
    }
  } catch {}
}


