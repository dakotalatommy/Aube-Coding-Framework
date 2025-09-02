import React, { Suspense, lazy, useMemo, useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { setQueryParams } from '../lib/url';
import { Home, MessageSquare, Users, Calendar, Layers, Package2, Plug, CheckCircle2, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { startGuide } from '../lib/guide';
import { track } from '../lib/analytics';
import { UI_STRINGS } from '../lib/strings';
// import PaneManager from './pane/PaneManager';
import { registerActions, registerMessageBridge } from '../lib/actions';

type PaneKey = 'dashboard' | 'messages' | 'contacts' | 'calendar' | 'cadences' | 'inventory' | 'integrations' | 'approvals' | 'workflows' | 'askvx';

const PANES: { key: PaneKey; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <Home size={18} /> },
  { key: 'messages', label: 'Messages', icon: <MessageSquare size={18} /> },
  { key: 'contacts', label: 'Contacts', icon: <Users size={18} /> },
  { key: 'calendar', label: 'Calendar', icon: <Calendar size={18} /> },
  { key: 'cadences', label: 'Follow‑ups', icon: <Layers size={18} /> },
  { key: 'inventory', label: 'Inventory', icon: <Package2 size={18} /> },
  { key: 'integrations', label: 'Settings/Connections', icon: <Plug size={18} /> },
  { key: 'workflows', label: 'Work Styles', icon: <Layers size={18} /> },
  { key: 'approvals', label: 'Approvals', icon: <CheckCircle2 size={18} /> },
  { key: 'askvx', label: 'Ask VX', icon: <MessageCircle size={18} /> },
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
  const [showDemoWelcome, setShowDemoWelcome] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showOnboardingPrompt, setShowOnboardingPrompt] = useState(false);

  // Workspace billing gate: open modal if not trialing/active
  useEffect(()=>{
    (async()=>{
      try{
        // Auth guard with tolerant resolver to avoid bounce loop
        if (!demo) {
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
        const sp = new URLSearchParams(loc.search);
        if (sp.get('billing') === 'success') {
          try { track('billing_success'); } catch {}
          try { localStorage.setItem('bvx_billing_dismissed','1'); } catch {}
          setBillingOpen(false);
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
        if (!covered && !dismissed) { setBillingOpen(true); try { track('billing_modal_open'); } catch {} }
        try {
          const doneServer = Boolean(r?.data?.onboarding_done);
          if (doneServer) { try { localStorage.setItem('bvx_onboarding_done','1'); } catch {} }
        } catch {}

        // Show welcome if onboarding not completed (suppress in demo)
        try {
          const doneLocal = localStorage.getItem('bvx_onboarding_done') === '1';
          const seenSession = sessionStorage.getItem('bvx_welcome_seen') === '1';
          const introFlag2 = localStorage.getItem('bvx_intro_pending') === '1';
          if (introFlag2) { try{ localStorage.removeItem('bvx_intro_pending'); }catch{} }
          if (!demo && (forceWelcome || introFlag2 || (!doneLocal && !seenSession))) {
            setTimeout(()=> setShowWelcome(true), 200);
          }
        } catch {}
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.search]);

  // Demo: suppress welcome entirely
  useEffect(()=>{
    try{ if (demo) setShowDemoWelcome(false); } catch {}
  }, [demo]);

  const setPane = (key: PaneKey) => {
    setQueryParams({ pane: key }, { replace: false, pathname: '/workspace' });
  };

  const toggleDemo = () => {
    const shouldOn = !demo;
    const baseParams: Record<string,string|number|boolean> = { pane: (pane||'dashboard') };
    if (shouldOn) baseParams.demo = 1; else baseParams.demo = '' as any;
    setQueryParams(baseParams, { replace: false, pathname: '/workspace' });
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
      case 'askvx': return <LazyAsk/>;
      default: return <div/>;
    }
  })();
  // When welcome opens, force viewport to top to ensure centered overlay
  useEffect(()=>{
    if (showWelcome) {
      try { window.scrollTo(0,0); } catch {}
    }
  }, [showWelcome]);

  const items = useMemo(()=> PANES, []);
  const [approvalsCount, setApprovalsCount] = useState<number>(0);
  useEffect(()=>{
    (async()=>{
      try{
        const sp = new URLSearchParams(loc.search);
        const isDemo = sp.get('demo')==='1';
        if (isDemo) { setApprovalsCount(0); return; }
        const tid = localStorage.getItem('bvx_tenant')||'';
        if (!tid) { setApprovalsCount(0); return; }
        const r = await api.get(`/approvals?tenant_id=${encodeURIComponent(tid)}`);
        const arr = Array.isArray(r) ? r : (r?.items||[]);
        const pending = (arr||[]).filter((x:any)=> String(x?.status||'pending')==='pending').length;
        setApprovalsCount(pending);
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
      'nav.styles': { id:'nav.styles', run: ()=> setPane('workflows') },
      'nav.askvx': { id:'nav.askvx', run: ()=> setPane('askvx') },
      'guide.dashboard': { id:'guide.dashboard', run: ()=> startGuide('dashboard') },
      'guide.integrations': { id:'guide.integrations', run: ()=> startGuide('integrations') },
      'guide.workflows': { id:'guide.workflows', run: ()=> startGuide('workflows') },
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
          if (!demo) {
            setShowWelcome(true);
            try { localStorage.setItem(shownKey, '1'); } catch {}
          }
        }
      } catch {}
    })();
  }, [loc.pathname]);

  // After workspace intro finishes, show onboarding prompt and persist seen
  useEffect(()=>{
    const handler = async () => {
      try {
        const uid = (await supabase.auth.getSession()).data.session?.user?.id;
        if (uid) localStorage.setItem(`bvx_intro_seen_${uid}`, '1');
      } catch {}
      setShowOnboardingPrompt(true);
    };
    window.addEventListener('bvx:guide:workspace_intro:done', handler, { once: true } as any);
    return () => window.removeEventListener('bvx:guide:workspace_intro:done', handler as any);
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="h-[100dvh] grid grid-cols-[theme(spacing.56)_1fr] gap-4 md:gap-5 overflow-hidden pb-[calc(var(--bvx-commandbar-height,64px)+env(safe-area-inset-bottom,0px))] relative md:[--sticky-offset:88px] [--sticky-offset:70px]">
        {/* Left dock */}
        <aside className="h-full min-h-0 bg-white/70 backdrop-blur border border-b-0 rounded-2xl p-3 md:p-4 flex flex-col relative" aria-label="Primary navigation">
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
                  data-tour={`nav-${p.key}`}
                  className={`relative w-full flex items-center gap-3 pl-4 pr-3 py-2 rounded-xl border text-slate-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white hover:bg-white hover:ring-1 hover:ring-pink-100 ${active?'bg-gradient-to-r from-pink-50 to-white shadow ring-1 ring-pink-100 text-slate-900':''}`}
                >
                  {active && <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-pink-400 to-violet-400 rounded-l-xl" />}
                  <span className="shrink-0">{p.icon}</span>
                  <span className="text-sm">{p.label}</span>
                  {p.key==='approvals' && approvalsCount>0 && (
                    <span aria-label={`${approvalsCount} pending`} className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] px-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">{approvalsCount}</span>
                  )}
                  <span className="ml-auto text-[10px] text-slate-400">{i+1}</span>
                </button>
              );
            })}
          </nav>
          {/* Anchored footer */}
          <div className="absolute left-3 right-3" style={{ bottom: 'calc(var(--bvx-commandbar-height,64px) + env(safe-area-inset-bottom,0px) + 18px)' }}>
            {demo && (
              <button
                className={`mb-2 inline-flex w-full items-center justify-center px-3 py-2 rounded-xl border bg-amber-50 text-amber-800 border-amber-200`}
                onClick={toggleDemo}
                data-tour="demo-toggle"
              >Demo mode: on</button>
            )}
            {BOOKING_URL && (
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noreferrer"
                className="mb-2 inline-flex w-full items-center justify-center px-3 py-2 rounded-xl border bg-white text-slate-700 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/60"
                data-tour="book-onboarding"
              >Book onboarding</a>
            )}
            <button
              className="w-full pl-4 pr-3 py-2 rounded-xl border text-slate-700 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/60 text-left"
              data-guide={new URLSearchParams(loc.search).get('demo')==='1' ? 'demo-signup' : undefined}
              data-tour="signup"
              onClick={async()=>{
                const sp = new URLSearchParams(loc.search);
                const isDemo = sp.get('demo') === '1';
                if (isDemo) {
                  window.location.href = '/signup';
                  return;
                }
                try { localStorage.setItem('bvx_signed_out','1'); } catch {}
                try { await supabase.auth.signOut(); } catch {}
                try { localStorage.removeItem('bvx_tenant'); localStorage.removeItem('bvx_demo_profile'); localStorage.removeItem('bvx_demo_preferences'); } catch {}
                window.location.href = '/brandvx';
              }}
            >{new URLSearchParams(loc.search).get('demo')==='1' ? UI_STRINGS.ctas.demoOnly.signUp : UI_STRINGS.ctas.liveOnly.signOut}</button>
          </div>
        </aside>
        {/* Canvas */}
        <main className={`h-full rounded-2xl border border-b-0 border-l-slate-300/80 ${demo? 'bg-amber-50/60' : 'bg-white/90'} backdrop-blur p-4 md:p-5 shadow-sm overflow-hidden border-l relative`}>
          <div className="rounded-xl bg-white/70 backdrop-blur overflow-hidden min-h-full">
            <Suspense fallback={<div className="p-4 text-slate-600 text-sm">Loading {PANES.find(p=>p.key===pane)?.label}…</div>}>
              {PaneView}
            </Suspense>
          </div>
          {/* Bottom hard separator just above Command Bar */}
          <div aria-hidden className="sticky left-0 right-0" style={{ bottom: 'calc(var(--bvx-commandbar-height,64px) + env(safe-area-inset-bottom,0px))', top: 'var(--sticky-offset)' }}>
            <div className="h-0.5 w-full bg-slate-800/70" />
          </div>
        </main>
        {/* Arrows removed per product decision */}
      </div>
      {showDemoWelcome && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div aria-hidden className="absolute inset-0 bg-black/30" onClick={()=>{ setShowDemoWelcome(false); try{ sessionStorage.setItem('bvx_demo_welcome_seen','1'); }catch{} }} />
          <div className="relative w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl">
            <div className="text-slate-900 text-lg font-semibold">Welcome to the BrandVX demo</div>
            <div className="text-slate-600 text-sm mt-1">We’ll show each panel briefly. Use “Guide me” on any page for a quick walkthrough.</div>
            <div className="mt-4 flex gap-2 justify-end">
              <button className="rounded-full px-3 py-2 border" onClick={()=>{ setShowDemoWelcome(false); try{ sessionStorage.setItem('bvx_demo_welcome_seen','1'); }catch{} }}>Got it</button>
              <button className="rounded-full px-3 py-2 bg-slate-900 text-white" onClick={()=>{ try{ sessionStorage.setItem('bvx_demo_welcome_seen','1'); }catch{}; setShowDemoWelcome(false); try{ startGuide('dashboard'); } catch {} }}>Start guide</button>
            </div>
          </div>
        </div>
      )}
      {demo && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="flex gap-2 items-center rounded-full border bg-white/90 backdrop-blur px-3 py-2 shadow">
            <span className="text-xs text-amber-800 bg-amber-100 rounded-full px-2 py-0.5 border border-amber-200">Demo</span>
            <a href="/signup" className="text-sm px-3 py-1.5 rounded-full bg-slate-900 text-white">Create account</a>
          </div>
        </div>
      )}
      {showWelcome && createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" id="bvx-welcome-modal" style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div aria-hidden className="absolute inset-0 bg-black/30" onClick={()=>{ setShowWelcome(false); try{ sessionStorage.setItem('bvx_welcome_seen','1'); }catch{} }} />
          <div className="relative inline-block max-w-md w-[min(92vw,420px)] rounded-2xl border bg-white p-6 shadow-xl text-center">
            <div className="text-lg font-semibold text-slate-900">Welcome to brandVX</div>
            <div className="text-slate-700 text-sm mt-1">Let’s briefly walk through your different views.</div>
            <div className="mt-4 flex items-center justify-center">
              <button className="inline-flex rounded-full px-5 py-2 bg-slate-900 text-white" onClick={()=>{ setShowWelcome(false); try{ sessionStorage.setItem('bvx_welcome_seen','1'); }catch{}; try{ startGuide('workspace_intro'); }catch{} }}>Start</button>
            </div>
          </div>
        </div>, document.body)
      }
      {showOnboardingPrompt && createPortal(
        <div className="fixed inset-0 z-[1000] grid place-items-center p-4" id="bvx-onboarding-modal" style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:1000,display:'grid',alignItems:'center',justifyItems:'center'}}>
          <div aria-hidden className="absolute inset-0 bg-black/30" onClick={()=> setShowOnboardingPrompt(false)} />
          <div className="relative w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl text-center">
            <div className="text-lg font-semibold text-slate-900">Let’s set up your Priority Work Styles</div>
            <div className="text-slate-700 text-sm mt-1">Full walkthrough will walk the visible sections and show them to click.</div>
            <div className="mt-4 grid gap-2">
              <a className="rounded-full px-5 py-2 text-white bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600" href="/workspace?pane=workflows">Open Work Styles</a>
              <button className="rounded-full px-5 py-2 border" onClick={()=> setShowOnboardingPrompt(false)}>Later</button>
            </div>
          </div>
        </div>, document.body)
      }
      {/* Billing modal */}
      {billingOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div aria-hidden className="absolute inset-0 bg-black/20" onClick={()=>{ setBillingOpen(false); try{ localStorage.setItem('bvx_billing_dismissed','1'); }catch{} }} />
          <div className="relative w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl">
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
const LazyAsk = lazy(()=> import('../pages/Ask'));
// Onboarding is now a standalone route (not a workspace pane)


