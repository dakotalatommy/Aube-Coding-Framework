export type GuideStep = { element?: string; popover: { title: string; description: string } };
import { driver } from 'driver.js';
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
    { element: '[data-guide="kpis"]', popover: { title: 'KPIs', description: 'Track time saved and messages at a glance.' } },
    { element: '[data-guide="actions"]', popover: { title: 'Quick actions', description: 'Import contacts, start a cadence, and more.' } },
  ],
  integrations: [
    { popover: { title: 'Integrations', description: 'Connect booking, CRM, messaging, and inventory.' } },
    { element: '[data-guide="providers"]', popover: { title: 'Providers', description: 'Each card shows connection status and actions.' } },
  ],
  messages: [
    { popover: { title: 'Messages', description: 'Simulate or send, consent-first. STOP/HELP honored automatically.' } },
    { element: 'button:has(> :where(.not-real))', popover: { title: 'Presets', description: 'Use presets to draft quickly, then edit before sending.' } },
  ],
  cadences: [
    { popover: { title: 'Cadences', description: 'Start/stop flows; scheduler tick processes due actions.' } },
  ],
  inventory: [
    { popover: { title: 'Inventory', description: 'Sync Shopify/Square and review items and stock levels.' } },
    { element: '[data-guide="kpis"]', popover: { title: 'Metrics', description: 'Products, low/out-of-stock, and top SKU.' } },
    { element: '[data-guide="table"]', popover: { title: 'Items', description: 'Low and out-of-stock items are highlighted.' } },
  ],
  calendar: [
    { popover: { title: 'Calendar', description: 'Unified view from Google/Apple plus booking merges.' } },
    { element: '[data-guide="filters"]', popover: { title: 'Provider filter', description: 'View only Google, Apple, Square or Acuity events.' } },
    { element: '[data-guide="list"]', popover: { title: 'Events', description: 'Events show provider tags; use Deduplicate to remove duplicates.' } },
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
};

export function getGuideSteps(page: string): GuideStep[] {
  return registry[page] || [];
}

export function startGuide(page: string) {
  const steps = getGuideSteps(page);
  if (!steps || steps.length === 0) return;
  const d = driver({
    showProgress: true,
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    steps,
  } as any);
  d.drive();
}


