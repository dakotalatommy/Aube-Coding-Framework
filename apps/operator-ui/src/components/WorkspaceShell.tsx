import React, { Suspense, lazy, useMemo, useRef, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, MessageSquare, Users, Calendar, Layers, Package2, Plug, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { track } from '../lib/analytics';

type PaneKey = 'dashboard' | 'messages' | 'contacts' | 'calendar' | 'cadences' | 'inventory' | 'integrations' | 'approvals' | 'workflows' | 'onboarding';

const PANES: { key: PaneKey; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <Home size={18} /> },
  { key: 'messages', label: 'Messages', icon: <MessageSquare size={18} /> },
  { key: 'contacts', label: 'Contacts', icon: <Users size={18} /> },
  { key: 'calendar', label: 'Calendar', icon: <Calendar size={18} /> },
  { key: 'cadences', label: 'Cadences', icon: <Layers size={18} /> },
  { key: 'inventory', label: 'Inventory', icon: <Package2 size={18} /> },
  { key: 'integrations', label: 'Integrations', icon: <Plug size={18} /> },
  { key: 'workflows', label: 'Workflows', icon: <Layers size={18} /> },
  { key: 'onboarding', label: 'Onboarding', icon: <CheckCircle2 size={18} /> },
  { key: 'approvals', label: 'Approvals', icon: <CheckCircle2 size={18} /> },
];

export default function WorkspaceShell(){
  const loc = useLocation();
  const nav = useNavigate();
  const params = new URLSearchParams(loc.search);
  const pane = (params.get('pane') as PaneKey) || 'dashboard';
  const demo = params.get('demo') === '1';
  const BOOKING_URL = (import.meta as any).env?.VITE_BOOKING_URL || '';
  const PRICE_147 = (import.meta as any).env?.VITE_STRIPE_PRICE_147 || '';
  const PRICE_97 = (import.meta as any).env?.VITE_STRIPE_PRICE_97 || '';
  const TRIAL_DAYS = Number((import.meta as any).env?.VITE_STRIPE_TRIAL_DAYS || '7');

  const [billingOpen, setBillingOpen] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingStatus, setBillingStatus] = useState<string>('');

  // Workspace billing gate: open modal if not trialing/active
  useEffect(()=>{
    (async()=>{
      try{
        // Auth guard: if not signed in and not explicitly demo, bounce to signup
        if (!demo) {
          const session = (await supabase.auth.getSession()).data.session;
          if (!session) {
            nav('/signup');
            return;
          }
        }
        const sp = new URLSearchParams(loc.search);
        if (sp.get('billing') === 'success') {
          try { track('billing_success'); } catch {}
          try { localStorage.setItem('bvx_billing_dismissed','1'); } catch {}
          setBillingOpen(false);
          return;
        }
        const dismissed = localStorage.getItem('bvx_billing_dismissed') === '1';
        const r = await api.get('/settings');
        const status = String(r?.data?.subscription_status || '');
        setBillingStatus(status);
        const covered = status === 'active' || status === 'trialing';
        if (!covered && !dismissed) { setBillingOpen(true); try { track('billing_modal_open'); } catch {} }
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.search]);

  const setPane = (key: PaneKey) => {
    const next = new URLSearchParams(loc.search);
    next.set('pane', key);
    nav(`/workspace?${next.toString()}`);
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
      case 'workflows': return <LazyWorkflows/>;
      case 'onboarding': return <LazyOnboardingStepper/>;
      default: return <div/>;
    }
  })();

  const items = useMemo(()=> PANES, []);
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
  };

  return (
    <div className="max-w-6xl mx-auto supports-[padding:env(safe-area-inset-bottom)]:pb-[env(safe-area-inset-bottom)]">
      <div className="h-[calc(100vh-140px)] grid grid-cols-[theme(spacing.56)_1fr] gap-4 md:gap-5 overflow-hidden">
        {/* Left dock */}
        <aside className="h-full bg-white/70 backdrop-blur border rounded-2xl p-3 md:p-4 flex flex-col" aria-label="Primary navigation">
          <nav className="flex flex-col gap-2" role="tablist" aria-orientation="vertical" onKeyDown={onKeyDown}>
            {items.map((p, i) => {
              const active = pane===p.key;
              return (
                <button
                  key={p.key}
                  ref={el=>{ if (el) refs.current[i]=el; }}
                  onClick={()=>setPane(p.key)}
                  role="tab"
                  aria-selected={active}
                  aria-current={active ? 'page' : undefined}
                  title={`${p.label}  •  ${i+1}`}
                  className={`relative w-full flex items-center gap-3 pl-4 pr-3 py-2 rounded-xl border text-slate-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white hover:bg-white hover:ring-1 hover:ring-pink-100 ${active?'bg-gradient-to-r from-pink-50 to-white shadow ring-1 ring-pink-100 text-slate-900':''}`}
                >
                  {active && <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-pink-400 to-violet-400 rounded-l-xl" />}
                  <span className="shrink-0">{p.icon}</span>
                  <span className="text-sm">{p.label}</span>
                  <span className="ml-auto text-[10px] text-slate-400">{i+1}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto pt-3">
            {BOOKING_URL && (
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noreferrer"
                className="mb-2 inline-flex w-full items-center justify-center px-3 py-2 rounded-xl border bg-white text-slate-700 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/60"
              >Book onboarding</a>
            )}
            <button
              className="w-full px-3 py-2 rounded-xl border text-slate-700 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/60"
              onClick={async()=>{
                try { localStorage.setItem('bvx_signed_out','1'); } catch {}
                try { await supabase.auth.signOut(); } catch {}
                try { localStorage.removeItem('bvx_tenant'); localStorage.removeItem('bvx_demo_profile'); localStorage.removeItem('bvx_demo_preferences'); } catch {}
                window.location.href = '/brandvx';
              }}
            >Sign out</button>
          </div>
        </aside>
        {/* Canvas */}
        <main className={`h-full rounded-2xl border ${demo? 'bg-amber-50/60' : 'bg-white/90'} backdrop-blur p-4 md:p-5 shadow-sm overflow-hidden pb-[var(--ask-float-height)]`}>
          <div className="h-full rounded-xl bg-white/70 backdrop-blur border overflow-auto">
            <Suspense fallback={<div className="p-4 text-slate-600 text-sm">Loading {PANES.find(p=>p.key===pane)?.label}…</div>}>
              {PaneView}
            </Suspense>
          </div>
        </main>
      </div>
      {demo && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="flex gap-2 items-center rounded-full border bg-white/90 backdrop-blur px-3 py-2 shadow">
            <span className="text-xs text-amber-800 bg-amber-100 rounded-full px-2 py-0.5 border border-amber-200">Demo</span>
            <a href="/signup" className="text-sm px-3 py-1.5 rounded-full bg-slate-900 text-white">Create account</a>
          </div>
        </div>
      )}
      {/* Billing modal */}
      {billingOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div aria-hidden className="absolute inset-0 bg-black/20" onClick={()=>{ setBillingOpen(false); try{ localStorage.setItem('bvx_billing_dismissed','1'); }catch{} }} />
          <div className="relative w-full max-w-md rounded-2xl border bg-white/95 backdrop-blur p-5 shadow-xl">
            <div className="text-slate-900 text-lg font-semibold">Start your BrandVX</div>
            <div className="text-slate-600 text-sm mt-1">Choose a plan to unlock your workspace. You can change anytime.</div>
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
              <button className="w-full rounded-xl border bg-white px-4 py-2 text-sm" onClick={()=>{ setBillingOpen(false); try{ localStorage.setItem('bvx_billing_dismissed','1'); }catch{} }}>Skip for now</button>
            </div>
            <div className="text-[11px] text-slate-500 mt-2">Status: {billingStatus||'unavailable'}</div>
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
const LazyWorkflows = lazy(()=> import('../pages/Workflows'));
const LazyOnboardingStepper = lazy(()=> import('./OnboardingStepper'));


