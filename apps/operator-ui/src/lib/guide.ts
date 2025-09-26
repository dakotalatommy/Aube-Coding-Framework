type GuideStepContext = {
  driver: any;
  index: number;
  step: GuideStep;
};

export type GuideStep = {
  element?: string;
  popover: {
    title: string;
    description: string;
    // When true, render the popover centered in the viewport (not docked to an element)
    centered?: boolean;
    showButtons?: Array<'next' | 'previous' | 'close'>;
    nextBtnText?: string;
    // Lighten overlay and allow pointer events to pass through for interactive steps
    allowClicks?: boolean;
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
  onEnter?: (ctx: GuideStepContext) => void;
  onExit?: (ctx: GuideStepContext) => void;
};
import { track } from './analytics';
import { api, getTenant } from './api';
import { workspaceStorage } from '../onboarding/workspace/storage';
import foundersImage from '../assets/onboarding/IMG_7577.jpeg';
import 'driver.js/dist/driver.css';
// import { flags } from './flags';

// Welcome handled by WelcomeModal; previously 0
const DASHBOARD_BILLING_STEP = 12;

type FounderFormState = {
  email: string;
  phone: string;
};

const FOUNDER_FORM_KEY = 'bvx_founder_form_cache';

type FounderFormBindings = {
  emailInput?: HTMLInputElement;
  phoneInput?: HTMLInputElement;
  changeHandler?: (e: Event) => void;
  nextButton?: HTMLButtonElement;
  nextHandler?: (e: Event) => void;
} | null;

let founderBindings: FounderFormBindings = null;

const loadFounderForm = (): FounderFormState => {
  try {
    const raw = localStorage.getItem(FOUNDER_FORM_KEY);
    if (!raw) return { email: '', phone: '' };
    const parsed = JSON.parse(raw);
    return {
      email: typeof parsed?.email === 'string' ? parsed.email : '',
      phone: typeof parsed?.phone === 'string' ? parsed.phone : '',
    };
  } catch {
    return { email: '', phone: '' };
  }
};

const persistFounderForm = (state: FounderFormState) => {
  try {
    localStorage.setItem(FOUNDER_FORM_KEY, JSON.stringify(state));
  } catch {}
};

const clearFounderForm = () => {
  try {
    localStorage.removeItem(FOUNDER_FORM_KEY);
  } catch {}
};

const sanitizeFounderPhone = (value: string) => value.replace(/[^0-9+\s().-]/g, '');

const getFounderFormElements = () => {
  const popover = document.querySelector('.driver-popover') as HTMLElement | null;
  if (!popover) return null;
  return {
    popover,
    emailInput: popover.querySelector('[data-founder-email]') as HTMLInputElement | null,
    phoneInput: popover.querySelector('[data-founder-phone]') as HTMLInputElement | null,
    emailError: popover.querySelector('[data-founder-email-error]') as HTMLElement | null,
    phoneError: popover.querySelector('[data-founder-phone-error]') as HTMLElement | null,
    nextButton: popover.querySelector('[data-action="next"]') as HTMLButtonElement | null,
    previousButton: popover.querySelector('[data-action="previous"]') as HTMLButtonElement | null,
  };
};

const validateFounderForm = (opts: { showErrors?: boolean } = {}) => {
  const elements = getFounderFormElements();
  const result = { valid: true, state: loadFounderForm() };
  if (!elements) return result;

  const { emailInput, phoneInput, emailError, phoneError, nextButton } = elements;
  const rawEmail = (emailInput?.value || '').trim().toLowerCase();
  const rawPhone = (phoneInput?.value || '').trim();

  const sanitizedPhone = sanitizeFounderPhone(rawPhone);
  if (phoneInput && phoneInput.value !== sanitizedPhone) phoneInput.value = sanitizedPhone;

  const digits = sanitizedPhone.replace(/[^0-9]/g, '');
  const emailValid = !rawEmail || /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(rawEmail);
  const phoneValid = !sanitizedPhone || (digits.length >= 7 && digits.length <= 15);
  const allValid = emailValid && phoneValid;

  if (emailError) {
    if (!emailValid && opts.showErrors) emailError.classList.remove('hidden');
    else emailError.classList.add('hidden');
  }
  if (phoneError) {
    if (!phoneValid && opts.showErrors) phoneError.classList.remove('hidden');
    else phoneError.classList.add('hidden');
  }

  if (nextButton) nextButton.disabled = !allValid;

  const state: FounderFormState = { email: rawEmail, phone: sanitizedPhone };
  persistFounderForm(state);

  return { valid: allValid, state };
};

const founderCleanup = () => {
  if (!founderBindings) return;
  const { emailInput, phoneInput, changeHandler, nextButton, nextHandler } = founderBindings;
  if (emailInput && changeHandler) {
    emailInput.removeEventListener('input', changeHandler);
    emailInput.removeEventListener('blur', changeHandler);
  }
  if (phoneInput && changeHandler) {
    phoneInput.removeEventListener('input', changeHandler);
    phoneInput.removeEventListener('blur', changeHandler);
  }
  if (nextButton && nextHandler) {
    nextButton.removeEventListener('click', nextHandler, true);
    try { delete nextButton.dataset.bvxFounderBound; } catch {}
  }
  founderBindings = null;
};

const initFounderFormStep = () => {
  const elements = getFounderFormElements();
  if (!elements || !elements.nextButton) return;

  const { emailInput, phoneInput, nextButton } = elements;

  founderCleanup();

  const cached = loadFounderForm();
  if (emailInput) emailInput.value = cached.email;
  if (phoneInput) phoneInput.value = cached.phone;

  const changeHandler = () => {
    validateFounderForm({ showErrors: false });
  };

  if (emailInput) {
    emailInput.addEventListener('input', changeHandler);
    emailInput.addEventListener('blur', changeHandler);
  }
  if (phoneInput) {
    phoneInput.addEventListener('input', changeHandler);
    phoneInput.addEventListener('blur', changeHandler);
  }

  const nextHandler = (event: Event) => {
    const { valid } = validateFounderForm({ showErrors: true });
    if (!valid) {
      event.preventDefault();
      event.stopPropagation();
      (event as any).stopImmediatePropagation?.();
    }
  };

  if (!nextButton.dataset.bvxFounderBound) {
    nextButton.addEventListener('click', nextHandler, true);
    nextButton.dataset.bvxFounderBound = '1';
  }

  validateFounderForm({ showErrors: false });
  founderBindings = { emailInput: emailInput || undefined, phoneInput: phoneInput || undefined, changeHandler, nextButton, nextHandler };
};

const submitFounderContact = async (state: FounderFormState, finalize?: boolean) => {
  try {
    persistFounderForm(state);
    const email = state.email.trim().toLowerCase();
    const phoneNormalized = state.phone.replace(/[^0-9+]/g, '');
    if (!email && !phoneNormalized) return;
    const tenant = (await getTenant().catch(() => '')) || localStorage.getItem('bvx_tenant') || '';
    if (!tenant) return;
    await api.post('/onboarding/founder/contact', {
      tenant_id: tenant,
      email: email || undefined,
      phone: phoneNormalized || undefined,
      finalize: finalize ? true : undefined,
    });
  } catch (err) {
    console.error('founder contact submission failed', err);
  }
};

const founderSlides = [
  {
    title: 'A brief note from Dakota',
    html: '<p>Hi! My name is Dakota LaTommy and I created this platform for beauty professionals like <strong>you</strong>. In a world that underestimates your ability, hustle, and drive, I wanted to design something that lets you know I see you.</p>',
  },
  {
    title: 'Our tribe',
    html: `<p>From my girlfriend Rachel to my business partner Jaydn, I have deep connections with the beauty industry. You are hustlers, business-savvy <strong>artists</strong>, but the mounting pressure to survive has stripped the joy from a craft you once loved.</p><div class="mt-3 flex justify-center"><img src="${foundersImage}" alt="Dakota and Rachel" style="width:128px;height:128px;border-radius:16px;object-fit:cover;box-shadow:0 8px 20px rgba(15,23,42,0.18);"/></div>`,
  },
  {
    title: 'Why brandVX exists',
    html: '<p>brandVX is designed to help you optimize your business, save time, and generate more revenue. It grows with you — as a CEO, brand, salesperson, content-creator, and <strong>person</strong> — by accelerating every aspect of your passion. We are in open beta with 1,000 users and will keep shipping new features weekly. If you need anything, email <strong>support@aubecreativelabs.com</strong>.</p>',
  },
  {
    title: 'Let's stay in touch',
    html: '<p>I appreciate you trying brandVX and would love any feedback. Drop your contact info below and I will personally reach out to thank you. Go be great!</p><div class="mt-3 grid gap-2">\n  <label class="grid gap-1 text-sm">\n    <span class="text-xs uppercase tracking-wide text-slate-500">Email</span>\n    <input type="email" data-founder-email class="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="you@example.com"/>\n    <div class="text-[11px] text-rose-600 hidden" data-founder-email-error>Enter a valid email or leave blank.</div>\n  </label>\n  <label class="grid gap-1 text-sm">\n    <span class="text-xs uppercase tracking-wide text-slate-500">Phone</span>\n    <input type="tel" data-founder-phone class="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="(555) 555-5555"/>\n    <div class="text-[11px] text-rose-600 hidden" data-founder-phone-error>Use 7–15 digits (numbers, spaces, dashes, + allowed) or leave blank.</div>\n  </label>\n  <div class="text-[11px] text-slate-500">Optional — share either email or phone if you'd like me to follow up.</div>\n</div>',
  },
];

const registry: Record<string, GuideStep[]> = {
  workspace_intro: [
    { element: '[data-tour="nav-dashboard"]', popover: { title: 'Dashboard', description: 'Check your most important metrics, know the next best steps to take, and see the priority action to take today.' } },
    { element: '[data-tour="nav-askvx"]', popover: { title: 'askVX', description: 'Ask general — ask any question about branding, marketing, or the beauty industry. You can also train brandVX on how you run your business.' } },
    { element: '[data-tour="nav-vision"]', popover: { title: 'brandVZN', description: 'The easiest professional photo editor you've ever used. Showcase different looks and make basic photo edits with ease.' } },
    { element: '[data-tour="nav-messages"]', popover: { title: 'Messages', description: 'Draft messages in your brand's voice for clients in bulk. Currently supports creation; text sending support is coming soon.' } },
    { element: '[data-tour="nav-contacts"]', popover: { title: 'Clients', description: 'Search your clients to view their individual information, and send quick messages.' } },
    { element: '[data-tour="nav-calendar"]', popover: { title: 'Calendar', description: 'View all of your appointments and important events across your booking and Google Calendar.' } },
    { element: '[data-tour="nav-cadences"]', popover: { title: 'Follow‑ups', description: 'Easily follow up with who you need to, when you need to, so you don't miss any clients ever again.' } },
    { element: '[data-tour="nav-inventory"]', popover: { title: 'Inventory', description: 'Connect your inventory for basic management. Inventory is in beta; we'll expand this feature soon.' } },
    { element: '[data-tour="nav-approvals"]', popover: { title: 'To‑Do', description: 'See all of your notifications, follow‑ups, and anything that needs your approval in brandVX.' } },
    { element: '[data-tour="nav-integrations"]', popover: { title: 'Settings', description: 'Manage your brandVX settings.' } },
    { element: '[data-tour="book-onboarding"]', popover: { title: 'Book onboarding', description: 'For an in‑depth walk‑through with one of our founders, click Book onboarding to open our schedule and set a time.' } },
  ],
  onboarding: [
    { element: '[data-tour="steps"]', popover: { title: 'Steps', description: 'Personalize your brandVX — you can jump around anytime.' } },
    { element: '[data-tour="connect"]', popover: { title: 'Connect tools', description: 'Link booking, messages, payments, and CRM. We keep it human.' } },
    { element: '[data-tour="analyze"]', popover: { title: 'Analyze', description: 'Run a quick analysis to see what's configured.' } },
    { element: '[data-tour="cta"]', popover: { title: 'Ready when you are', description: 'White‑glove or self-serve — you approve everything.' } },
  ],
  dashboard: [
    // Centered welcome as step 0
    { popover: { title: 'Welcome to brandVX', description: 'Let's do a quick walk‑through of your workspace, then get you running our 3 most powerful features.', centered: true, showButtons: ['next'], nextBtnText: 'Start' } },
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
    { element: '[data-tour="book-onboarding"]', popover: { title: 'Book Onboarding', description: 'Schedule a 1-on-1 to go deeper whenever you're ready.' } },
    { element: '#tour-billing-anchor', popover: { title: 'Choose your plan', description: 'Unlock the workspace with a founding plan or free trial.', centered: true, showButtons: ['previous','next'], nextBtnText: 'Next', allowClicks: true, onPopoverRender: (dom: any) => {
      try {
        const host = dom?.popover || dom?.wrapper;
        if (!host) return;
        const c = document.createElement('div');
        c.className = 'mt-3 grid gap-2 sm:grid-cols-3';
        c.innerHTML = `
          <button class="bvx-onboard-btn" data-plan="lite">$47/mo — Lite</button>
          <button class="bvx-onboard-btn" data-plan="pro">$97/mo — Pro</button>
          <button class="bvx-onboard-btn" data-plan="founder">$147/mo — Founder</button>
        `;
        host.appendChild(c);
        const wire = (btn: HTMLElement|null, plan: string) => {
          btn?.addEventListener('click', () => {
            try { window.dispatchEvent(new CustomEvent('bvx:billing:checkout', { detail: { plan } })); } catch {}
          });
        };
        wire(c.querySelector('[data-plan="lite"]') as any, 'lite');
        wire(c.querySelector('[data-plan="pro"]') as any, 'pro');
        wire(c.querySelector('[data-plan="founder"]') as any, 'founder');
      } catch {}
    } } },
    { element: '[data-guide="kpis"]', popover: { title: 'Your metrics at the top', description: 'Review key metrics to track how brandVX is helping you grow.' } },
    { element: '[data-guide="next-best-steps"]', popover: { title: 'Next Best Steps', description: 'Monitor and keep up with the next best actions to take to maximize your business.', allowClicks: true } },
    { element: '[data-guide="quickstart"]', popover: { title: 'Guided Walk‑through', description: 'Kick off with brandVZN, import clients, or train VX so you can showcase three fast wins and learn how to use brandVX.' } },
    {
      element: '[data-guide="quickstart-brandvzn"]',
      popover: {
        title: 'Guided Walk‑through',
        description: 'Let's showcase three of brandVX's most powerful features.<div class="mt-3"><button class="bvx-onboard-btn" data-open-vision>Open brandVZN</button></div>',
        centered: true,
        showButtons: ['previous'],
        onPopoverRender: (dom: any) => {
          try {
            const triggerNavigate = () => {
              // Unified flow: keep current driver alive and rely on page-ready gating
              try { window.dispatchEvent(new CustomEvent('bvx:guide:navigate', { detail: { pane: 'vision' } })); } catch {}
            };
            // Bind button (check both popover and wrapper roots)
            const btn = dom?.popover?.querySelector?.('[data-open-vision]') || dom?.wrapper?.querySelector?.('[data-open-vision]') || document.querySelector('[data-open-vision]');
            btn?.addEventListener('click', (e: Event) => { try{ e.preventDefault(); }catch{} triggerNavigate(); });
            // Unify ArrowRight to perform the same navigate (no cross-route moveNext)
            const keyHandler = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') { e.stopPropagation(); e.preventDefault(); triggerNavigate(); } };
            document.addEventListener('keydown', keyHandler, true);
            window.addEventListener('keydown', keyHandler, true);
            const cleanup = () => {
              document.removeEventListener('keydown', keyHandler, true);
              window.removeEventListener('keydown', keyHandler, true);
            };
            // Cleanup when this popover is replaced
            setTimeout(() => { try { cleanup(); } catch {} }, 9000);
          } catch {}
        },
      },
    },
    // Centered intro on Vision to avoid anchoring races right after navigation
    { popover: { title: 'brandVZN', description: 'Let's do a quick color change so you can see how edits work. Then we'll continue the tour.', centered: true, showButtons: ['previous', 'next'], nextBtnText: 'Next' } },
    { element: '[data-guide="upload"]', popover: { title: 'Upload a look', description: 'Pick a photo that shows the subject's face and hair, then press Upload.', allowClicks: true, onPopoverRender: () => { try { const id='bvx-driver-pe'; if (!document.getElementById(id)) { const s=document.createElement('style'); s.id=id; s.textContent = `.driver-overlay{ pointer-events:none !important; } .driver-stage{ pointer-events:none !important; background: transparent !important; }`; document.head.appendChild(s); } } catch {} } } },
    {
      popover: {
        title: 'Select a color',
        description: `What color would you like to transform their hair to? Select a color, then hit Continue.<br/><br/>
          <div class="grid gap-2">
            <button data-color="copper" class="bvx-color-btn">Copper</button>
            <button data-color="espresso" class="bvx-color-btn">Espresso Brown</button>
            <button data-color="platinum" class="bvx-color-btn">Platinum Blonde</button>
            <button data-color="rose" class="bvx-color-btn">Rose Gold</button>
            <button data-color="jet" class="bvx-color-btn">Jet Black</button>
          </div>`,
        showButtons: ['previous','next'],
        onPopoverRender: (dom: any) => {
          const palette: Record<string, string> = {
            copper: 'Change the subject's hair to a warm copper tone.',
            espresso: 'Change the subject's hair to a rich espresso brown.',
            platinum: 'Change the subject's hair to a bright platinum blonde.',
            rose: 'Change the subject's hair to a shiny rose gold.',
            jet: 'Change the subject's hair to a glossy jet black.',
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
              // No auto-advance; user will click Next
            });
          });
        },
      },
    },
    { element: '[data-guide="edit"]', popover: { title: 'Run edit', description: 'Click Run Edit to apply your selected color.', allowClicks: true } },
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
        description: 'Re-run Run Edit to refine the look as many times as you'd like.',
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
        showButtons: ['previous', 'next'],
        nextBtnText: 'Go to Clients',
        onPopoverRender: (dom: any) => {
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
          };

          const skipHandler = () => {
            (window as any).__bvxSkipImport = true;
            cleanup();
          };

          window.addEventListener('bvx:flow:contacts-imported', importedHandler as any, { once: true } as any);
          window.addEventListener('bvx:onboarding:skip-import', skipHandler as any, { once: true } as any);

          importBtn?.addEventListener('click', () => {
            (window as any).__bvxSkipImport = false;
            try { sessionStorage.setItem('bvx_auto_import','1'); } catch {}
            try { window.dispatchEvent(new CustomEvent('bvx:guide:navigate', { detail: { pane: 'contacts' } })); } catch {}
          });

          skipBtn?.addEventListener('click', () => {
            (window as any).__bvxSkipImport = true;
            ensureStripe();
            skipPanel?.classList.remove('hidden');
          });

          skipContinue?.addEventListener('click', () => {
            cleanup();
            try { window.dispatchEvent(new CustomEvent('bvx:onboarding:skip-import')); } catch {}
            try { localStorage.setItem('bvx_done_contacts', '1'); } catch {}
            try { localStorage.setItem('bvx_done_plan', '1'); } catch {}
            try { window.dispatchEvent(new CustomEvent('bvx:quickstart:update')); } catch {}
            // Jump directly to AskVX and prepare the strategy prompt
            try { window.dispatchEvent(new CustomEvent('bvx:guide:navigate', { detail: { pane: 'askvx' } })); } catch {}
            const onAskReady = () => {
              try { window.removeEventListener('bvx:ask:ready', onAskReady as any); } catch {}
              try { window.dispatchEvent(new CustomEvent('askvx.frontfill-strategy')); } catch {}
              // Advance the tour to the "Send the strategy prompt" step if driver is present
              try {
                const drv: any = (window as any).__driverDashboard;
                const titleMatch = (t:string)=>/Send the strategy prompt/i.test(t);
                let tries = 0;
                const stepTo = () => {
                  tries++;
                  const st = drv?.getState?.();
                  const idx = st?.activeIndex ?? -1;
                  const title = String(drv?._options?.steps?.[idx]?.popover?.title || '');
                  if (titleMatch(title) || tries > 10) return;
                  try { drv.moveNext?.(); } catch {}
                  setTimeout(stepTo, 120);
                };
                setTimeout(stepTo, 200);
              } catch {}
            };
            try { window.addEventListener('bvx:ask:ready', onAskReady as any, { once: true } as any); } catch {}
          });
          // Navigation to Contacts is now triggered on Next; global gate will advance on bvx:contacts:ready
        },
        onNextClick: (_el, _step, { driver }) => {
          void driver;
          try { window.dispatchEvent(new CustomEvent('bvx:guide:navigate', { detail: { pane: 'contacts' } })); } catch {}
          try { window.dispatchEvent(new CustomEvent('bvx:dbg', { detail: { type: 'nav.req', pane: 'contacts' } })); } catch {}
        },
      },
    },
    // Centered intro on Contacts to stabilize first step after navigation
    { popover: { title: 'Contacts', description: 'We'll import your guests so AskVX can analyze recent revenue and surface top clients.', centered: true, showButtons: ['previous', 'next'], nextBtnText: 'Next' } },
    {
      element: '[data-guide="clients-import-status"]',
      popover: {
        title: 'Import status',
        description: 'We'll show your latest import status here. If something fails you can retry or skip ahead.',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Continue',
        onPopoverRender: (_dom: any) => {
          if ((window as any).__bvxSkipImport) return;
        },
      },
    },
    { element: '[data-guide="clients-list"]', popover: { title: 'Clients list', description: 'Review synced guests, visit history, and follow-up readiness in one place.', showButtons: ['previous', 'next'], onPopoverRender: ()=>{ try{ window.dispatchEvent(new CustomEvent('bvx:dbg',{ detail:{ type:'clients.ready' } })); }catch{} } } },
    { element: '[data-guide="clients-actions"]', popover: { title: 'Quick actions', description: 'Select text or email to copy contact info and launch ready-to-edit drafts.', showButtons: ['previous', 'next'] } },
    { element: '[data-guide="clients-pagination"]', popover: { title: 'Navigate pages', description: 'Use the arrows to move through larger client lists.', showButtons: ['previous', 'next'] } },
    { element: '[data-guide="clients-export"]', popover: { title: 'Export CSV', description: 'Download your imported contacts anytime for offline review.', showButtons: ['previous', 'next'] } },
    { element: '[data-guide="clients-refresh"]', popover: { title: 'Refresh data', description: 'Pull the latest booking updates whenever you reconnect providers.', showButtons: ['previous', 'next'] } },
    {
      popover: {
        title: 'Next: askVX',
        description: 'We'll grab a revenue snapshot and build a strategy next.',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Go to askVX',
        onNextClick: (_element, _step, { driver }) => {
          void driver; // advance will occur after askvx ready via gating listener
          try { window.dispatchEvent(new CustomEvent('bvx:guide:navigate', { detail: { pane: 'askvx' } })); } catch {}
          try {
            const handler = () => {
              try { window.removeEventListener('bvx:ask:ready', handler as any); } catch {}
              try { window.dispatchEvent(new CustomEvent('bvx:flow:askvx-command', { detail: { action: 'askvx.frontfill-insights' } })); } catch {}
            };
            window.addEventListener('bvx:ask:ready', handler as any, { once: true } as any);
          } catch {}
        },
      },
      onEnter: () => {
        try { delete (window as any).__bvxInsightsRequested; } catch {}
      },
    },
    // Centered intro on AskVX to orient users after navigation
    { element: '#tour-center-anchor', popover: { title: 'askVX', description: 'We'll load a prompt that summarizes your last 3 months revenue and top 3 clients. You'll press Send to run it.', centered: true, showButtons: ['previous', 'next'], nextBtnText: 'Next' } },
    { element: '[data-guide="askvx-import-count"]', popover: { title: 'Imported contacts', description: 'Here's the new contact count from your booking sync.', showButtons: ['previous', 'next'] } },
    { element: '[data-guide="askvx-digest"]', popover: { title: 'Since your last visit', description: 'Keep an eye on fresh contacts, appointments, and messages.', showButtons: ['previous', 'next'] } },
    {
      element: '[data-guide="composer"]',
      popover: {
        title: 'Review the insights prompt',
        description: 'We queued a summary prompt so it's ready to send. Tweak anything you'd like, then continue.',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Next',
        allowClicks: true,
      },
      onEnter: () => {
        try {
          if (!(window as any).__bvxInsightsFrontfilled) {
            (window as any).__bvxInsightsFrontfilled = true;
            window.dispatchEvent(new CustomEvent('bvx:flow:askvx-command', { detail: { action: 'askvx.frontfill-insights' } }));
          }
        } catch {}
      },
      onExit: (ctx) => {
        try {
          if ((window as any).__bvxInsightsPrefilled) return;
          (window as any).__bvxInsightsPrefilled = true;
          const summary = (window as any).__bvxAskInsights?.summary || null;
          const prompt = (window as any).__bvxAskInsights?.prompt || '';
          window.dispatchEvent(
            new CustomEvent('bvx:ask:prefill', {
              detail: {
                kind: 'insights',
                source: 'tour',
                step: typeof ctx?.index === 'number' ? ctx.index : 36,
                at: Date.now(),
                payload: summary,
                visible: prompt,
              },
            })
          );
        } catch {}
      },
    },
    {
      element: '[data-guide="ask-send"]',
      popover: {
        title: 'Send the prompt',
        description: 'Press Send to let AskVX crunch the numbers for you.',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Next',
        allowClicks: true,
      },
    },
    { element: '[data-guide="messages"]', popover: { title: 'Waiting for reply', description: 'We'll highlight the conversation while AskVX responds.', showButtons: ['previous', 'next'], nextBtnText: 'Continue', allowClicks: true } },
    {
      element: '[data-guide="askvx-strategy"]',
      popover: {
        title: 'Plan your next 14 days',
        description: 'We'll outline what's next and then prepare a strategy prompt for you to send.',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Ready',
        onNextClick: (_element, _step, { driver }) => {
          void driver;
          if ((window as any).__bvxSkipImport) return;
          try { window.dispatchEvent(new CustomEvent('bvx:flow:askvx-command', { detail: { action: 'askvx.frontfill-strategy' } })); } catch {}
          try { driver.moveNext?.(); } catch {}
        },
      },
      onEnter: () => {
        try { delete (window as any).__bvxStrategyPrefilled; } catch {}
      },
    },
    {
      element: '[data-guide="composer"]',
      popover: {
        title: 'Send the strategy prompt',
        description: 'We queued the 14-day strategy prompt so it's ready to review and send.',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Next',
        allowClicks: true,
      },
      onExit: (ctx) => {
        try {
          if ((window as any).__bvxStrategyPrefilled) return;
          (window as any).__bvxStrategyPrefilled = true;
          const snapshot = (window as any).__bvxAskInsights?.summary || null;
          const brand = (window as any).__bvxBrandContext || null;
          const prompt = typeof (window as any).__bvxStrategyPrompt === 'string' ? (window as any).__bvxStrategyPrompt : '';
          window.dispatchEvent(
            new CustomEvent('bvx:ask:prefill', {
              detail: {
                kind: 'strategy',
                source: 'tour',
                step: typeof ctx?.index === 'number' ? ctx.index : 40,
                at: Date.now(),
                payload: { snapshot, brand },
                visible: prompt,
              },
            })
          );
        } catch {}
      },
    },
    { element: '[data-guide="messages"]', popover: { title: 'Waiting for reply', description: 'We'll highlight the conversation while AskVX drafts your 14‑day plan.', showButtons: ['previous', 'next'], nextBtnText: 'Continue', allowClicks: true } },
    {
      element: '#tour-welcome-anchor',
      popover: {
        title: 'Build your 14‑day strategy',
        description: 'Generate and download the Markdown plan. We'll also save it to your memory.\n\n<div class="mt-3"><button class="bvx-onboard-btn" data-onboard-generate>Generate & Download</button></div>',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Next',
        allowClicks: true,
        onPopoverRender: (dom: any) => {
          try {
            const btn = dom?.popover?.querySelector?.('[data-onboard-generate]') || dom?.wrapper?.querySelector?.('[data-onboard-generate]');
            if (!btn) return;
            const trigger = async () => {
              try {
                // If a strategy doc is already available on window, download immediately
                const existing = (window as any).__bvxStrategyDoc?.markdown as string | undefined;
                if (existing && typeof existing === 'string' && existing.length > 0) {
                  const blob = new Blob([existing], { type: 'text/markdown;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'brandvx-14-day-strategy.md';
                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                  setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch{} }, 1500);
                  return;
                }
                // Otherwise ask AskVX pane to prepare, then poll for availability and download
                try { window.dispatchEvent(new CustomEvent('bvx:flow:askvx-command', { detail: { action: 'askvx.prepare-strategy' } })); } catch {}
                const start = Date.now();
                const check = () => {
                  try {
                    const md = (window as any).__bvxStrategyDoc?.markdown as string | undefined;
                    if (md && md.length > 0) {
                      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = 'brandvx-14-day-strategy.md';
                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch{} }, 1500);
                      return;
                    }
                    if (Date.now() - start > 15000) return;
                    setTimeout(check, 400);
                  } catch {}
                };
                setTimeout(check, 500);
              } catch {}
            };
            btn.addEventListener('click', (e: Event) => { try{ e.preventDefault(); }catch{} trigger(); });
          } catch {}
        },
      },
    },
    {
      element: '#tour-welcome-anchor',
      popover: {
        title: 'Next: Train VX',
        description: 'Switch to Train & Profile to add tone notes and review your brand profile.',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Open Train VX',
        onNextClick: (_element, _step, { driver }) => {
          try {
            window.dispatchEvent(new CustomEvent('bvx:flow:askvx-command', { detail: { action: 'askvx.tab', tab: 'profile' } }));
          } catch {}
          const start = Date.now();
          const advance = () => { try { driver.moveNext?.(); } catch {} };
          const wait = () => {
            try {
              const ready = document.querySelector('[data-guide="trainvx-notes"]') || document.querySelector('[data-guide="trainvx-profile"]');
              if (ready) { advance(); return; }
              if (Date.now() - start > 6000) { advance(); return; }
              setTimeout(wait, 120);
            } catch { advance(); }
          };
          setTimeout(wait, 120);
        },
      },
    },
    { element: '[data-guide="trainvx-notes"]', popover: { title: 'Add a brand fact', description: 'Type a tone note or preference, then press "Save to training".', showButtons: ['previous', 'next'], allowClicks: true } },
    {
      element: '[data-guide="trainvx-profile"]',
      popover: {
        title: 'Review your brand profile',
        description: 'Use Edit → Save to adjust tone, story, and pricing anytime.',
        showButtons: ['previous', 'next'],
        nextBtnText: 'Next',
        onNextClick: (_element, _step, { driver }) => {
          void driver; // advance will occur after dashboard ready via gating listener
          try {
            window.dispatchEvent(new CustomEvent('bvx:guide:navigate', { detail: { pane: 'dashboard' } }));
          } catch {}
        },
        allowClicks: true,
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
    { element: '[data-guide="upload"]', popover: { title: 'Upload', description: 'Pick a photo or screenshot to analyze or edit.', allowClicks: true } },
    { element: '[data-guide\="analyze"]', popover: { title: 'Analyze', description: 'GPT‑5 returns a short brief (lighting, color, texture). Use Notes to ask a specific question.', allowClicks: true } },
    { element: '[data-guide="edit"]', popover: { title: 'Edit', description: 'Run subtle edits using the prompt to the left.', allowClicks: true } },
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
    { popover: { title: 'Follow‑ups', description: 'Set up human‑feel follow‑ups. "Update follow‑ups" processes due steps and respects quiet hours.' } },
    { element: '[data-guide="kpis"]', popover: { title: 'Coverage', description: 'See how many contacts are in each step and what's next.' } },
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

// Handoff shim to normalize index after Train VX → Dashboard
registry.dashboard.push({
  element: '#tour-welcome-anchor',
  popover: {
    title: '',
    description: '',
    centered: true,
    showButtons: ['next'],
    onPopoverRender: (_dom: any, { driver }) => { try { setTimeout(() => driver.moveNext?.(), 10); } catch {} },
  },
});

founderSlides.forEach((slide, idx) => {
  registry.dashboard.push({
    element: '#tour-welcome-anchor',
    popover: {
      title: slide.title,
      description: slide.html,
      centered: true,
      showButtons: ['previous', 'next'],
      allowClicks: true,
      nextBtnText: idx === founderSlides.length - 1 ? 'Finish tour' : 'Next',
      onPopoverRender: (dom: any) => {
        try {
          const desc = dom?.popover?.querySelector?.('.driver-popover-description');
          if (desc) desc.innerHTML = slide.html;
          if (idx === founderSlides.length - 1) {
            try {
              const nextBtn = dom?.popover?.querySelector?.('[data-action="next"]') as HTMLButtonElement | null;
              if (nextBtn) {
                nextBtn.textContent = 'Finish tour';
                nextBtn.dataset.analyticsEvent = 'tour_founder_finish';
              }
            } catch {}
          }
        } catch {}
      },
      onNextClick: idx === founderSlides.length - 1
        ? async (_element, _step, { driver }) => {
            const result = validateFounderForm({ showErrors: true });
            if (!result.valid) return;
            try {
              await submitFounderContact(result.state, true);
            } catch {}
            try { localStorage.setItem('bvx_founder_finale_seen', '1'); } catch {}
            try { localStorage.setItem('bvx_quickstart_completed', '1'); } catch {}
            try { window.dispatchEvent(new CustomEvent('bvx:quickstart:completed')); } catch {}
            clearFounderForm();
            try { driver?.destroy?.(); } catch {}
          }
        : async (_element, _step, { driver }) => {
            const result = validateFounderForm({ showErrors: true });
            if (!result.valid) return;
            await submitFounderContact(result.state);
            try { driver?.moveNext?.(); } catch {}
          },
    },
  });
});

export function getGuideSteps(page: string): GuideStep[] {
  return registry[page] || [];
}

export function startGuide(page: string, _opts?: { step?: number }) {
  const steps = getGuideSteps(page);
  if (!steps || steps.length === 0) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  // Singleton guard: avoid multiple driver instances fighting each other
  try {
    // If a start is already in-flight or a tour is running, no-op
    if ((window as any).__bvxTourStarting === true || (window as any).__bvxTourRunning === true) {
      return;
    }
    (window as any).__bvxTourStarting = true;
    // Clean any lingering overlays/stages from prior interrupted runs
    try { document.querySelectorAll('.driver-overlay, .driver-stage, .driver-popover').forEach(el => { try { el.parentElement?.removeChild(el); } catch {} }); } catch {}
  } catch {}
  if (page === 'dashboard') {
    try { delete (window as any).__bvxStrategyPrefilled; } catch {}
    try { delete (window as any).__bvxInsightsRequested; } catch {}
  }
  try { localStorage.setItem('bvx_last_tour_page', page); } catch {}
  try { localStorage.setItem('bvx_last_tour_step', '0'); } catch {}
  try {
    const tenantId = (()=>{ try{ return localStorage.getItem('bvx_tenant')||''; }catch{ return '' }})();
    if (tenantId) void api.post('/onboarding/complete_step', { tenant_id: tenantId, step_key: `tour.start.${page}`, context: {} });
  } catch {}
  try { track('tour_start', { page }); } catch {}
  // Ensure centered steps remain enabled in production: strip ?nocenter=1 unless debugging
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('nocenter') === '1' && localStorage.getItem('bvx_debug') !== '1') {
      url.searchParams.delete('nocenter');
      window.history.replaceState({}, '', url.toString());
    }
  } catch {}
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
      // Runtime toggle: allow skipping special centering for diagnosis via ?nocenter=1 or localStorage('bvx_nocenter')
      const nocenter = (()=>{ try{ const sp = new URLSearchParams(window.location.search); return sp.get('nocenter')==='1' || localStorage.getItem('bvx_nocenter')==='1'; }catch{ return false; } })();
      const instance = driverFactory({
        showProgress: steps.length > 1,
        allowClose: false,
        animate: true,
        overlayOpacity: 0.55,
        stagePadding: 8,
        steps: steps.map((step, idx) => {
          const hasElement = Boolean(step.element);
          const autoCentered = !hasElement;
          const { title, description, onPopoverRender: originalOnRender, centered, ...restPopover } = step.popover as any;
          // Compose a renderer that can force viewport-centering when requested
          const composedOnRender = (dom: any, opts: { driver: any }) => {
            try {
              const effectiveCentered = (!!centered || autoCentered) && !nocenter;
              if (effectiveCentered) {
                // Hide arrow for the centered welcome; placement is handled by anchor element
                try { (dom?.popover?.querySelector?.('.driver-popover-arrow') as HTMLElement | null)?.style?.setProperty('display','none'); } catch {}
              }
            } catch {}
            // Instrumentation: report active step transitions for debugging
            try {
              const idx = typeof opts?.driver?.getActiveIndex === 'function' ? opts.driver.getActiveIndex() : null;
              window.dispatchEvent(new CustomEvent('bvx:tour:step', { detail: { page, index: idx, title } }));
            } catch {}
            try { if (typeof originalOnRender === 'function') originalOnRender(dom, opts); } catch {}
          };
          const effectiveCentered = (!!centered || autoCentered) && !nocenter;
          const centerAnchor = document.getElementById('tour-center-anchor') as any;
          const stepIndex = idx;
          return {
            // When centered, attach to our fixed anchor right at the viewport center
            element: effectiveCentered ? (centerAnchor || (document.body as any)) : (step.element || document.body),
            popover: {
              title,
              description,
              side: effectiveCentered ? 'bottom' : 'bottom',
              align: effectiveCentered ? 'center' : 'start',
              onPopoverRender: composedOnRender,
              ...restPopover,
              // Preserve a flag for click-through overlay handling
              bvxAllowClicks: (step.popover as any)?.allowClicks === true,
              bvxStepIndex: stepIndex,
              bvxAutoCentered: autoCentered,
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
            .driver-overlay {
              z-index: 2147483641 !important;
              background: transparent !important; /* keep stage fully bright */
              pointer-events: auto !important; /* ensure overlay captures clicks */
            }
            .driver-overlay + .driver-overlay { display: none !important; }
            .driver-popover { z-index: 2147483642 !important; max-width: min(560px, 90vw) !important; }
          `;
          document.head.appendChild(s);
        }
        // Remove legacy body-based centering helpers; anchor-based centering handles placement
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
              border: 1px solid rgb(148 163 184 / 0.6);
              background: linear-gradient(180deg, rgb(219 234 254) 0%, rgb(191 219 254) 100%);
              font-size: 0.78rem;
              font-weight: 600;
              color: rgb(30 58 138);
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
      // Helper: toggle overlay/stage pointer events for clickable steps
      const setOverlayClicks = (allow: boolean) => {
        try {
          const id = 'bvx-driver-pe';
          const existing = document.getElementById(id);
          if (allow) {
            if (!existing) {
              const s = document.createElement('style');
              s.id = id;
              s.textContent = `
                .driver-overlay{ pointer-events: none !important; }
                .driver-stage{ pointer-events: none !important; background: transparent !important; }
              `;
              document.head.appendChild(s);
            }
          } else if (existing) {
            existing.parentElement?.removeChild(existing);
          }
        } catch {}
      };

      const persistIndex = () => {
        try {
          const idx = instance?.getState?.()?.activeIndex;
          if (typeof idx === 'number') localStorage.setItem('bvx_last_tour_step', String(idx));
        } catch {}
      };
      instance.on?.('next', persistIndex);
      instance.on?.('previous', persistIndex);
      let lastActiveIndex: number | null = null;
      const runStepHook = (idx: number | null | undefined, type: 'enter' | 'exit') => {
        if (typeof idx !== 'number' || idx < 0) return;
        const targetStep = steps[idx];
        if (!targetStep) return;
        try {
          if (type === 'enter') targetStep.onEnter?.({ driver: instance, step: targetStep, index: idx });
          if (type === 'exit') targetStep.onExit?.({ driver: instance, step: targetStep, index: idx });
        } catch {}
      };
      const arrowNavHandler = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          try { instance.moveNext?.(); } catch {}
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          try { instance.movePrevious?.(); } catch {}
        }
      };
      document.addEventListener('keydown', arrowNavHandler, true);
      window.addEventListener('keydown', arrowNavHandler, true);

      const detachArrowNav = () => {
        document.removeEventListener('keydown', arrowNavHandler, true);
        window.removeEventListener('keydown', arrowNavHandler, true);
      };

      const restoreFounderFieldsIfNeeded = (cfg: any) => {
        if (!cfg) return;
        const title = String(cfg.title || '').toLowerCase();
        const isFounder = title.includes('let's stay in touch') || title.includes("let's stay in touch");
        if (isFounder) initFounderFormStep();
      };

      instance.on?.('highlighted', () => {
        persistIndex();
        let currentIndex = -1;
        try {
          const state = instance?.getState?.();
          currentIndex = state?.activeIndex ?? -1;
          const cfg = (instance as any)?._options?.steps?.[currentIndex]?.popover || {};
          const allow = !!cfg?.bvxAllowClicks;
          setOverlayClicks(allow);
          restoreFounderFieldsIfNeeded(cfg);
        } catch {}
        // Remove any duplicate overlays to prevent double-dimming
        try {
          const overlays = Array.from(document.querySelectorAll('.driver-overlay')) as HTMLElement[];
          overlays.slice(1).forEach((el) => { try { el.parentElement?.removeChild(el); } catch {} });
        } catch {}
        try {
          const idxNumber = currentIndex;
          const changed = idxNumber !== lastActiveIndex;
          if (changed && typeof lastActiveIndex === 'number' && lastActiveIndex >= 0) {
            runStepHook(lastActiveIndex, 'exit');
          }
          if (changed && idxNumber >= 0) {
            runStepHook(idxNumber, 'enter');
          }
          if (changed) {
            lastActiveIndex = idxNumber >= 0 ? idxNumber : lastActiveIndex;
          }
        } catch {}
      });
      try {
        window.dispatchEvent(new CustomEvent('bvx:tour:started', { detail: { page, total: steps.length } }));
      } catch {}

      if (page === 'dashboard') {
        instance.on?.('highlighted', () => {
          try {
            const idx = instance?.getState?.()?.activeIndex ?? -1;
            // Welcome step handled by modal; treat first dashboard step as already seen
            if (idx === DASHBOARD_BILLING_STEP) {
              try { window.dispatchEvent(new CustomEvent('bvx:guide:dashboard:billing')); } catch {}
            }
            // Billing step: let users click the modal buttons under the tour overlay
            try {
              const styleId = 'bvx-driver-pe';
              const existing = document.getElementById(styleId);
              if (idx === DASHBOARD_BILLING_STEP) {
                if (!existing) {
                  const s = document.createElement('style');
                  s.id = styleId;
                  s.textContent = `.driver-overlay{ pointer-events: none !important; } .driver-stage{ pointer-events: none !important; }`;
                  document.head.appendChild(s);
                }
              } else if (existing) {
                existing.parentElement?.removeChild(existing);
              }
            } catch {}
            // Removed legacy body-based centering toggles
          } catch {}
        });
      }
      if (page === 'dashboard') {
        // Handle brandVZN jump: wait for explicit page-ready event before advancing
        try {
          window.addEventListener('bvx:guide:navigate', (ev: any) => {
            try {
              const target = (ev?.detail?.pane || '').toString();
              if (target !== 'vision') return;
              const start = Date.now();
              let advanced = false;
              const onReady = () => {
                if (advanced) return; advanced = true;
                try { window.removeEventListener('bvx:vision:ready', onReady as any); } catch {}
                try { instance.moveNext?.(); } catch {}
              };
              window.addEventListener('bvx:vision:ready', onReady as any, { once: true } as any);
              // Backstop: if ready event is missed, fallback to selector presence
              const wait = () => {
                try {
                  const sp = new URLSearchParams(window.location.search);
                  const pane = sp.get('pane');
                  const ready = pane === 'vision' && document.querySelector('[data-guide="upload"]');
                  if (ready) { onReady(); return; }
                  if (Date.now() - start > 6000) { return; }
                  setTimeout(wait, 120);
                } catch {}
              };
              setTimeout(wait, 200);
            } catch {}
          });
  } catch {}
        // Handle Contacts jump: wait for explicit page-ready event before advancing
        try {
          window.addEventListener('bvx:guide:navigate', (ev: any) => {
            try {
              const target = (ev?.detail?.pane || '').toString();
              if (target !== 'contacts') return;
              const start = Date.now();
              const onReady = () => {
                try { window.removeEventListener('bvx:contacts:ready', onReady as any); } catch {}
                try { instance.moveNext?.(); } catch {}
              };
              window.addEventListener('bvx:contacts:ready', onReady as any, { once: true } as any);
              const wait = () => {
                try {
                  const sp = new URLSearchParams(window.location.search);
                  const pane = sp.get('pane');
                  const ready = pane === 'contacts' && (document.querySelector('[data-guide="clients-import-status"]') || document.querySelector('[data-guide="clients-list"]'));
                  if (ready) { onReady(); return; }
                  if (Date.now() - start > 7000) { return; }
                  setTimeout(wait, 120);
                } catch {}
              };
              setTimeout(wait, 200);
            } catch {}
          });
        } catch {}
        // Instrumentation: log navigation lifecycle
        try {
          window.addEventListener('bvx:guide:navigate', (ev: any) => {
            try { window.dispatchEvent(new CustomEvent('bvx:dbg', { detail: { type: 'nav.req', pane: ev?.detail?.pane } })); } catch {}
          });
          window.addEventListener('bvx:guide:navigate:done', (ev: any) => {
            try { window.dispatchEvent(new CustomEvent('bvx:dbg', { detail: { type: 'nav.done', pane: ev?.detail?.pane } })); } catch {}
          });
  } catch {}
}
      // Handle return to Dashboard: wait for page-ready event before advancing
      try {
        window.addEventListener('bvx:guide:navigate', (ev: any) => {
          try {
            const target = (ev?.detail?.pane || '').toString();
            if (target !== 'dashboard') return;
            const start = Date.now();
            const onReady = () => {
              try { window.removeEventListener('bvx:dashboard:ready', onReady as any); } catch {}
              try { instance.moveNext?.(); } catch {}
            };
            window.addEventListener('bvx:dashboard:ready', onReady as any, { once: true } as any);
            const wait = () => {
              try {
                const sp = new URLSearchParams(window.location.search);
                const pane = sp.get('pane');
                const ready = pane === 'dashboard' && document.getElementById('tour-welcome-anchor');
                if (ready) { onReady(); return; }
                if (Date.now() - start > 6000) { return; }
                setTimeout(wait, 120);
              } catch {}
            };
            setTimeout(wait, 200);
          } catch {}
        });
      } catch {}
      // New: Handle AskVX jump readiness similar to Vision/Contacts
      try {
        window.addEventListener('bvx:guide:navigate', (ev: any) => {
          try {
            const target = (ev?.detail?.pane || '').toString();
            if (target !== 'askvx') return;
            const start = Date.now();
            const onReady = () => {
              try { window.removeEventListener('bvx:ask:ready', onReady as any); } catch {}
              try { instance.moveNext?.(); } catch {}
            };
            window.addEventListener('bvx:ask:ready', onReady as any, { once: true } as any);
            const wait = () => {
              try {
                const sp = new URLSearchParams(window.location.search);
                const pane = sp.get('pane');
                const ready = pane === 'askvx' && (document.querySelector('[data-guide="ask-input"]') || document.querySelector('input'));
                if (ready) { onReady(); return; }
                if (Date.now() - start > 6000) { return; }
                setTimeout(wait, 120);
              } catch {}
            };
            setTimeout(wait, 200);
          } catch {}
        });
      } catch {}
      if (typeof instance.drive === 'function') {
        instance.drive();
      }
      // Mark running and expose the singleton handle
      try {
        (window as any).__driverDashboard = instance;
        (window as any).__bvxTourRunning = true;
        (window as any).__bvxTourStarting = false;
      } catch {}
      instance.on?.('next', async () => {
        try {
          const state = instance?.getState?.();
          const idx = state?.activeIndex ?? -1;
          const cfg = (instance as any)?._options?.steps?.[idx]?.popover || {};
          const title = String(cfg?.title || '').toLowerCase();
          if (title.includes('let's stay in touch') || title.includes("let's stay in touch")) {
            const { valid, state: formState } = validateFounderForm({ showErrors: true });
            if (!valid) {
              try { instance.movePrevious?.(); } catch {}
              return;
            }
            await submitFounderContact(formState);
          }
          runStepHook(idx, 'enter');
        } catch {}
      });
      instance.on?.('previous', () => {
        try {
          const idx = instance?.getState?.()?.activeIndex;
          runStepHook(idx, 'enter');
        } catch {}
      });
      instance.on?.('destroyed', async () => {
        persistIndex();
        try {
          if (typeof lastActiveIndex === 'number' && lastActiveIndex >= 0) runStepHook(lastActiveIndex, 'exit');
        } catch {}
        try { document.body.classList.remove('bvx-center-popover-body'); } catch {}
        try { track('tour_complete', { page }); } catch {}
        if (page === 'workspace_intro') {
          try { localStorage.setItem('bvx_tour_seen_workspace_intro', '1'); } catch {}
          try { sessionStorage.setItem('bvx_intro_session', '1'); } catch {}
          try { window.dispatchEvent(new CustomEvent('bvx:guide:workspace_intro:done')); } catch {}
        }
        if (page === 'dashboard') {
          try { window.dispatchEvent(new CustomEvent('bvx:guide:dashboard:done')); } catch {}
          try { delete (window as any).__bvxStrategyPrefilled; } catch {}
          try { delete (window as any).__bvxInsightsRequested; } catch {}
          try { workspaceStorage.setGuideDone(true); } catch {}
          try { localStorage.setItem('bvx_quickstart_completed', '1'); } catch {}
          try { localStorage.setItem('bvx_done_contacts', '1'); } catch {}
          try { localStorage.setItem('bvx_done_plan', '1'); } catch {}
          try { localStorage.setItem('bvx_done_vision', '1'); } catch {}
          try { window.dispatchEvent(new CustomEvent('bvx:quickstart:completed')); } catch {}
          try { window.dispatchEvent(new CustomEvent('bvx:quickstart:update')); } catch {}
          try {
            const tenantId = (await getTenant().catch(() => '')) || localStorage.getItem('bvx_tenant') || '';
            if (tenantId) {
              const completedAt = Math.floor(Date.now() / 1000);
              await api.post('/onboarding/complete_tour', { tenant_id: tenantId, completed_at: completedAt });
            }
          } catch (err) {
            console.error('tour completion persistence failed', err);
          }
        }
        // Clear singleton flags and any leftover overlays/stages/popovers
        try {
          (window as any).__bvxTourRunning = false;
          (window as any).__bvxTourStarting = false;
          delete (window as any).__driverDashboard;
        } catch {}
        try { document.querySelectorAll('.driver-overlay, .driver-stage, .driver-popover').forEach(el => { try { el.parentElement?.removeChild(el); } catch {} }); } catch {}
        detachArrowNav();
        founderCleanup();
      });
    } catch (err) {
      console.error('startGuide error', err);
      try { (window as any).__bvxTourStarting = false; } catch {}
    }
  })();
}
