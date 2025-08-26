export type GuideStep = { element?: string; popover: { title: string; description: string } };
import { driver } from 'driver.js';
import { track } from './analytics';
import 'driver.js/dist/driver.css';

const registry: Record<string, GuideStep[]> = {
  onboarding: [
    { element: '[data-tour="steps"]', popover: { title: 'Steps', description: 'Quick 5 steps — you can jump around anytime.' } },
    { element: '[data-tour="connect"]', popover: { title: 'Connect tools', description: 'Link booking, messages, payments, and CRM. We keep it human.' } },
    { element: '[data-tour="analyze"]', popover: { title: 'Analyze', description: 'Run a quick analysis to see what’s configured.' } },
    { element: '[data-tour="cta"]', popover: { title: 'Ready when you are', description: 'White‑glove or self-serve — you approve everything.' } },
  ],
  dashboard: [
    { popover: { title: 'Welcome to your dashboard', description: 'Time saved, funnel, and quick actions live here.' } },
    { element: '[data-guide="quick-actions"]', popover: { title: 'Quick actions', description: 'Import contacts, preview outreach (beta), simulate a message, or connect tools.' } },
    { element: '[data-guide="kpis"]', popover: { title: 'KPIs', description: 'Track time saved, messages, revenue uplift, and referrals.' } },
    { element: '[data-guide="chart"]', popover: { title: 'Trend', description: 'Daily progress over the last 30 days.' } },
    { element: '[data-guide="queue"]', popover: { title: 'Cadence queue', description: 'What’s coming next, by contact and flow step.' } },
  ],
  integrations: [
    { popover: { title: 'Integrations', description: 'Connect booking, CRM, messaging, and inventory.' } },
    { element: '[data-guide="providers"]', popover: { title: 'Providers', description: 'Each card shows connection status and actions.' } },
    { element: '[data-guide="twilio"]', popover: { title: 'SMS via Twilio', description: 'Use a dedicated business number. Personal numbers are not supported yet.' } },
  ],
  messages: [
    { popover: { title: 'Messages', description: 'Preview & copy in beta. STOP/HELP honored automatically when sending is enabled.' } },
    { element: '[data-guide="filter"]', popover: { title: 'Filter & refresh', description: 'Search by contact_id and refresh the list.' } },
    { element: '[data-guide="simulate"]', popover: { title: 'Simulate', description: 'Generate SMS/Email examples without sending (beta).' } },
    { element: '[data-guide="quiet"]', popover: { title: 'Quiet hours', description: 'Sends are blocked during your quiet window.' } },
    { element: '[data-guide="send-form"]', popover: { title: 'Compose', description: 'Choose channel, subject (email), and body. In beta, use Copy & Mark as sent.' } },
    { element: '[data-guide="presets"]', popover: { title: 'Presets', description: 'Draft quickly; you can edit before sending.' } },
    { element: '[data-guide="table"]', popover: { title: 'History', description: 'Recent messages with status and timestamps.' } },
    { popover: { title: 'Beta note', description: 'Sending will be enabled soon. For now, use Copy recipients + Copy message and Mark as sent.' } },
  ],
  cadences: [
    { popover: { title: 'Cadences', description: 'Set up human‑feel follow‑ups; scheduler runs due actions with quiet hours respected.' } },
    { element: '[data-guide="kpis"]', popover: { title: 'Coverage', description: 'See how many contacts are in each step and what’s next.' } },
    { element: '[data-guide="send-form"]', popover: { title: 'Compose & guardrails', description: 'We honor STOP/HELP, quiet hours, and approvals (if auto‑approve is off).' } },
    { element: '[data-guide="actions"]', popover: { title: 'Start / Stop', description: 'You can start or stop a cadence anytime; actions may queue Approvals.' } },
  ],
  inventory: [
    { popover: { title: 'Inventory', description: 'Sync Shopify/Square; review low/out‑of‑stock and restock fast.' } },
    { element: '[data-guide="kpis"]', popover: { title: 'Metrics', description: 'Products, low/out-of-stock, and top SKU.' } },
    { element: '[data-guide="table"]', popover: { title: 'Items', description: 'Low and out-of-stock items are highlighted.' } },
    { popover: { title: 'Thresholds', description: 'Out=0. Low≤3 by default; you can override per item.' } },
  ],
  calendar: [
    { popover: { title: 'Calendar', description: 'Unified view from Google/Apple, merged with Square/Acuity bookings.' } },
    { element: '[data-guide="filters"]', popover: { title: 'Filters', description: 'Toggle providers to isolate sources.' } },
    { element: '[data-guide="list"]', popover: { title: 'Events/weekly grid', description: 'See upcoming events grouped by date. Use Deduplicate to remove overlaps.' } },
  ],
  inbox: [
    { popover: { title: 'Inbox', description: 'Master inbox — search and filter by channel and date.' } },
    { element: '[data-guide="channels"]', popover: { title: 'Channels', description: 'Quickly switch Facebook, Instagram, SMS, Email, or view All.' } },
    { element: '[data-guide="filters"]', popover: { title: 'Filters', description: 'Search and date filters help you narrow messages.' } },
    { element: '[data-guide="table"]', popover: { title: 'Messages', description: 'Click any row to open details.' } },
  ],
  workflows: [
    { popover: { title: 'Workflows', description: 'Everything you can do in one place. Click a flow to begin.' } },
    { element: '[data-tour="wf-quick"]', popover: { title: 'Quick actions', description: 'Run common steps without leaving this page.' } },
    { element: '[data-tour="wf-dedupe"]', popover: { title: 'Dedupe contacts', description: 'Removes duplicates by email/phone. May require approval.' } },
    { element: '[data-tour="wf-lowstock"]', popover: { title: 'Low stock check', description: 'Find items at or below threshold for restock.' } },
    { element: '[data-tour="wf-social"]', popover: { title: 'Draft 14‑day social', description: 'Creates a two‑week plan; you approve before scheduling.' } },
  ],
  approvals: [
    { popover: { title: 'Approvals', description: 'When BrandVX needs your OK, items appear here.' } },
    { element: '[data-guide="filters"]', popover: { title: 'Filter & pending', description: 'Search and toggle pending-only.' } },
    { element: '[data-guide="table"]', popover: { title: 'Items', description: 'Click a row to view details.' } },
    { element: '[data-guide="details"]', popover: { title: 'Details', description: 'Human-readable summary and parameters.' } },
    { element: '[data-guide="actions"]', popover: { title: 'Actions', description: 'Approve or Reject. Some bulk actions are available.' } },
  ],
  contacts: [
    { popover: { title: 'Contacts', description: 'Import/export and manage consent/data requests.' } },
    { element: '[data-guide="import"]', popover: { title: 'Import JSON', description: 'Paste a simple list and import.' } },
    { element: '[data-guide="export"]', popover: { title: 'Export', description: 'Download your contacts.' } },
    { element: '[data-guide="consent"]', popover: { title: 'Consent & data', description: 'Send STOP or erase personal data.' } },
    { element: '[data-guide="status"]', popover: { title: 'Status', description: 'See the result of recent actions.' } },
  ],
};

export function getGuideSteps(page: string): GuideStep[] {
  return registry[page] || [];
}

export function startGuide(page: string) {
  const steps = getGuideSteps(page);
  if (!steps || steps.length === 0) return;
  try { localStorage.setItem(`bvx_tour_seen_${page}`, '1'); } catch {}
  try { track('tour_start', { page }); } catch {}
  const d = driver({
    showProgress: true,
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    steps,
  } as any);
  d.drive();
}


// Cross-panel workflow guide orchestrator
export async function startWorkflowGuide(name: string) {
  try {
    try { localStorage.setItem(`bvx_wf_tour_seen_${name}`, '1'); } catch {}
    try { track('workflow_tour_start', { name }); } catch {}
    const res = await fetch('/guide/manifest');
    const manifest = await res.json();
    const flows = manifest?.workflows || {};
    const steps = flows[name];
    if (!Array.isArray(steps) || steps.length === 0) return;
    // Navigate to first panel, then run a minimal step-highlighting driver
    const first = steps[0];
    if (first?.panel) {
      window.location.href = `/workspace?pane=${first.panel}`;
      // Allow route transition
      setTimeout(() => {
        const d = driver({
          showProgress: true,
          steps: steps.map((s:any) => ({ element: s.selector, popover: { title: s.title, description: s.desc } }))
        } as any);
        d.drive();
      }, 400);
    }
  } catch {}
}

// Demo-wide mega tour across key panels
export function startDemoMegaTour() {
  try { localStorage.setItem('bvx_demo_mega_seen', '1'); } catch {}
  try { track('demo_mega_tour_start', {}); } catch {}
  const seq: Array<{ path: string; page: string }> = [
    { path: '/workspace?pane=dashboard&demo=1', page: 'dashboard' },
    { path: '/workspace?pane=integrations&demo=1', page: 'integrations' },
    { path: '/workspace?pane=messages&demo=1', page: 'messages' },
    { path: '/workspace?pane=contacts&demo=1', page: 'contacts' },
    { path: '/workspace?pane=calendar&demo=1', page: 'calendar' },
    { path: '/workspace?pane=inventory&demo=1', page: 'inventory' },
    { path: '/workspace?pane=approvals&demo=1', page: 'approvals' },
    // Workflows remains a standalone route
    { path: '/workflows?demo=1', page: 'workflows' },
  ];
  const driveAt = (idx: number) => {
    if (idx >= seq.length) {
      try { track('demo_mega_tour_done', {}); } catch {}
      // Return to dashboard at end
      setTimeout(()=>{ window.location.href = '/workspace?pane=dashboard&demo=1'; }, 300);
      return;
    }
    const { path, page } = seq[idx];
    // Navigate and then start that page's guide
    if (window.location.pathname + window.location.search !== path) {
      window.location.href = path;
    }
    setTimeout(() => {
      startGuide(page);
      // Heuristic duration per page before moving on
      setTimeout(() => driveAt(idx + 1), 2600);
    }, 500);
  };
  driveAt(0);
}

