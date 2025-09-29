import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import posthog from 'posthog-js'
import { initAnalytics } from './lib/analytics'
import { supabase } from './lib/supabase'
import * as Sentry from '@sentry/react'

const PH_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
// const PH_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com'
// Defer analytics init until after first paint / idle to reduce TTI
try {
  const idle = (cb: () => void) => (window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb) : setTimeout(cb, 1200)
  if (PH_KEY) {
    idle(() => {
      initAnalytics()
      try {
        window.addEventListener('error', (e) => {
          try { posthog.capture('client_error', { message: e.message, source: 'window', filename: (e as any).filename, lineno: (e as any).lineno, colno: (e as any).colno }) } catch {}
        })
        window.addEventListener('unhandledrejection', (e) => {
          try { posthog.capture('client_unhandled_rejection', { reason: String((e as any).reason || ''), source: 'promise' }) } catch {}
        })
        const origErr = console.error
        const origWarn = console.warn
        console.error = (...args: any[]) => { try { posthog.capture('client_console_error', { args: args.map(String).slice(0,5) }) } catch {}; try { origErr.apply(console, args as any) } catch {} }
        console.warn = (...args: any[]) => { try { posthog.capture('client_console_warn', { args: args.map(String).slice(0,5) }) } catch {}; try { origWarn.apply(console, args as any) } catch {} }
      } catch {}
    })
  }
} catch {}

// Idle prefetch for core vendor to smooth subsequent navigations
try {
  const idle = (cb: () => void) => (window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb) : setTimeout(cb, 1500)
  idle(async () => {
    try {
      // Load React Router and make it globally available
      const ReactRouterDOM = await import('react-router-dom');
      if (typeof window !== 'undefined') {
        (window as any).ReactRouterDOM = ReactRouterDOM;
      }
    } catch (error) {
      console.error('Failed to load React Router:', error);
    }
    try { import('react'); } catch {}
    try { import('react-dom'); } catch {}
  })
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
      release: (import.meta.env as any).VITE_SENTRY_RELEASE as string | undefined,
      environment: (import.meta.env as any).VITE_SENTRY_ENVIRONMENT as string | (string | undefined),
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
      (async()=>{
        try {
          const s = await supabase.auth.getSession();
          const uid = s?.data?.session?.user?.id;
          if (uid) {
            (window as any).__bvx_uid = uid;
            Sentry.setUser({ id: uid });
          }
        } catch {}
      })();
    } catch {}
  }
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Temporarily unregister any existing service worker to force fresh shell
try {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations?.().then((regs)=>{
      regs?.forEach((r)=>{ try { r.unregister(); } catch {} });
      try { if ((window as any).__bvxDebug) console.info('[boot] SW unregistered; caches clear requested'); } catch {}
      // Best-effort: clear caches with our prefix
      try {
        (async()=>{
          const keys = await caches.keys();
          await Promise.all(keys.filter((k)=> k.startsWith('bvx-cache-')).map((k)=> caches.delete(k)));
        })();
      } catch {}
      // Skip re-registering for now; allow a fully fresh load
    }).catch(()=>{});
  }
} catch {}

// Mark end of boot phase to allow deferred UI prompts
try { sessionStorage.setItem('bvx_boot_phase','ready'); } catch {}
