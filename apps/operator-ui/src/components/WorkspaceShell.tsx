import React, { Suspense, lazy, useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Button from './ui/Button';
import { Home, MessageSquare, Users, Calendar, Layers, Package2, Plug, CheckCircle2, MessageCircle, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api, getTenant } from '../lib/api';
import { startGuide } from '../lib/guide';
import { track } from '../lib/analytics';
import { UI_STRINGS } from '../lib/strings';
// import PaneManager from './pane/PaneManager';
import { registerActions, registerMessageBridge } from '../lib/actions';

type PaneKey = 'dashboard' | 'messages' | 'contacts' | 'calendar' | 'cadences' | 'inventory' | 'integrations' | 'approvals' | 'askvx' | 'vision';

const PANES: { key: PaneKey; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <Home size={18} /> },
  { key: 'askvx', label: 'askVX', icon: <MessageCircle size={18} /> },
  { key: 'vision', label: 'brandVZN', icon: <Eye size={18} /> },
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

  const [billingOpen, setBillingOpen] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingStatus, setBillingStatus] = useState<string>('');
  const [trialModalOpen, setTrialModalOpen] = useState<boolean>(false);
  const [trialEndedOpen, setTrialEndedOpen] = useState<boolean>(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(0);
  const [showWelcome, setShowWelcome] = useState(false);
  const [flowModal, setFlowModal] = useState<FlowModalConfig | null>(null);
  const [flowModalInput, setFlowModalInput] = useState('');

  const paneRef = useRef(pane);
  useEffect(()=>{ paneRef.current = pane; }, [pane]);
  const billingOpenRef = useRef(billingOpen);
  useEffect(()=>{ billingOpenRef.current = billingOpen; }, [billingOpen]);
  const billingStatusRef = useRef(billingStatus);
  useEffect(()=>{ billingStatusRef.current = billingStatus; }, [billingStatus]);
  const flowRunningRef = useRef(false);
  const flowModalResolveRef = useRef<((value: any) => void) | undefined>(undefined);

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

  const waitForCondition = useCallback(async (predicate: () => boolean, timeoutMs = 10000) => {
    const start = Date.now();
    while (!predicate()) {
      if (Date.now() - start > timeoutMs) return false;
      await sleep(80);
    }
    return true;
  }, [sleep]);

  const waitForEvent = useCallback((eventName: string, predicate: ((event: Event) => boolean) | undefined = undefined, timeoutMs = 30000) => {
    return new Promise<Event>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const handler = (event: Event) => {
        try {
          if (!predicate || predicate(event)) {
            cleanup();
            resolve(event);
          }
        } catch (err) {
          cleanup();
          reject(err);
        }
      };
      const cleanup = () => {
        window.removeEventListener(eventName, handler as any);
        if (timer) clearTimeout(timer);
      };
      window.addEventListener(eventName, handler as any);
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          cleanup();
          reject(new Error(`${eventName} timeout`));
        }, timeoutMs);
      }
    });
  }, []);

  const highlightStep = useCallback(async (selector: string, title: string, description: string) => {
    const found = await waitForCondition(() => !!document.querySelector(selector), 8000);
    if (!found) return;
    const mod: any = await import('driver.js');
    const driverFactory = mod?.driver || mod;
    const instance = driverFactory({
      showProgress: false,
      allowClose: false,
      steps: [
        {
          element: selector,
          popover: {
            title,
            description,
            side: 'bottom',
            align: 'start',
          },
        },
      ],
    } as any);
    return new Promise<void>((resolve) => {
      try {
        instance.drive();
      } catch {
        resolve();
        return;
      }
      instance.on('destroyed', () => resolve());
    });
  }, [waitForCondition]);

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

  const ensureBilling = useCallback(async () => {
    const covered = () => {
      const status = billingStatusRef.current || '';
      return status === 'active' || status === 'trialing';
    };
    if (covered()) return;
    setBillingOpen(true);
    try { localStorage.removeItem('bvx_billing_dismissed'); } catch {}
    const start = Date.now();
    while (!covered()) {
      if (!billingOpenRef.current) break;
      if (Date.now() - start > 60000) break;
      await sleep(600);
    }
    setBillingOpen(false);
  }, [sleep]);

  const runUnifiedFlow = useCallback(async () => {
    if (flowRunningRef.current) return;
    if (localStorage.getItem('bvx_quickstart_completed') === '1') return;
    flowRunningRef.current = true;
    const hairOptions = [
      'Copper',
      'Espresso brown',
      'Platinum blonde',
      'Rose gold',
      'Jet black',
    ];
    const planQuestions = [
      {
        id: 'goal',
        title: 'Your focus',
        placeholder: 'Example: Fill weekdays with high-ticket color clients',
        prompt: 'What is your biggest business goal for the next two weeks?',
      },
      {
        id: 'segments',
        title: 'Who you want to serve',
        placeholder: 'Example: Vivid color guests or bridal parties',
        prompt: 'Which client segments are you focusing on (vivid color, bridal, lash refills, etc.)?',
      },
      {
        id: 'time',
        title: 'Time available',
        placeholder: 'Example: 30 minutes per day, 2 hours on Mondays',
        prompt: 'How much time per day can you realistically invest in follow-ups, content, or training?',
      },
    ];
    try {
      await sleep(400);
      await ensureBilling();

      await showFlowModalAsync({
        title: 'Let’s start strong',
        body: (
          <div className="text-sm text-slate-700">
            We’ll knock out three quick wins so your workspace delivers value right away.
          </div>
        ),
        buttons: [{ label: 'Let’s go', value: 'continue', tone: 'primary' }],
      });

      await highlightStep('[data-guide="quickstart-brandvzn"]', 'Brand Vision', 'Tap Brand Vision to jump in and show a fast before & after.');
      await goToPane('vision');
      await sleep(400);
      try { startGuide('vision'); } catch {}
      await sleep(1600);

      if (localStorage.getItem('bvx_done_vision') !== '1') {
        await highlightStep('[data-guide="upload"]', 'Upload a photo', 'Pick a selfie or client look to get started.');
        try {
          await waitForEvent('bvx:flow:vision-uploaded', undefined, 90000);
        } catch {
          throw new Error('vision-upload-timeout');
        }

        const choice = await showFlowModalAsync({
          title: 'Try a quick hair update',
          body: (
            <div className="text-sm text-slate-700">
              Choose a shade to see how naturally Brand Vision edits.
            </div>
          ),
          buttons: hairOptions.map(label => ({ label, value: label, tone: 'primary' })),
        });
        if (choice) {
          window.dispatchEvent(new CustomEvent('bvx:flow:vision-command', {
            detail: {
              action: 'vision.run-edit',
              prompt: `Change just the hair on the top of the subject's head to ${choice}`,
            },
          }));
          try {
            await waitForEvent('bvx:flow:vision-edit-complete', (event) => {
              const detail = (event as CustomEvent).detail as any;
              if (detail?.error) throw new Error(detail.error);
              return true;
            }, 120000);
          } catch {
            throw new Error('vision-edit-failed');
          }
        }

        await highlightStep('[data-guide="slider"]', 'Compare the look', 'Drag the slider to show before vs after in real time.');
        await showFlowModalAsync({
          title: 'Brand Vision ready',
          body: (
            <div className="text-sm text-slate-700">
              Your edit is saved in the Brand Vision library for future share-outs.
            </div>
          ),
          buttons: [{ label: 'Back to dashboard', value: 'dashboard', tone: 'primary' }],
        });
        try { localStorage.setItem('bvx_done_vision','1'); } catch {}
        window.dispatchEvent(new CustomEvent('bvx:quickstart:update', { detail: { step: 'vision' } }));
      }

      await goToPane('dashboard');
      await sleep(400);

      if (localStorage.getItem('bvx_done_contacts') !== '1') {
        await highlightStep('[data-guide="quickstart-import"]', 'Import clients', 'Bring in your Square or Acuity guests so metrics stay accurate.');
        await goToPane('contacts');
        await sleep(400);
        try { startGuide('contacts'); } catch {}
        await sleep(1400);
        window.dispatchEvent(new CustomEvent('bvx:flow:contacts-command', { detail: { action: 'contacts.import' } }));
        try {
          await waitForEvent('bvx:flow:contacts-imported', (event) => {
            const detail = (event as CustomEvent).detail as any;
            if (detail?.error) throw new Error(detail.error);
            return true;
          }, 150000);
        } catch {
          throw new Error('contacts-import-failed');
        }
        await showFlowModalAsync({
          title: 'Clients connected',
          body: (
            <div className="text-sm text-slate-700">
              Your guests, spend, and visit history are synced. Let’s tap into insights now.
            </div>
          ),
          buttons: [{ label: 'Continue', value: 'next', tone: 'primary' }],
        });
        try { localStorage.setItem('bvx_done_contacts','1'); } catch {}
        window.dispatchEvent(new CustomEvent('bvx:quickstart:update', { detail: { step: 'contacts' } }));
      }

      await goToPane('dashboard');
      await highlightStep('[data-guide="quickstart-train"]', 'Train VX', 'Use Train VX to tailor a 14-day plan with your style and schedule.');
      await goToPane('askvx');
      await sleep(400);
      try { startGuide('askvx'); } catch {}
      await sleep(1500);

      const analyticsPrompt = 'What was my revenue for the last three months and who are my top three clients?';
      window.dispatchEvent(new CustomEvent('bvx:flow:askvx-command', { detail: { action: 'askvx.prefill', prompt: analyticsPrompt } }));
      await showFlowModalAsync({
        title: 'Check your numbers',
        body: (
          <div className="text-sm text-slate-700">
            Press Send to see revenue for the last three months and your top three clients.
          </div>
        ),
        buttons: [{ label: 'Send now', value: 'send', tone: 'primary' }],
      });
      window.dispatchEvent(new CustomEvent('bvx:flow:askvx-command', { detail: { action: 'askvx.send', prompt: analyticsPrompt, context: { flow: 'analytics' } } }));
      await waitForEvent('bvx:flow:askvx-response', (event) => ((event as CustomEvent).detail as any)?.context?.flow === 'analytics', 60000);
      await showFlowModalAsync({
        title: 'Revenue ready',
        body: (
          <div className="text-sm text-slate-700">
            Review the chat response for your three-month revenue snapshot. When you’re set, we’ll map your 14-day strategy.
          </div>
        ),
        buttons: [{ label: 'Next', value: 'next', tone: 'primary' }],
      });

      if (localStorage.getItem('bvx_done_plan') !== '1') {
        const answers: Record<string, string> = {};
        for (const item of planQuestions) {
        const response = await showFlowModalAsync({
          title: item.prompt,
          body: (
            <div className="text-sm text-slate-700">
              {item.title}
            </div>
          ),
          input: {
            placeholder: item.placeholder,
            textarea: true,
            required: true,
            defaultValue: '',
          },
          buttons: [{ label: 'Save answer', tone: 'primary' }],
        });
          const value = typeof response === 'string' ? response.trim() : '';
          if (!value) {
            throw new Error('plan-question-missing');
          }
          answers[item.id] = value;
        }

        const planPrompt = `You are a beauty business coach. Create a warm, practical 14-day action plan with daily bullet points based on the owner’s answers. Goal: ${answers.goal}. Focused client segments: ${answers.segments}. Daily time available: ${answers.time}. Keep it friendly, no tech jargon, and include a mix of follow-ups, content, and training.`;
        window.dispatchEvent(new CustomEvent('bvx:flow:askvx-command', { detail: { action: 'askvx.send', prompt: planPrompt, context: { flow: 'plan' } } }));
        const planEvent = await waitForEvent('bvx:flow:askvx-response', (event) => ((event as CustomEvent).detail as any)?.context?.flow === 'plan', 60000);
        const planText = String(((planEvent as CustomEvent).detail as any)?.text || '').trim();

        const planChoice = await showFlowModalAsync({
          title: 'Your 14-day plan',
          body: (
            <div className="text-sm text-slate-700 whitespace-pre-wrap max-h-[40vh] overflow-y-auto">{planText || 'Plan available in chat window.'}</div>
          ),
          buttons: [
            { label: 'Save plan', value: 'save', tone: 'primary', disabled: !planText },
            { label: 'Skip for now', value: 'skip' },
          ],
        });

        if (planChoice === 'save' && planText) {
          try {
            const tid = await getTenant();
            await api.post('/ai/memories/upsert', { tenant_id: tid, key: 'plan.14day', value: planText, tags: 'onboarding,plan' });
          } catch (err) {
            console.error('plan save failed', err);
          }
        }
        try { localStorage.setItem('bvx_done_plan','1'); } catch {}
        window.dispatchEvent(new CustomEvent('bvx:quickstart:update', { detail: { step: 'plan' } }));
      }

      await goToPane('dashboard');
      await showFlowModalAsync({
        title: 'You’re all set',
        body: (
          <div className="text-sm text-slate-700">
            Brand Vision edits, your client list, and your 14-day plan are ready. Explore the dashboard anytime.
          </div>
        ),
        buttons: [{ label: 'Finish', value: 'done', tone: 'primary' }],
      });

      try { localStorage.setItem('bvx_quickstart_completed','1'); } catch {}
      window.dispatchEvent(new CustomEvent('bvx:quickstart:completed'));
    } catch (err) {
      console.error('Unified onboarding flow error', err);
      await showFlowModalAsync({
        title: 'Flow paused',
        body: (
          <div className="text-sm text-slate-700">
            Something interrupted the guided steps. You can continue exploring manually and rerun the tour later.
          </div>
        ),
        buttons: [{ label: 'Continue', value: 'ok', tone: 'primary' }],
      });
    } finally {
      flowRunningRef.current = false;
      setFlowModal(null);
    }
  }, [ensureBilling, goToPane, highlightStep, showFlowModalAsync, sleep, waitForEvent, waitForCondition]);

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
            sessionStorage.setItem('bvx_welcome_seen','1');
          }
        } catch {}
        // Auth guard with tolerant resolver to avoid bounce loop
        {
          let session = (await supabase.auth.getSession()).data.session;
          if (!session) {
            const inProgress = localStorage.getItem('bvx_auth_in_progress') === '1';
            if (inProgress) {
              // wait briefly for session propagation
              for (let i=0; i<8; i++) {
                await new Promise(r=> setTimeout(r, 700));
                session = (await supabase.auth.getSession()).data.session;
                if (session) break;
              }
            }
            if (!session) { nav('/login'); return; }
          }
        }
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
        // Determine whether to show welcome based on onboarding status (or forced)
        const forceWelcome = sp.get('welcome') === '1';
        const dismissed = localStorage.getItem('bvx_billing_dismissed') === '1';
        const tid = (await supabase.auth.getSession()).data.session ? (localStorage.getItem('bvx_tenant') || '') : '';
        const r = await api.get(`/settings${tid?`?tenant_id=${encodeURIComponent(tid)}`:''}`);
        const status = String(r?.data?.subscription_status || '');
        setBillingStatus(status);
        const covered = status === 'active' || status === 'trialing';
        // Only open billing modal when explicitly requested via query param
        const billingParam = sp.get('billing');
        if (billingParam === 'prompt' && !covered && !dismissed) {
          setBillingOpen(true); try { track('billing_modal_open'); } catch {}
        } else {
          setBillingOpen(false);
        }
        try {
          const doneServer = Boolean(r?.data?.onboarding_completed || r?.data?.onboarding_done);
          if (doneServer) { try { localStorage.setItem('bvx_onboarding_done','1'); } catch {} }
          const welcomeSeen = Boolean(r?.data?.welcome_seen);
          if (welcomeSeen) { try { sessionStorage.setItem('bvx_welcome_seen','1'); } catch {} }
          const guideDone = Boolean(r?.data?.guide_done);
          if (guideDone) { try { localStorage.setItem('bvx_guide_done','1'); } catch {} }
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

        // Optionally auto-start tour when ?tour=1 (Dashboard only to avoid conflicting with post-book chain)
        try {
          const wantTour = sp.get('tour') === '1';
          const pane = sp.get('pane') || 'dashboard';
          const billingParam = sp.get('billing');
          if (wantTour && pane === 'dashboard' && billingParam !== 'prompt') {
            setTimeout(()=>{ try{ startGuide('workspace_intro'); }catch{} }, 400);
          }
        } catch {}
        // Show welcome only once after onboarding_done=true
        try {
          const doneLocal = localStorage.getItem('bvx_onboarding_done') === '1';
          const seenSession = sessionStorage.getItem('bvx_welcome_seen') === '1';
          // Only show when onboarding completed and never seen before
          if (forceWelcome || (doneLocal && !seenSession)) {
            setTimeout(()=> setShowWelcome(true), 200);
          }
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
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.search]);

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
      default: return <div/>;
    }
  })();
  // When welcome opens, force viewport to top to ensure centered overlay
  useEffect(()=>{
    if (showWelcome) {
      try { window.scrollTo(0,0); } catch {}
    }
  }, [showWelcome]);

  useEffect(()=>{
    const handler = () => {
      runUnifiedFlow();
    };
    window.addEventListener('bvx:guide:workspace_intro:done', handler as any);
    return () => window.removeEventListener('bvx:guide:workspace_intro:done', handler as any);
  }, [runUnifiedFlow]);

  const items = useMemo(()=> PANES, []);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-time workspace intro for any newly authenticated user (Google or email)
  useEffect(()=>{
    (async()=>{
      try{
        const session = (await supabase.auth.getSession()).data.session;
        const uid = session?.user?.id;
        if (!uid) return;
        const key = `bvx_intro_seen_${uid}`;
        if (localStorage.getItem(key) === '1') return;
        const shownKey = `bvx_welcome_shown_${uid}`;
        if (localStorage.getItem(shownKey) === '1') return;
        // Ensure nav is mounted before running the guide
        let tries = 24;
        const waitForMarkers = async()=>{
          while (tries-- > 0) {
            if (document.querySelector('[data-tour="nav-dashboard"]')) return true;
            await new Promise(r=> setTimeout(r, 120));
          }
          return false;
        };
        const ok = await waitForMarkers();
        if (ok) {
          {
            setShowWelcome(true);
            try { localStorage.setItem(shownKey, '1'); } catch {}
          }
        }
      } catch {}
    })();
  }, [loc.pathname]);

  // After workspace intro finishes, mark guide_done in settings
  useEffect(()=>{
    const handler = async () => {
      try {
        const uid = (await supabase.auth.getSession()).data.session?.user?.id;
        if (uid) localStorage.setItem(`bvx_intro_seen_${uid}`, '1');
        try {
          const tid = localStorage.getItem('bvx_tenant')||'';
          if (tid) await api.post('/settings', { tenant_id: tid, guide_done: true });
        } catch {}
      } catch {}
      // After tour completes, billing is handled by guide.ts handoff; avoid duplicate prompts here
    };
    window.addEventListener('bvx:guide:workspace_intro:done', handler, { once: true } as any);
    return () => window.removeEventListener('bvx:guide:workspace_intro:done', handler as any);
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
            const covered = st === 'active' || st === 'trialing';
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

  return (
    <div className="max-w-6xl mx-auto">
      {/* E2E readiness marker */}
      <div id="e2e-ready" data-pane={pane} style={{ position:'absolute', opacity:0, pointerEvents:'none' }} />
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
            {BOOKING_URL && (
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noreferrer"
                className="mb-[2px] inline-flex w-full items-center justify-center px-3 py-2 rounded-full border bg-white text-slate-900 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] [font-family:var(--font-display)]"
                data-tour="book-onboarding"
              >Book onboarding</a>
            )}
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
      {showWelcome && createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" id="bvx-welcome-modal" style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div aria-hidden className="absolute inset-0 bg-black/20" onClick={async()=>{ setShowWelcome(false); try{ sessionStorage.setItem('bvx_welcome_seen','1'); }catch{}; try{ const tid = localStorage.getItem('bvx_tenant')||''; if (tid) await api.post('/settings', { tenant_id: tid, welcome_seen: true }); }catch{} }} />
          <div className="relative inline-block max-w-md w=[min(92vw,420px)] rounded-2xl border border-[var(--border)] p-6 shadow-soft text-center bvx-modal-card" style={{ backgroundColor:'#fff' }}>
            <div className="text-lg font-semibold text-ink-900">Welcome to brandVX</div>
            <div className="text-ink-700 text-sm mt-1">Let’s briefly walk through your different views.</div>
            <div className="mt-4 flex items-center justify-center">
              <button className="inline-flex rounded-xl px-5 py-2 bg-slate-900 text-white" onClick={async()=>{
                setShowWelcome(false);
                try{ sessionStorage.setItem('bvx_welcome_seen','1'); }catch{}
                try{ const tid = localStorage.getItem('bvx_tenant')||''; if (tid) await api.post('/settings', { tenant_id: tid, welcome_seen: true }); }catch{}
                try{
                  const sp = new URLSearchParams(window.location.search);
                  const returning = sp.get('postVerify') === '1' || sp.get('return') === 'workspace';
                  if (returning) {
                    // Default to Dashboard, no cross‑panel sequence on OAuth return
                    try {
                      const u = new URL(window.location.href);
                      u.pathname = '/workspace';
                      u.searchParams.set('pane','dashboard');
                      window.history.replaceState({}, '', u.toString());
                    } catch {}
                    startGuide('workspace_intro');
                  } else {
                    // Force Dashboard context before starting intro tour
                    try {
                      const u = new URL(window.location.href);
                      u.pathname = '/workspace';
                      u.searchParams.set('pane','dashboard');
                      window.history.replaceState({}, '', u.toString());
                    } catch {}
                    startGuide('workspace_intro');
                  }
                }catch{}
              }}>Start</button>
              {(() => {
                try{
                  const sp = new URLSearchParams(window.location.search);
                  const shouldHide = sp.get('postVerify') === '1' || sp.get('return') === 'workspace' || localStorage.getItem('bvx_onboarding_done') === '1';
                  if (shouldHide) return null;
                } catch {}
                return <a className="ml-2 inline-flex rounded-xl px-5 py-2 border bg-white hover:bg-slate-50" href="/onboarding">Go to onboarding</a>;
              })()}
            </div>
          </div>
        </div>, document.body)
      }
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
          <div aria-hidden className="absolute inset-0 bg-black/20" onClick={()=>{ setBillingOpen(false); try{ localStorage.setItem('bvx_billing_dismissed','1'); }catch{} }} />
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-5 shadow-soft">
            <div className="text-ink-900 text-lg font-semibold">Start your BrandVX</div>
            <div className="text-ink-700 text-sm mt-1">Choose a plan to unlock your workspace. You can change anytime.</div>
            <div className="mt-4 grid gap-2">
              <button disabled={billingLoading} onClick={async()=>{
                try { track('billing_trial_click'); } catch {}
                if (!PRICE_147) { setBillingOpen(false); window.location.href='/billing'; return; }
                setBillingLoading(true);
                try{
                  const r = await api.post('/billing/create-checkout-session', { price_id: PRICE_147, mode: 'subscription', trial_days: TRIAL_DAYS });
                  if (r?.url) window.location.href = r.url;
                } finally { setBillingLoading(false); }
              }} className="w-full rounded-xl border bg-gradient-to-b from-sky-50 to-sky-100 hover:from-sky-100 hover:to-sky-200 text-slate-900 px-4 py-3 text-sm text-left">
                <div className="font-medium">7‑day free trial → $147/mo</div>
                <div className="text-slate-600 text-xs">You’ll be reminded before any charge.</div>
              </button>
              <button disabled={billingLoading} onClick={async()=>{
                try { track('billing_97_click'); } catch {}
                if (!PRICE_97) { setBillingOpen(false); window.location.href='/billing'; return; }
                setBillingLoading(true);
                try{
                  try { localStorage.setItem('bvx_founding_member', '1'); } catch {}
                  const r = await api.post('/billing/create-checkout-session', { price_id: PRICE_97, mode: 'subscription' });
                  if (r?.url) window.location.href = r.url;
                } finally { setBillingLoading(false); }
              }} className="w-full rounded-xl border bg-white hover:shadow-sm text-slate-900 px-4 py-3 text-sm text-left">
                <div className="font-medium">$97 today → $97/mo (Founding price)</div>
                <div className="text-slate-600 text-xs">Lock in $97/mo now; recurring thereafter.</div>
              </button>
              <button className="w-full rounded-xl border bg-white hover:bg-slate-50 px-4 py-2 text-sm" onClick={()=>{ setBillingOpen(false); try{ localStorage.setItem('bvx_billing_dismissed','1'); }catch{} }}>Skip for now</button>
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
        <div className="fixed inset-0 z-[1200] grid place-items-center p-4">
          <div aria-hidden className="absolute inset-0 bg-black/20" />
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-5 shadow-soft text-center">
            <div className="text-ink-900 text-lg font-semibold">Trial ended</div>
            <div className="text-ink-700 text-sm mt-1">Add payment method to access your brandVX!</div>
            <div className="mt-3 flex gap-2 justify-center">
              <Button onClick={()=> nav('/billing')}>Add payment</Button>
              <Button variant="outline" onClick={()=> setTrialEndedOpen(false)}>Later</Button>
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
