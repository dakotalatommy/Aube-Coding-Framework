import posthog from 'posthog-js';

let initialized = false;

export function initAnalytics() {
  if (initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
  if (!key) return; // silently no-op without key
  posthog.init(key, { api_host: host, capture_pageview: false });
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




