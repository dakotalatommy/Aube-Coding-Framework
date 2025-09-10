import posthog from 'posthog-js';

let initialized = false;

// Standardized analytics events used across the app
export type AnalyticsEvent =
  | 'integrations.connect.click'
  | 'integrations.connect.retry'
  | 'integrations.reanalyze.click'
  | 'integrations.guide.open'
  | 'approvals.approve'
  | 'approvals.reject'
  | 'todo.approve'
  | 'todo.reject'
  | 'ask.smart_action.run'
  | 'vision.save_to_client'
  | 'vision.upload'
  | 'vision.run_edit'
  | 'vision.analyze'
  | 'cadences.start'
  | 'cadences.reminders.next_week'
  | 'cadences.reminders.reengage_30d'
  | 'cadences.reminders.winback_45d'
  | 'billing.success'
  | 'billing.modal.open'
  | 'referral.copy'
  | 'messages.filter.change'
  | 'messages.save_quiet_hours'
  | 'messages.draft'
  | 'contacts.import_booking';

export function initAnalytics() {
  if (initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  // Force US cloud host unless explicitly overridden
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
  if (!key) return; // silently no-op without key
  posthog.init(key, { api_host: host, capture_pageview: false, autocapture: false });
  initialized = true;
}

export function trackPage(path: string) {
  if (!initialized) initAnalytics();
  try {
    posthog.capture('$pageview', { path });
  } catch {}
}

export function track(event: string, props?: Record<string, any>) {
  if (!initialized) initAnalytics();
  try {
    posthog.capture(event, props || {});
  } catch {}
}

export function trackEvent(event: AnalyticsEvent, props?: Record<string, any>) {
  // Ensure consistent dot-case naming already enforced by union type
  track(event, props);
}

export function identify(userId?: string, props?: Record<string, any>) {
  if (!initialized) initAnalytics();
  try {
    if (userId) posthog.identify(userId, props || {});
  } catch {}
}

export function setFeatureFlag(key: string, value: boolean) {
  if (!initialized) initAnalytics();
  try {
    // PostHog JS does not expose a typed setter on featureFlags; use override via persistence
    const overrides = (posthog as any)?.persistence?.props?.$override_feature_flags || {};
    overrides[key] = value ? 'on' : 'off';
    if ((posthog as any)?.persistence?.register) {
      (posthog as any).persistence.register({ $override_feature_flags: overrides });
    }
  } catch {}
}



