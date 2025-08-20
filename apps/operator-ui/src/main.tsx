import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import posthog from 'posthog-js'

const PH_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const PH_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://app.posthog.com'
if (PH_KEY) {
  posthog.init(PH_KEY, { api_host: PH_HOST, capture_pageview: true })
}

// Idle prefetch for core vendor to smooth subsequent navigations
try {
  const idle = (cb: () => void) => (window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb) : setTimeout(cb, 1500)
  idle(() => { import('react'); import('react-dom'); import('react-router-dom'); })
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
