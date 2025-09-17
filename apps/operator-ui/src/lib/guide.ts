export type GuideStep = { element?: string; popover: { title: string; description: string } };
import { track } from './analytics';
import { api } from './api';
import 'driver.js/dist/driver.css';
// import { flags } from './flags';

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
  const demoSuffix = (()=>{ try{ const sp = new URLSearchParams(window.location.search); return sp.get('demo')==='1' ? '&demo=1' : ''; } catch { return '' } })();
  const begin = () => {
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
      const prefetchPath = (href: string) => { try { const link = document.createElement('link'); link.rel = 'prefetch'; link.href = href; document.head.appendChild(link); } catch {} };
      steps.forEach(s=>{ try { if (s.path) prefetchPath(s.path); } catch {} });
    } catch {}
  // Determine starting index (support resume)
  let i = 0;
  try {
    const anyOpts = opts as any;
    if (anyOpts?.resume) {
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
      try { await api.post('/onboarding/complete_step', { step_key: 'showcase.done', context: {} }); } catch {}
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
        if (curr.wait) {
          try {
            const sel = String(curr.wait||'');
            const timeout = 3000; const start = Date.now();
            const wait = async()=>{ for(;;){ if (document.querySelector(sel)) return; if (Date.now()-start>timeout) return; await new Promise(r=> setTimeout(r,80)); } };
            await wait();
          } catch {}
        }
        if (curr.guide) {
          try { startGuide(curr.guide); } catch {}
        }
        if (curr.progress) {
          try { await api.post('/onboarding/complete_step', { step_key: curr.progress, context: {} }); } catch {}
        }
        // Prefetch next path for faster transition
        try {
          const prefetchPath = (href: string) => { try { const link = document.createElement('link'); link.rel = 'prefetch'; link.href = href; document.head.appendChild(link); } catch {} };
          const nxt = steps[i]; if (nxt?.path) prefetchPath(nxt.path);
        } catch {}
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


