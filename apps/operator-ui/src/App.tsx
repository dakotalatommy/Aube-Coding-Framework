//
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Breadcrumbs from './components/Breadcrumbs';
import { ToastProvider } from './components/ui/Toast';
import { useLenis } from './hooks/useLenis';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import AskFloat from './components/AskFloat';
import { initAnalytics, trackPage } from './lib/analytics';
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
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Tutorial = lazy(() => import('./pages/Tutorial'));
const Billing = lazy(() => import('./pages/Billing'));
const PlasmicPage = lazy(() => import('./pages/PlasmicPage'));
const PlasmicHost = lazy(() => import('./pages/PlasmicHost'));
const LandingV2 = lazy(() => import('./pages/LandingV2'));
const DemoFlow = lazy(() => import('./pages/DemoFlow'));
const DemoIntake = lazy(() => import('./pages/DemoIntake'));
const Workspace = lazy(() => import('./pages/Workspace'));
const Share = lazy(() => import('./pages/Share'));

function RouteContent() {
  const loc = useLocation();
  const embed = new URLSearchParams(loc.search).get('embed') === '1';
  const hideCrumbs = loc.pathname === '/workspace';
  initAnalytics();
  try { trackPage(loc.pathname + loc.search); } catch {}
  if (loc.pathname === '/landing-v2') {
    window.history.replaceState({}, '', '/brandvx' + loc.search);
  }
  return (
    <>
      {!embed && !hideCrumbs && (
        <div className="max-w-5xl mx-auto px-1 mb-2">
          <Breadcrumbs />
        </div>
      )}
      <Routes>
        <Route path="/" element={<Navigate to="/brandvx" replace />} />
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
        <Route path="/workflows" element={<Navigate to="/workspace?pane=workflows" replace />} />
        <Route path="/vision" element={<Vision />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/agent" element={<Agent />} />
        <Route path="/tutorial" element={<Tutorial />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/plasmic" element={<PlasmicPage />} />
        <Route path="/plasmic-host" element={<PlasmicHost />} />
        <Route path="/landing-v2" element={<LandingV2 />} />
        <Route path="/brandvx" element={<LandingV2 />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/demo" element={<DemoIntake />} />
        <Route path="/demo-intake" element={<Navigate to="/demo" replace />} />
        <Route path="/ask-vx-demo" element={<DemoFlow />} />
        <Route path="/s/:token" element={<Share />} />
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
          <ErrorBoundary>
            <Shell />
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </ToastProvider>
  );
}

function Shell() {
  const loc = useLocation();
  const embed = new URLSearchParams(loc.search).get('embed') === '1';
  const qs = new URLSearchParams(loc.search);
  const onLanding = loc.pathname === '/brandvx';
  const onAskPage = loc.pathname.startsWith('/ask');
  const onDemo = loc.pathname.startsWith('/demo') || loc.pathname.startsWith('/ask-vx-demo');
  // Only show AskFloat in workspace/dashboard to avoid overlays elsewhere
  const onlyWorkspace = loc.pathname.startsWith('/workspace') || loc.pathname === '/dashboard';
  const showAsk = !embed && !onAskPage && !onDemo && onlyWorkspace;

  // Clear Ask VX persisted state on pure landing to avoid stray artifacts
  useEffect(()=>{
    if (onLanding && qs.get('demo') !== '1') {
      try {
        localStorage.setItem('bvx-ask-open','0');
      } catch {}
    }
  }, [onLanding, loc.search]);

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
        <div className="px-6 pt-4 md:pt-6">
          {/* Header bar removed per request to keep workspace minimal */}
          <main id="main">
            <Suspense fallback={<div className="max-w-5xl mx-auto p-4"><div className="h-10 w-40 bg-slate-100 rounded mb-3" /><div className="h-6 w-64 bg-slate-100 rounded mb-2" /><div className="h-24 w-full bg-slate-100 rounded" /></div>}>
              <RouteContent />
            </Suspense>
          </main>
          {!embed && showAsk && <AskFloat />}
        </div>
      </div>
    </>
  );
}
