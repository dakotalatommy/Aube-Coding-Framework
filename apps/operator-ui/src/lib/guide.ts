export type GuideStep = { element?: string; popover: { title: string; description: string } };
import { track } from './analytics';
import { api } from './api';
import 'driver.js/dist/driver.css';
import { flags } from './flags';

const registry: Record<string, GuideStep[]> = {
  workspace_intro: [
    { element: '[data-tour="nav-dashboard"]', popover: { title: 'Dashboard', description: 'KPIs up top; “Next Best Steps” shows Day N/14 and today’s tasks.' } },
    { element: '[data-tour="nav-askvx"]', popover: { title: 'askVX', description: 'Ask in your voice. We suggest safe actions; you’re in control.' } },
    { element: '[data-tour="nav-vision"]', popover: { title: 'brandVZN', description: 'Upload, analyze, and refine with natural, texture‑safe edits.' } },
    { element: '[data-tour="nav-messages"]', popover: { title: 'Messages', description: 'Draft in one tap. Quiet hours + STOP/HELP are respected.' } },
    { element: '[data-tour="nav-contacts"]', popover: { title: 'Clients', description: 'Predictive search, quick copy (email/phone), and context drafts.' } },
    { element: '[data-tour="nav-calendar"]', popover: { title: 'Calendar', description: 'Unified week grid: Google + booking. Mirror events to Google.' } },
    { element: '[data-tour="nav-cadences"]', popover: { title: 'Follow‑ups', description: 'Tomorrow, this week, 30‑day re‑engage, 45‑day win‑back — fast.' } },
    { element: '[data-tour="nav-inventory"]', popover: { title: 'Inventory', description: 'Sync Shopify/Square. See low/out‑of‑stock at a glance.' } },
    { element: '[data-tour="nav-approvals"]', popover: { title: 'To‑Do', description: 'Anything needing your OK lands here — resolve in one click.' } },
    { element: '[data-tour="nav-integrations"]', popover: { title: 'Settings', description: 'Connect Square/Acuity/Google; Setup Progress updates live.' } },
    { element: '[data-tour="book-onboarding"]', popover: { title: 'Book Onboarding', description: 'Book a 1-on-1 onboarding for an in-depth walk through of brand BX (beyond the brand)!' } },
  ],
  onboarding: [
    { element: '[data-tour="steps"]', popover: { title: 'Steps', description: 'Personalize your brandVX — you can jump around anytime.' } },
    { element: '[data-tour="connect"]', popover: { title: 'Connect tools', description: 'Link booking, messages, payments, and CRM. We keep it human.' } },
    { element: '[data-tour="analyze"]', popover: { title: 'Analyze', description: 'Run a quick analysis to see what’s configured.' } },
    { element: '[data-tour="cta"]', popover: { title: 'Ready when you are', description: 'White‑glove or self-serve — you approve everything.' } },
  ],
  dashboard: [
    { popover: { title: 'Welcome', description: 'Your time saved, wins, and a gentle plan — all in one place.' } },
    { element: '[data-guide="kpis"]', popover: { title: 'KPIs', description: 'Messages sent, Time saved, Rebook rate (30d), Revenue uplift.' } },
    { element: '[data-guide="quickstart"]', popover: { title: 'Quick start', description: 'Open brandVZN, import clients, or train VX — 3 fast wins.' } },
    { element: '[data-guide="quickstart-brandvzn"]', popover: { title: 'brandVZN', description: 'Start here — upload a photo and try a quick edit to see it in action.' } },
    { element: '[data-guide="next-best-steps"]', popover: { title: 'Next Best Steps', description: 'Day N/14 with today’s tasks. Generate a plan anytime.' } },
  ],
  askvx: [
    { popover: { title: 'askVX', description: 'Your co‑pilot. Short answers, your tone, ready to act (with approval).' } },
    { element: '[data-guide="history"]', popover: { title: 'History', description: 'Open session history; start a new session without reloading.' } },
    { element: '[data-guide="composer"]', popover: { title: 'Compose', description: 'Enter to send; Shift+Enter for new line. Templates are one‑tap.' } },
    { element: '[data-guide="smart-action"]', popover: { title: 'Smart action', description: 'We propose one safe next step; you can run it instantly.' } },
    { element: '[data-guide="digest"]', popover: { title: 'Digest', description: 'Recent contacts, bookings, messages — summarized for you.' } },
    { element: '[data-guide="trainer"]', popover: { title: 'trainVX', description: 'Save tone notes and profile to sharpen drafts.' } },
  ],
  vision: [
    { popover: { title: 'Brand Vision', description: 'Analyze and refine photos — fast, natural, beauty‑friendly.' } },
    { element: '[data-guide="preview"]', popover: { title: 'Preview', description: 'Your working image; press/hold for before/after.' } },
    { element: '[data-guide="upload"]', popover: { title: 'Upload', description: 'Pick a photo or screenshot to analyze or edit.' } },
    { element: '[data-guide\="analyze"]', popover: { title: 'Analyze', description: 'GPT‑5 returns a short brief (lighting, color, texture). Use Notes to ask a specific question.' } },
    { element: '[data-guide="edit"]', popover: { title: 'Edit', description: 'Run subtle edits using the prompt to the left.' } },
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
    { popover: { title: 'To‑Do', description: 'When brandVX needs your OK, items appear here.' } },
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
  // Server checkpoint: tour started for this page (use API base)
  try {
    const tenantId = (()=>{ try{ return localStorage.getItem('bvx_tenant')||''; }catch{ return '' }})();
    if (tenantId) void api.post('/onboarding/complete_step', { tenant_id: tenantId, step_key: `tour.start.${page}`, context: {} });
  } catch {}
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
          { element: '[data-guide="list"]', popover: { title: 'Calendar', description: 'Weekly grid view with names & times. Filter by provider.' } },
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
          { element: '[data-guide="table"]', popover: { title: 'To‑Do', description: 'Pending / All filters and types. Mark done to resolve.' } },
        ],
        onboarding: [
          { popover: { title: 'Onboarding', description: 'In live, you’ll start here — personalize your brandVX.' } },
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
          (async()=>{
            const mod2: any = await import('driver.js');
            const drv2 = (mod2 && (mod2 as any).driver) ? (mod2 as any).driver : (mod2 as any);
            const d = drv2({ showProgress: true, steps } as any);
            d.drive();
          })();
          const next = idx + 1;
          setTimeout(() => {
            if (next >= seq.length) {
              // Final: highlight demo Sign up button
              try {
                (async()=>{
                  const mod3: any = await import('driver.js');
                  const drv3 = (mod3 && (mod3 as any).driver) ? (mod3 as any).driver : (mod3 as any);
                  const d2 = drv3({
                    showProgress: true,
                    steps: [
                      { element: '[data-guide="demo-signup"]', popover: { title: 'Create your brandVX', description: 'Ready to continue? Tap Sign up to start your live workspace.' } }
                    ],
                  } as any);
                  d2.drive();
                })();
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
  // Sanitize steps: if an element selector is missing, fall back to a popover-only step
  const sanitize = (arr: GuideStep[]): GuideStep[] => {
    try {
      return arr.map((s) => {
        if (!s.element) return s;
        try {
          if (document.querySelector(String(s.element))) return s;
        } catch {}
        return { popover: s.popover } as GuideStep;
      });
    } catch { return arr; }
  };
  const stepsToRun = sanitize(Array.isArray(steps) ? steps.slice(startAt) : steps);
  (async()=>{
    const mod: any = await import('driver.js');
    const drv = (mod && (mod as any).driver) ? (mod as any).driver : (mod as any);
    let lastIndex = -1;
    const totalSteps = Array.isArray(stepsToRun) ? stepsToRun.length : 0;
    // Determine the index of the BrandVZN (dashboard quickstart) step if present
    const brandVznIdx = (()=>{
      try{
        if (page !== 'dashboard') return -1;
        const raw = Array.isArray(steps) ? steps : [];
        for (let i=0; i<raw.length; i++){
          const s:any = raw[i];
          if (s?.element === '[data-guide="quickstart-brandvzn"]' || String(s?.popover?.title||'').toLowerCase().includes('brandvzn')){
            return Math.max(0, i - Math.max(0, startAt));
          }
        }
      }catch{}
      return -1;
    })();
    // Determine the index of the Book Onboarding step within the workspace intro, if present
    const bookIdx = (()=>{
      try{
        if (page !== 'workspace_intro') return -1;
        const raw = Array.isArray(steps) ? steps : [];
        for (let i=0; i<raw.length; i++){
          const s:any = raw[i];
          if (s?.element === '[data-tour="book-onboarding"]'){
            return Math.max(0, i - Math.max(0, startAt));
          }
        }
      }catch{}
      return -1;
    })();
    const d = drv({
      showProgress: true,
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      steps: stepsToRun,
    } as any);
    try {
      (d as any).on?.('highlighted', (_el:any, _step:any, idx:any)=>{
        try { lastIndex = typeof idx === 'number' ? idx : (lastIndex + 1); } catch { lastIndex = lastIndex + 1; }
      });
      (d as any).on?.('next', ()=>{
        try {
          if (lastIndex < totalSteps - 1) lastIndex = lastIndex + 1;
        } catch { lastIndex = lastIndex + 1; }
        // When user advances past the BrandVZN highlight on Dashboard, jump to Vision panel and start its guide
        try{
          if (page === 'dashboard' && brandVznIdx >= 0 && lastIndex === brandVznIdx + 1){
            try { (d as any).destroy?.(); } catch {}
            setTimeout(()=>{
              try { window.location.href = '/workspace?pane=vision'; } catch {}
              setTimeout(()=>{ try { startGuide('vision'); } catch {} }, 480);
            }, 60);
          }
          // When user advances past Book Onboarding in the workspace intro, open billing then hop to Brand VZN tour
          if (page === 'workspace_intro' && bookIdx >= 0 && lastIndex === bookIdx + 1){
            try { (d as any).destroy?.(); } catch {}
            setTimeout(async()=>{
              try { sessionStorage.setItem('bvx_billing_prompt_request','1'); } catch {}
              try { window.dispatchEvent(new CustomEvent('bvx:billing:prompt')); } catch {}
              try { await waitForBillingSatisfiedSimple(); } catch {}
              try { window.location.href = '/workspace?pane=vision'; } catch {}
              setTimeout(()=>{ try { startGuide('vision'); } catch {} }, 480);
            }, 60);
          }
        }catch{}
      });
    } catch {}
    d.drive();
    try {
      if (flags.tour_resume_chip()) {
        (d as any).on?.('destroyed', ()=>{
          try{
            try { track('tour_destroyed', { page }); } catch {}
            const completed = lastIndex >= totalSteps - 1 && totalSteps > 0;
            if (completed) {
              try { markProgress(`tour.done.${page}`); } catch {}
            }
            // Mark workspace intro seen only on true completion
            if (page === 'workspace_intro' && completed) {
              try { localStorage.setItem('bvx_tour_seen_workspace_intro','1'); } catch {}
            }
            const chip = document.createElement('button');
            chip.className = 'fixed right-3 bottom-3 z-[2000] text-xs px-2 py-1 rounded-full border bg-white shadow';
            chip.textContent = 'Resume tour';
            chip.onclick = ()=>{ try{ chip.remove(); }catch{} startGuide(page, { step: Number(localStorage.getItem('bvx_last_tour_step')||'0')||0 }); };
            document.body.appendChild(chip);
            setTimeout(()=>{ try{ chip.remove(); }catch{} }, 8000);
          } catch {}
        });
      }
    } catch {}
    try {
      // Notify workspace when the intro finishes so onboarding prompt can trigger
      if (page === 'workspace_intro' && typeof (d as any).on === 'function') {
        (d as any).on('destroyed', () => {
          try {
            const completed = lastIndex >= totalSteps - 1 && totalSteps > 0;
            if (completed) window.dispatchEvent(new CustomEvent('bvx:guide:workspace_intro:done'));
          } catch {}
        });
      }
    } catch {}
  })();
}

// Resilient DOM wait helper
async function waitForSelector(selector: string, timeoutMs: number = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      try {
        if (document.querySelector(selector)) return resolve(true);
      } catch {}
      if (Date.now() - start >= timeoutMs) return resolve(false);
      setTimeout(tick, 80);
    };
    tick();
  });
}

async function markProgress(key: string) {
  try {
    const tenantId = (()=>{ try{ return localStorage.getItem('bvx_tenant')||''; }catch{ return '' }})();
    if (!tenantId) return;
    await fetch('/onboarding/complete_step', {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, step_key: key, context: {} })
    });
  } catch {}
}

// Simple billing waiter usable from step-level handoffs
async function waitForBillingSatisfiedSimple() {
  const maxWaitMs = 20000; const start = Date.now();
  const isCovered = async (): Promise<boolean> => {
    try {
      const tid = (localStorage.getItem('bvx_tenant')||'');
      if (!tid) return false;
      const j = await api.get(`/settings?tenant_id=${encodeURIComponent(tid)}`);
      const st = String(j?.data?.subscription_status || j?.subscription_status || '');
      return st === 'active' || st === 'trialing';
    } catch { return false; }
  };
  for (;;) {
    try {
      if (localStorage.getItem('bvx_billing_dismissed') === '1') return;
      if (await isCovered()) return;
    } catch {}
    if (Date.now() - start > maxWaitMs) return; // fail-open
    await new Promise(r=> setTimeout(r, 600));
  }
}

function prefetchPath(path: string) {
  try {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = path;
    document.head.appendChild(link);
    // Also fire a best-effort fetch to warm caches
    try { fetch(path, { mode: 'no-cors' } as any).catch(()=>{}); } catch {}
  } catch {}
}

// Cross-page showcase: Dashboard → brandVZN → Contacts (Import) → Ask VX → Dashboard
export function startShowcase(opts?: { resume?: boolean }) {
  // Begin only after the 13-step workspace intro has completed
  const begin = () => {
    try { localStorage.setItem('bvx_showcase_started','1'); } catch {}
    try { track('showcase_start'); } catch {}
    try { markProgress('showcase.start'); } catch {}
    const demoSuffix = (()=>{ try{ return new URLSearchParams(window.location.search).get('demo')==='1' ? '&demo=1' : ''; } catch { return ''; } })();
    const steps: Array<{ path: string; guide?: string; wait?: string; progress?: string }> = [
      { path: `/workspace?pane=dashboard${demoSuffix}` as any, guide: 'dashboard', wait: '[data-guide="quickstart"]', progress: 'showcase.dashboard' },
    ];
  // Branch: if booking not connected, detour to Integrations first
  try {
    (async()=>{
      try{
        const j = await api.post('/onboarding/analyze', {});
        const cm = (j?.summary?.connected || {}) as Record<string,string>;
        const bookingOn = String(cm.square||'')==='connected' || String(cm.acuity||'')==='connected';
        if (!bookingOn) {
          steps.push({ path: `/workspace?pane=integrations&tour=1&onboard=1${demoSuffix}` as any, guide: 'integrations', wait: '[data-guide="providers"]', progress: 'showcase.integrations' });
        }
      } catch {}
      steps.push(
        // Stay within the workspace tab/pane for all steps
        // Billing CTA comes after booking (integrations) and before brandVZN — event-based (no URL param)
        { path: `/workspace?pane=dashboard${demoSuffix}` as any, guide: undefined as any, wait: undefined as any, progress: 'showcase.billing' },
        // brandVZN: upload → edit hair → refine eyes, with explicit dashboard hop afterward
        { path: `/workspace?pane=vision&tour=1&onboard=1${demoSuffix}` as any, guide: 'vision', wait: '[data-guide="preview"][data-vision-has-preview="1"]', progress: 'showcase.vision.upload' },
        { path: `/workspace?pane=vision&tour=1&onboard=1${demoSuffix}` as any, guide: 'vision', wait: '[data-guide="preview"][data-vision-edits="1"]', progress: 'showcase.vision.edit.hair' },
        { path: `/workspace?pane=vision&tour=1&onboard=1${demoSuffix}` as any, guide: 'vision', wait: '[data-guide="preview"][data-vision-edits="2"]', progress: 'showcase.vision.edit.eyes' },
        { path: `/workspace?pane=dashboard${demoSuffix}` as any, guide: 'dashboard', wait: '[data-guide="quickstart"]', progress: 'showcase.back.dashboard.after.vision' },
        // Contacts import, then AskVX, then dashboard hop
        { path: `/workspace?pane=contacts&tour=1&onboard=1${demoSuffix}` as any, guide: 'contacts', wait: '[data-guide="import"]', progress: 'showcase.contacts' },
        { path: `/workspace?pane=askvx&onboard=1&autosummarize=1${demoSuffix}` as any, guide: 'askvx', wait: '[data-guide="composer"]', progress: 'showcase.ask' },
        { path: `/workspace?pane=dashboard${demoSuffix}` as any, guide: 'dashboard', wait: '[data-guide="quickstart"]', progress: 'showcase.back.dashboard.after.ask' },
        // Train & Profile hop, then final dashboard
        { path: `/workspace?pane=askvx&onboard=1&page=2${demoSuffix}` as any, guide: 'askvx', wait: '[data-guide="composer"]', progress: 'showcase.trainvx' },
        { path: `/workspace?pane=dashboard${demoSuffix}` as any, guide: 'dashboard', wait: '[data-guide="next-best-steps"]', progress: 'showcase.done' },
      );
    })();
  } catch {}
  // Prefetch upcoming routes without navigating
  try {
    steps.forEach(s=>{ try { if (s.path) prefetchPath(s.path); } catch {} });
  } catch {}
  // Determine starting index (support resume)
  let i = 0;
  try {
    if (opts?.resume) {
      const lastIndex = Number(localStorage.getItem('bvx_showcase_index')||'');
      if (Number.isFinite(lastIndex)) i = Math.max(0, lastIndex + 1);
    }
  } catch {}
  // Helper: wait until billing is satisfied (dismissed or covered)
  const waitForBillingSatisfied = async (): Promise<void> => {
    const maxWaitMs = 20000; const start = Date.now();
    const isCovered = async (): Promise<boolean> => {
      try {
        const tid = (localStorage.getItem('bvx_tenant')||'');
        if (!tid) return false;
        const j = await api.get(`/settings?tenant_id=${encodeURIComponent(tid)}`);
        const st = String(j?.data?.subscription_status || j?.subscription_status || '');
        return st === 'active' || st === 'trialing';
      } catch { return false; }
    };
    for (;;) {
      try {
        if (localStorage.getItem('bvx_billing_dismissed') === '1') return;
        if (await isCovered()) return;
      } catch {}
      if (Date.now() - start > maxWaitMs) return; // fail-open to avoid stall
      await new Promise(r=> setTimeout(r, 600));
    }
  };
  const setPhase = (phase: string) => { try { localStorage.setItem('bvx_showcase_phase', phase); } catch {} };
  const drive = async () => {
    if (i >= steps.length) {
      try { localStorage.setItem('bvx_showcase_done','1'); } catch {}
      try { localStorage.removeItem('bvx_showcase_index'); } catch {}
      try { track('showcase_done'); } catch {}
      try { markProgress('showcase.done'); } catch {}
      return;
    }
    const curr = steps[i++];
    try { localStorage.setItem('bvx_showcase_index', String(i-1)); } catch {}
    try {
      try { track('showcase_step', { path: curr.path, idx: i-1 }); } catch {}
      // Update simple phase hints for resume
      try {
        if (curr.path.includes('integrations')) setPhase('integrations');
        else if (curr.progress === 'showcase.billing') setPhase('billing');
        else if (curr.path.includes('pane=vision')) setPhase('vision');
        else if (curr.path.includes('pane=contacts')) setPhase('contacts');
        else if (curr.path.includes('pane=askvx') && !curr.path.includes('page=2')) setPhase('ask');
        else if (curr.path.includes('page=2')) setPhase('train');
        else if (curr.path.includes('pane=dashboard')) setPhase('dashboard');
      } catch {}
      if (window.location.pathname + window.location.search !== curr.path) {
        window.location.href = curr.path;
      }
    } catch {}
    setTimeout(async () => {
      // Special gating for billing CTA step
      try {
        if (curr.progress === 'showcase.billing') {
          try { sessionStorage.setItem('bvx_billing_prompt_request', '1'); } catch {}
          try { window.dispatchEvent(new CustomEvent('bvx:billing:prompt')); } catch {}
          await waitForBillingSatisfied();
        }
        if (curr.wait) await waitForSelector(curr.wait, 3000);
        if (curr.guide) {
          try { startGuide(curr.guide); } catch {}
        }
        if (curr.progress) {
          try { await markProgress(curr.progress); } catch {}
        }
        // Prefetch next path for faster transition
        try { const nxt = steps[i]; if (nxt?.path) prefetchPath(nxt.path); } catch {}
      } catch(e:any) {
        try { track('showcase_error', { step: curr.path, message: String(e?.message||e) }); } catch {}
      }
      setTimeout(drive, 2400);
    }, 450);
  };
  drive();
  };
  // Gate on tour completion
  try {
    const seen = localStorage.getItem('bvx_tour_seen_workspace_intro') === '1';
    if (seen) { begin(); return; }
    const onDone = () => { try { window.removeEventListener('bvx:guide:workspace_intro:done' as any, onDone as any); } catch {}; begin(); };
    window.addEventListener('bvx:guide:workspace_intro:done' as any, onDone as any);
  } catch { begin(); }
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
      setTimeout(async () => {
        const mod: any = await import('driver.js');
        const drv = (mod && (mod as any).driver) ? (mod as any).driver : (mod as any);
        const d = drv({
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
