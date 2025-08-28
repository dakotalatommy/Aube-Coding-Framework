export type UIAction = {
  id: string;
  run: (...args: any[]) => Promise<any> | any;
  description?: string;
};

export type UIActionsRegistry = Record<string, UIAction>;

let registry: UIActionsRegistry = {};

export function registerActions(map: UIActionsRegistry) {
  registry = { ...registry, ...map };
}

export function getAction(id: string): UIAction | undefined {
  return registry[id];
}

export function listActions(): string[] {
  return Object.keys(registry);
}

export function registerMessageBridge(getOrigin?: () => string) {
  const handler = async (event: MessageEvent) => {
    try {
      const originOk = typeof getOrigin === 'function' ? event.origin === getOrigin() : true;
      if (!originOk) return;
      const data = event?.data || {};
      if (!data || data.type !== 'bvx:action') return;
      const { action, args, requestId } = data;
      const act = getAction(String(action));
      if (!act) {
        (event.source as any)?.postMessage?.({ type: 'bvx:action:result', requestId, error: 'unknown_action' }, event.origin);
        return;
      }
      const result = await Promise.resolve(act.run(...(Array.isArray(args)? args: [])));
      (event.source as any)?.postMessage?.({ type: 'bvx:action:result', requestId, result }, event.origin);
    } catch (e:any) {
      try { (event.source as any)?.postMessage?.({ type: 'bvx:action:result', requestId: (event as any)?.data?.requestId, error: String(e?.message||e) }, event.origin); } catch {}
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

// Convenience: run a registered action by id from any component
export async function runUIAction(id: string, ...args: any[]): Promise<any> {
  const act = getAction(id);
  if (!act) return { error: 'unknown_action' } as any;
  return await Promise.resolve(act.run(...(Array.isArray(args)? args: [])));
}

// Register a few common plan actions if not present (defensive)
try {
  registerActions({
    'workflows.run.wow10': {
      id: 'workflows.run.wow10',
      run: async () => {
        try {
          const tid = localStorage.getItem('bvx_tenant')||'';
          // Prefer a specific tool name if backend supports it; fall back to a generic notice
          const payloads = [
            { name:'wow.quickstart.10min', params:{ tenant_id: tid } },
            { name:'starter.wow.10min', params:{ tenant_id: tid } },
          ];
          for (const p of payloads) {
            try {
              const r = await (await fetch('/ai/tools/execute', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ tenant_id: tid, ...p, require_approval: true }) })).json();
              if (!r?.error) return r;
            } catch {}
          }
        } catch {}
        return { status:'not_available' };
      }
    }
  });
} catch {}

