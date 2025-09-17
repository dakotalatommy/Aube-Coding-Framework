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

export function startGuide(page: string, _opts?: { step?: number }) {
  const steps = getGuideSteps(page);
  if (!steps || steps.length === 0) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  try { localStorage.setItem('bvx_last_tour_page', page); } catch {}
  try { localStorage.setItem('bvx_last_tour_step', '0'); } catch {}
  try {
    const tenantId = (()=>{ try{ return localStorage.getItem('bvx_tenant')||''; }catch{ return '' }})();
    if (tenantId) void api.post('/onboarding/complete_step', { tenant_id: tenantId, step_key: `tour.start.${page}`, context: {} });
  } catch {}
  try { track('tour_start', { page }); } catch {}

  void (async () => {
    try {
      const mod: any = await import('driver.js');
      const driverFactory = mod?.driver || mod?.default || mod;
      if (!driverFactory) return;
      const instance = driverFactory({
        showProgress: steps.length > 1,
        allowClose: false,
        animate: true,
        overlayOpacity: 0.55,
        stagePadding: 8,
        steps: steps.map((step) => ({
          element: step.element || document.body,
          popover: {
            title: step.popover.title,
            description: step.popover.description,
            side: 'bottom',
            align: 'start',
          },
        })),
      } as any);
      const persistIndex = () => {
        try {
          const idx = instance?.getState?.()?.activeIndex;
          if (typeof idx === 'number') localStorage.setItem('bvx_last_tour_step', String(idx));
        } catch {}
      };
      instance.on?.('next', persistIndex);
      instance.on?.('previous', persistIndex);
      instance.on?.('highlighted', persistIndex);
      if (typeof instance.drive === 'function') {
        instance.drive();
      }
      instance.on?.('destroyed', () => {
        persistIndex();
        try { track('tour_complete', { page }); } catch {}
        if (page === 'workspace_intro') {
          try { localStorage.setItem('bvx_tour_seen_workspace_intro', '1'); } catch {}
          try { sessionStorage.setItem('bvx_welcome_seen', '1'); } catch {}
          try { window.dispatchEvent(new CustomEvent('bvx:guide:workspace_intro:done')); } catch {}
        }
      });
    } catch (err) {
      console.error('startGuide error', err);
    }
  })();
}
