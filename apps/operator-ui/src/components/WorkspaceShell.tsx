import React, { Suspense, lazy, useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Button from './ui/Button';
import { Home, MessageSquare, Users, Calendar, Layers, Package2, Plug, CheckCircle2, MessageCircle, Eye, ArrowUpRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api, getTenant } from '../lib/api';
import { startGuide } from '../lib/guide';
import { track } from '../lib/analytics';
import { UI_STRINGS } from '../lib/strings';
// import PaneManager from './pane/PaneManager';
import { registerActions, registerMessageBridge } from '../lib/actions';
import { workspaceStorage } from '../onboarding/workspace/storage';
import { useWorkspaceOnboardingController } from '../hooks/useWorkspaceOnboardingController';
import type { OnboardingState } from '../onboarding/workspace/orchestrator';
import SupportBubble from './SupportBubble';

type PaneKey = 'dashboard' | 'messages' | 'contacts' | 'calendar' | 'cadences' | 'inventory' | 'integrations' | 'approvals' | 'askvx' | 'vision' | 'upgradevx';

const PANES: { key: PaneKey; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <Home size={18} /> },
  { key: 'askvx', label: 'askVX', icon: <MessageCircle size={18} /> },
  { key: 'vision', label: 'brandVZN', icon: <Eye size={18} /> },
  { key: 'upgradevx', label: 'upgradeVX', icon: <ArrowUpRight size={18} /> },
  { key: 'messages', label: 'Messages', icon: <MessageSquare size={18} /> },
  { key: 'contacts', label: 'Clients', icon: <Users size={18} /> },
  { key: 'calendar', label: 'Calendar', icon: <Calendar size={18} /> },
  { key: 'cadences', label: 'Follow‑ups', icon: <Layers size={18} /> },
  { key: 'inventory', label: 'Inventory', icon: <Package2 size={18} /> },
  { key: 'approvals', label: 'To-Do', icon: <CheckCircle2 size={18} /> },
  { key: 'integrations', label: 'Settings', icon: <Plug size={18} /> },
];

type FlowModalButton = {
  label: string;
  value?: any;
  tone?: 'primary' | 'secondary';
  disabled?: boolean;
};

type FlowModalConfig = {
  title: string;
  body?: React.ReactNode;
  buttons: FlowModalButton[];
  input?: {
    placeholder?: string;
    textarea?: boolean;
    required?: boolean;
    defaultValue?: string;
  };
};

export default function WorkspaceShell(){
  const loc = useLocation();
  const nav = useNavigate();
  const params = new URLSearchParams(loc.search);
  const rawPane = (params.get('pane') as PaneKey) || 'dashboard';
  const oauthReturn = !!(params.get('provider') || params.get('connected') || params.get('postVerify') || (params.get('return') === 'workspace'));
  const pane = (rawPane === 'integrations' && oauthReturn) ? 'dashboard' : rawPane;
  const BOOKING_URL = (import.meta as any).env?.VITE_BOOKING_URL || '';
  const PRICE_147 = (import.meta as any).env?.VITE_STRIPE_PRICE_147 || '';
  const PRICE_97 = (import.meta as any).env?.VITE_STRIPE_PRICE_97 || '';
  const TRIAL_DAYS = Number((import.meta as any).env?.VITE_STRIPE_TRIAL_DAYS || '7');
  const STRIPE_BUY_BUTTON_47 = String((import.meta as any).env?.VITE_STRIPE_BUY_BUTTON_47 || '');
  const STRIPE_PK = String((import.meta as any).env?.VITE_STRIPE_PK || (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY || '');
  const DEV_ONBOARDING = String((import.meta as any).env?.VITE_ONBOARDING_DEV_MODE || '0') === '1';
const FORCE_ONBOARD_TOUR = false;

  const [billingOpen, setBillingOpen] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingStatus, setBillingStatus] = useState<string>('');
  const [trialModalOpen, setTrialModalOpen] = useState<boolean>(false);
  const [trialEndedOpen, setTrialEndedOpen] = useState<boolean>(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(0);
  const [flowModal, setFlowModal] = useState<FlowModalConfig | null>(null);
  // Welcome step is now part of driver.js tour; no standalone modal
  const [isLiteTier, setIsLiteTier] = useState<boolean>(false);
  const [flowModalInput, setFlowModalInput] = useState('');
  const [debugEvents, setDebugEvents] = useState<string[]>([]);
  const debugEnabled = useMemo(()=>{
    try { const sp = new URLSearchParams(loc.search); return sp.get('debug') === '1' || localStorage.getItem('bvx_debug') === '1'; } catch { return false; }
  }, [loc.search]);
  const debugLog = useCallback((msg: string) => {
    try {
      const ts = new Date().toLocaleTimeString();
      setDebugEvents(evs => [`${ts} ${msg}`, ...evs].slice(0,5));
      console.info('[WorkspaceShell]', msg);
    } catch {}
  }, []);

  const paneRef = useRef(pane);
  useEffect(()=>{ paneRef.current = pane; }, [pane]);
  const billingOpenRef = useRef(billingOpen);
  useEffect(()=>{ billingOpenRef.current = billingOpen; }, [billingOpen]);
  const billingStatusRef = useRef(billingStatus);
  useEffect(()=>{ billingStatusRef.current = billingStatus; }, [billingStatus]);
  const flowModalResolveRef = useRef<((value: any) => void) | undefined>(undefined);
  useEffect(()=>{ if (debugEnabled) debugLog(`billingOpen=${billingOpen?'1':'0'}`); }, [billingOpen, debugEnabled, debugLog]);

  useEffect(()=>{
    if (flowModal?.input) {
      setFlowModalInput(flowModal.input.defaultValue || '');
    } else {
      setFlowModalInput('');
    }
  }, [flowModal]);

  const sleep = useCallback((ms: number) => new Promise(resolve => setTimeout(resolve, ms)), []);

  const showFlowModalAsync = useCallback((config: FlowModalConfig) => {
    return new Promise<any>((resolve) => {
      flowModalResolveRef.current = resolve;
      setFlowModal(config);
    });
  }, []);

  const resolveFlowModal = useCallback((value: any) => {
    const resolver = flowModalResolveRef.current;
    flowModalResolveRef.current = undefined;
    const resolvedValue = value !== undefined ? value : (flowModal?.input ? flowModalInput.trim() : undefined);
    setFlowModal(null);
    if (resolver) resolver(resolvedValue);
  }, [flowModal, flowModalInput]);

  const waitForCondition = useCallback(async (predicate: () => boolean, timeoutMs?: number) => {
    const limit = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : Infinity;
    const start = Date.now();
    while (!predicate()) {
      if (Date.now() - start > limit) return false;
      await sleep(80);
    }
    return true;
  }, [sleep]);

  const billingResolverRef = useRef<((dismiss?: boolean) => void) | null>(null);
  // const forceInitRef = useRef(false);
  const autoStartRef = useRef(false);
  const forcedRef = useRef(false);
  const skipImportRef = useRef(false);
  const importSummaryRef = useRef<{ imported?: number; updated?: number; error?: string } | null>(null);
  const [onboardingState, setOnboardingState] = useState<OnboardingState>({ phase: 'idle', forced: false, running: false });

  useEffect(() => {
    console.info('[onboarding] phase ->', onboardingState.phase);
  }, [onboardingState.phase]);

  const goToPane = useCallback(async (target: PaneKey) => {
    if (paneRef.current !== target) {
      try {
        const sp = new URLSearchParams(window.location.search);
        sp.set('pane', target);
        nav({ pathname: '/workspace', search: `?${sp.toString()}` }, { replace: false });
      } catch {
        window.location.href = `/workspace?pane=${encodeURIComponent(target)}`;
        return;
      }
    }
    await waitForCondition(() => paneRef.current === target, 12000);
    await sleep(200);
  }, [nav, sleep, waitForCondition]);

  const showWelcomeEffect = useCallback(async ({ forced }: { forced: boolean }) => {
    console.info('showWelcomeEffect', { forced });
    if (forced) workspaceStorage.clearWelcome();
  }, []);

  const runUnifiedTour = useCallback(async ({ forced }: { forced: boolean }) => {
    console.info('unifiedTour:start', { forced });
    try {
      document.body?.classList.remove('driver-active', 'driver-fade');
      document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => {
        try { el.parentElement?.removeChild(el); } catch {}
      });
    } catch {}
    return new Promise<void>((resolve, reject) => {
      const handler = () => {
        window.removeEventListener('bvx:guide:dashboard:done', handler as any);
        console.info('unifiedTour:complete');
        resolve();
      };
      window.addEventListener('bvx:guide:dashboard:done', handler as any, { once: true } as any);
      try {
        if (debugEnabled) debugLog('tour:start dashboard');
        // Delay slightly to allow dashboard DOM to stabilize before showing welcome
        setTimeout(() => { try { startGuide('dashboard'); } catch {} }, 350);
        // Safety: if overlay mounts but no popover appears quickly, teardown once and retry without centering
        setTimeout(() => {
          try {
            const hasOverlay = document.querySelectorAll('.driver-overlay').length > 0;
            const hasPopover = document.querySelectorAll('.driver-popover').length > 0;
            const retried = (window as any).__bvxTourRetried === true;
            if (hasOverlay && !hasPopover && !retried) {
              (window as any).__bvxTourRetried = true;
              document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => { try{ el.parentElement?.removeChild(el); }catch{} });
              document.body.classList.remove('driver-active','driver-fade','bvx-center-popover-body');
              // Retry with nocenter to isolate centering issues
              try {
                const url = new URL(window.location.href);
                url.searchParams.set('nocenter','1');
                window.history.replaceState({}, '', url.toString());
              } catch {}
              startGuide('dashboard');
            }
          } catch {}
        }, 700);
      } catch (err) {
        window.removeEventListener('bvx:guide:dashboard:done', handler as any);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }, [debugEnabled, debugLog]);

  const resolveBilling = useCallback((dismiss: boolean = true) => {
    const resolver = billingResolverRef.current;
    billingResolverRef.current = null;
    if (dismiss) workspaceStorage.setBillingDismissed();
    setBillingOpen(false);
    setBillingLoading(false);
    resolver?.(dismiss);
    try { window.dispatchEvent(new CustomEvent('bvx:billing:closed')); } catch {}
  }, []);

  const ensureBillingEffect = useCallback(async () => {
    console.info('ensureBillingEffect noop');
  }, []);

  const completeEffect = useCallback(async (_ctx: { forced: boolean }) => {
    void _ctx;
    workspaceStorage.setGuideDone(true);
    try { localStorage.setItem('bvx_quickstart_completed','1'); } catch {}
    try { window.dispatchEvent(new CustomEvent('bvx:quickstart:completed')); } catch {}
    try {
      const tid = await getTenant();
      if (tid) {
        await api.post('/settings', { tenant_id: tid, guide_done: true });
      }
    } catch (err) {
      console.error('guide_done update failed', err);
    }
  }, []);

  const handleOnboardingError = useCallback(async ({ error }: { forced: boolean; error: Error }) => {
    await showFlowModalAsync({
      title: 'Flow paused',
      body: (
        <div className="text-sm text-slate-700">
          Something interrupted the guided steps. {error?.message ? `(${error.message})` : 'You can continue exploring manually and rerun the tour later.'}
        </div>
      ),
      buttons: [{ label: 'Continue', value: 'ok', tone: 'primary' }],
    });
  }, [showFlowModalAsync]);

  const controllerLogger = useCallback((message: string, data?: any) => {
    if (!debugEnabled) return;
    try {
      const suffix = data ? ` ${JSON.stringify(data)}` : '';
      debugLog(`${message}${suffix}`);
    } catch {
      debugLog(message);
    }
  }, [debugEnabled, debugLog]);

  const onboardingController = useWorkspaceOnboardingController(
    {
      showWelcome: showWelcomeEffect,
      runTour: runUnifiedTour,
      ensureBilling: ensureBillingEffect,
      runDashboardGuide: async () => {},
      runQuickstart: async () => {},
      complete: completeEffect,
      handleError: handleOnboardingError,
    },
    {
      exposeDebugHelpers: debugEnabled,
      logger: controllerLogger,
    }
  );

  useEffect(() => {
    setOnboardingState(onboardingController.getState());
    const unsubscribe = onboardingController.subscribe(setOnboardingState);
    return unsubscribe;
  }, [onboardingController]);

  // No welcome modal bootstrap; driver tour will show the centered welcome as step 0

  // Dev guard: if in workspace while dev mode is on, send to /onboarding once per session
  useEffect(() => {
    if (!DEV_ONBOARDING) return;
    try {
      const onOnboarding = window.location.pathname.startsWith('/onboarding');
      const already = sessionStorage.getItem('bvx_dev_onboard_routed') === '1';
      if (!onOnboarding && !already) {
        sessionStorage.setItem('bvx_dev_onboard_routed','1');
        window.location.replace('/onboarding');
      }
    } catch {}
  }, [DEV_ONBOARDING]);

  // Welcome handled by tour; no overlay coordination needed here

  // Dev mode: reset tour-related local flags on mount so each run behaves like a fresh tenant
  useEffect(() => {
    if (!DEV_ONBOARDING) return;
    try {
      localStorage.removeItem('bvx_guide_done');
      localStorage.removeItem('bvx_quickstart_completed');
      localStorage.removeItem('bvx_tour_seen_workspace_intro');
      localStorage.removeItem('bvx_billing_dismissed');
      localStorage.removeItem('bvx_founder_finale_seen');
      localStorage.removeItem('bvx_last_tour_step');
      localStorage.removeItem('bvx_nocenter');
      localStorage.removeItem('bvx_force_start_tour');
      localStorage.removeItem('bvx_force_welcome_modal');
      sessionStorage.removeItem('bvx_intro_session');
    } catch {}
  }, [DEV_ONBOARDING]);

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ pane?: PaneKey }>).detail;
      const target = detail?.pane;
      if (!target) return;
      (async () => {
        try {
          if (debugEnabled) debugLog(`guide:navigate -> ${target}`);
          // Strip legacy tour flag when leaving dashboard to prevent page-level tours
          try {
            if (target !== 'dashboard') {
              const u = new URL(window.location.href);
              if (u.searchParams.get('tour') === '1') { u.searchParams.delete('tour'); window.history.replaceState({}, '', u.toString()); }
            }
          } catch {}
          await goToPane(target);
          // Emit pane-ready synthetic event when the pane becomes active to help tour waits
          try {
            window.dispatchEvent(new CustomEvent('bvx:pane:ready', { detail: { pane: target } }));
          } catch {}
        } catch (err) {
          console.error('guide navigate failed', err);
        } finally {
          try {
            window.dispatchEvent(new CustomEvent('bvx:guide:navigate:done', { detail: { pane: target } }));
          } catch {}
        }
      })();
    };
    const onColor = (event: Event) => {
      const prompt = String((event as CustomEvent<string>).detail || '').trim();
      if (!prompt) return;
      try {
        window.dispatchEvent(new CustomEvent('bvx:flow:vision-command', {
          detail: {
            action: 'vision.prefill-prompt',
            prompt,
          },
        }));
      } catch (err) {
        console.error('prefill prompt failed', err);
      }
    };
    const onImport = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail || {};
      importSummaryRef.current = detail;
      const failed = Boolean(detail?.error);
      skipImportRef.current = failed;
    };
    const onSkip = () => {
      skipImportRef.current = true;
      importSummaryRef.current = null;
    };
    window.addEventListener('bvx:guide:navigate', onNavigate as any);
    window.addEventListener('bvx:guide:brandvzn:color', onColor as any);
    window.addEventListener('bvx:flow:contacts-imported', onImport as any);
    window.addEventListener('bvx:onboarding:skip-import', onSkip as any);
    return () => {
      window.removeEventListener('bvx:guide:navigate', onNavigate as any);
      window.removeEventListener('bvx:guide:brandvzn:color', onColor as any);
      window.removeEventListener('bvx:flow:contacts-imported', onImport as any);
      window.removeEventListener('bvx:onboarding:skip-import', onSkip as any);
    };
  }, [goToPane]);

  useEffect(() => {
    const onBillingStep = () => {
      console.info('dashboard step: billing');
      const status = billingStatusRef.current || '';
      // Always show once as part of onboarding step, even if already active
      let promptedOnce = false; try { promptedOnce = localStorage.getItem('bvx_billing_prompted_once') === '1'; } catch {}
      if (status === 'active' && promptedOnce) {
        try { localStorage.setItem('bvx_billing_dismissed','1'); } catch {}
        return;
      }
      workspaceStorage.clearBillingDismissed();
      if (billingOpenRef.current) return;
      setBillingOpen(true);
      billingResolverRef.current = (dismiss = true) => {
        if (dismiss) workspaceStorage.setBillingDismissed();
        setBillingOpen(false);
        setBillingLoading(false);
        billingResolverRef.current = null;
      };
      try { localStorage.setItem('bvx_billing_prompted_once','1'); } catch {}
      if (forcedRef.current) {
        setTimeout(() => resolveBilling(true), 800);
      }
    };
    window.addEventListener('bvx:guide:dashboard:billing', onBillingStep as any);
    return () => window.removeEventListener('bvx:guide:dashboard:billing', onBillingStep as any);
  }, []);

  useEffect(() => {
    // Auto-start unified tour on dashboard when onboarding is done and guide not done (or always in dev mode)
    const paneNow = new URLSearchParams(loc.search).get('pane') || 'dashboard';
    const onboardingDone = (()=>{ try{ return localStorage.getItem('bvx_onboarding_done')==='1'; }catch{ return false; }})();
    const guideDone = (()=>{ try{ return workspaceStorage.getGuideDone(); }catch{ return false; }})();
    const shouldStart = paneNow === 'dashboard' && (DEV_ONBOARDING || (onboardingDone && !guideDone));
    if (shouldStart && !autoStartRef.current) {
      autoStartRef.current = true;
      (async () => {
        // Clean any lingering overlays before starting
        try {
          document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => { try{ el.parentElement?.removeChild(el); }catch{} });
          document.body.classList.remove('driver-active','driver-fade','bvx-center-popover-body');
        } catch {}
        // Wait for explicit dashboard ready event (or flag)
        // Wait for ready; but if not fired in ~3s, still start the tour
        try {
          const readyNow = (window as any).__bvxDashReady === 1;
          if (!readyNow) {
            await new Promise<void>((resolve) => {
              let done = false;
              const to = window.setTimeout(() => { if (!done) { done = true; resolve(); } }, 3000);
              const handler = () => { if (!done) { done = true; window.clearTimeout(to); resolve(); } };
              window.addEventListener('bvx:dashboard:ready', handler as any, { once: true } as any);
            });
          }
        } catch {}
        onboardingController.start({ force: false }).catch(err => console.error('onboarding start failed', err));
      })();
    }
  }, [loc.search, onboardingController, DEV_ONBOARDING]);

  // Dev mode: only start tour once per session to avoid restarts when navigating back to dashboard
  useEffect(() => {
    if (!DEV_ONBOARDING) return;
    try {
      if (sessionStorage.getItem('bvx_dev_tour_started') === '1') return;
      const handler = () => { try{ sessionStorage.setItem('bvx_dev_tour_started','1'); }catch{} };
      window.addEventListener('bvx:guide:dashboard:done', handler as any, { once: true } as any);
      return () => window.removeEventListener('bvx:guide:dashboard:done', handler as any);
    } catch {}
  }, [DEV_ONBOARDING]);

  useEffect(() => {
    (async () => {
      try {
        const tid = await getTenant();
        if (!tid) return;
        const res = await api.get(`/ai/memories/list?tenant_id=${encodeURIComponent(tid)}&limit=50`);
        const cutoff = Date.now() - 30 * 86400000;
        const items = Array.isArray(res?.items)
          ? res.items.filter((item: any) => Number(item?.updated_at || 0) * 1000 >= cutoff)
          : [];
        try { (window as any).__bvxMemories = items; } catch {}
      } catch (err) {
        console.warn('workspace memories load failed', err);
      }
    })();
  }, []);

  // Workspace billing gate: open modal if not trialing/active
  useEffect(()=>{
    (async()=>{
      try{
        // E2E hook: when e2e=1, bypass billing and intro gating to stabilize tests
        try {
          const sp0 = new URLSearchParams(loc.search);
          if (sp0.get('e2e') === '1') {
            localStorage.setItem('bvx_billing_dismissed','1');
            localStorage.setItem('bvx_tour_seen_workspace_intro','1');
            sessionStorage.setItem('bvx_intro_session','1');
          }
        } catch {}
        // Auth guard with tolerant resolver to avoid bounce loop
        {
          let session = (await supabase.auth.getSession()).data.session;
          if (!session) {
            const ready = localStorage.getItem('bvx_auth_ready') === '1';
            const inProgress = localStorage.getItem('bvx_auth_in_progress') === '1';
            if (ready || inProgress) {
              // wait briefly for session propagation
              for (let i=0; i<10; i++) {
                await new Promise(r=> setTimeout(r, 600));
                session = (await supabase.auth.getSession()).data.session;
                if (session) break;
              }
            }
            if (!session) { nav('/login'); return; }
          }
          // Do not redirect here; AuthCallback owns forced onboarding routing
        }

        // Do not clear driver overlays here; tour bootstrap (runUnifiedTour) already handles cleanup safely.

        const sp = new URLSearchParams(loc.search); void sp;
        // Strip and normalize: never land on Settings due to stale query; prefer Dashboard
        try{
          const paneQ = sp.get('pane');
          const hasFlow = sp.get('flow')==='connect' || !!sp.get('provider') || !!sp.get('error');
          if (paneQ === 'integrations' && !hasFlow) {
            const clean = new URL(window.location.href);
            clean.searchParams.set('pane','dashboard');
            clean.searchParams.delete('provider');
            clean.searchParams.delete('connected');
            clean.searchParams.delete('postVerify');
            window.history.replaceState({}, '', clean.toString());
          }
          // Guard: only allow tour=1 to autostart on Dashboard. If present on other panes, strip it.
          try {
            const tour = sp.get('tour');
            const pane = sp.get('pane') || 'dashboard';
            if (tour === '1' && pane !== 'dashboard') {
              const clean2 = new URL(window.location.href);
              clean2.searchParams.delete('tour');
              window.history.replaceState({}, '', clean2.toString());
          }
        } catch {}
        } catch {}
        // OAuth return cleanup
        try {
          const prov = sp.get('provider') || '';
          const connected = sp.get('connected') === '1';
          if (prov && connected) {
            const u = new URL(window.location.href);
            u.pathname = '/workspace';
            u.searchParams.set('pane','dashboard');
            u.searchParams.delete('provider');
            u.searchParams.delete('connected');
            u.searchParams.delete('error');
            window.history.replaceState({}, '', u.toString());
          }
        } catch {}
        if (sp.get('billing') === 'success') {
          try { track('billing_success'); } catch {}
          try { localStorage.setItem('bvx_billing_dismissed','1'); } catch {}
          setBillingOpen(false);
          // Stripe webhook lag fallback: poll subscription status briefly
          try {
            const tidPoll = (await supabase.auth.getSession()).data.session ? (localStorage.getItem('bvx_tenant') || '') : '';
            if (tidPoll) {
              for (let i=0; i<12; i++) { // ~18s total
                try {
                  const s2 = await api.get(`/settings?tenant_id=${encodeURIComponent(tidPoll)}`);
                  const st2 = String(s2?.data?.subscription_status || '');
                  if (st2 === 'active' || st2 === 'trialing') { setBillingStatus(st2); break; }
                } catch {}
                await new Promise(r=> setTimeout(r, 1500));
              }
            }
          } catch {}
          return;
        }
        const dismissed = localStorage.getItem('bvx_billing_dismissed') === '1';
        const tid = (await supabase.auth.getSession()).data.session ? (localStorage.getItem('bvx_tenant') || '') : '';
        const r = await api.get(`/settings${tid?`?tenant_id=${encodeURIComponent(tid)}`:''}`);
        const status = String(r?.data?.subscription_status || '');
        setBillingStatus(status);
        // Determine $47 tier heuristically (plan_code or price hint). Apply only when Beta tools are off.
        try {
          const planCode = String(r?.data?.plan_code || '').toLowerCase();
          const spid = String(r?.data?.subscription_price_id || '').toLowerCase();
          const betaOpen = String((import.meta as any).env?.VITE_BETA_OPEN_TOOLS || '0') === '1';
          const lite = !betaOpen && (
            planCode.includes('lite') || planCode.includes('47') || spid.includes('price_1s8svi') || /(^|\b)47(\b|$)/.test(planCode)
          );
          setIsLiteTier(lite);
        } catch {}
        const covered = status === 'active';
        // Only open billing modal when explicitly requested via query param, or forced
        const billingParam = sp.get('billing');
        const forceBilling = sp.get('forceBilling') === '1';
        if ((billingParam === 'prompt' && !covered && !dismissed) || forceBilling) {
          setBillingOpen(true); try { track('billing_modal_open'); } catch {}
        } else {
          if ((!billingOpenRef.current || covered || dismissed) && onboardingState.phase !== 'billing') {
          setBillingOpen(false);
          }
        }
        try {
          const doneServer = Boolean(r?.data?.onboarding_completed || r?.data?.onboarding_done);
          if (doneServer) { try { localStorage.setItem('bvx_onboarding_done','1'); } catch {} }
          const welcomeSeen = Boolean(r?.data?.welcome_seen);
          if (welcomeSeen) { try { sessionStorage.setItem('bvx_intro_session','1'); } catch {} }
          const guideDoneServer = Boolean(r?.data?.guide_done);
          workspaceStorage.setGuideDone(guideDoneServer);
          // Trial status compute (prefer server ts)
          try {
            const trialEndTs = Number((r?.data?.trial_end_ts || r?.data?.trialEndsAt || 0));
            let left = 0;
            if (trialEndTs && trialEndTs > 0) {
              left = Math.max(0, Math.ceil((trialEndTs*1000 - Date.now()) / (24*60*60*1000)));
            } else {
              const TRIAL_DAYS = Number((import.meta as any).env?.VITE_STRIPE_TRIAL_DAYS || '7');
              let started = Number(localStorage.getItem('bvx_trial_started_at')||'0');
              if (!started) { started = Date.now(); localStorage.setItem('bvx_trial_started_at', String(started)); }
              const elapsedDays = Math.floor((Date.now() - started) / (24*60*60*1000));
              left = Math.max(0, TRIAL_DAYS - elapsedDays);
            }
            setTrialDaysLeft(left);
            // Open trial modal on login when in trialing
            if (status === 'trialing' && left > 0) {
              setTrialModalOpen(true);
            }
            // Trial ended gating modal when not covered
            if (status !== 'active' && left <= 0) {
              setTrialEndedOpen(true);
          }
        } catch {}
        } catch {}

        // Booking nudge: highlight left-rail Book onboarding button once after onboarding
        try {
          const nudge = localStorage.getItem('bvx_booking_nudge') === '1';
          if (nudge && BOOKING_URL) {
            localStorage.removeItem('bvx_booking_nudge');
            setTimeout(()=>{
              try{
                const target = document.querySelector('[data-tour="book-onboarding"]') as HTMLElement | null;
                if (!target) return;
                const tip = document.createElement('div');
                tip.setAttribute('role','dialog');
                tip.style.position = 'fixed';
                const rect = target.getBoundingClientRect();
                tip.style.left = `${rect.left}px`;
                tip.style.top = `${Math.max(8, rect.top - 44)}px`;
                tip.style.zIndex = '9999';
                tip.className = 'pointer-events-auto';
                tip.innerHTML = `<a href="${BOOKING_URL}" target="_blank" rel="noreferrer" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white shadow text-sm text-slate-900">Click here to book a one‑on‑one onboarding for brand VX</a>`;
                document.body.appendChild(tip);
                const remove = ()=>{ try{ document.body.removeChild(tip); }catch{} };
                setTimeout(remove, 6000);
                tip.addEventListener('click', remove, { once: true } as any);
              } catch {}
            }, 600);
          }
        } catch {}
      } catch {}
    })();
  }, [loc.search, onboardingState.phase, FORCE_ONBOARD_TOUR]);

  const setPane = (key: PaneKey) => {
    try {
      const sp = new URLSearchParams(loc.search);
      sp.set('pane', key);
      nav({ pathname: '/workspace', search: `?${sp.toString()}` }, { replace: false });
    } catch {
      // Fallback
      window.location.href = `/workspace?pane=${encodeURIComponent(key)}`;
    }
  };

  const PaneView = (() => {
    switch (pane) {
      case 'dashboard': return <LazyDashboard/>;
      case 'messages': return <LazyMessages/>;
      case 'contacts': return <LazyContacts/>;
      case 'calendar': return <LazyCalendar/>;
      case 'cadences': return <LazyCadences/>;
      case 'inventory': return <LazyInventory/>;
      case 'integrations': return <LazyIntegrations/>;
      case 'approvals': return <LazyApprovals/>;
      case 'askvx': return <LazyAsk/>;
      case 'vision': return <LazyVision/>;
      case 'upgradevx': {
        // Open billing modal/route for upgrade
        setTimeout(()=>{ try { window.dispatchEvent(new CustomEvent('bvx:billing:prompt')); } catch {}; try { nav('/billing'); } catch {} }, 0);
        return <div/>;
      }
      default: return <div/>;
    }
  })();
  const items = useMemo(()=> {
    const betaOpen = String((import.meta as any).env?.VITE_BETA_OPEN_TOOLS || '0') === '1';
    if (isLiteTier && !betaOpen) {
      // Only askVX, brandVZN, upgradeVX — in that exact order
      const minimal: { key: PaneKey; label: string; icon: React.ReactNode }[] = [];
      const pick = (k: PaneKey) => {
        const p = PANES.find(x=> x.key===k);
        if (p) minimal.push(p);
      };
      pick('askvx'); pick('vision'); pick('upgradevx');
      return minimal;
    }
    return PANES;
  }, [isLiteTier]);
  const [approvalsCount, setApprovalsCount] = useState<number>(0);
  const [queueCount, setQueueCount] = useState<number>(0);
  useEffect(()=>{
    (async()=>{
      try{
        // Ensure we have an authenticated session before hitting protected endpoints
        const session = (await supabase.auth.getSession()).data.session;
        if (!session?.access_token) { setApprovalsCount(0); setQueueCount(0); return; }
        const tid = await getTenant();
        if (!tid) { setApprovalsCount(0); setQueueCount(0); return; }
        const r = await api.get(`/approvals?tenant_id=${encodeURIComponent(tid)}`);
        const arr = Array.isArray(r) ? r : (r?.items||[]);
        const pending = (arr||[]).filter((x:any)=> String(x?.status||'pending')==='pending').length;
        setApprovalsCount(pending);
        try {
          const q = await api.get(`/cadences/queue?tenant_id=${encodeURIComponent(tid)}`);
          const count = Array.isArray(q?.items) ? q.items.length : 0;
          setQueueCount(count);
        } catch { setQueueCount(0); }
      } catch { setApprovalsCount(0); }
    })();
  }, [loc.search]);
  const refs = useRef<HTMLButtonElement[]>([]);
  useEffect(()=>{ refs.current = refs.current.slice(0, items.length); }, [items.length]);

  // If on lite tier, prevent navigation to hidden panes
  useEffect(()=>{
    const betaOpen = String((import.meta as any).env?.VITE_BETA_OPEN_TOOLS || '0') === '1';
    if (!isLiteTier || betaOpen) return;
    const allowed = new Set<PaneKey>(['askvx','vision','upgradevx']);
    if (!allowed.has(pane)) {
      try { setPane('askvx'); } catch {}
    }
  }, [isLiteTier, pane]);

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const idx = items.findIndex(p=>p.key===pane);
    if (e.key === 'ArrowDown') { e.preventDefault(); const n = (idx+1) % items.length; setPane(items[n].key); refs.current[n]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); const n = (idx-1+items.length) % items.length; setPane(items[n].key); refs.current[n]?.focus(); }
    if (e.key === 'Enter') { e.preventDefault(); setPane(items[idx].key); }
    // number shortcuts 1..8
    const num = parseInt(e.key, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= items.length) {
      e.preventDefault();
      const n = num - 1;
      setPane(items[n].key);
      refs.current[n]?.focus();
    }
    // Global tour shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      try { startGuide(pane); } catch {}
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '?') {
      e.preventDefault();
      try {
        const last = localStorage.getItem('bvx_last_tour_page') || pane;
        const step = Number(localStorage.getItem('bvx_last_tour_step')||'0') || 0;
        startGuide(last as any, { step });
      } catch {}
    }
    // Quick help key: '?' opens current page guide
    if (e.key === '?') {
      e.preventDefault();
      try { startGuide(pane); } catch {}
    }
  };

  useEffect(()=>{
    // Register UI actions and message bridge once per mount
    const unregister = registerMessageBridge();
    registerActions({
      'nav.dashboard': { id:'nav.dashboard', run: ()=> setPane('dashboard') },
      'nav.messages': { id:'nav.messages', run: ()=> setPane('messages') },
      'nav.contacts': { id:'nav.contacts', run: ()=> setPane('contacts') },
      'nav.calendar': { id:'nav.calendar', run: ()=> setPane('calendar') },
      'nav.cadences': { id:'nav.cadences', run: ()=> setPane('cadences') },
      'nav.inventory': { id:'nav.inventory', run: ()=> setPane('inventory') },
      'nav.integrations': { id:'nav.integrations', run: ()=> setPane('integrations') },
      'nav.approvals': { id:'nav.approvals', run: ()=> setPane('approvals') },
      // styles/workflows pane is hidden; keep action as no-op
      'nav.styles': { id:'nav.styles', run: ()=> setPane('dashboard') },
      'nav.askvx': { id:'nav.askvx', run: ()=> setPane('askvx') },
      'nav.vision': { id:'nav.vision', run: ()=> setPane('vision') },
      'guide.dashboard': { id:'guide.dashboard', run: ()=> startGuide('dashboard') },
      'guide.integrations': { id:'guide.integrations', run: ()=> startGuide('integrations') },
      'guide.workflows': { id:'guide.workflows', run: ()=> startGuide('dashboard') },
      'guide.messages': { id:'guide.messages', run: ()=> startGuide('messages') },
      'guide.contacts': { id:'guide.contacts', run: ()=> startGuide('contacts') },
      'guide.calendar': { id:'guide.calendar', run: ()=> startGuide('calendar') },
      'guide.cadences': { id:'guide.cadences', run: ()=> startGuide('cadences') },
      'guide.inventory': { id:'guide.inventory', run: ()=> startGuide('inventory') },
      'guide.approvals': { id:'guide.approvals', run: ()=> startGuide('approvals') },
      'guide.inbox': { id:'guide.inbox', run: ()=> startGuide('inbox') },
      'nav.wow': { id:'nav.wow', run: ()=> { window.location.assign('/wow'); } },
      'integrations.reanalyze': { id:'integrations.reanalyze', run: async()=> { try{ await api.post('/onboarding/analyze',{}); }catch{} } },
      'integrations.square.import_contacts': { id:'integrations.square.import_contacts', run: async()=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/ai/tools/execute',{ tenant_id: tid, name:'contacts.import.square', params:{ tenant_id: tid }, require_approval: false, idempotency_key: `square_import_${Date.now()}` }); }catch{} } },
      'integrations.twilio.provision': { id:'integrations.twilio.provision', run: async(area_code?: string)=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/ai/tools/execute',{ tenant_id: tid, name:'integrations.twilio.provision', params:{ tenant_id: tid, area_code: String(area_code||'') }, require_approval: false }); }catch{} } },
      'integrations.sendgrid.test_email': { id:'integrations.sendgrid.test_email', run: async()=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/ai/tools/execute',{ tenant_id: tid, name:'messages.send', params:{ tenant_id: tid, contact_id: 'c_demo', channel: 'email', subject: 'BrandVX Test', body: '<p>Hello from BrandVX</p>' }, require_approval: false }); }catch{} } },
      'integrations.hubspot.upsert_sample': { id:'integrations.hubspot.upsert_sample', run: async()=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/integrations/crm/hubspot/upsert',{ tenant_id: tid, obj_type:'contact', attrs:{ email:'demo@example.com', firstName:'Demo', lastName:'User' }, idempotency_key:'demo_contact_1' }); }catch{} } },
      'integrations.acuity.import_sample': { id:'integrations.acuity.import_sample', run: async()=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/integrations/booking/acuity/import',{ tenant_id: tid, since:'0', until:'', cursor:'' }); }catch{} } },
      'integrations.redirects.copy': { id:'integrations.redirects.copy', run: async()=> { try{ const r = await api.get('/integrations/redirects'); const lines: string[] = []; Object.entries(r?.oauth||{}).forEach(([k,v]:any)=> lines.push(`${k}: ${v}`)); Object.entries(r?.webhooks||{}).forEach(([k,v]:any)=> lines.push(`${k} webhook: ${v}`)); await navigator.clipboard?.writeText(lines.join('\n')); }catch{} } },
      'integrations.connect': { id:'integrations.connect', run: async(provider: string)=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; const j = await api.get(`/oauth/${provider}/login?tenant_id=${encodeURIComponent(tid)}`); const url = String(j?.url||''); if (url) window.location.assign(url); }catch{} } },
      'integrations.refresh': { id:'integrations.refresh', run: async(provider: string)=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/oauth/refresh',{ tenant_id: tid, provider }); }catch{} } },
      'messages.send': { id:'messages.send', run: async(contactId: string, channel: 'sms'|'email', body: string)=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/messages/send',{ tenant_id: tid, contact_id: contactId, channel, body }); }catch{} } },
      'messages.simulate': { id:'messages.simulate', run: async(contactId: string, channel: 'sms'|'email')=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/messages/simulate',{ tenant_id: tid, contact_id: contactId, channel, generate: false }); }catch{} } },
      'messages.copy.text': { id:'messages.copy.text', run: async(text: string)=> { try{ await navigator.clipboard?.writeText(String(text||'')); }catch{} } },
      'messages.open.sms': { id:'messages.open.sms', run: (to: string, body: string)=> { try{ window.location.href = `sms:${encodeURIComponent(to||'')}&body=${encodeURIComponent(body||'')}`; }catch{} } },
      'messages.open.mail': { id:'messages.open.mail', run: (to: string, subject: string, body: string)=> { try{ window.location.href = `mailto:${encodeURIComponent(to||'')}?subject=${encodeURIComponent(subject||'')}&body=${encodeURIComponent(body||'')}`; }catch{} } },
      'contacts.get_candidates': { id:'contacts.get_candidates', run: async()=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; return await api.get(`/import/candidates?tenant_id=${encodeURIComponent(tid)}`); }catch(e){ return { error: String((e as any)?.message||e) }; } } },
      'contacts.import': { id:'contacts.import', run: async(contacts: Array<any>)=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/import/contacts',{ tenant_id: tid, contacts: Array.isArray(contacts)? contacts: [] }); }catch{} } },
      'recon.import_missing_contacts': { id:'recon.import_missing_contacts', run: async()=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/reconciliation/import_missing_contacts',{ tenant_id: tid }); }catch{} } },
      'calendar.preview_reminders': { id:'calendar.preview_reminders', run: async()=> { return { status: 'not_available' }; } },
      'cadences.start': { id:'cadences.start', run: async(contactId: string, cadenceId: string)=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/cadences/start',{ tenant_id: tid, contact_id: contactId, cadence_id: cadenceId }); }catch{} } },
      'cadences.stop': { id:'cadences.stop', run: async(contactId: string, cadenceId: string)=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post(`/cadences/stop?tenant_id=${encodeURIComponent(tid)}&contact_id=${encodeURIComponent(contactId)}&cadence_id=${encodeURIComponent(cadenceId)}`, {} as any); }catch{} } },
      'scheduler.tick': { id:'scheduler.tick', run: async()=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/scheduler/tick',{ tenant_id: tid }); }catch{} } },
      'workflows.run.dedupe': { id:'workflows.run.dedupe', run: async()=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/ai/tools/execute',{ tenant_id: tid, name:'contacts.dedupe', params:{ tenant_id: tid }, require_approval: true }); }catch{} } },
      'workflows.run.lowstock': { id:'workflows.run.lowstock', run: async()=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/ai/tools/execute',{ tenant_id: tid, name:'inventory.alerts.get', params:{ tenant_id: tid, low_stock_threshold: Number(localStorage.getItem('bvx_low_threshold')||'5') }, require_approval: false }); }catch{} } },
      'workflows.run.reminders': { id:'workflows.run.reminders', run: async()=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/ai/tools/execute',{ tenant_id: tid, name:'appointments.schedule_reminders', params:{ tenant_id: tid }, require_approval: false }); }catch{} } },
      'workflows.run.dormant_preview': { id:'workflows.run.dormant_preview', run: async(threshold: number = 60)=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/ai/tools/execute',{ tenant_id: tid, name:'campaigns.dormant.preview', params:{ tenant_id: tid, threshold_days: threshold }, require_approval: false }); }catch{} } },
      'workflows.run.social_plan': { id:'workflows.run.social_plan', run: async()=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/ai/tools/execute',{ tenant_id: tid, name:'social.schedule.14days', params:{ tenant_id: tid }, require_approval: true }); }catch{} } },
      'approvals.approve': { id:'approvals.approve', run: async()=> { try{ window.location.assign('/workspace?pane=approvals'); return { status:'navigate' }; }catch{} } },
      'approvals.reject': { id:'approvals.reject', run: async()=> { try{ window.location.assign('/workspace?pane=approvals'); return { status:'navigate' }; }catch{} } },
      'settings.update': { id:'settings.update', run: async(payload: any)=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/settings',{ tenant_id: tid, ...(payload||{}) }); }catch{} } },
      'settings.quiet_hours': { id:'settings.quiet_hours', run: async(start: string, end: string)=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/settings',{ tenant_id: tid, quiet_hours:{ start, end } }); }catch{} } },
      'settings.brand_profile': { id:'settings.brand_profile', run: async(profile: any)=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/settings',{ tenant_id: tid, brand_profile: profile }); }catch{} } },
      'settings.goals': { id:'settings.goals', run: async(goals: any)=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/settings',{ tenant_id: tid, goals }); }catch{} } },
      'share.create': { id:'share.create', run: async(title: string, description: string)=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; return await api.post('/share/create',{ tenant_id: tid, title, description }); }catch(e){ return { error: String((e as any)?.message||e) }; } } },
      'usage.limits.get': { id:'usage.limits.get', run: async()=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; const s = await api.get(`/settings?tenant_id=${encodeURIComponent(tid)}`); return s?.data?.usage_limits || {}; }catch(e){ return { error: String((e as any)?.message||e) }; } } },
      'config.get': { id:'config.get', run: ()=> { try{ const ro = (import.meta as any).env?.VITE_RECOMMEND_ONLY === '1' || (import.meta as any).env?.VITE_BETA_RECOMMEND_ONLY === '1'; return { recommend_only: !!ro }; }catch{ return { recommend_only:false }; } } },
      'admin.clear_cache': { id:'admin.clear_cache', run: async(scope: string = 'all')=> { try{ const tid = localStorage.getItem('bvx_tenant')||''; await api.post('/admin/cache/clear',{ tenant_id: tid, scope }); }catch{} } },
    });
    return unregister;
  }, []);

  // Billing prompt: open modal when guide/issues event, idempotent and re-usable
  useEffect(()=>{
    try {
      const onBilling = async () => {
        try { localStorage.setItem('bvx_billing_dismissed',''); } catch {}
        // Check coverage to avoid unnecessary opens
        try {
          const tid = await getTenant();
          if (tid) {
            const r = await api.get(`/settings?tenant_id=${encodeURIComponent(tid)}`);
            const st = String(r?.data?.subscription_status || '');
            const covered = st === 'active';
            if (covered) return;
          }
        } catch {}
          setBillingOpen(true);
        try { track('billing_modal_open'); } catch {}
      };
      window.addEventListener('bvx:billing:prompt' as any, onBilling as any);
      // Clean up on unmount
      return () => window.removeEventListener('bvx:billing:prompt' as any, onBilling as any);
      } catch {}
  }, []);

  // Load Stripe Buy Button script once when the billing modal opens and an ID+PK are available
  useEffect(() => {
    try {
      const isId = STRIPE_BUY_BUTTON_47.startsWith('buy_btn_');
      if (!billingOpen || !isId || !STRIPE_PK) return;
      if ((window as any).__bvxStripeBuyLoaded) return;
      const scriptId = 'bvx-stripe-buy-button-js';
      if (!document.getElementById(scriptId)) {
        const s = document.createElement('script');
        s.id = scriptId;
        s.async = true;
        s.src = 'https://js.stripe.com/v3/buy-button.js';
        document.head.appendChild(s);
      }
      (window as any).__bvxStripeBuyLoaded = true;
      } catch {}
  }, [billingOpen, STRIPE_BUY_BUTTON_47, STRIPE_PK]);

  const buyButton47Html = useMemo(() => {
    const id = STRIPE_BUY_BUTTON_47;
    const pk = STRIPE_PK;
    const isId = id.startsWith('buy_btn_');
    if (!isId || !pk) return '';
    const safeId = id.replace(/"/g, '&quot;');
    const safePk = pk.replace(/"/g, '&quot;');
    return `<stripe-buy-button buy-button-id="${safeId}" publishable-key="${safePk}"></stripe-buy-button>`;
  }, [STRIPE_BUY_BUTTON_47, STRIPE_PK]);

  return (
    <div className="max-w-6xl mx-auto">
      <div id="tour-welcome-anchor" className="fixed inset-0 pointer-events-none" style={{ zIndex: 2147483602 }} />
      <div
        id="tour-center-anchor"
        className="fixed"
        style={{ top: '50%', left: '50%', width: 0, height: 0, opacity: 0, pointerEvents: 'none', transform: 'translate(-50%, -50%)', zIndex: 2147483602 }}
      />
      <div id="tour-billing-anchor" className="fixed inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 2147483602 }} />
      {/* E2E readiness marker */}
      <div id="e2e-ready" data-pane={pane} style={{ position:'absolute', opacity:0, pointerEvents:'none' }} />
      {debugEnabled && (
        <div
          className="fixed right-2 z-[3000] text-[11px] bg-yellow-100 border border-yellow-300 text-yellow-900 rounded-md px-2 py-1 shadow-sm pointer-events-auto"
          style={{ bottom: 'calc(env(safe-area-inset-bottom,0px) + 96px)' }}
          data-debug-panel
        >
          <div>dbg pane={pane} status={billingStatus||'n/a'} open={billingOpen?'1':'0'} phase={onboardingState.phase} running={onboardingState.running?'1':'0'}</div>
          <div>overlay={typeof document!=='undefined'?document.querySelectorAll('.driver-overlay').length:0} pop={typeof document!=='undefined'?document.querySelectorAll('.driver-popover').length:0}</div>
          <div>ready dash={(window as any).__bvxDashReady? '1':'0'} msgs={(window as any).__bvxMessagesReady? '1':'0'} inv={(window as any).__bvxInventoryReady? '1':'0'}</div>
          <div>
            <button className="underline" onClick={()=>{ try{ startGuide('dashboard'); }catch{} }}>Restart tour</button>
          </div>
          {debugEvents.map((e,i)=> (<div key={i}>{e}</div>))}
        </div>
      )}
      <div className="h-[100dvh] grid grid-cols-[theme(spacing.64)_1fr] gap-4 md:gap-5 overflow-hidden pb-2 relative md:[--sticky-offset:88px] [--sticky-offset:70px]">
        {/* Left dock */}
        <aside className="h-full min-h-0 bg-white/70 backdrop-blur border border-b-0 rounded-2xl p-0 flex flex-col relative" aria-label="Primary navigation">
          <nav className="flex flex-col gap-1 mt-[2px] px-[3px]" role="tablist" aria-orientation="vertical" onKeyDown={onKeyDown}>
            {items.map((p, i) => {
              const active = pane===p.key;
              return (
                <Link
                  key={p.key}
                  ref={el=>{ if (el) refs.current[i]=el as any; }}
                  to={`/workspace?pane=${encodeURIComponent(p.key)}`}
                  role="tab"
                  aria-selected={active}
                  aria-current={active ? 'page' : undefined}
                  title={`${p.label}  •  ${i+1}`}
                  data-tour={`nav-${p.key}`}
                  className={`relative w-full h-11 flex items-center gap-3 pl-4 pr-4 rounded-full border [font-family:var(--font-display)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${active ? 'bg-[var(--brand-50)] text-ink-900 border-black shadow-sm' : 'bg-[var(--brand-50)] text-ink-900 border-black hover:brightness-105'}`}
                >
                  <span className="inline-flex items-center justify-center shrink-0 w-7 h-7 rounded-full border border-black bg-transparent text-ink-900 overflow-hidden">{p.icon}</span>
                  <span className="text-[15px] leading-none">{p.label}</span>
                  {p.key==='approvals' && approvalsCount>0 && (
                    <span aria-label={`${approvalsCount} pending`} className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] px-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">{approvalsCount}</span>
                  )}
                  {p.key==='cadences' && queueCount>0 && (
                    <span aria-label={`${queueCount} queued`} className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] px-1 rounded-full bg-sky-100 text-sky-900 border border-sky-200">{queueCount}</span>
                  )}
                  {/* Remove numeric index per spec */}
                </Link>
              );
            })}
          </nav>
          {/* Anchored footer */}
          <div className="absolute left-[3px] right-[3px]" style={{ bottom: 'calc(env(safe-area-inset-bottom,0px) + 18px)' }}>
            <div className="flex flex-col gap-2">
              <SupportBubble hideTrigger />
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 [font-family:var(--font-display)]"
                onClick={()=>{
                  try { window.dispatchEvent(new CustomEvent('bvx:support:open', { detail: { source: 'workspace-cta' } })); } catch {}
                }}
              >Support</button>
              {BOOKING_URL && (
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center px-3 py-2 rounded-full border bg-white text-slate-900 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] [font-family:var(--font-display)]"
                  data-tour="book-onboarding"
                >Book onboarding</a>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full !rounded-full !py-2 text-left"
              data-guide={undefined}
              data-tour="signup"
              onClick={async()=>{
                // const sp = new URLSearchParams(loc.search);
                const isDemo = false;
                if (isDemo) {
                  window.location.href = '/signup';
                  return;
                }
                try { localStorage.setItem('bvx_signed_out','1'); } catch {}
                try { await supabase.auth.signOut(); } catch {}
                try { localStorage.removeItem('bvx_tenant'); } catch {}
                window.location.href = '/brandvx';
              }}
            >{UI_STRINGS.ctas.liveOnly.signOut}</Button>
          </div>
        </aside>
        {/* Canvas */}
        <main className={`h-full rounded-2xl border border-b-0 border-l-slate-300/80 bg-white/90 backdrop-blur p-4 md:p-5 shadow-sm overflow-hidden border-l relative`}>
          <div className="rounded-xl bg-white/70 backdrop-blur min-h-full h-full overflow-y-auto pb-3">
            <Suspense fallback={<div className="p-4 text-slate-600 text-sm">Loading {PANES.find(p=>p.key===pane)?.label}…</div>}>
              {PaneView}
            </Suspense>
          </div>
          {/* Bottom separator removed with command bar */}
        </main>
        {/* Arrows removed per product decision */}
      </div>
      {/* No external WelcomeModal */}
      {flowModal && createPortal(
        <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-5 shadow-soft text-center">
            <div className="text-lg font-semibold text-ink-900">{flowModal.title}</div>
            {flowModal.body && (
              <div className="mt-2 text-sm text-slate-700 text-left whitespace-pre-wrap">{flowModal.body}</div>
            )}
            {flowModal.input && (
              flowModal.input.textarea ? (
                <textarea
                  className="mt-4 w-full rounded-md border px-3 py-2 text-sm"
                  rows={4}
                  placeholder={flowModal.input.placeholder}
                  value={flowModalInput}
                  onChange={e=> setFlowModalInput(e.target.value)}
                />
              ) : (
                <input
                  className="mt-4 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder={flowModal.input.placeholder}
                  value={flowModalInput}
                  onChange={e=> setFlowModalInput(e.target.value)}
                />
              )
            )}
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {flowModal.buttons.map((btn, idx) => {
                const disabled = btn.disabled || (flowModal.input?.required && !flowModalInput.trim() && btn.value === undefined);
                const tone = btn.tone || 'secondary';
                const className = tone === 'primary'
                  ? 'inline-flex items-center justify-center px-4 py-2 rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60'
                  : 'inline-flex items-center justify-center px-4 py-2 rounded-full border bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-60';
                return (
                  <button
                    key={idx}
                    type="button"
                    className={className}
                    disabled={disabled}
                    onClick={()=> resolveFlowModal(btn.value)}
                  >{btn.label}</button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Onboarding prompt for WorkStyles removed per simplification */}
      {/* Billing modal */}
      {billingOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div aria-hidden className="absolute inset-0 bg-black/20" onClick={()=> resolveBilling()} />
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-5 shadow-soft">
            <div className="text-ink-900 text-lg font-semibold">Start your BrandVX</div>
            <div className="text-ink-700 text-sm mt-1">Choose a plan to unlock your workspace. You can change anytime.</div>
            <div className="mt-4 grid gap-2">
              <button disabled={billingLoading} onClick={async()=>{
                try { track('billing_trial_click'); } catch {}
                if (!PRICE_147) { resolveBilling(); window.location.href='/billing'; return; }
                setBillingLoading(true);
                try{
                  const r = await api.post('/billing/create-checkout-session', { price_id: PRICE_147, mode: 'subscription', trial_days: TRIAL_DAYS });
                  if (r?.url) {
                    resolveBilling();
                    window.location.href = r.url;
                  }
                } finally { setBillingLoading(false); }
              }} className="w-full rounded-xl border bg-gradient-to-b from-sky-50 to-sky-100 hover:from-sky-100 hover:to-sky-200 text-slate-900 px-4 py-3 text-sm text-left">
                <div className="font-medium">7‑day free trial → $147/mo</div>
                <div className="text-slate-600 text-xs">You’ll be reminded before any charge.</div>
              </button>
              <button disabled={billingLoading} onClick={async()=>{
                try { track('billing_97_click'); } catch {}
                if (!PRICE_97) { resolveBilling(); window.location.href='/billing'; return; }
                setBillingLoading(true);
                try{
                  try { localStorage.setItem('bvx_founding_member', '1'); } catch {}
                  const r = await api.post('/billing/create-checkout-session', { price_id: PRICE_97, mode: 'subscription' });
                  if (r?.url) {
                    resolveBilling();
                    window.location.href = r.url;
                  }
                } finally { setBillingLoading(false); }
              }} className="w-full rounded-xl border bg-white hover:shadow-sm text-slate-900 px-4 py-3 text-sm text-left">
                <div className="font-medium">$97 today → $97/mo (Founding price)</div>
                <div className="text-slate-600 text-xs">Lock in $97/mo now; recurring thereafter.</div>
              </button>
              {/* $47/mo Stripe Buy Button (env-driven) */}
              {STRIPE_BUY_BUTTON_47 && (
                <div className="w-full grid place-items-center py-1">
                  {STRIPE_BUY_BUTTON_47.startsWith('buy_btn_') && STRIPE_PK ? (
                    <div
                      className="w-full flex items-center justify-center"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: buyButton47Html }}
                    />
                  ) : (
                    <a
                      href={STRIPE_BUY_BUTTON_47}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full inline-flex items-start rounded-xl border bg-white hover:shadow-sm text-slate-900 px-4 py-3 text-sm text-left"
                    >
                      <div>
                        <div className="font-medium">brandVZN Lite — $47/mo</div>
                        <div className="text-slate-600 text-xs">Opens secure Stripe checkout in a new tab.</div>
            </div>
                    </a>
                  )}
                </div>
              )}
              <button className="w-full rounded-xl border bg-white hover:bg-slate-50 px-4 py-2 text-sm" onClick={()=> resolveBilling()}>Skip for now</button>
            </div>
            <div className="text-[11px] text-ink-700 mt-2">Status: {billingStatus||'unavailable'}</div>
          </div>
        </div>
      )}
      {/* Trial active modal */}
      {trialModalOpen && (
        <div className="fixed inset-0 z-[1100] grid place-items-center p-4">
          <div aria-hidden className="absolute inset-0 bg-black/20" onClick={()=> setTrialModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-5 shadow-soft">
            <div className="text-ink-900 text-lg font-semibold">Trial active</div>
            <div className="text-ink-700 text-sm mt-1">{trialDaysLeft} day{trialDaysLeft===1?'':'s'} until payment of $147 is required.</div>
            <div className="mt-3 flex gap-2 justify-end">
              <Button variant="outline" onClick={()=> setTrialModalOpen(false)}>Close</Button>
              <Button onClick={()=>{ setTrialModalOpen(false); nav('/billing'); }}>Add payment</Button>
            </div>
          </div>
        </div>
      )}
      {/* Trial ended modal (soft gate) */}
      {trialEndedOpen && (
        <div className="fixed inset-0 z-[2147483603] grid place-items-center p-4">
          <div aria-hidden className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-6 shadow-soft text-center">
            <div className="text-ink-900 text-lg font-semibold">Trial ended</div>
            <div className="text-ink-700 text-sm mt-1">Add payment method to access your brandVX!</div>
            <div className="mt-3 flex gap-2 justify-center">
              <Button onClick={()=> nav('/billing')}>Add payment</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Lazy panes (reuse existing pages)
const LazyDashboard = lazy(()=> import('../pages/Dashboard'));
const LazyMessages = lazy(()=> import('../pages/Messages'));
const LazyContacts = lazy(()=> import('../pages/Contacts'));
const LazyCalendar = lazy(()=> import('../pages/Calendar'));
const LazyCadences = lazy(()=> import('../pages/Cadences'));
const LazyInventory = lazy(()=> import('../pages/Inventory'));
const LazyIntegrations = lazy(()=> import('../pages/Integrations'));
const LazyApprovals = lazy(()=> import('../pages/Approvals'));
// const LazyWorkflows = lazy(()=> import('../pages/Workflows'));
const LazyAsk = lazy(()=> import('../pages/Ask'));
const LazyVision = lazy(()=> import('../pages/Vision'));
// Onboarding is now a standalone route (not a workspace pane)
