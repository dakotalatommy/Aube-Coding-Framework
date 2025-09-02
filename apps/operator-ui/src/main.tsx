import { StrictMode } from 'react'
import '@google/model-viewer'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import posthog from 'posthog-js'
import * as Sentry from '@sentry/react'

const PH_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const PH_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://app.posthog.com'
if (PH_KEY) {
  posthog.init(PH_KEY, { api_host: PH_HOST, capture_pageview: true })
  try {
    // Capture global errors
    window.addEventListener('error', (e) => {
      try { posthog.capture('client_error', { message: e.message, source: 'window', filename: (e as any).filename, lineno: (e as any).lineno, colno: (e as any).colno }) } catch {}
    })
    window.addEventListener('unhandledrejection', (e) => {
      try { posthog.capture('client_unhandled_rejection', { reason: String((e as any).reason || ''), source: 'promise' }) } catch {}
    })
    // Capture console errors/warnings
    const origErr = console.error
    const origWarn = console.warn
    console.error = (...args: any[]) => { try { posthog.capture('client_console_error', { args: args.map(String).slice(0,5) }) } catch {}; try { origErr.apply(console, args as any) } catch {} }
    console.warn = (...args: any[]) => { try { posthog.capture('client_console_warn', { args: args.map(String).slice(0,5) }) } catch {}; try { origWarn.apply(console, args as any) } catch {} }
  } catch {}
}

// Idle prefetch for core vendor to smooth subsequent navigations
try {
  const idle = (cb: () => void) => (window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb) : setTimeout(cb, 1500)
  idle(() => { import('react'); import('react-dom'); import('react-router-dom'); })
} catch {}

// Optional Sentry initialization
try {
  const SENTRY_DSN = (import.meta.env as any).VITE_SENTRY_DSN as string | undefined
  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.0,
      replaysOnErrorSampleRate: 1.0,
      integrations: [Sentry.browserTracingIntegration?.(), Sentry.replayIntegration?.()].filter(Boolean) as any,
      beforeSend: (event) => {
        try {
          const tid = localStorage.getItem('bvx_tenant') || undefined
          const uid = (window as any)?.__bvx_uid || undefined
          if (tid) event.tags = { ...(event.tags||{}), tenant_id: tid }
          if (uid) event.user = { ...(event.user||{}), id: uid }
        } catch {}
        return event
      },
    })
    // Defer user identification until Supabase session is ready
    try {
      import('./lib/supabase').then(async (m) => {
        try {
          const s = await m.supabase.auth.getSession();
          const uid = s?.data?.session?.user?.id;
          if (uid) {
            (window as any).__bvx_uid = uid;
            Sentry.setUser({ id: uid });
          }
        } catch {}
      });
    } catch {}
  }
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker (non-blocking)
try {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
} catch {}
