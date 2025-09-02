import { useEffect, useState } from 'react';
import { api, getTenant, API_BASE } from '../lib/api';
import { setQueryParams } from '../lib/url';
import { track } from '../lib/analytics';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { UI_STRINGS } from '../lib/strings';
import { useToast } from '../components/ui/Toast';

export default function Integrations(){
  const { showToast } = useToast();
  // Single-page integrations view (no step pager)
  const sp = (()=>{ try { return new URLSearchParams(window.location.search); } catch { return new URLSearchParams(); } })();
  const providerFromURL = (()=>{ try{ return (sp.get('provider')||'').toLowerCase(); } catch { return ''; } })();
  const returnHint = (()=>{ try{ return (sp.get('return')||''); } catch { return ''; } })();
  const [focusedProvider] = useState<string>(providerFromURL);
  const PAGE_MAX = 3;
  const initialStep = (()=>{ try{ const n = parseInt(new URLSearchParams(window.location.search).get('step')||'1',10); return Math.min(Math.max(n,1), PAGE_MAX); } catch { return 1; } })();
  const [page, setPage] = useState<number>(initialStep);
  const go = (n: number) => {
    const clamped = Math.min(Math.max(n,1), PAGE_MAX);
    setPage(clamped);
    setQueryParams({ pane:'integrations', step: clamped }, { replace: true, pathname: '/workspace' });
  };
  const SOCIAL_ON = (import.meta as any).env?.VITE_FEATURE_SOCIAL === '1';
  const SHOW_REDIRECT_URIS = ((import.meta as any).env?.VITE_SHOW_REDIRECT_URIS === '1') || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev'));
  const DEV_MODE = (()=>{ try{ return new URLSearchParams(window.location.search).has('dev'); } catch { return false; } })();
  const [settings, setSettings] = useState<any>({ tone:'helpful', services:['sms','email'], auto_approve_all:false, quiet_hours:{ start:'21:00', end:'08:00' }, brand_profile:{ name:'', voice:'', about:'' }, metrics:{ monthly_revenue:'', avg_service_price:'', avg_service_time:'', rent:'' }, goals:{ primary_goal:'' }, preferences:{} });
  const isDemo = (()=>{ try{ return new URLSearchParams(window.location.search).get('demo')==='1'; } catch { return false; } })();
  const [status, setStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [onboarding, setOnboarding] = useState<any>({ connected:false, first_sync_done:false, counts:{}, connectedMap:{}, providers:{} });
  const [squareLink, setSquareLink] = useState<string>('');
  const [redirects, setRedirects] = useState<any>(null);
  const [twilioArea, setTwilioArea] = useState<string>('');
  const [twilioFrom, setTwilioFrom] = useState<string>('');
  const [connAccounts, setConnAccounts] = useState<Array<{provider:string,status?:string,ts?:number}>>([]);
  const [lastCallback, setLastCallback] = useState<any>(null);
  const [linked, setLinked] = useState<Record<string, boolean>>({});
  const [lastSync, setLastSync] = useState<Record<string, number>>({});
  const [providerStatus, setProviderStatus] = useState<Record<string, { linked:boolean; status?:string; expires_at?:number; last_sync?:number }>>({});
  const nowSec = Math.floor(Date.now()/1000);
  const fmtTs = (ts?: number) => (ts && ts>0) ? new Date(Number(ts)*1000).toLocaleString() : '';
  const expSoon = (p: string) => {
    const ex = Number(providerStatus?.[p]?.expires_at||0);
    return ex>0 && (ex - nowSec) < (7*24*3600);
  };
  const [events, setEvents] = useState<Array<{name:string;ts:number;payload?:any}>>([]);
  const loadEvents = async () => {
    try{
      const tid = await getTenant();
      const r = await api.get(`/integrations/events?tenant_id=${encodeURIComponent(tid)}&limit=50`);
      setEvents(Array.isArray(r?.items)? r.items: []);
    }catch{}
  };

  const isConnected = (provider: string): boolean => {
    try {
      const map = onboarding?.connectedMap || {};
      if (map && typeof map[provider] === 'string') return String(map[provider]) === 'connected';
      if (linked && typeof linked[provider] === 'boolean') return !!linked[provider];
      if (Array.isArray(connAccounts)) return connAccounts.some(x => (x?.provider||'') === provider);
    } catch {}
    return false;
  };
  const isLive = (provider: string): boolean => {
    try { return !!(settings?.providers_live||{})[provider]; } catch { return false; }
  };
  const isConnectedAny = (providers: string[]): boolean => {
    try { return providers.some(p=> isConnected(p)); } catch { return false; }
  };
  const shouldShow = (providers: string | string[]): boolean => {
    try{
      if (DEV_MODE) return true;
      const arr = Array.isArray(providers) ? providers : [providers];
      return arr.some(p=> isLive(p)) || isConnectedAny(arr);
    } catch { return true; }
  };

  const connectLabel = (provider: string) => isConnected(provider) ? `Reconnect ${provider.charAt(0).toUpperCase()+provider.slice(1)}` : `Connect ${provider.charAt(0).toUpperCase()+provider.slice(1)}`;
  const reanalyze = async () => {
    try{
      const a = await api.post('/onboarding/analyze', { tenant_id: await getTenant() });
      setOnboarding({ ...a?.summary, connectedMap: a?.summary?.connected || {}, providers: a?.summary?.providers || {} });
      const ts = new Date();
      setStatus(`Re‑analyzed at ${ts.toLocaleTimeString()}`);
      try { showToast({ title:'Re‑analyzed', description: ts.toLocaleTimeString() }); } catch {}
      try{
        const tid = await getTenant();
        if (tid) {
          const ca = await api.get(`/integrations/connected-accounts?tenant_id=${encodeURIComponent(tid)}`);
          setConnAccounts(Array.isArray(ca?.items)? ca.items: []);
          setLastCallback(ca?.last_callback || null);
          // New status endpoint for per-provider linked badges
          try {
            const st = await api.get(`/integrations/status?tenant_id=${encodeURIComponent(tid)}`);
            const provs = (st?.providers||{}) as Record<string, { linked:boolean; status?:string; expires_at?:number; last_sync?:number }>;
            const nextLinked: Record<string, boolean> = {};
            const nextSync: Record<string, number> = {};
            Object.entries(provs).forEach(([k,v])=>{
              nextLinked[k] = !!v?.linked;
              const ls = Number(v?.last_sync||0);
              if (ls>0) nextSync[k] = ls;
            });
            setLinked(nextLinked);
            setLastSync(nextSync);
            setProviderStatus(provs);
            if (!lastCallback && st?.last_callback) setLastCallback(st.last_callback);
          } catch {}
        }
      }catch{}
    } catch(e:any){ setStatus(String(e?.message||e)); }
  };

  // (removed troubleshooting preflight UI)

  useEffect(()=>{
    (async()=>{
      try{
        const r = await api.get(`/settings?tenant_id=${encodeURIComponent(await getTenant())}`);
        setSettings({ auto_approve_all:false, providers_live:{}, ...(r?.data||{}) });
      }catch{}
      try{
        const a = await api.post('/onboarding/analyze', { tenant_id: await getTenant() });
        setOnboarding({ ...a?.summary, connectedMap: a?.summary?.connected || {}, providers: a?.summary?.providers || {} });
      }catch{}
      try{
        const tid = await getTenant();
        if (tid) {
          const ca = await api.get(`/integrations/connected-accounts?tenant_id=${encodeURIComponent(tid)}`);
          setConnAccounts(Array.isArray(ca?.items)? ca.items: []);
          setLastCallback(ca?.last_callback || null);
        }
      }catch{}
      // (removed troubleshooting preflight UI)
      try{
        const l = await api.get(`/integrations/booking/square/link?tenant_id=${encodeURIComponent(await getTenant())}`);
        setSquareLink(l?.url||'');
      }catch{}
      // Best-effort retry for Square link if empty
      try{
        setTimeout(async()=>{
          if (!squareLink) {
            try{
              const l2 = await api.get(`/integrations/booking/square/link?tenant_id=${encodeURIComponent(await getTenant())}`);
              if (l2?.url) setSquareLink(l2.url);
            }catch{}
          }
        }, 1500);
      } catch {}
      try{
        const rj = await api.get('/integrations/redirects');
        setRedirects(rj);
      }catch{
        // Client-side fallback when backend endpoint isn't reachable in test/demo
        try{
          const baseApi = API_BASE;
          const baseApp = (typeof window !== 'undefined') ? window.location.origin : '';
          setRedirects({
            oauth: {
              google: `${baseApi}/oauth/google/callback`,
              apple: `${baseApi}/oauth/apple/callback`,
              square: `${baseApi}/oauth/square/callback`,
              acuity: `${baseApi}/oauth/acuity/callback`,
              hubspot: `${baseApi}/oauth/hubspot/callback`,
              facebook: `${baseApi}/oauth/facebook/callback`,
              instagram: `${baseApi}/oauth/instagram/callback`,
              shopify: `${baseApi}/oauth/shopify/callback`,
            },
            webhooks: { stripe: `${baseApi}/billing/webhook` },
            post_auth_redirect: { supabase_email: `${baseApp}/onboarding?offer=1` },
          });
        } catch {}
      }
      try{
        if (new URLSearchParams(window.location.search).has('dev')) await loadEvents();
      }catch{}
    })();
  },[]);

  // Focused provider mode: when returning from OAuth, jump to that section and optionally auto-return
  useEffect(()=>{
    try{
      const connected = sp.get('connected') === '1';
      const error = sp.get('error') || '';
      if (focusedProvider && connected) {
        try { showToast({ title: `${focusedProvider.charAt(0).toUpperCase()+focusedProvider.slice(1)} connected` }); } catch {}
        // Auto re-analyze so badges update immediately
        reanalyze();
        if (returnHint === 'workspace') {
          setTimeout(()=>{ try{ window.history.replaceState({}, '', '/workspace?pane=integrations'); }catch{} }, 1200);
        }
      } else if (focusedProvider && error) {
        try { showToast({ title: `${focusedProvider} connection failed`, description: error }); } catch {}
      }
    } catch{}
  }, [focusedProvider]);

  // Optional deep-link tour to Twilio card
  useEffect(()=>{
    try{
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('tour') === 'twilio') {
        const d = driver({
          showProgress: true,
          steps: [
            { popover: { title: 'SMS via Twilio', description: 'Use a dedicated business number. Personal numbers are not supported yet.' } },
            { element: '[data-guide="twilio"]', popover: { title: 'Twilio SMS', description: 'Connect a Twilio number for outbound/inbound SMS. Porting personal numbers will come later.' } },
          ]
        } as any);
        d.drive();
      }
    } catch {}
  },[]);

  useEffect(()=>{
    try{
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('tour') === '1') {
        const d = driver({
          showProgress: true,
          steps: [
            { popover: { title: 'Integrations', description: 'Connect booking, CRM, messaging, and inventory.' } },
            { element: '[data-guide="providers"]', popover: { title: 'Providers', description: 'Each card shows connection status and actions.' } },
            { element: '[data-guide="twilio"]', popover: { title: 'SMS via Twilio', description: 'Use a dedicated business number. Personal numbers are not supported yet.' } },
          ]
        } as any);
        d.drive();
      }
    } catch {}
  },[]);

  const save = async () => {
    try{
      setBusy(true);
      const prefs = { ...(settings.preferences||{}), user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, user_timezone_offset: computeOffsetHours() };
      const r = await api.post('/settings',{ tenant_id: await getTenant(), ...settings, preferences: prefs });
      setStatus(JSON.stringify(r));
      try { showToast({ title:'Settings saved', description:'Settings saved successfully' }); } catch {}
      try { localStorage.setItem('bvx_onboarding_done','1'); } catch {}
    }
    catch(e:any){ setStatus(String(e?.message||e)); }
    finally{ setBusy(false); }
  };

  // Toggle a provider between Demo and Live directly from the card
  const setProviderLive = async (provider: string, live: boolean) => {
    try {
      setSettings((s:any)=> ({ ...s, providers_live: { ...(s.providers_live||{}), [provider]: live } }));
      await api.post('/settings', { tenant_id: await getTenant(), providers_live: { ...(settings.providers_live||{}), [provider]: live } });
      try { showToast({ title: 'Mode updated', description: `${provider}: ${live ? 'Live' : 'Demo'}` }); } catch {}
    } catch(e:any) {
      setErrorMsg(String(e?.message||e));
    }
  };

  const computeOffsetHours = () => {
    try {
      const minutes = new Date().getTimezoneOffset(); // minutes behind UTC
      return Math.round((-minutes) / 60);
    } catch { return 0; }
  };
  const sendTestSms = async () => {
    try{ setBusy(true); const r = await api.post('/ai/tools/execute',{ tenant_id: await getTenant(), name: 'messages.send', params: { tenant_id: await getTenant(), contact_id:'c_demo', channel:'sms', body:'Test SMS from BrandVX (reply STOP/HELP to opt out)' }, require_approval: false }); setStatus(JSON.stringify(r)); try { showToast({ title:'Test SMS sent', description:'Test SMS sent successfully' }); } catch {} }
    catch(e:any){ setStatus(String(e?.message||e)); }
    finally{ setBusy(false); }
  };
  const sendTestEmail = async () => {
    try{ setBusy(true); const r = await api.post('/ai/tools/execute',{ tenant_id: await getTenant(), name: 'messages.send', params: { tenant_id: await getTenant(), contact_id:'c_demo', channel:'email', subject:'BrandVX Test', body:'<p>Hello from BrandVX</p>' }, require_approval: false }); setStatus(JSON.stringify(r)); try { showToast({ title:'Test email sent', description:'Test email sent successfully' }); } catch {} }
    catch(e:any){ setStatus(String(e?.message||e)); }
    finally{ setBusy(false); }
  };
  const fmt12 = (v?: string) => {
    try{
      if (!v) return '';
      const [h,m] = String(v).split(':').map((x)=> parseInt(x,10));
      const am = (h||0) < 12;
      const hr = (((h||0) % 12) || 12);
      return `${hr}:${String(m||0).padStart(2,'0')} ${am ? 'AM':'PM'}`;
    } catch { return String(v||''); }
  };
  const saveTraining = async () => {
    try{
      setBusy(true);
      const r = await api.post('/settings', { tenant_id: await getTenant(), training_notes: settings.training_notes||'' });
      setStatus(JSON.stringify(r));
      try { showToast({ title:'Saved', description:'Training notes saved' }); } catch {}
    } catch(e:any){ setStatus(String(e?.message||e)); }
    finally{ setBusy(false); }
  };
  const enableSms = async () => {
    try{
      setBusy(true);
      const r = await api.post('/integrations/twilio/provision', { tenant_id: await getTenant(), area_code: '' });
      setStatus(JSON.stringify(r));
      if (r?.status === 'ok') { setStatus('SMS enabled: ' + (r?.from || '')); try { showToast({ title:'SMS enabled', description: r?.from||'' }); } catch {} }
      else setErrorMsg(r?.detail||r?.status||'Enable failed');
    } catch(e:any){ setErrorMsg(String(e?.message||e)); }
    finally{ setBusy(false); }
  };

  const hubspotUpsertSample = async () => {
    try{
      setBusy(true);
      const r = await api.post('/integrations/crm/hubspot/upsert', {
        tenant_id: await getTenant(),
        obj_type:'contact',
        attrs:{ email:'demo@example.com', firstName:'Demo', lastName:'User' },
        idempotency_key:'demo_contact_1'
      });
      setStatus(JSON.stringify(r));
      try { showToast({ title:'HubSpot sample synced', description:'HubSpot sample contact synced' }); } catch {}
    } catch(e:any){ setStatus(String(e?.message||e)); }
    finally{ setBusy(false); }
  };

  const hubspotImportContacts = async () => {
    try{
      setBusy(true);
      const r = await api.post('/crm/hubspot/import', { tenant_id: await getTenant() });
      const c = Number(r?.imported||0);
      setStatus(`HubSpot import: ${c} contacts`);
      try { showToast({ title:'HubSpot import', description: `${c} contacts imported` }); } catch {}
    } catch(e:any){ setErrorMsg(String(e?.message||e)); }
    finally{ setBusy(false); }
  };

  const calendarSync = async (prov: string) => {
    try{
      setBusy(true);
      const r = await api.post('/calendar/sync', { tenant_id: await getTenant(), provider: prov });
      setStatus(`Calendar sync (${prov}): ${r?.status||'done'}`);
      try { showToast({ title:'Calendar sync', description: prov }); } catch {}
    }catch(e:any){ setErrorMsg(String(e?.message||e)); }
    finally{ setBusy(false); }
  };

  const calendarMerge = async () => {
    try{
      setBusy(true);
      const r = await api.post('/calendar/merge', { tenant_id: await getTenant() });
      const m = Number(r?.merged||0);
      setStatus(`Calendar merged: ${m} duplicates dropped`);
      try { showToast({ title:'Calendar merged', description: `${m} drops` }); } catch {}
    }catch(e:any){ setErrorMsg(String(e?.message||e)); }
    finally{ setBusy(false); }
  };

  const rlsSelfcheck = async () => {
    try{
      setBusy(true);
      const r = await api.get('/integrations/rls/selfcheck');
      setStatus(`RLS ok for tenant ${r?.tenant_id||''}: ${JSON.stringify(r?.counts||{})}`);
      try { showToast({ title:'RLS self-check', description:'OK' }); } catch {}
    }catch(e:any){ setErrorMsg(String(e?.message||e)); }
    finally{ setBusy(false); }
  };

  const connectorsCleanup = async () => {
    try{
      setBusy(true);
      const r = await api.post('/integrations/connectors/cleanup', { tenant_id: await getTenant() });
      setStatus(`Connectors cleaned: ${Number(r?.deleted||0)} removed`);
      try { showToast({ title:'Connectors cleaned' }); } catch {}
    }catch(e:any){ setErrorMsg(String(e?.message||e)); }
    finally{ setBusy(false); }
  };

  const acuityImportSample = async () => {
    try{
      setBusy(true);
      const r = await api.post('/integrations/booking/acuity/import', { tenant_id: await getTenant(), since:'0', until:'', cursor:'' });
      setStatus(JSON.stringify(r));
      try { showToast({ title:'Acuity sample imported', description:'Acuity sample appointments imported' }); } catch {}
    } catch(e:any){ setStatus(String(e?.message||e)); }
    finally{ setBusy(false); }
  };

  const openSquare = () => { if (squareLink) window.open(squareLink, '_blank'); };
  const connect = async (provider: string) => {
    try{
      setConnecting((m)=> ({ ...m, [provider]: true }));
      setErrorMsg('');
      try { track('oauth_login_click', { provider }); } catch {}
      // Feature flag and config guards for social providers
      if ((provider === 'facebook' || provider === 'instagram')) {
        if (!SOCIAL_ON) {
          setErrorMsg('Social inbox is disabled for this environment. Set VITE_FEATURE_SOCIAL=1 to enable.');
          return;
        }
        if (onboarding?.providers?.[provider] === false) {
          setErrorMsg('Pending app credentials — configure Facebook/Instagram OAuth to enable.');
          return;
        }
      }
      // Defensive: ensure backend returns an oauth link even if first attempt is slow
      // Request the login URL with a generous window; avoid AbortController races
      const r = await api.get(`/oauth/${provider}/login?tenant_id=${encodeURIComponent(await getTenant())}&return=workspace`, { timeoutMs: 25000 });
      if (r?.url) {
        // Always navigate in the same tab immediately; popup blockers won't interfere
        try { window.location.href = r.url; } catch { window.location.assign(r.url); }
        // Belt-and-suspenders: reassign shortly if we are still visible (navigation didn’t happen)
        setTimeout(()=>{ try { if (document.visibilityState === 'visible') window.location.assign(r.url); } catch {} }, 600);
      } else {
        // Retry once after a short delay with a longer window
        setTimeout(async()=>{
          try{
            try { track('oauth_login_retry', { provider }); } catch {}
            const r2 = await api.get(`/oauth/${provider}/login?tenant_id=${encodeURIComponent(await getTenant())}&return=workspace`, { timeoutMs: 20000 });
            if (r2?.url) {
              try { window.location.href = r2.url; } catch { window.location.assign(r2.url); }
              setTimeout(()=>{ try { if (document.visibilityState === 'visible') window.location.assign(r2.url); } catch {} }, 600);
            } else {
              setErrorMsg('Connect link unavailable. Verify provider credentials, sandbox vs prod, and callback URLs. Use “View redirect URIs” with ?dev=1.');
            }
          }catch{}
        }, 800);
      }
    }catch(e:any){
      const msg = String(e?.message||e||'');
      if (/abort/i.test(msg) || /timeout/i.test(msg)) setErrorMsg('Connect timed out. Please try again. If it persists, copy the connect URL from the Network tab and open it.');
      else setErrorMsg(msg);
    } finally {
      setConnecting((m)=> ({ ...m, [provider]: false }));
    }
  };
  const refresh = async (provider: string) => {
    try{
      setBusy(true);
      setErrorMsg('');
      const r = await api.post('/oauth/refresh', { tenant_id: await getTenant(), provider });
      if (r?.status !== 'ok') setErrorMsg(r?.message || r?.status || 'Refresh failed');
      else setStatus('Refreshed');
      // re-analyze to reflect any status changes
      try{
        const a = await api.post('/onboarding/analyze', { tenant_id: await getTenant() });
        setOnboarding({ ...a?.summary, connectedMap: a?.summary?.connected || {}, providers: a?.summary?.providers || {} });
      }catch{}
    } finally {
      setBusy(false);
    }
  };
  // Full-height canvas first screen gate when coming from demo or fresh
  const [showIntro, setShowIntro] = useState<boolean>(()=>{
    try{
      const seen = sessionStorage.getItem('bvx_integrations_intro_seen') === '1';
      return !seen;
    }catch{ return false; }
  });
  if (showIntro) {
    return (
      <>
        <div className="space-y-3 overflow-hidden min-h-[calc(100vh-var(--bvx-commandbar-height,64px)-48px)]">
          <section className="grid place-items-center h-[calc(100vh-var(--ask-float-height,0px)-80px)]">
            <div className="max-w-lg text-center rounded-2xl p-6 bg-white/70 backdrop-blur border border-white/70 shadow-sm">
              <div className="text-lg font-semibold text-slate-900">Settings & Connections</div>
              <div className="text-sm text-slate-600 mt-1">We’ll connect booking, messages, and (optionally) CRM. One step at a time.</div>
              <div className="mt-4 flex justify-center">
                <Button onClick={()=>{ setShowIntro(false); try{ sessionStorage.setItem('bvx_integrations_intro_seen','1'); }catch{} }}>Start</Button>
              </div>
            </div>
          </section>
        </div>
        {(connAccounts?.length>0 || lastCallback) && (
          <div className="text-[11px] text-slate-600 mt-1">
            {connAccounts?.length>0 && (
              <span>Connected: {connAccounts.map(x=>x.provider).join(', ')}</span>
            )}
            {lastCallback && (
              <span className="ml-3">Last callback: {new Date((lastCallback.ts||0)*1000).toLocaleString()}</span>
            )}
          </div>
        )}
      </>
    );
  }
  return (
    <div className="space-y-3 overflow-hidden min-h-[calc(100vh-var(--bvx-commandbar-height,64px)-48px)]">
      <div className="flex items-center sticky top-0 z-10 bg-white/80 backdrop-blur rounded-md px-1 py-1">
        <h3 className="text-lg font-semibold">Settings & Connections</h3>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-600 px-2 py-1 rounded-md border bg-white/70">
            TZ: {Intl.DateTimeFormat().resolvedOptions().timeZone} (UTC{computeOffsetHours()>=0?'+':''}{computeOffsetHours()})
          </span>
          <Button variant="outline" size="sm" onClick={()=>{ reanalyze(); try{ track('reanalyze_clicked', { area:'integrations' }); }catch{} }} aria-label="Re-analyze connections" data-guide="reanalyze">{UI_STRINGS.ctas.secondary.reanalyze}</Button>
          <Button variant="outline" size="sm" aria-label="Open integrations guide" onClick={()=>{
            try { track('guide_open', { area: 'integrations' }); } catch {}
            const d = driver({ showProgress: true, steps: [
              { popover: { title: 'Integrations', description: 'Connect booking, CRM, messaging, and inventory.' } },
              { element: '[data-guide="providers"]', popover: { title: 'What each does', description: 'Booking (Square/Acuity), Calendar (Google/Apple), CRM (HubSpot), Messaging (Twilio/SendGrid), Commerce (Shopify).' } },
              { element: '[data-guide="reanalyze"]', popover: { title: 'Re‑analyze', description: 'Re‑pull provider deltas and refresh KPIs after connecting or changing settings.' } },
            ] } as any);
            d.drive();
          }}>{UI_STRINGS.ctas.tertiary.guideMe}</Button>
          <div className="flex items-center gap-1 ml-2">
            <Button variant="outline" size="sm" onClick={()=> go(page-1)} disabled={page<=1}>Prev</Button>
            <span className="text-xs px-2">Page {page}/3</span>
            <Button variant="outline" size="sm" onClick={()=> go(page+1)} disabled={page>=3}>Next</Button>
          </div>
        </div>
      </div>
      {/* Token expiry warnings */}
      {(() => {
        try {
          const now = Math.floor(Date.now()/1000);
          const soon: string[] = [];
          Object.entries(providerStatus||{}).forEach(([k,v])=>{
            const ex = Number(v?.expires_at||0);
            if (ex>0 && (ex - now) < (7*24*3600)) soon.push(k);
          });
          if (soon.length>0) {
            return (
              <div className="rounded-md border bg-amber-50 border-amber-200 text-amber-900 text-xs px-2 py-1">
                Tokens expiring soon: {soon.join(', ')}. Click Refresh to renew.
              </div>
            );
          }
        } catch {}
        return null;
      })()}
      {/* Simplified header; hide connected/last-callback troubleshooting details */}
      {isDemo && (
        <div className="rounded-md border bg-amber-50 border-amber-200 text-amber-900 text-xs px-2 py-1 inline-block">
          Demo mode — external provider connections are off. Explore UI and previews here; enable Twilio/SendGrid after signup.
        </div>
      )}
      {onboarding?.providers && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-700 bg-white/70 border border-white/70 rounded-md px-2 py-1 inline-block">
            {(() => {
              const entries = Object.entries(onboarding.providers as Record<string, boolean>);
              const total = entries.length;
              const configured = entries.filter(([,v]) => !!v).length;
              const pending = total - configured;
              return `Configured: ${configured}/${total} · Pending config: ${pending}`;
            })()}
          </span>
          {onboarding?.last_analyzed && (
            <span className="text-[11px] text-slate-500">Last analyzed: {new Date((onboarding as any).last_analyzed*1000).toLocaleString()}</span>
          )}
        </div>
      )}
      {errorMsg && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-2 py-1 inline-block">
          {errorMsg}
          <div className="mt-1 text-[11px] text-rose-700/90">
            Tips: verify client ID/secret, redirect URI matches backend callback, and sandbox vs prod app settings.
          </div>
        </div>
      )}
      {page===1 && (
      <div className="grid gap-3 max-w-xl">
        {onboarding?.providers && Object.entries(onboarding.providers).some(([,v])=> (v as boolean)===false) && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">Some providers are pending app credentials; connect buttons will be disabled for those until configured.</div>
        )}
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">Some actions may require approval when auto-approve is off. Review in <a className="underline" href="/workspace?pane=approvals">Approvals</a>.</div>
        {lastCallback && (
          <div className="text-[11px] text-slate-600">Last OAuth callback: {new Date(Number(lastCallback?.ts||0)*1000).toLocaleString()} · {String(lastCallback?.action||'')}</div>
        )}
        <label className="flex items-center gap-2 text-sm"> Tone
          <Input value={settings.tone||''} onChange={e=>setSettings({...settings,tone:e.target.value})} />
        </label>
        <div className="grid gap-2 text-sm">
          <div className="text-slate-700">Brand profile</div>
          <Input placeholder="Business name" value={settings.brand_profile?.name||''} onChange={e=> setSettings({...settings, brand_profile:{ ...(settings.brand_profile||{}), name:e.target.value }})} />
          <Input placeholder="Brand voice (e.g., Warm, Editorial crisp)" value={settings.brand_profile?.voice||''} onChange={e=> setSettings({...settings, brand_profile:{ ...(settings.brand_profile||{}), voice:e.target.value }})} />
          <Input placeholder="About (one line)" value={settings.brand_profile?.about||''} onChange={e=> setSettings({...settings, brand_profile:{ ...(settings.brand_profile||{}), about:e.target.value }})} />
        </div>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-slate-700">Monthly revenue</div>
            <Input placeholder="$" value={settings.metrics?.monthly_revenue||''} onChange={e=> setSettings({...settings, metrics:{ ...(settings.metrics||{}), monthly_revenue:e.target.value }})} />
          </div>
          <div>
            <div className="text-slate-700">Avg service price</div>
            <Input placeholder="$" value={settings.metrics?.avg_service_price||''} onChange={e=> setSettings({...settings, metrics:{ ...(settings.metrics||{}), avg_service_price:e.target.value }})} />
          </div>
          <div>
            <div className="text-slate-700">Avg service time (mins)</div>
            <Input placeholder="minutes" value={settings.metrics?.avg_service_time||''} onChange={e=> setSettings({...settings, metrics:{ ...(settings.metrics||{}), avg_service_time:e.target.value }})} />
          </div>
          <div>
            <div className="text-slate-700">Monthly rent</div>
            <Input placeholder="$" value={settings.metrics?.rent||''} onChange={e=> setSettings({...settings, metrics:{ ...(settings.metrics||{}), rent:e.target.value }})} />
          </div>
        </div>
        <div className="grid gap-2 text-sm">
          <div className="text-slate-700">Primary goal</div>
          <Input placeholder="What do you want BrandVX to do first?" value={settings.goals?.primary_goal||''} onChange={e=> setSettings({...settings, goals:{ ...(settings.goals||{}), primary_goal:e.target.value }})} />
        </div>
        {/* Provider mode moved onto each integration card (Demo/Live) */}
        <label className="flex items-center gap-2 text-sm"> SMS
          <input type="checkbox" checked={settings.services?.includes('sms')} onChange={e=>{
            const s = new Set(settings.services||[]); e.target.checked ? s.add('sms') : s.delete('sms'); setSettings({...settings, services: Array.from(s)});
          }} />
        </label>
        <label className="flex items-center gap-2 text-sm"> Email
          <input type="checkbox" checked={settings.services?.includes('email')} onChange={e=>{
            const s = new Set(settings.services||[]); e.target.checked ? s.add('email') : s.delete('email'); setSettings({...settings, services: Array.from(s)});
          }} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 text-sm">
          <div className="text-slate-700">{UI_STRINGS.quietHours.sectionTitle}</div>
          <input className="border rounded-md px-2 py-1 bg-white" type="time" value={settings.quiet_hours?.start||'21:00'} onChange={e=> setSettings({...settings, quiet_hours:{ ...(settings.quiet_hours||{}), start:e.target.value }})} aria-label="Quiet hours start" />
          <input className="border rounded-md px-2 py-1 bg-white" type="time" value={settings.quiet_hours?.end||'08:00'} onChange={e=> setSettings({...settings, quiet_hours:{ ...(settings.quiet_hours||{}), end:e.target.value }})} aria-label="Quiet hours end" />
        </div>
        <div className="text-xs text-slate-600">{UI_STRINGS.quietHours.helper}</div>
        <div className="text-[11px] text-slate-600">Preview: {fmt12(settings.quiet_hours?.start||'21:00')} – {fmt12(settings.quiet_hours?.end||'08:00')}</div>
        <label className="flex items-center gap-2 text-sm"> Auto-approve risky tools
          <input type="checkbox" checked={!!settings.auto_approve_all} onChange={e=>setSettings({...settings, auto_approve_all: e.target.checked})} />
        </label>
        <label className="flex items-center gap-2 text-sm"> Share anonymized insights
          <input type="checkbox" checked={!!(settings.ai?.share_insights)} onChange={e=>{
            const ai = { ...(settings.ai||{}), share_insights: e.target.checked };
            setSettings({ ...settings, ai });
            (async()=>{ try{ await api.post('/settings', { tenant_id: await getTenant(), ai_share_insights: e.target.checked }); }catch{} })();
          }} />
        </label>
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">Some actions may require approval when auto-approve is off. Review in <a className="underline" href="/workspace?pane=approvals">Approvals</a>.</div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy} onClick={save}>{UI_STRINGS.ctas.primary.saveChanges}</Button>
          <Button variant="outline" disabled={busy} onClick={sendTestSms}>Send Test SMS</Button>
          <Button variant="outline" disabled={busy} onClick={sendTestEmail}>Send Test Email</Button>
        </div>
        <section className="rounded-2xl p-3 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="font-medium text-slate-900">Train VX</div>
          <div className="text-sm text-slate-600 mt-1">Add context, phrases, and do/don’t guidance. VX will prefer this voice.</div>
          <textarea className="mt-2 w-full border rounded-md px-3 py-2 bg-white text-sm" rows={5} placeholder="e.g., We always say 'gentle nudge' not 'blast'. Short, kind, clear."
            value={settings.training_notes||''}
            onChange={e=> setSettings({...settings, training_notes: e.target.value})}
          />
          <div className="mt-2 flex gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={saveTraining}>Save training</Button>
          </div>
        </section>
      </div>
      )}

      {page===2 && (
      <div className="grid md:grid-cols-3 gap-4 mt-1 overflow-hidden" data-guide="providers">
        {SHOW_REDIRECT_URIS && redirects && (
          <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm md:col-span-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="font-semibold text-slate-900">Redirect URIs</div>
              <Button variant="outline" size="sm" onClick={async()=>{
                try{
                  const lines: string[] = [];
                  Object.entries(redirects.oauth||{}).forEach(([k,v])=> lines.push(`${k}: ${v}`));
                  Object.entries(redirects.webhooks||{}).forEach(([k,v])=> lines.push(`${k} webhook: ${v}`));
                  await navigator.clipboard.writeText(lines.join('\n'));
                  setStatus('Copied all redirect URIs');
                  try { showToast({ title:'Copied', description:'Redirect URIs copied' }); } catch {}
                } catch(e:any) { setStatus('Copy failed'); }
              }}>Copy all</Button>
            </div>
            <div className="grid md:grid-cols-2 gap-2 text-xs">
              {Object.entries(redirects.oauth||{}).map(([k,v])=> (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-28 capitalize text-slate-600">{k}</span>
                  <input readOnly className="flex-1 border rounded-md px-2 py-1 bg-white" value={String(v)} onFocus={(e)=> e.currentTarget.select()} />
                </div>
              ))}
              {Object.entries(redirects.webhooks||{}).map(([k,v])=> (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-28 capitalize text-slate-600">{k} webhook</span>
                  <input readOnly className="flex-1 border rounded-md px-2 py-1 bg-white" value={String(v)} onFocus={(e)=> e.currentTarget.select()} />
                </div>
              ))}
            </div>
          </section>
        )}
        {onboarding?.providers?.hubspot !== false && shouldShow('hubspot') && (
        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">HubSpot</div>
              <div className="text-sm text-slate-600">CRM sync (contacts + properties)</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs ${isConnected('hubspot') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{isConnected('hubspot') ? (providerStatus?.hubspot?.status||'Connected') : 'Not linked'}</span>
              <label className="inline-flex items-center gap-1 text-[11px]">
                <span className={`${settings.providers_live?.hubspot ? 'text-emerald-700' : 'text-slate-600'}`}>{settings.providers_live?.hubspot ? 'Live' : 'Demo'}</span>
                <input type="checkbox" checked={!!settings.providers_live?.hubspot} onChange={e=> setProviderLive('hubspot', e.target.checked)} />
              </label>
            </div>
          </div>
          <div className="mt-3 flex gap-2 items-center flex-wrap">
            <Button variant="outline" disabled={busy || connecting.hubspot || onboarding?.providers?.hubspot===false} onClick={()=> connect('hubspot')}>{connecting.hubspot ? 'Connecting…' : connectLabel('hubspot')}</Button>
            <Button variant="outline" disabled={busy || onboarding?.providers?.hubspot===false} onClick={hubspotUpsertSample}>Sync sample contact</Button>
            <Button variant="outline" disabled={busy || onboarding?.providers?.hubspot===false} onClick={hubspotImportContacts}>Import contacts</Button>
            <Button variant="outline" disabled={busy} onClick={()=> refresh('hubspot')}>Refresh</Button>
            {providerStatus?.hubspot?.last_sync && (
              <span className="text-[11px] text-slate-600">Last sync: {fmtTs(providerStatus.hubspot.last_sync)}</span>
            )}
            {expSoon('hubspot') && <span className="text-[11px] text-amber-700">Token expiring soon</span>}
          </div>
          {onboarding?.providers?.hubspot===false && <div className="mt-2 text-xs text-amber-700">Pending app credentials — configure HubSpot OAuth to enable.</div>}
          <div className="mt-2 text-xs text-amber-700">Note: Contact syncs may require approval if auto-approve is disabled.</div>
        </section>
        )}

        {(
        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm" id="twilio-card" data-guide="twilio">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Twilio SMS</div>
              <div className="text-sm text-slate-600">Business SMS only — personal numbers not supported (yet). Each tenant uses their own number.</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700">Requires Twilio</span>
              <label className="inline-flex items-center gap-1 text-[11px]">
                <span className={`${settings.providers_live?.twilio ? 'text-emerald-700' : 'text-slate-600'}`}>{settings.providers_live?.twilio ? 'Live' : 'Demo'}</span>
                <input type="checkbox" checked={!!(settings.providers_live as any)?.twilio} onChange={e=> setProviderLive('twilio', e.target.checked)} />
              </label>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || isDemo} onClick={enableSms}>{isDemo ? 'Enable (live only)' : 'Enable SMS'}</Button>
            <input className="border rounded-md px-2 py-1 bg-white text-sm" placeholder="Area code (optional)" value={twilioArea} onChange={e=> setTwilioArea(e.target.value)} style={{width:140}} />
            <Button variant="outline" disabled={busy || isDemo} onClick={async()=>{
              try{
                setStatus('Provisioning…');
                const r = await api.post('/integrations/twilio/provision', { area_code: twilioArea });
                if (r?.from) { setTwilioFrom(r.from); setStatus('Provisioned'); try { showToast({ title:'Provisioned', description: r.from }); } catch {} }
                else if (r?.detail) setStatus(String(r.detail));
              } catch(e:any){ setStatus(String(e?.message||e)); }
            }}>Provision number</Button>
            {twilioFrom && <span className="text-xs text-slate-600">From: {twilioFrom}</span>}
            <Button variant="outline" disabled={busy || isDemo} onClick={()=>{ try{ track('twilio_test_sms'); }catch{}; if (isDemo) { setStatus('Demo: sending disabled'); return; } sendTestSms(); try { showToast({ title:'Test SMS sent', description:'Test SMS sent successfully' }); } catch {} }}>{isDemo? 'Send test (demo off)' : 'Send test SMS'}</Button>
            {!isDemo && (
              <>
                <Button variant="outline" disabled={busy} onClick={()=>{ try{ track('twilio_console_open'); }catch{}; window.open('https://www.twilio.com/console', '_blank', 'noreferrer'); try { showToast({ title:'Opening Twilio Console' }); } catch {} }}>Open Twilio Console</Button>
                <Button variant="outline" disabled={busy} onClick={()=>{ try{ track('twilio_docs_open'); }catch{}; window.open('https://www.twilio.com/en-us/messaging/channels/sms', '_blank', 'noreferrer'); }}>Twilio SMS Guide</Button>
              </>
            )}
          </div>
          <div className="mt-2 text-xs text-amber-700">
            {isDemo ? 'Coming soon in demo. In live workspaces, you can provision a dedicated Twilio business number (no personal numbers).' : 'Use a dedicated Twilio business number for SMS. We’ll add number porting support later. For now, personal mobile numbers are not supported.'}
          </div>
        </section>
        )}

        {(
        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Square / Acuity</div>
              <div className="text-sm text-slate-600">Booking & appointments (we ingest bookings; merging and 2‑way scheduling are coming soon)</div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs ${onboarding?.connectedMap?.square==='connected' || onboarding?.connectedMap?.acuity==='connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{(onboarding?.connectedMap?.square==='connected' || onboarding?.connectedMap?.acuity==='connected') ? 'Connected' : 'Not linked'}</span>
          </div>
          {focusedProvider==='square' && sp.get('connected')==='1' && (
            <div className="mb-2 text-xs rounded-md px-2 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700">Square connected. You can import contacts now.</div>
          )}
          <div className="mt-3 flex gap-2 items-center flex-wrap">
            <Button variant="outline" disabled={busy || !squareLink || onboarding?.providers?.square===false} onClick={openSquare}>{squareLink ? 'Open Square booking' : 'No link set'}</Button>
            <Button variant="outline" disabled={busy || connecting.square || onboarding?.providers?.square===false} onClick={()=> connect('square')}>{connecting.square ? 'Connecting…' : connectLabel('square')}</Button>
            <Button variant="outline" disabled={busy || connecting.acuity || onboarding?.providers?.acuity===false} onClick={()=> connect('acuity')}>{connecting.acuity ? 'Connecting…' : connectLabel('acuity')}</Button>
            <Button variant="outline" disabled={busy || onboarding?.providers?.acuity===false} onClick={async()=>{ await acuityImportSample(); try{ showToast({ title:'Imported sample appointments', description:'Acuity sample appointments imported' }); }catch{} }}>Import sample appointments</Button>
            <span className="text-[11px] text-slate-600">Tip: After connecting, click Re‑analyze to refresh status.</span>
            <Button variant="outline" disabled={busy} onClick={()=> { refresh('square'); try { showToast({ title:UI_STRINGS.ctas.secondary.refresh }); } catch {} }}>Refresh</Button>
            <Button variant="outline" disabled={busy} onClick={async()=>{
              try{
                setBusy(true);
                const r = await api.post('/integrations/booking/square/sync-contacts', { tenant_id: await getTenant() });
                if (typeof r?.imported === 'number') {
                  setStatus(`Imported ${r?.imported||0} contacts from Square`);
                  try { showToast({ title:'Imported', description: `${Number(r?.imported||0)} contacts` }); } catch {}
                } else if (r?.error || r?.detail) {
                  const msg = r?.detail || r?.error || 'Import failed';
                  setErrorMsg(`Import failed: ${msg}. Try Refresh, then Connect again if needed.`);
                } else {
                  setStatus('Import completed');
                }
                // Re-analyze status after import
                try { await reanalyze(); } catch {}
              }catch(e:any){ setErrorMsg('Import failed. Verify Square is connected, then click Refresh and try again.'); }
              finally{ setBusy(false); }
            }}>Import contacts from Square</Button>
            <Button variant="outline" disabled={busy} onClick={async()=>{
              try{
                setBusy(true);
                const r = await api.post('/integrations/booking/square/backfill-metrics', { tenant_id: await getTenant() });
                if (typeof r?.updated === 'number') {
                  try { showToast({ title:'Backfill complete', description: `${Number(r.updated)} customers updated` }); } catch {}
                  setStatus(`Backfill updated ${Number(r.updated)} customers`);
                } else if (r?.error) {
                  setErrorMsg(String(r?.error||'backfill_failed'));
                }
                try { await reanalyze(); } catch {}
              }catch(e:any){ setErrorMsg(String(e?.message||e)); }
              finally { setBusy(false); }
            }}>Backfill metrics</Button>
            {linked.square && lastSync.square && (
              <span className="text-[11px] text-slate-600">Last sync: {new Date(Number(lastSync.square)*1000).toLocaleString()}</span>
            )}
          </div>
          {(onboarding?.providers?.square===false || onboarding?.providers?.acuity===false) && <div className="mt-2 text-xs text-amber-700">Pending app credentials — configure Square/Acuity OAuth to enable.</div>}
          <div className="mt-2 text-xs text-amber-700">Note: Imports and booking merges may queue approvals when auto-approve is off.</div>
        </section>
        )}

        {shouldShow('sendgrid') && (
        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">SendGrid</div>
              <div className="text-sm text-slate-600">Transactional email</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700">Webhook ready</span>
              <label className="inline-flex items-center gap-1 text-[11px]">
                <span className={`${settings.providers_live?.sendgrid ? 'text-emerald-700' : 'text-slate-600'}`}>{(settings.providers_live as any)?.sendgrid ? 'Live' : 'Demo'}</span>
                <input type="checkbox" checked={!!(settings.providers_live as any)?.sendgrid} onChange={e=> setProviderLive('sendgrid', e.target.checked)} />
              </label>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" disabled={busy} onClick={sendTestEmail}>{UI_STRINGS.ctas.secondary.sendTestEmail}</Button>
          </div>
          <div className="mt-2 text-xs text-amber-700">Note: Test emails may require approval if auto-approve is disabled.</div>
          {/* Deliverability hints */}
          <div className="mt-2 rounded-md border bg-slate-50 p-3 text-xs text-slate-700">
            <div className="font-medium text-slate-800">Deliverability</div>
            <div className="mt-1">Add SPF and DKIM records for your sending domain to improve inbox placement.</div>
            <ul className="list-disc list-inside mt-1">
              <li>SPF: include:sendgrid.net</li>
              <li>DKIM: create CNAMEs in SendGrid &rarr; Settings &rarr; Sender Authentication</li>
            </ul>
            <div className="mt-1">After updating DNS, click Refresh to re‑check status.</div>
          </div>
        </section>
        )}

        {shouldShow('google') && (
        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Google Calendar</div>
              <div className="text-sm text-slate-600">One-way sync and merge bookings for now</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs ${isConnected('google') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{isConnected('google')? (providerStatus?.google?.status||'Connected') : 'Not linked'}</span>
              <label className="inline-flex items-center gap-1 text-[11px]">
                <span className={`${settings.providers_live?.google ? 'text-emerald-700' : 'text-slate-600'}`}>{settings.providers_live?.google ? 'Live' : 'Demo'}</span>
                <input type="checkbox" checked={!!settings.providers_live?.google} onChange={e=> setProviderLive('google', e.target.checked)} />
              </label>
            </div>
          </div>
          <div className="mt-3 flex gap-2 items-center flex-wrap">
            <Button variant="outline" disabled={busy || connecting.google || onboarding?.providers?.google===false} onClick={()=> connect('google')}>{connecting.google ? 'Connecting…' : connectLabel('google')}</Button>
            <Button variant="outline" disabled={busy} onClick={()=> window.open('/workspace?pane=calendar','_self')}>{UI_STRINGS.ctas.secondary.openCalendar}</Button>
            <Button variant="outline" disabled={busy} onClick={()=> calendarSync('google')}>Sync calendar</Button>
            <Button variant="outline" disabled={busy} onClick={calendarMerge}>Merge duplicates</Button>
            <Button variant="outline" disabled={busy} onClick={()=> refresh('google')}>{UI_STRINGS.ctas.secondary.refresh}</Button>
            {providerStatus?.google?.last_sync && (
              <span className="text-[11px] text-slate-600">Last sync: {fmtTs(providerStatus.google.last_sync)}</span>
            )}
            {expSoon('google') && <span className="text-[11px] text-amber-700">Token expiring soon</span>}
          </div>
          {onboarding?.providers?.google===false && <div className="mt-2 text-xs text-amber-700">Pending app credentials — configure Google OAuth to enable.</div>}
        </section>
        )}

        {SOCIAL_ON && shouldShow('instagram') && (
          <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900">Instagram</div>
                <div className="text-sm text-slate-600">DMs & comments in Master Inbox</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs ${isConnected('instagram') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{isConnected('instagram')? (providerStatus?.instagram?.status||'Connected') : 'Not linked'}</span>
                <label className="inline-flex items-center gap-1 text-[11px]">
                  <span className={`${settings.providers_live?.instagram ? 'text-emerald-700' : 'text-slate-600'}`}>{settings.providers_live?.instagram ? 'Live' : 'Demo'}</span>
                  <input type="checkbox" checked={!!settings.providers_live?.instagram} onChange={e=> setProviderLive('instagram', e.target.checked)} />
                </label>
              </div>
            </div>
            <div className="mt-3 flex gap-2 items-center flex-wrap">
              <Button variant="outline" disabled={busy || connecting.instagram || onboarding?.providers?.instagram===false} onClick={()=> connect('instagram')}>{connecting.instagram ? 'Connecting…' : connectLabel('instagram')}</Button>
              <Button variant="outline" disabled={busy} onClick={()=> window.open('/workspace?pane=messages','_self')}>{UI_STRINGS.ctas.secondary.openInbox}</Button>
              <Button variant="outline" disabled={busy} onClick={()=> refresh('instagram')}>{UI_STRINGS.ctas.secondary.refresh}</Button>
              {providerStatus?.instagram?.last_sync && (
                <span className="text-[11px] text-slate-600">Last sync: {fmtTs(providerStatus.instagram.last_sync)}</span>
              )}
              {expSoon('instagram') && <span className="text-[11px] text-amber-700">Token expiring soon</span>}
            </div>
            {(onboarding?.providers?.instagram===false) && <div className="mt-2 text-xs text-amber-700">Pending app credentials — configure Instagram OAuth to enable.</div>}
          </section>
        )}
        {!SOCIAL_ON && (
          <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
            <div className="font-semibold text-slate-900">Instagram</div>
            <div className="text-sm text-slate-600">Social inbox is not enabled for this environment.</div>
            <div className="mt-2 text-xs text-slate-600">Set <code>VITE_FEATURE_SOCIAL=1</code> to enable.</div>
          </section>
        )}
      </div>
      )}

      {/* Troubleshooting (dev helpers) */}
      {(() => {
        try{
          const dev = new URLSearchParams(window.location.search).has('dev')
          if (!dev) return null
        }catch{ return null }
        return (
          <div className="mt-3 rounded-md border bg-slate-50 px-2 py-2 text-xs flex gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={rlsSelfcheck}>RLS self-check</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={connectorsCleanup}>Cleanup connectors</Button>
          </div>
        )
      })()}

      {page===3 && (
      <div className="grid md:grid-cols-3 gap-4 mt-4">
        {(
        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Shopify</div>
              <div className="text-sm text-slate-600">Inventory & products</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs ${isConnected('shopify') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{isConnected('shopify') ? (providerStatus?.shopify?.status||'Connected') : (onboarding?.connectedMap?.shopify||'Not linked')}</span>
              <label className="inline-flex items-center gap-1 text-[11px]">
                <span className={`${settings.providers_live?.shopify ? 'text-emerald-700' : 'text-slate-600'}`}>{settings.providers_live?.shopify ? 'Live' : 'Demo'}</span>
                <input type="checkbox" checked={!!settings.providers_live?.shopify} onChange={e=> setProviderLive('shopify', e.target.checked)} />
              </label>
            </div>
          </div>
          <div className="mt-3 flex gap-2 items-center flex-wrap">
            <Button variant="outline" disabled={busy || connecting.shopify || onboarding?.providers?.shopify===false} onClick={()=> connect('shopify')}>{connecting.shopify ? 'Connecting…' : connectLabel('shopify')}</Button>
            <Button variant="outline" disabled={busy} onClick={()=> window.open('/workspace?pane=inventory','_self')}>{UI_STRINGS.ctas.secondary.openInventory}</Button>
            <Button variant="outline" disabled={busy} onClick={()=> refresh('shopify')}>{UI_STRINGS.ctas.secondary.refresh}</Button>
            {providerStatus?.shopify?.last_sync && (
              <span className="text-[11px] text-slate-600">Last sync: {fmtTs(providerStatus.shopify.last_sync)}</span>
            )}
            {expSoon('shopify') && <span className="text-[11px] text-amber-700">Token expiring soon</span>}
          </div>
          {onboarding?.providers?.shopify===false && <div className="mt-2 text-xs text-amber-700">Pending app credentials — configure Shopify OAuth to enable.</div>}
        </section>
        )}
      </div>
      )}
      {(() => {
        try{ if (!new URLSearchParams(window.location.search).has('dev')) return null }catch{ return null }
        return (
          <section className="rounded-2xl p-3 bg-white/60 backdrop-blur border border-white/70 shadow-sm mt-3">
            <div className="flex items-center justify-between">
              <div className="font-medium text-slate-900">Integration events</div>
              <Button variant="outline" size="sm" disabled={busy} onClick={loadEvents}>Refresh</Button>
            </div>
            <div className="mt-2 text-[12px] max-h-48 overflow-auto">
              {events.map((e,i)=> (
                <div key={i} className="py-1 border-b border-slate-100/70">
                  <div className="text-slate-800">{e.name}</div>
                  <div className="text-slate-500">{fmtTs(e.ts)}</div>
                </div>
              ))}
              {events.length===0 && (
                <div className="text-slate-500">No recent events</div>
              )}
            </div>
          </section>
        )
      })()}
      {/* Image generation for users is available on the Vision page; intentionally not exposed here to avoid changing app imagery. */}
      <pre className="whitespace-pre-wrap mt-3 text-sm text-slate-700">{status}</pre>
    </div>
  );
}


