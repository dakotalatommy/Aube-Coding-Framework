//
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Nav from './components/Nav';
import Breadcrumbs from './components/Breadcrumbs';
import { ToastProvider } from './components/ui/Toast';
import { useLenis } from './hooks/useLenis';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import CommandPalette from './components/CommandPalette';
import AskFloat from './components/AskFloat';
import { initAnalytics, trackPage } from './lib/analytics';
const Landing = lazy(() => import('./pages/Landing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Messages = lazy(() => import('./pages/Messages'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Cadences = lazy(() => import('./pages/Cadences'));
const Approvals = lazy(() => import('./pages/Approvals'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Ask = lazy(() => import('./pages/Ask'));
const Admin = lazy(() => import('./pages/Admin'));
const Agent = lazy(() => import('./pages/Agent'));
const Vision = lazy(() => import('./pages/Vision'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Curation = lazy(() => import('./pages/Curation'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Workflows = lazy(() => import('./pages/Workflows'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Tutorial = lazy(() => import('./pages/Tutorial'));

function RouteContent() {
  const loc = useLocation();
  const embed = new URLSearchParams(loc.search).get('embed') === '1';
  initAnalytics();
  try { trackPage(loc.pathname + loc.search); } catch {}
  return (
    <>
      {loc.pathname !== '/' && !embed && (
        <div className="max-w-5xl mx-auto px-1 mb-2">
          <Breadcrumbs />
        </div>
      )}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/cadences" element={<Cadences />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/curation" element={<Curation />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/ask" element={<Ask />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/vision" element={<Vision />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/agent" element={<Agent />} />
        <Route path="/tutorial" element={<Tutorial />} />
      </Routes>
    </>
  );
}

export default function App() {
  useLenis();
  return (
    <ToastProvider>
      <TooltipProvider delayDuration={200}>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </TooltipProvider>
    </ToastProvider>
  );
}

function Shell() {
  const loc = useLocation();
  const embed = new URLSearchParams(loc.search).get('embed') === '1';
  return (
    <>
      {!embed && (
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:bg-white focus:text-slate-900 focus:px-3 focus:py-2 focus:rounded-md focus:shadow">Skip to content</a>
      )}
      <div className="relative min-h-screen">
        {!embed && (
          <div aria-hidden className="absolute inset-0 -z-10" style={{
            background: 'radial-gradient(1200px 400px at 10% -10%, rgba(236,72,153,0.14), transparent), radial-gradient(900px 300px at 90% -20%, rgba(99,102,241,0.12), transparent)'
          }} />
        )}
        <div className="px-6 pt-6">
          {!embed && (
            <div className="max-w-5xl mx-auto">
              <header className="rounded-3xl backdrop-blur bg-white/60 border border-white/70 shadow-md px-6 py-5 md:px-8 md:py-7">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900" style={{fontFamily:'\"Space Grotesk\", Inter, ui-sans-serif'}}>BrandVX</h1>
              </header>
            </div>
          )}
          {!embed && (
            <div className="max-w-5xl mx-auto mt-4">
              <Nav />
            </div>
          )}
          <main id="main">
            <Suspense fallback={<div className="max-w-5xl mx-auto p-4"><div className="h-10 w-40 bg-slate-100 rounded mb-3" /><div className="h-6 w-64 bg-slate-100 rounded mb-2" /><div className="h-24 w-full bg-slate-100 rounded" /></div>}>
              <RouteContent />
            </Suspense>
          </main>
          {!embed && <CommandPalette />}
          {!embed && <AskFloat />}
        </div>
      </div>
    </>
  );
}
