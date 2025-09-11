import { api, getTenant } from './api';
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
              const r = await api.post('/ai/tools/execute', { tenant_id: tid, ...p, require_approval: true });
              if (!r?.error) return r;
            } catch {}
          }
        } catch {}
        return { status:'not_available' };
      }
    },
    'workflows.run.reminders': {
      id: 'workflows.run.reminders',
      run: async () => {
        try {
          const tid = await getTenant();
          return await api.post('/ai/tools/execute', { tenant_id: tid, name:'appointments.schedule_reminders', params:{ tenant_id: tid }, require_approval: false });
        } catch { return { status:'error' }; }
      },
      description: 'Schedule gentle appointment reminders for this week'
    },
    'workflows.run.reengage_30': {
      id: 'workflows.run.reengage_30',
      run: async () => {
        try {
          const tid = await getTenant();
          return await api.post('/ai/tools/execute', { tenant_id: tid, name:'campaigns.dormant.preview', params:{ tenant_id: tid, threshold_days: 30 }, require_approval: false });
        } catch { return { status:'error' }; }
      },
      description: 'Preview 30‑day re‑engagement list'
    },
    'workflows.run.winback_45': {
      id: 'workflows.run.winback_45',
      run: async () => {
        try {
          const tid = await getTenant();
          return await api.post('/ai/tools/execute', { tenant_id: tid, name:'campaigns.dormant.preview', params:{ tenant_id: tid, threshold_days: 45 }, require_approval: false });
        } catch { return { status:'error' }; }
      },
      description: 'Preview 45+ day win‑back list'
    },
    'workflows.run.social_plan': {
      id: 'workflows.run.social_plan',
      run: async () => {
        try {
          const tid = await getTenant();
          return await api.post('/ai/tools/execute', { tenant_id: tid, name:'social.schedule.14days', params:{ tenant_id: tid }, require_approval: true });
        } catch { return { status:'error' }; }
      },
      description: 'Draft a 14‑day social plan'
    },
    'workflows.run.import_and_normalize': {
      id: 'workflows.run.import_and_normalize',
      run: async () => {
        try {
          const tid = await getTenant();
          // Attempt import first, then normalize/cleanup
          try { await api.post('/ai/tools/execute', { tenant_id: tid, name:'contacts.import.square', params:{ tenant_id: tid }, require_approval: true }); } catch {}
          try { await api.post('/ai/tools/execute', { tenant_id: tid, name:'connectors.normalize', params:{ tenant_id: tid }, require_approval: false }); } catch {}
          try { await api.post('/ai/tools/execute', { tenant_id: tid, name:'connectors.cleanup', params:{ tenant_id: tid }, require_approval: false }); } catch {}
          return { status:'ok' };
        } catch { return { status:'error' }; }
      },
      description: 'Pull bookings and tidy contact list'
    },
    'workflows.run.calendar_sync': {
      id: 'workflows.run.calendar_sync',
      run: async () => {
        try {
          const tid = await getTenant();
          return await api.post('/ai/tools/execute', { tenant_id: tid, name:'calendar.sync', params:{ tenant_id: tid }, require_approval: false });
        } catch { return { status:'error' }; }
      },
      description: 'Sync calendar now'
    },
    'workflows.run.calendar_merge': {
      id: 'workflows.run.calendar_merge',
      run: async () => {
        try {
          const tid = await getTenant();
          return await api.post('/ai/tools/execute', { tenant_id: tid, name:'calendar.merge', params:{ tenant_id: tid }, require_approval: false });
        } catch { return { status:'error' }; }
      },
      description: 'Merge duplicate calendar events'
    },
    'workflows.run.dedupe_contacts': {
      id: 'workflows.run.dedupe_contacts',
      run: async () => {
        try {
          const tid = await getTenant();
          return await api.post('/ai/tools/execute', { tenant_id: tid, name:'contacts.dedupe', params:{ tenant_id: tid }, require_approval: true });
        } catch { return { status:'error' }; }
      },
      description: 'Remove duplicate contacts'
    },
    'nav.billing': {
      id: 'nav.billing',
      run: async () => { try { window.location.assign('/billing'); } catch { window.location.href = '/billing'; } return { status:'ok' }; },
      description: 'Open Billing'
    },
    'nav.integrations': {
      id: 'nav.integrations',
      run: async () => { try { window.location.assign('/workspace?pane=integrations'); } catch { window.location.href = '/workspace?pane=integrations'; } return { status:'ok' }; },
      description: 'Open Settings/Connections'
    },
    // Quick actions for Command Bar
    'quick.import_bookings': {
      id: 'quick.import_bookings',
      run: async () => {
        try { const tid = await getTenant(); return await api.post('/ai/tools/execute', { tenant_id: tid, name: 'contacts.import.square', params: { tenant_id: tid }, require_approval: true }); } catch { return { status: 'error' }; }
      },
      description: 'Import booking data (Square)'
    },
    'nav.connect_google_calendar': {
      id: 'nav.connect_google_calendar',
      run: async () => { try { window.location.assign('/workspace?pane=integrations&provider=google'); } catch { window.location.href = '/workspace?pane=integrations&provider=google'; } return { status:'ok' }; },
      description: 'Connect Google Calendar'
    },
    'nav.open_brandvzn_demo': {
      id: 'nav.open_brandvzn_demo',
      run: async () => { try { window.location.assign('/vision?demo=1'); } catch { window.location.href = '/vision?demo=1'; } return { status:'ok' }; },
      description: 'Open brandVZN demo'
    },
    'nav.open_todo': {
      id: 'nav.open_todo',
      run: async () => { try { window.location.assign('/workspace?pane=approvals'); } catch { window.location.href = '/workspace?pane=approvals'; } return { status:'ok' }; },
      description: 'Open To‑Do'
    },
    'nav.view_14day_plan': {
      id: 'nav.view_14day_plan',
      run: async () => { try { window.location.assign('/dashboard'); } catch { window.location.href = '/dashboard'; } return { status:'ok' }; },
      description: 'View 14‑day Plan'
    }
  });
} catch {}
