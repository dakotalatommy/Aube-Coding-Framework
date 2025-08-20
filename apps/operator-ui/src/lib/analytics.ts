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




