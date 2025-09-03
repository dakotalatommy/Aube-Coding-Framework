export type GuideStep = { element?: string; popover: { title: string; description: string } };
import { driver } from 'driver.js';
import { track } from './analytics';
import 'driver.js/dist/driver.css';

const registry: Record<string, GuideStep[]> = {
  workspace_intro: [
    { element: '[data-tour="nav-dashboard"]', popover: { title: 'Dashboard', description: 'KPIs and quick actions live here.' } },
    { element: '[data-tour="nav-messages"]', popover: { title: 'Messages', description: 'Preview and later send SMS/Email in your voice.' } },
    { element: '[data-tour="nav-contacts"]', popover: { title: 'Contacts', description: 'Import from booking/CRM; manage consent.' } },
    { element: '[data-tour="nav-calendar"]', popover: { title: 'Calendar', description: 'Merge Google/Apple with Square/Acuity.' } },
    { element: '[data-tour="nav-cadences"]', popover: { title: 'Follow‑ups', description: 'Friendly follow‑ups; quiet hours and approvals respected.' } },
    { element: '[data-tour="nav-inventory"]', popover: { title: 'Inventory', description: 'Track low/out‑of‑stock; sync Shopify/Square.' } },
    { element: '[data-tour="nav-integrations"]', popover: { title: 'Settings', description: 'Connect tools one step at a time.' } },
    { element: '[data-tour="nav-workflows"]', popover: { title: 'WorkStyles', description: 'Playbooks like 14‑day Social and 10‑Minute Wow.' } },
    { element: '[data-tour="nav-approvals"]', popover: { title: 'To‑Do', description: 'We’ll pause here when your OK is needed.' } },
    { element: '[data-tour="nav-askvx"]', popover: { title: 'Ask VX', description: 'Ask, plan, and run tools with one tap. You approve changes.' } },
    { element: '[data-tour="nav-vision"]', popover: { title: 'Brand Vision', description: 'Analyze/edit images and fetch socials; save to clients.' } },
    { element: '#bvx-commandbar', popover: { title: 'Ask or type a command', description: 'Quickly navigate or run actions. You approve anything impactful.' } },
    { element: '[data-tour="demo-toggle"]', popover: { title: 'Demo mode', description: 'Turn demo on/off. Demo uses simulated data only.' } },
    { element: '[data-tour="book-onboarding"]', popover: { title: 'Book onboarding', description: 'Prefer a white‑glove walkthrough? Book a time.' } },
    { element: '[data-tour="signup"]', popover: { title: 'Sign up / Sign out', description: 'Create your workspace or sign out anytime.' } },
  ],
  onboarding: [
    { element: '[data-tour="steps"]', popover: { title: 'Steps', description: 'Quick 5 steps — you can jump around anytime.' } },
    { element: '[data-tour="connect"]', popover: { title: 'Connect tools', description: 'Link booking, messages, payments, and CRM. We keep it human.' } },
    { element: '[data-tour="analyze"]', popover: { title: 'Analyze', description: 'Run a quick analysis to see what’s configured.' } },
    { element: '[data-tour="cta"]', popover: { title: 'Ready when you are', description: 'White‑glove or self-serve — you approve everything.' } },
  ],
  dashboard: [
    { popover: { title: 'Welcome to your dashboard', description: 'Time saved, quick wins, and KPIs live here.' } },
    { element: '[data-guide="kpis"]', popover: { title: 'KPIs', description: 'Track time saved, rebook rate (30d), messages, and revenue uplift.' } },
    { element: '[data-guide="referral"]', popover: { title: 'Referral link', description: 'Invite 2 friends to lock founding price; copy your link here.' } },
    { element: '[data-guide="quickstart"]', popover: { title: 'Quick start', description: 'Run 14‑day Social or 10‑Minute Wow from here.' } },
    { element: '[data-guide="primary"]', popover: { title: 'Primary action', description: 'Today’s suggested next step, always one tap away.' } },
  ],
  askvx: [
    { popover: { title: 'Ask VX', description: 'Chat with your ops co‑pilot. Answers in your brand voice.' } },
    { element: '[data-guide="history"]', popover: { title: 'History', description: 'Open recent messages for continuity.' } },
    { element: '[data-guide="composer"]', popover: { title: 'Compose', description: 'Type your question; Enter to send; Shift+Enter for newline.' } },
    { element: '[data-guide="smart-action"]', popover: { title: 'Smart action', description: 'VX proposes one safe action; you approve and we run it.' } },
    { element: '[data-guide="digest"]', popover: { title: 'Since your last visit', description: 'Quick digest of changes across contacts, bookings, and messages.' } },
    { element: '[data-guide="trainer"]', popover: { title: 'Train VX', description: 'Add tone notes; VX prefers this voice in drafts.' } },
  ],
  vision: [
    { popover: { title: 'Brand Vision', description: 'Analyze/edit photos, fetch socials, and save to clients.' } },
    { element: '[data-guide="preview"]', popover: { title: 'Preview', description: 'Your working image; edits update here.' } },
    { element: '[data-guide="upload"]', popover: { title: 'Upload', description: 'Pick a photo or screenshot to analyze or edit.' } },
    { element: '[data-guide="analyze"]', popover: { title: 'Analyze', description: 'Gemini inspects lighting, framing, and quality flags.' } },
    { element: '[data-guide="edit"]', popover: { title: 'Edit / Try‑on', description: 'Apply subtle edits or preset looks; export results.' } },
    { element: '[data-guide="social"]', popover: { title: 'Social fetch', description: 'Fetch public profile and recent posts (best effort).' } },
    { element: '[data-guide="save"]', popover: { title: 'Save to client', description: 'Link images to a client record for before/after.' } },
  ],
  integrations: [
    { popover: { title: 'Integrations', description: 'Connect booking, CRM, messaging, and inventory.' } },
    { element: '[data-guide="providers"]', popover: { title: 'What each does', description: 'Booking (Square/Acuity), Calendar (Google/Apple), CRM (HubSpot), Messaging (Twilio/SendGrid), Commerce (Shopify).' } },
    { element: '[data-guide="reanalyze"]', popover: { title: 'Re‑analyze', description: 'Re‑pull provider deltas and refresh KPIs after connecting or changing settings.' } },
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
    { popover: { title: 'Follow‑ups', description: 'Set up human‑feel follow‑ups. “Update follow‑ups” processes due steps and respects quiet hours.' } },
    { element: '[data-guide="kpis"]', popover: { title: 'Coverage', description: 'See how many contacts are in each step and what’s next.' } },
    { element: '[data-guide="send-form"]', popover: { title: 'Compose & guardrails', description: 'STOP/HELP, quiet hours, and approvals (if auto‑approve is off) are always respected.' } },
    { element: '[data-guide="actions"]', popover: { title: 'Start / Stop', description: 'Start or stop a follow‑up anytime; some steps may queue Approvals.' } },
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
    { popover: { title: 'WorkStyles', description: 'Everything you can do in one place. Click a flow to begin.' } },
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
    { popover: { title: 'Contacts', description: 'Bring your clients from booking or CRM; manage consent and data.' } },
    { element: '[data-guide="import"]', popover: { title: 'Import', description: 'Import from booking (Square/Acuity) or sync from CRM (HubSpot).' } },
    { element: '[data-guide="consent"]', popover: { title: 'Consent & data', description: 'Send STOP or erase personal data.' } },
    { element: '[data-guide="status"]', popover: { title: 'Status', description: 'See the result of recent actions.' } },
  ],
};

export function getGuideSteps(page: string): GuideStep[] {
  return registry[page] || [];
}

export function startGuide(page: string, opts?: { step?: number }) {
  const steps = getGuideSteps(page);
  if (!steps || steps.length === 0) return;
  // Persist last guide context for resume
  try { localStorage.setItem('bvx_last_tour_page', page); } catch {}
  try {
    const urlStep = (()=>{ try{ const sp = new URLSearchParams(window.location.search); return Number(sp.get('tourStep')||sp.get('step')||'0'); }catch{ return 0 } })();
    const raw = Number(opts?.step || 0) || (Number.isFinite(urlStep) ? urlStep : 0);
    const s = Math.max(0, Math.floor(raw||0));
    localStorage.setItem('bvx_last_tour_step', String(s||0));
  } catch {}
  // Demo-specific orchestration: if on dashboard with demo=1, chain across panels
  try {
    const sp = new URLSearchParams(window.location.search);
    const isDemo = sp.get('demo') === '1';
    // Gate per page once per session
    if (isDemo) {
      const key = `bvx_tour_seen_${page}_session`;
      if (sessionStorage.getItem(key) === '1') {
        return;
      }
      try { sessionStorage.setItem(key, '1'); } catch {}
    }
    if (isDemo && page === 'dashboard') {
      // Welcome only on dashboard, then single-step per pane sequence
      const demoStepsMap: Record<string, GuideStep[]> = {
        dashboard: [
          { element: '[data-guide="kpis"]', popover: { title: 'Dashboard', description: 'KPIs up top — then we’ll show each area briefly.' } },
        ],
        messages: [
          { element: '[data-guide="table"]', popover: { title: 'Messages', description: 'Preview and copy examples (beta). Sending will enable automatically later.' } },
        ],
        contacts: [
          { element: '[data-guide="import"]', popover: { title: 'Contacts', description: 'Import/export and manage consent. Simple JSON import to start.' } },
        ],
        calendar: [
          { element: '[data-guide="list"]', popover: { title: 'Calendar', description: 'Unified weekly grid from Google/Apple plus Square/Acuity bookings.' } },
        ],
        cadences: [
          { element: '[data-guide="actions"]', popover: { title: 'Cadences', description: 'Human‑feel follow‑ups; respects quiet hours and approvals.' } },
        ],
        inventory: [
          { element: '[data-guide="table"]', popover: { title: 'Inventory', description: 'Sync Shopify/Square; spot low/out‑of‑stock quickly.' } },
        ],
        integrations: [
          { element: '[data-guide="providers"]', popover: { title: 'Integrations', description: 'Connect booking, CRM, messaging, and more — status at a glance.' } },
        ],
        workflows: [
          { element: '[data-tour="wf-quick"]', popover: { title: 'WorkStyles', description: 'One place for common actions and impact steps.' } },
        ],
        approvals: [
          { element: '[data-guide="table"]', popover: { title: 'Approvals', description: 'Risky or bulk actions wait here for your OK.' } },
        ],
        onboarding: [
          { popover: { title: 'Onboarding', description: 'In live, you’ll start here — 5 quick steps to get going.' } },
        ],
      };
      const seq: Array<{ path: string; key: string }> = [
        { path: '/workspace?pane=dashboard&demo=1', key: 'dashboard' },
        { path: '/workspace?pane=messages&demo=1', key: 'messages' },
        { path: '/workspace?pane=contacts&demo=1', key: 'contacts' },
        { path: '/workspace?pane=calendar&demo=1', key: 'calendar' },
        { path: '/workspace?pane=cadences&demo=1', key: 'cadences' },
        { path: '/workspace?pane=inventory&demo=1', key: 'inventory' },
        { path: '/workspace?pane=integrations&demo=1', key: 'integrations' },
        { path: '/workspace?pane=workflows&demo=1', key: 'workflows' },
        { path: '/workspace?pane=approvals&demo=1', key: 'approvals' },
        { path: '/workspace?pane=onboarding&demo=1', key: 'onboarding' },
      ];
      const driveAt = (idx: number) => {
        if (idx >= seq.length) return;
        const { path, key } = seq[idx];
        if (window.location.pathname + window.location.search !== path) {
          window.location.href = path;
        }
        setTimeout(() => {
          const steps = demoStepsMap[key] || [];
          try { sessionStorage.setItem(`bvx_tour_seen_${key}_session`, '1'); } catch {}
          try { track('tour_start', { page: key }); } catch {}
          const d = driver({ showProgress: true, steps } as any);
          d.drive();
          const next = idx + 1;
          setTimeout(() => {
            if (next >= seq.length) {
              // Final: highlight demo Sign up button
              try {
                const d2 = driver({
                  showProgress: true,
                  steps: [
                    { element: '[data-guide="demo-signup"]', popover: { title: 'Create your BrandVX', description: 'Ready to continue? Tap Sign up to start your live workspace.' } }
                  ],
                } as any);
                d2.drive();
              } catch {}
              return;
            }
            driveAt(next);
          }, 2300);
        }, 450);
      };
      driveAt(0);
      return;
    }
  } catch {}
  try { localStorage.setItem(`bvx_tour_seen_${page}`, '1'); } catch {}
  try { track('tour_start', { page }); } catch {}
  // Support deep-link to a specific step by slicing steps
  let startAt = 0;
  try {
    const fromOpts = Number(opts?.step||0);
    const fromUrl = (()=>{ try{ const sp = new URLSearchParams(window.location.search); return Number(sp.get('tourStep')||sp.get('step')||'0'); }catch{ return 0 } })();
    startAt = Math.max(0, (fromOpts || fromUrl || 0) - 1);
  } catch { startAt = 0; }
  const stepsToRun = Array.isArray(steps) ? steps.slice(startAt) : steps;
  const d = driver({
    showProgress: true,
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    steps: stepsToRun,
  } as any);
  d.drive();
  try {
    // Notify workspace when the intro finishes so onboarding prompt can trigger
    if (page === 'workspace_intro' && typeof (d as any).on === 'function') {
      (d as any).on('destroyed', () => {
        try { window.dispatchEvent(new CustomEvent('bvx:guide:workspace_intro:done')); } catch {}
      });
    }
  } catch {}
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

