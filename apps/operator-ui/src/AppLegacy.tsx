//
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Breadcrumbs from './components/Breadcrumbs';
import { ToastProvider } from './components/ui/Toast';
import { useLenis } from './hooks/useLenis';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
// AskFloat and CommandBar removed per simplification
import ActionDrawer from './components/ActionDrawer';
import { initAnalytics, trackPage } from './lib/analytics';
import { api } from './lib/api';
import { supabase } from './lib/supabase';
import QuietBadge from './components/ui/QuietBadge';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Messages = lazy(() => import('./pages/Messages'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Cadences = lazy(() => import('./pages/Cadences'));
const Approvals = lazy(() => import('./pages/Approvals'));
const Ask = lazy(() => import('./pages/Ask'));
const Admin = lazy(() => import('./pages/Admin'));
const Agent = lazy(() => import('./pages/Agent'));
const Vision = lazy(() => import('./pages/Vision'));
const Onboarding = lazy(() => import('./onboarding/app-shell/OnboardingRoot'));
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
const Workspace = lazy(() => import('./pages/Workspace'));
const Share = lazy(() => import('./pages/Share'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));

function IntegrationsRedirect() {
  const loc = useLocation();
  const qs = loc.search ? (loc.search.startsWith('?') ? loc.search.slice(1) : loc.search) : '';
  // If this redirect includes OAuth success context, normalize to Dashboard
  try {
    const sp = new URLSearchParams(qs);
    const connected = sp.get('connected') === '1';
    const hasProvider = !!sp.get('provider');
    const wantsWorkspace = sp.get('return') === 'workspace';
    if ((connected || wantsWorkspace) && !hasProvider) {
      const dash = new URLSearchParams(qs);
      dash.set('pane','dashboard');
      dash.delete('provider');
      dash.delete('connected');
      dash.delete('error');
      const target = `/workspace?${dash.toString()}`;
      return <Navigate to={target} replace />;
    }
  } catch {}
  const target = `/workspace?pane=integrations${qs ? `&${qs}` : ''}`;
  return <Navigate to={target} replace />;
}

function LandingRedirect() {
  const loc = useLocation();
  const search = loc.search || '';
  const target = `/brandvx${search}`;
  return <Navigate to={target} replace />;
}

function RouteContent() {
  const loc = useLocation();
  const embed = new URLSearchParams(loc.search).get('embed') === '1';
  const hideCrumbs = loc.pathname === '/workspace' || loc.pathname === '/login' || loc.pathname === '/signup' || loc.pathname === '/billing' || loc.pathname === '/demo' || loc.pathname === '/onboarding';
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
        <Route path="/integrations" element={<IntegrationsRedirect />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/curation" element={<Curation />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/ask" element={<Ask />} />
        <Route path="/workflows" element={<Navigate to="/workspace?pane=workflows" replace />} />
        <Route path="/styles" element={<Navigate to="/workspace?pane=workflows&step=1" replace />} />
        <Route path="/styles/actions" element={<Navigate to="/workspace?pane=workflows&step=2" replace />} />
        <Route path="/vision" element={<Vision />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/agent" element={<Agent />} />
        <Route path="/tutorial" element={<Tutorial />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/plasmic" element={<PlasmicPage />} />
        <Route path="/plasmic-host" element={<PlasmicHost />} />
        <Route path="/landing-v2" element={<LandingV2 />} />
        <Route path="/brandvx" element={<LandingV2 />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/demo" element={<LandingRedirect />} />
        <Route path="/demo-intake" element={<LandingRedirect />} />
        <Route path="/ask-vx-demo" element={<LandingRedirect />} />
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
  const nav = useNavigate();
  const embed = new URLSearchParams(loc.search).get('embed') === '1';
  const qs = new URLSearchParams(loc.search);
  const onLanding = loc.pathname === '/brandvx';
  const onAskPage = loc.pathname.startsWith('/ask');
  const onBilling = loc.pathname === '/billing';
  const onDemo = loc.pathname.startsWith('/demo') || loc.pathname.startsWith('/ask-vx-demo');
  const onAuthRoute = loc.pathname === '/login' || loc.pathname === '/signup' || loc.pathname === '/auth/callback';
  const onOnboarding = loc.pathname === '/onboarding';

  const getTodayKey = useCallback(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const [betaModalOpen, setBetaModalOpen] = useState(false);
  const betaSeenKeyRef = useRef('');
  const betaStatusLoadedRef = useRef(false);
  const betaLastSeenRef = useRef<string | null>(null);

  const persistBetaModalSeen = useCallback(async (dayKey: string) => {
    try {
      await api.post('/me/beta-modal', { seen_at: dayKey });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[beta-modal] persist failed', err);
      }
    }
  }, []);

  const dismissBetaModalForToday = useCallback(() => {
    const todayKey = getTodayKey();
    try {
      const key = betaSeenKeyRef.current || 'bvx_beta_modal_last_seen';
      localStorage.setItem(key, todayKey);
    } catch {}
    betaLastSeenRef.current = todayKey;
    setBetaModalOpen(false);
    persistBetaModalSeen(todayKey).catch(() => {});
  }, [getTodayKey, persistBetaModalSeen]);

  const openSupportFromBeta = useCallback(() => {
    try { window.dispatchEvent(new CustomEvent('bvx:support:open-bug', { detail: { source: 'beta-modal' } })); } catch {}
    try {
      const support = (window as any).brandvxSupport;
      support?.reportBug?.();
    } catch {}
    dismissBetaModalForToday();
  }, [dismissBetaModalForToday]);

  useEffect(() => {
    if (embed || onAuthRoute || onDemo || onOnboarding) return;
    if (betaStatusLoadedRef.current) return;
    betaStatusLoadedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const me = await api.get('/me');
        if (cancelled) return;
        const tenantId = (me?.tenant_id || localStorage.getItem('bvx_tenant') || '').trim();
        const storageKey = tenantId ? `bvx_beta_modal_last_seen_${tenantId}` : 'bvx_beta_modal_last_seen';
        betaSeenKeyRef.current = storageKey;
        if (tenantId) {
          try { localStorage.setItem('bvx_tenant', tenantId); } catch {}
        }
        const serverSeen = typeof me?.beta_modal_last_seen === 'string' ? me.beta_modal_last_seen : null;
        if (serverSeen) {
          betaLastSeenRef.current = serverSeen;
          try { localStorage.setItem(storageKey, serverSeen); } catch {}
        }
        const today = getTodayKey();
        const localSeen = localStorage.getItem(storageKey);
        const effectiveSeen = serverSeen || localSeen;
        if (effectiveSeen !== today) {
          setBetaModalOpen(true);
        }
      } catch (err) {
        if (cancelled) return;
        const tenantId = localStorage.getItem('bvx_tenant') || '';
        const storageKey = tenantId ? `bvx_beta_modal_last_seen_${tenantId}` : 'bvx_beta_modal_last_seen';
        betaSeenKeyRef.current = storageKey;
        const today = getTodayKey();
        const lastSeen = localStorage.getItem(storageKey);
        if (lastSeen !== today) {
          setBetaModalOpen(true);
        }
        if (import.meta.env.DEV) {
          console.warn('[beta-modal] lookup failed', err);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [embed, onAuthRoute, onDemo, onOnboarding, getTodayKey]);

  // Clear askVX persisted state on pure landing to avoid stray artifacts
  useEffect(()=>{
    if (onLanding && qs.get('demo') !== '1') {
      try {
        localStorage.setItem('bvx-ask-open','0');
      } catch {}
    }
  }, [onLanding, loc.search]);

  // If user is authenticated, strip demo=1 from the URL to avoid demo fallbacks
  useEffect(()=>{
    (async()=>{
      try{
        const session = (await supabase.auth.getSession()).data.session;
        if (session && qs.get('demo') === '1') {
          const clean = new URL(window.location.href);
          clean.searchParams.delete('demo');
          window.history.replaceState({}, '', clean.toString());
        }
      } catch {}
    })();
  }, [loc.search]);

  // Keyboard shortcut: Cmd/Ctrl+K focuses askVX (navigates to /ask)
  useEffect(()=>{
    const onKey = (e: KeyboardEvent) => {
      try{
        if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          if (!onAskPage) nav('/ask');
        }
      } catch {}
    };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
  }, [nav, onAskPage]);

  
  return (
    <>
      {!embed && (
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:bg-white focus:text-slate-900 focus:px-3 focus:py-2 focus:rounded-md focus:shadow">Skip to content</a>
      )}
      <div className="relative h-[100dvh] overflow-hidden">
        {!embed && (
          <div aria-hidden className="absolute inset-0 -z-10" style={{
            // Respect runtime variable for landing page background while preserving current default
            background: onLanding ? 'var(--bvx-landing-bg, #F7CBDD)' : 'radial-gradient(1200px 400px at 10% -10%, rgba(236,72,153,0.14), transparent), radial-gradient(900px 300px at 90% -20%, rgba(99,102,241,0.12), transparent)'
          }} />
        )}
        <div className="px-6 pt-4 md:pt-6 h-full overflow-hidden box-border">
          {/* Header bar removed per request to keep workspace minimal */}
          <main id="main" className="h-full overflow-hidden">
            <Suspense fallback={<div className="max-w-5xl mx-auto p-4"><div className="h-10 w-40 bg-slate-100 rounded mb-3" /><div className="h-6 w-64 bg-slate-100 rounded mb-2" /><div className="h-24 w-full bg-slate-100 rounded" /></div>}>
              <RouteContent />
            </Suspense>
          </main>
          {/* Command mode and Ask dock removed; keep ActionDrawer */}
          {!embed && !onAskPage && !onDemo && !onLanding && !onBilling && !onAuthRoute && !onOnboarding && <ActionDrawer />}
          {!embed && !onAskPage && !onDemo && !onBilling && !onAuthRoute && !onOnboarding && <QuietBadge />}
        </div>
      </div>
      {betaModalOpen && (
        <div className="fixed inset-0 z-[2147483605] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/35" onClick={dismissBetaModalForToday} aria-hidden="true" />
          <div className="relative w-full max-w-lg rounded-3xl border border-[var(--border)] bg-white/95 p-6 shadow-soft text-center">
            <button
              type="button"
              aria-label="Dismiss beta notes"
              className="absolute top-3 right-3 rounded-full border border-transparent px-2 py-1 text-sm text-slate-500 hover:border-slate-200 hover:text-slate-700"
              onClick={dismissBetaModalForToday}
            >
              ×
            </button>
            <div className="text-sm font-semibold tracking-wide text-slate-500 uppercase">brandVX beta v001</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Welcome to brandVX</h2>
            <p className="mt-3 text-sm text-slate-700">
              We appreciate you helping us revolutionize beauty and win back your time. A few quick notes while we’re in open beta:
            </p>
            <div className="mt-4 text-left text-sm text-slate-700">
              <ul className="list-disc space-y-2 pl-5">
                <li>We’re in month one, so you may still spot the occasional bug.</li>
                <li>If the onboarding tour doesn’t auto-start, head to <strong>Settings → Restart Onboarding</strong>.</li>
                <li>We ship updates weekly—expect new features and refinements often.</li>
              </ul>
            </div>
            <p className="mt-4 text-sm text-slate-700">Need help or want to share feedback? Reach out and we’ll jump in.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
                onClick={openSupportFromBeta}
              >
                Contact support
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={dismissBetaModalForToday}
              >
                Don’t show again today
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
