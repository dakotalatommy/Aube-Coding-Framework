export type GuideStep = {
  element?: string;
  popover: {
    title: string;
    description: string;
    showButtons?: Array<'next' | 'previous' | 'close'>;
    nextBtnText?: string;
    onNextClick?: (
      element: Element | undefined,
      step: unknown,
      opts: { driver: any }
    ) => void;
    onPopoverRender?: (
      popoverDom: any,
      opts: { driver: any }
    ) => void;
  };
};
import { track } from './analytics';
import { api } from './api';
import 'driver.js/dist/driver.css';
// import { flags } from './flags';

const DASHBOARD_WELCOME_STEP = 0;
const DASHBOARD_BILLING_STEP = 12;

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
    { element: '#tour-welcome-anchor', popover: { title: 'Welcome to brandVX', description: 'Let’s do a quick walk-through of your workspace.' } },
    { element: '[data-tour="nav-dashboard"]', popover: { title: 'Dashboard', description: 'Check KPIs, quick start wins, and your 14-day plan progress.' } },
    { element: '[data-tour="nav-askvx"]', popover: { title: 'askVX', description: 'Ask in your voice. We suggest safe actions; you approve everything.' } },
    { element: '[data-tour="nav-vision"]', popover: { title: 'brandVZN', description: 'Upload, analyze, and refine with natural, texture-safe edits.' } },
    { element: '[data-tour="nav-messages"]', popover: { title: 'Messages', description: 'Draft in one tap. Quiet hours and STOP/HELP are respected.' } },
    { element: '[data-tour="nav-contacts"]', popover: { title: 'Clients', description: 'Predictive search, quick copy, and rich client context.' } },
    { element: '[data-tour="nav-calendar"]', popover: { title: 'Calendar', description: 'Unified grid for Google + bookings. Mirror events instantly.' } },
    { element: '[data-tour="nav-cadences"]', popover: { title: 'Follow-ups', description: 'Tomorrow, this week, re-engage in 30 days, win-back in 45 days.' } },
    { element: '[data-tour="nav-inventory"]', popover: { title: 'Inventory', description: 'Sync Shopify/Square; spot low or out-of-stock products quickly.' } },
    { element: '[data-tour="nav-approvals"]', popover: { title: 'To-Do', description: 'Approve drafts and actions in one place.' } },
    { element: '[data-tour="nav-integrations"]', popover: { title: 'Settings', description: 'Connect Square, Acuity, Google, and more.' } },
    { element: '[data-tour="book-onboarding"]', popover: { title: 'Book Onboarding', description: 'Schedule a 1-on-1 to go deeper whenever you’re ready.' } },
    { element: '#tour-billing-anchor', popover: { title: 'Choose your plan', description: 'Unlock the workspace with a founding plan or free trial.' } },
    { element: '[data-guide="kpis"]', popover: { title: 'KPIs', description: 'Messages sent, time saved, rebook rate (30d), and revenue uplift live here.' } },
    { element: '[data-guide="quickstart"]', popover: { title: 'Quick start', description: 'Kick off with brandVZN, import clients, or train VX — three fast wins.' } },
    { element: '[data-guide="next-best-steps"]', popover: { title: 'Next Best Steps', description: 'See the current day in your 14-day plan and today’s recommended actions.' } },
    {
      element: '[data-guide="quickstart-brandvzn"]',
      popover: {
        title: 'Guided Walkthrough',
        description: 'Let’s showcase three of brandVX’s most powerful tools!',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Open brandVZN',
        onNextClick: (_element, _step, { driver }) => {
          const proceed = () => {
            window.removeEventListener('bvx:guide:navigate:done', proceed as any);
            setTimeout(() => {
              try { driver.moveNext(); } catch {}
            }, 120);
          };
          window.addEventListener('bvx:guide:navigate:done', proceed as any, { once: true } as any);
          const fallback = window.setTimeout(() => {
            try { driver.moveNext(); } catch {}
          }, 1600);
          const clear = () => {
            window.clearTimeout(fallback);
            window.removeEventListener('bvx:guide:navigate:done', clear as any);
          };
          window.addEventListener('bvx:guide:navigate:done', clear as any, { once: true } as any);
          try {
            window.dispatchEvent(new CustomEvent('bvx:guide:navigate', { detail: { pane: 'vision' } }));
          } catch {}
        },
      },
    },
    { element: '[data-guide="upload"]', popover: { title: 'Upload a look', description: 'Pick a photo that shows the subject’s face and hair, then press Upload.' } },
    {
      popover: {
        title: 'Select a color',
        description: `What color would you like to transform their hair to?<br/><br/>
          <div class="grid gap-2">
            <button data-color="copper" class="bvx-color-btn">Copper</button>
            <button data-color="espresso" class="bvx-color-btn">Espresso Brown</button>
            <button data-color="platinum" class="bvx-color-btn">Platinum Blonde</button>
            <button data-color="rose" class="bvx-color-btn">Rose Gold</button>
            <button data-color="jet" class="bvx-color-btn">Jet Black</button>
          </div>`,
        showButtons: ['previous'],
        onPopoverRender: (dom: any, { driver }: { driver: any }) => {
          const palette: Record<string, string> = {
            copper: 'Change the subject’s hair to a warm copper tone.',
            espresso: 'Change the subject’s hair to a rich espresso brown.',
            platinum: 'Change the subject’s hair to a bright platinum blonde.',
            rose: 'Change the subject’s hair to a shiny rose gold.',
            jet: 'Change the subject’s hair to a glossy jet black.',
          };
          const buttons = Array.from(dom?.wrapper?.querySelectorAll?.('.bvx-color-btn') ?? []) as HTMLElement[];
          buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
              const key = btn.dataset.color || '';
              const prompt = palette[key];
              if (!prompt) return;
              try {
                window.dispatchEvent(new CustomEvent('bvx:guide:brandvzn:color', { detail: prompt }));
              } catch {}
              setTimeout(() => {
                try { driver.moveNext(); } catch {}
              }, 120);
            });
          });
        },
      },
    },
    { element: '[data-guide="edit"]', popover: { title: 'Run edit', description: 'Click Run Edit to apply your selected color.' } },
    {
      element: '[data-guide="preview"]',
      popover: {
        title: 'Watch the transformation',
        description: 'When the edit returns, drag the slider to view the before/after.',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Continue',
      },
    },
    {
      popover: {
        title: 'Iterate anytime',
        description: 'Re-run Run Edit to refine the look as many times as you’d like.',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Next',
      },
    },
    { element: '[data-guide="save"]', popover: { title: 'Download originals', description: 'Use Download Original + Edited to grab both versions anytime.' } },
    {
      popover: {
        title: 'Import your guests',
        description:
          'Since booking was connected during onboarding, click Import from booking to bring everyone in.<div class="mt-3 grid gap-2">\n            <button class="bvx-onboard-btn" data-onboard-action="import-now">Import from booking</button>\n            <button class="bvx-onboard-btn-secondary" data-onboard-action="import-skip">Skip this step</button>\n          </div>\n          <div class="mt-4 hidden" data-onboard-panel="lite">\n            <div class="text-xs text-slate-700 mb-2">Prefer to start lighter? brandVZN Lite keeps Brand Vision + AskVX for $47/mo.</div>\n            <div class="flex flex-col gap-2 items-center" data-onboard-lite-root>\n              <stripe-buy-button buy-button-id="buy_btn_1S8t06KsdVcBvHY1b42SHXi9" publishable-key="pk_live_51RJwqnKsdVcBvHY1Uf3dyiHqrB3fsE35Qhgs5KfnPSJSsdalZpoJik9HYR4x6OY1ITiNJw6VJnqN9bHymiw9xE3r00WyZkg6kZ"></stripe-buy-button>\n              <button class="bvx-onboard-btn" data-onboard-action="skip-continue">Continue without importing</button>\n            </div>\n          </div>',
        showButtons: ['previous'],
        onPopoverRender: (dom: any, { driver }: { driver: any }) => {
          (window as any).__bvxSkipImport = false;
          const root = dom?.wrapper as HTMLElement | null;
          if (!root) return;
          const importBtn = root.querySelector('[data-onboard-action="import-now"]') as HTMLElement | null;
          const skipBtn = root.querySelector('[data-onboard-action="import-skip"]') as HTMLElement | null;
          const skipPanel = root.querySelector('[data-onboard-panel="lite"]') as HTMLElement | null;
          const skipContinue = root.querySelector('[data-onboard-action="skip-continue"]') as HTMLElement | null;

          const ensureStripe = () => {
            if ((window as any).__bvxStripeLiteLoaded) return;
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/buy-button.js';
            script.async = true;
            document.head.appendChild(script);
            (window as any).__bvxStripeLiteLoaded = true;
          };

          const cleanup = () => {
            window.removeEventListener('bvx:flow:contacts-imported', importedHandler as any);
            window.removeEventListener('bvx:onboarding:skip-import', skipHandler as any);
          };

          const importedHandler = (event: Event) => {
            const detail = (event as CustomEvent).detail || {};
            (window as any).__bvxLastImport = detail;
            const failed = Boolean(detail?.error);
            (window as any).__bvxImportFailed = failed;
            if (failed) (window as any).__bvxSkipImport = true;
            cleanup();
            setTimeout(() => { try { driver.moveNext(); } catch {} }, 180);
          };

          const skipHandler = () => {
            (window as any).__bvxSkipImport = true;
            cleanup();
            setTimeout(() => { try { driver.moveNext(); } catch {} }, 120);
          };

          window.addEventListener('bvx:flow:contacts-imported', importedHandler as any, { once: true } as any);
          window.addEventListener('bvx:onboarding:skip-import', skipHandler as any, { once: true } as any);

          importBtn?.addEventListener('click', () => {
            (window as any).__bvxSkipImport = false;
            try {
              window.dispatchEvent(new CustomEvent('bvx:flow:contacts-command', { detail: { action: 'contacts.import' } }));
            } catch {}
          });

          skipBtn?.addEventListener('click', () => {
            (window as any).__bvxSkipImport = true;
            ensureStripe();
            skipPanel?.classList.remove('hidden');
          });

          skipContinue?.addEventListener('click', () => {
            cleanup();
            try { window.dispatchEvent(new CustomEvent('bvx:onboarding:skip-import')); } catch {}
            setTimeout(() => { try { driver.moveNext(); } catch {} }, 120);
          });

          // Navigate to contacts pane when this step mounts
          try {
            window.dispatchEvent(new CustomEvent('bvx:guide:navigate', { detail: { pane: 'contacts' } }));
          } catch {}
        },
      },
    },
    {
      element: '[data-guide="clients-import-status"]',
      popover: {
        title: 'Import status',
        description: 'We’ll show your latest import status here. If something fails you can retry or skip ahead.',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Continue',
        onPopoverRender: (_dom: any, { driver }: { driver: any }) => {
          if ((window as any).__bvxSkipImport) {
            setTimeout(() => { try { driver.moveNext(); } catch {} }, 80);
            return;
          }
        },
      },
    },
    { element: '[data-guide="clients-list"]', popover: { title: 'Clients list', description: 'Review synced guests, visit history, and follow-up readiness in one place.' } },
    { element: '[data-guide="clients-actions"]', popover: { title: 'Quick actions', description: 'Select text or email to copy contact info and launch ready-to-edit drafts.' } },
    { element: '[data-guide="clients-pagination"]', popover: { title: 'Navigate pages', description: 'Use the arrows to move through larger client lists.' } },
    { element: '[data-guide="clients-export"]', popover: { title: 'Export CSV', description: 'Download your imported contacts anytime for offline review.' } },
    { element: '[data-guide="clients-refresh"]', popover: { title: 'Refresh data', description: 'Pull the latest booking updates whenever you reconnect providers.' } },
    {
      popover: {
        title: 'Next: askVX',
        description: 'We’ll grab a revenue snapshot and build a strategy next.',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Go to askVX',
        onNextClick: (_element, _step, { driver }) => {
          const proceed = () => {
            window.removeEventListener('bvx:guide:navigate:done', proceed as any);
            setTimeout(() => {
              try { driver.moveNext(); } catch {}
            }, 120);
          };
          window.addEventListener('bvx:guide:navigate:done', proceed as any, { once: true } as any);
          const fallback = window.setTimeout(() => {
            try { driver.moveNext(); } catch {}
          }, 1600);
          const clear = () => {
            window.clearTimeout(fallback);
            window.removeEventListener('bvx:guide:navigate:done', clear as any);
          };
          window.addEventListener('bvx:guide:navigate:done', clear as any, { once: true } as any);
          try {
            window.dispatchEvent(new CustomEvent('bvx:guide:navigate', { detail: { pane: 'askvx' } }));
          } catch {}
        },
      },
    },
    { element: '[data-guide="askvx-import-count"]', popover: { title: 'Imported contacts', description: 'Here’s the new contact count from your booking sync.' } },
    { element: '[data-guide="askvx-digest"]', popover: { title: 'Since your last visit', description: 'Keep an eye on fresh contacts, appointments, and messages.' } },
    {
      element: '[data-guide="askvx-insights-cta"]',
      popover: {
        title: 'Generate insights',
        description: 'Click “Generate snapshot” to preload the AskVX prompt with your data.',
        showButtons: ['previous'],
        onPopoverRender: (_dom: any, { driver }: { driver: any }) => {
          if ((window as any).__bvxSkipImport) {
            setTimeout(() => { try { driver.moveNext(); } catch {} }, 120);
            return;
          }
          let done = false;
          const cleanup = () => {
            if (done) return;
            done = true;
            window.removeEventListener('bvx:onboarding:askvx-prefill', handler as any);
            window.clearTimeout(timer);
          };
          const handler = () => {
            cleanup();
            setTimeout(() => { try { driver.moveNext(); } catch {} }, 160);
          };
          const timer = window.setTimeout(() => {
            cleanup();
            try { driver.moveNext(); } catch {}
          }, 60000);
          window.addEventListener('bvx:onboarding:askvx-prefill', handler as any, { once: true } as any);
        },
      },
    },
    {
      element: '[data-guide="composer"]',
      popover: {
        title: 'Send the prompt',
        description: 'Press Send to let AskVX crunch the numbers for you.',
        showButtons: ['previous'],
        onPopoverRender: (_dom: any, { driver }: { driver: any }) => {
          if ((window as any).__bvxSkipImport) {
            setTimeout(() => { try { driver.moveNext(); } catch {} }, 120);
            return;
          }
          let done = false;
          const cleanup = () => {
            if (done) return;
            done = true;
            window.removeEventListener('bvx:onboarding:askvx-sent', handler as any);
            window.clearTimeout(timer);
          };
          const handler = (event: Event) => {
            const detail = (event as CustomEvent).detail || {};
            if (detail?.success === false) return;
            cleanup();
            setTimeout(() => { try { driver.moveNext(); } catch {} }, 160);
          };
          const timer = window.setTimeout(() => {
            cleanup();
            try { driver.moveNext(); } catch {}
          }, 60000);
          window.addEventListener('bvx:onboarding:askvx-sent', handler as any, { once: true } as any);
        },
      },
    },
    {
      element: '[data-guide="askvx-strategy"]',
      popover: {
        title: 'Build your 14-day strategy',
        description: 'Generate and download the Markdown plan. We’ll also save it to your AI memory.',
        showButtons: ['previous'],
        onPopoverRender: (_dom: any, { driver }: { driver: any }) => {
          let done = false;
          const cleanup = () => {
            if (done) return;
            done = true;
            window.removeEventListener('bvx:onboarding:strategy-ready', handler as any);
            window.clearTimeout(timer);
          };
          const handler = () => {
            cleanup();
            setTimeout(() => { try { driver.moveNext(); } catch {} }, 160);
          };
          const timer = window.setTimeout(() => {
            cleanup();
            try { driver.moveNext(); } catch {}
          }, 90000);
          window.addEventListener('bvx:onboarding:strategy-ready', handler as any, { once: true } as any);
        },
      },
    },
    {
      popover: {
        title: 'Next: Train VX',
        description: 'Switch to Train & Profile to add tone notes and review your brand profile.',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Open Train VX',
        onNextClick: (_element, _step, { driver }) => {
          let done = false;
          const cleanup = () => {
            if (done) return;
            done = true;
            window.removeEventListener('bvx:onboarding:askvx-tab-active', handler as any);
            window.clearTimeout(timer);
          };
          const handler = (event: Event) => {
            const detail = (event as CustomEvent).detail || {};
            if (Number(detail?.index) === 1) {
              cleanup();
              setTimeout(() => { try { driver.moveNext(); } catch {} }, 160);
            }
          };
          const timer = window.setTimeout(() => {
            cleanup();
            try { driver.moveNext(); } catch {}
          }, 1600);
          window.addEventListener('bvx:onboarding:askvx-tab-active', handler as any);
          try {
            window.dispatchEvent(new CustomEvent('bvx:flow:askvx-command', { detail: { action: 'askvx.tab', tab: 'profile' } }));
          } catch {}
        },
      },
    },
    {
      element: '[data-guide="trainvx-notes"]',
      popover: {
        title: 'Add a brand fact',
        description: 'Type a tone note or preference, then press “Save to training”.',
        showButtons: ['previous'],
        onPopoverRender: (_dom: any, { driver }: { driver: any }) => {
          let done = false;
          const cleanup = () => {
            if (done) return;
            done = true;
            window.removeEventListener('bvx:onboarding:trainvx-saved', handler as any);
            window.clearTimeout(timer);
          };
          const handler = () => {
            cleanup();
            setTimeout(() => { try { driver.moveNext(); } catch {} }, 160);
          };
          const timer = window.setTimeout(() => {
            cleanup();
            try { driver.moveNext(); } catch {}
          }, 90000);
          window.addEventListener('bvx:onboarding:trainvx-saved', handler as any, { once: true } as any);
        },
      },
    },
    {
      element: '[data-guide="trainvx-profile"]',
      popover: {
        title: 'Review your brand profile',
        description: 'Use Edit → Save to adjust tone, story, and pricing anytime.',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Finish tour',
        onNextClick: (_element, _step, { driver }) => {
          const proceed = () => {
            window.removeEventListener('bvx:guide:navigate:done', proceed as any);
            setTimeout(() => {
              try { driver.moveNext(); } catch {}
            }, 120);
          };
          window.addEventListener('bvx:guide:navigate:done', proceed as any, { once: true } as any);
          const fallback = window.setTimeout(() => {
            try { driver.moveNext(); } catch {}
          }, 1600);
          const clear = () => {
            window.clearTimeout(fallback);
            window.removeEventListener('bvx:guide:navigate:done', clear as any);
          };
          window.addEventListener('bvx:guide:navigate:done', clear as any, { once: true } as any);
          try {
            window.dispatchEvent(new CustomEvent('bvx:guide:navigate', { detail: { pane: 'dashboard' } }));
          } catch {}
        },
      },
    },
  ],
  askvx: [
    { popover: { title: 'askVX', description: 'Your co‑pilot. Short answers, your tone, ready to act (with approval).' } },
    { element: '[data-guide="askvx-import-count"]', popover: { title: 'Contacts snapshot', description: 'Check synced totals anytime after a booking refresh.' } },
    { element: '[data-guide="askvx-digest"]', popover: { title: 'Activity digest', description: 'Recent contacts, bookings, messages — summarized for you.' } },
    { element: '[data-guide="composer"]', popover: { title: 'Compose', description: 'Enter to send; Shift+Enter for new line. Templates are one‑tap.' } },
    { element: '[data-guide="smart-action"]', popover: { title: 'Smart action', description: 'We propose one safe next step; you can run it instantly.' } },
    { element: '[data-guide="askvx-strategy"]', popover: { title: 'Strategy export', description: 'Download the Markdown plan or regenerate after new data comes in.' } },
    { element: '[data-guide="trainvx-notes"]', popover: { title: 'Train VX', description: 'Save tone notes and preferences to sharpen drafts.' } },
    { element: '[data-guide="trainvx-profile"]', popover: { title: 'Brand profile', description: 'Edit your voice, goals, and pricing from here.' } },
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
  // Mount driver.js overlay into the canonical overlay root if available
  try {
    const root = document.getElementById('bvx-overlay-root');
    if (root) {
      // driver.js latest supports custom stage/overlay container via CSS; ensure our CSS root has highest priority
      // We rely on OverlayPortal to keep #bvx-overlay-root last and isolated; tour popovers will render above content.
      // If the library exposes a container option in this version, we would pass it here.
    }
  } catch {}

  void (async () => {
    try {
      const mod: any = await import('driver.js');
      const driverFactory = mod?.driver || mod?.default || mod;
      if (!driverFactory) return;
      // Ensure popovers/overlay are above app content but below our global overlay root if present
      const instance = driverFactory({
        showProgress: steps.length > 1,
        allowClose: false,
        animate: true,
        overlayOpacity: 0.55,
        stagePadding: 8,
        steps: steps.map((step) => {
          const { title, description, ...restPopover } = step.popover;
          return {
            element: step.element || document.body,
            popover: {
              title,
              description,
              side: 'bottom',
              align: 'start',
              ...restPopover,
            },
          };
        }),
        } as any);
      try {
        const styleId = 'bvx-driver-zindex';
        if (!document.getElementById(styleId)) {
          const s = document.createElement('style');
          s.id = styleId;
          s.textContent = `
            .driver-overlay { z-index: 2147483600 !important; }
            .driver-popover { z-index: 2147483601 !important; }
          `;
          document.head.appendChild(s);
        }
        const btnStyleId = 'bvx-onboard-styles';
        if (!document.getElementById(btnStyleId)) {
          const s2 = document.createElement('style');
          s2.id = btnStyleId;
          s2.textContent = `
            .bvx-onboard-btn {
              display: inline-flex;
              justify-content: center;
              align-items: center;
              width: 100%;
              padding: 0.55rem 0.75rem;
              border-radius: 0.75rem;
              border: 1px solid rgb(14 165 233 / 0.6);
              background: linear-gradient(180deg, rgb(224 242 254) 0%, rgb(186 230 253) 100%);
              font-size: 0.78rem;
              font-weight: 600;
              color: rgb(12 74 110);
              cursor: pointer;
            }
            .bvx-onboard-btn:hover {
              background: linear-gradient(180deg, rgb(186 230 253) 0%, rgb(147 197 253) 100%);
            }
            .bvx-onboard-btn-secondary {
              display: inline-flex;
              justify-content: center;
              align-items: center;
              width: 100%;
              padding: 0.55rem 0.75rem;
              border-radius: 0.75rem;
              border: 1px solid rgb(148 163 184 / 0.6);
              background: white;
              font-size: 0.78rem;
              font-weight: 500;
              color: rgb(71 85 105);
              cursor: pointer;
            }
            .bvx-onboard-btn-secondary:hover {
              background: rgb(248 250 252);
            }
            .bvx-color-btn {
              display: inline-flex;
              justify-content: center;
              align-items: center;
              padding: 0.45rem 0.6rem;
              border-radius: 0.65rem;
              border: 1px solid rgb(148 163 184 / 0.6);
              background: white;
              font-size: 0.75rem;
              font-weight: 500;
              color: rgb(30 41 59);
              cursor: pointer;
            }
            .bvx-color-btn:hover {
              border-color: rgb(37 99 235 / 0.45);
            }
          `;
          document.head.appendChild(s2);
        }
      } catch {}
      const persistIndex = () => {
        try {
          const idx = instance?.getState?.()?.activeIndex;
          if (typeof idx === 'number') localStorage.setItem('bvx_last_tour_step', String(idx));
        } catch {}
      };
      instance.on?.('next', persistIndex);
      instance.on?.('previous', persistIndex);
      instance.on?.('highlighted', persistIndex);
      if (page === 'dashboard') {
        instance.on?.('highlighted', () => {
          try {
            const idx = instance?.getState?.()?.activeIndex ?? -1;
            if (idx === DASHBOARD_WELCOME_STEP) {
              localStorage.setItem('bvx_welcome_seen', '1');
              sessionStorage.setItem('bvx_intro_session', '1');
            }
            if (idx === DASHBOARD_BILLING_STEP) {
              window.dispatchEvent(new CustomEvent('bvx:guide:dashboard:billing'));
            }
          } catch {}
        });
      }
      if (typeof instance.drive === 'function') {
        instance.drive();
      }
      try { (window as any).__driverDashboard = instance; } catch {}
      instance.on?.('destroyed', () => {
        persistIndex();
        try { track('tour_complete', { page }); } catch {}
        if (page === 'workspace_intro') {
          try { localStorage.setItem('bvx_tour_seen_workspace_intro', '1'); } catch {}
          try { sessionStorage.setItem('bvx_intro_session', '1'); } catch {}
          try { window.dispatchEvent(new CustomEvent('bvx:guide:workspace_intro:done')); } catch {}
        }
        if (page === 'dashboard') {
          try { window.dispatchEvent(new CustomEvent('bvx:guide:dashboard:done')); } catch {}
          return;
        }
      });
    } catch (err) {
      console.error('startGuide error', err);
    }
  })();
}
