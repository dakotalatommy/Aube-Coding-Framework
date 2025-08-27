import { useEffect, useState } from 'react';
import { api, getTenant, API_BASE } from '../lib/api';
import { track } from '../lib/analytics';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { driver } from 'driver.js';
import StepPager from '../components/StepPager';
import 'driver.js/dist/driver.css';
import { UI_STRINGS } from '../lib/strings';
import { useToast } from '../components/ui/Toast';

export default function Integrations(){
  const { showToast } = useToast();
  const [step, setStep] = useState<number>(()=>{
    try{
      const sp = new URLSearchParams(window.location.search);
      const s = Number(sp.get('step')||'1');
      return Math.max(1, Math.min(8, isFinite(s)? s : 1)) - 1;
    } catch { return 0; }
  });
  const sp = (()=>{ try { return new URLSearchParams(window.location.search); } catch { return new URLSearchParams(); } })();
  const providerFromURL = (()=>{ try{ return (sp.get('provider')||'').toLowerCase(); } catch { return ''; } })();
  const returnHint = (()=>{ try{ return (sp.get('return')||''); } catch { return ''; } })();
  const [focusedProvider] = useState<string>(providerFromURL);
  const steps = [
    { key:'overview', label:'Overview' },
    { key:'twilio', label:'Twilio SMS' },
    { key:'hubspot', label:'HubSpot' },
    { key:'calendar', label:'Google/Calendar' },
    { key:'booking', label:'Square/Acuity' },
    { key:'shopify', label:'Shopify' },
    { key:'settings', label:'Settings' },
    { key:'reanalyze', label:'Re‑analyze' },
  ];
  const SOCIAL_ON = (import.meta as any).env?.VITE_FEATURE_SOCIAL === '1';
  const SHOW_REDIRECT_URIS = ((import.meta as any).env?.VITE_SHOW_REDIRECT_URIS === '1') || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev'));
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
  const reanalyze = async () => {
    try{
      const a = await api.post('/onboarding/analyze', { tenant_id: await getTenant() });
      setOnboarding({ ...a?.summary, connectedMap: a?.summary?.connected || {}, providers: a?.summary?.providers || {} });
      const ts = new Date();
      setStatus(`Re‑analyzed at ${ts.toLocaleTimeString()}`);
      try { showToast({ title:'Re‑analyzed', description: ts.toLocaleTimeString() }); } catch {}
    } catch(e:any){ setStatus(String(e?.message||e)); }
  };

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
    })();
  },[]);

  // Focused provider mode: when returning from OAuth, jump to that section and optionally auto-return
  useEffect(()=>{
    try{
      if (focusedProvider) {
        const map: Record<string, number> = { hubspot:2, google:4, square:5, acuity:5, shopify:6 };
        const idx = (map[focusedProvider] ?? 1) - 1;
        setStep(idx);
        // If asked to return to workspace, bounce after a short confirmation window
        if (returnHint === 'workspace' && sp.get('connected') === '1') {
          setTimeout(()=>{ try{ window.location.assign('/workspace?pane=integrations'); }catch{} }, 1800);
        }
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
    }
    catch(e:any){ setStatus(String(e?.message||e)); }
    finally{ setBusy(false); }
  };

  const computeOffsetHours = () => {
    try {
      const minutes = new Date().getTimezoneOffset(); // minutes behind UTC
      return Math.round((-minutes) / 60);
    } catch { return 0; }
  };
  const sendTestSms = async () => {
    try{ setBusy(true); const r = await api.post('/messages/send',{ tenant_id: await getTenant(), contact_id:'c_demo', channel:'sms', body:'Test SMS from BrandVX (reply STOP/HELP to opt out)' }); setStatus(JSON.stringify(r)); try { showToast({ title:'Test SMS sent', description:'Test SMS sent successfully' }); } catch {} }
    catch(e:any){ setStatus(String(e?.message||e)); }
    finally{ setBusy(false); }
  };
  const sendTestEmail = async () => {
    try{ setBusy(true); const r = await api.post('/messages/send',{ tenant_id: await getTenant(), contact_id:'c_demo', channel:'email', subject:'BrandVX Test', body:'<p>Hello from BrandVX</p>' }); setStatus(JSON.stringify(r)); try { showToast({ title:'Test email sent', description:'Test email sent successfully' }); } catch {} }
    catch(e:any){ setStatus(String(e?.message||e)); }
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
      // Request the login URL with a generous window; avoid AbortController races
      const r = await api.get(`/oauth/${provider}/login?tenant_id=${encodeURIComponent(await getTenant())}`, { timeoutMs: 25000 });
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
            const r2 = await api.get(`/oauth/${provider}/login?tenant_id=${encodeURIComponent(await getTenant())}`, { timeoutMs: 20000 });
            if (r2?.url) {
              try { window.location.href = r2.url; } catch { window.location.assign(r2.url); }
              setTimeout(()=>{ try { if (document.visibilityState === 'visible') window.location.assign(r2.url); } catch {} }, 600);
            } else {
              setErrorMsg('Connect link unavailable. Verify provider credentials, sandbox vs prod, and callback URLs.');
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
  return (
    <div className="space-y-3 overflow-hidden">
      <div className="flex items-center sticky top-0 z-10 bg-[var(--sticky-bg,white)]/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 rounded-md px-1 py-1">
        <h3 className="text-lg font-semibold">Settings & Connections</h3>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-600 px-2 py-1 rounded-md border bg-white/70">
            TZ: {Intl.DateTimeFormat().resolvedOptions().timeZone} (UTC{computeOffsetHours()>=0?'+':''}{computeOffsetHours()})
          </span>
          <Button variant="outline" size="sm" onClick={reanalyze} aria-label="Re-analyze connections" data-guide="reanalyze">{UI_STRINGS.ctas.secondary.reanalyze}</Button>
          <Button variant="outline" size="sm" aria-label="Open integrations guide" onClick={()=>{
            try { track('guide_open', { area: 'integrations' }); } catch {}
            const d = driver({ showProgress: true, steps: [
              { popover: { title: 'Integrations', description: 'Connect booking, CRM, messaging, and inventory.' } },
              { element: '[data-guide="providers"]', popover: { title: 'What each does', description: 'Booking (Square/Acuity), Calendar (Google/Apple), CRM (HubSpot), Messaging (Twilio/SendGrid), Commerce (Shopify).' } },
              { element: '[data-guide="reanalyze"]', popover: { title: 'Re‑analyze', description: 'Re‑pull provider deltas and refresh KPIs after connecting or changing settings.' } },
            ] } as any);
            d.drive();
          }}>{UI_STRINGS.ctas.tertiary.guideMe}</Button>
        </div>
      </div>
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
      {step===0 && (
      <div className="grid gap-3 max-w-xl">
        {onboarding?.providers && Object.entries(onboarding.providers).some(([,v])=> (v as boolean)===false) && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">Some providers are pending app credentials; connect buttons will be disabled for those until configured.</div>
        )}
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">Some actions may require approval when auto-approve is off. Review in <a className="underline" href="/workspace?pane=approvals">Approvals</a>.</div>
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
        <div className="text-sm text-slate-700">Provider mode</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {['google','square','acuity','hubspot','instagram','shopify'].map(p=> (
            <label key={p} className="flex items-center justify-between rounded-md border bg-white p-2">
              <span className="capitalize text-slate-700">{p}</span>
              <span className="flex items-center gap-2">
                <span className={`${settings.providers_live?.[p] ? 'text-emerald-700':'text-slate-600'}`}>{settings.providers_live?.[p] ? 'Live' : 'Sandbox'}</span>
                <input type="checkbox" checked={!!settings.providers_live?.[p]} onChange={e=> setSettings((s:any)=> { const next = { ...(s.providers_live||{}) } as Record<string, boolean>; next[p] = e.target.checked; return { ...s, providers_live: next }; })} />
              </span>
            </label>
          ))}
        </div>
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
        <label className="flex items-center gap-2 text-sm"> Auto-approve risky tools
          <input type="checkbox" checked={!!settings.auto_approve_all} onChange={e=>setSettings({...settings, auto_approve_all: e.target.checked})} />
        </label>
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">Some actions may require approval when auto-approve is off. Review in <a className="underline" href="/workspace?pane=approvals">Approvals</a>.</div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy} onClick={save}>{UI_STRINGS.ctas.primary.saveChanges}</Button>
          <Button variant="outline" disabled={busy} onClick={sendTestSms}>Send Test SMS</Button>
          <Button variant="outline" disabled={busy} onClick={sendTestEmail}>Send Test Email</Button>
        </div>
      </div>
      )}

      <StepPager steps={steps} index={step} onChange={setStep} persistKey="bvx_int_step" />
      <div className="grid md:grid-cols-3 gap-4 mt-1 overflow-hidden" data-guide="providers">
        {step===0 && SHOW_REDIRECT_URIS && redirects && (
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
        {step===1 && (
        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">HubSpot</div>
              <div className="text-sm text-slate-600">CRM sync (contacts + properties)</div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs ${onboarding?.connectedMap?.hubspot==='connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{onboarding?.connectedMap?.hubspot==='connected' ? 'Connected' : (onboarding?.connectedMap?.hubspot||'Not linked')}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" disabled={busy || connecting.hubspot || onboarding?.providers?.hubspot===false} onClick={()=> connect('hubspot')}>{connecting.hubspot ? 'Connecting…' : 'Connect HubSpot'}</Button>
            <Button variant="outline" disabled={busy || onboarding?.providers?.hubspot===false} onClick={hubspotUpsertSample}>Sync sample contact</Button>
            <Button variant="outline" disabled={busy} onClick={()=> refresh('hubspot')}>Refresh</Button>
          </div>
          {onboarding?.providers?.hubspot===false && <div className="mt-2 text-xs text-amber-700">Pending app credentials — configure HubSpot OAuth to enable.</div>}
          <div className="mt-2 text-xs text-amber-700">Note: Contact syncs may require approval if auto-approve is disabled.</div>
        </section>
        )}

        {step===1 && (
        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm" id="twilio-card" data-guide="twilio">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Twilio SMS</div>
              <div className="text-sm text-slate-600">Business SMS only — personal numbers not supported (yet). Each tenant uses their own number.</div>
            </div>
            <span className="px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700">Requires Twilio</span>
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
            <Button variant="outline" disabled={busy || isDemo} onClick={()=>{ try{ track('twilio_test_sms'); }catch{}; if (isDemo) { setStatus('Demo: sending disabled'); return; } sendTestSms(); try { showToast({ title:'Test SMS sent', description:'Test SMS sent successfully' }); } catch {} }}>{isDemo? 'Send test (disabled)' : 'Send test SMS'}</Button>
            <Button variant="outline" disabled={busy || isDemo} onClick={()=>{ if (isDemo) { setStatus('Demo: console unavailable'); return; } try{ track('twilio_console_open'); }catch{}; window.open('https://www.twilio.com/console', '_blank', 'noreferrer'); try { showToast({ title:'Opening Twilio Console' }); } catch {} }}>{isDemo? 'Twilio Console (demo off)' : 'Open Twilio Console'}</Button>
            <Button variant="outline" disabled={busy || isDemo} onClick={()=>{ if (isDemo) { setStatus('Demo: guide external link unavailable'); return; } try{ track('twilio_docs_open'); }catch{}; window.open('https://www.twilio.com/en-us/messaging/channels/sms', '_blank', 'noreferrer'); }}>{isDemo? 'Twilio Guide (demo off)' : 'Twilio SMS Guide'}</Button>
          </div>
          <div className="mt-2 text-xs text-amber-700">
            {isDemo ? 'Coming soon in demo. In live workspaces, you can provision a dedicated Twilio business number (no personal numbers).' : 'Use a dedicated Twilio business number for SMS. We’ll add number porting support later. For now, personal mobile numbers are not supported.'}
          </div>
        </section>
        )}

        {step===4 && (
        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Square / Acuity</div>
              <div className="text-sm text-slate-600">Booking & appointments (we currently ingest bookings & inventory only)</div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs ${onboarding?.connectedMap?.square==='connected' || onboarding?.connectedMap?.acuity==='connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{(onboarding?.connectedMap?.square==='connected' || onboarding?.connectedMap?.acuity==='connected') ? 'Connected' : 'Not linked'}</span>
          </div>
          {focusedProvider==='square' && sp.get('connected')==='1' && (
            <div className="mb-2 text-xs rounded-md px-2 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700">Square connected. You can import contacts now.</div>
          )}
          <div className="mt-3 flex gap-2">
            <Button variant="outline" disabled={busy || !squareLink || onboarding?.providers?.square===false} onClick={openSquare}>{squareLink ? 'Open Square booking' : 'No link set'}</Button>
            <Button variant="outline" disabled={busy || connecting.square || onboarding?.providers?.square===false} onClick={()=> connect('square')}>{connecting.square ? 'Connecting…' : 'Connect Square'}</Button>
            <Button variant="outline" disabled={busy || connecting.acuity || onboarding?.providers?.acuity===false} onClick={()=> connect('acuity')}>{connecting.acuity ? 'Connecting…' : 'Connect Acuity'}</Button>
            <Button variant="outline" disabled={busy || onboarding?.providers?.acuity===false} onClick={async()=>{ await acuityImportSample(); try{ showToast({ title:'Imported sample appointments', description:'Acuity sample appointments imported' }); }catch{} }}>Import sample appointments</Button>
            <Button variant="outline" disabled={busy} onClick={()=> { refresh('square'); try { showToast({ title:UI_STRINGS.ctas.secondary.refresh }); } catch {} }}>Refresh</Button>
            <Button variant="outline" disabled={busy} onClick={async()=>{
              try{
                setBusy(true);
                const r = await api.post('/integrations/booking/square/sync-contacts', { tenant_id: await getTenant() });
                setStatus(`Imported ${r?.imported||0} contacts from Square`);
                try { showToast({ title:'Imported', description: `${Number(r?.imported||0)} contacts` }); } catch {}
              }catch(e:any){ setStatus(String(e?.message||e)); }
              finally{ setBusy(false); }
            }}>Import contacts from Square</Button>
          </div>
          {(onboarding?.providers?.square===false || onboarding?.providers?.acuity===false) && <div className="mt-2 text-xs text-amber-700">Pending app credentials — configure Square/Acuity OAuth to enable.</div>}
          <div className="mt-2 text-xs text-amber-700">Note: Imports and booking merges may queue approvals when auto-approve is off.</div>
        </section>
        )}

        {step===6 && (
        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">SendGrid</div>
              <div className="text-sm text-slate-600">Transactional email</div>
            </div>
            <span className="px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700">Webhook ready</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" disabled={busy} onClick={sendTestEmail}>{UI_STRINGS.ctas.secondary.sendTestEmail}</Button>
          </div>
          <div className="mt-2 text-xs text-amber-700">Note: Test emails may require approval if auto-approve is disabled.</div>
        </section>
        )}

        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Google / Apple Calendar</div>
              <div className="text-sm text-slate-600">Two-way calendar (merge bookings)</div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs ${onboarding?.calendar_ready ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{onboarding?.calendar_ready? 'Ready' : 'Not linked'}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" disabled={busy || connecting.google || onboarding?.providers?.google===false} onClick={()=> connect('google')}>{connecting.google ? 'Connecting…' : UI_STRINGS.ctas.secondary.connectGoogle}</Button>
            <Button variant="outline" disabled={busy} onClick={()=> window.open('/workspace?pane=calendar','_self')}>{UI_STRINGS.ctas.secondary.openCalendar}</Button>
            <Button variant="outline" disabled={busy} onClick={()=> refresh('google')}>{UI_STRINGS.ctas.secondary.refresh}</Button>
          </div>
          {onboarding?.providers?.google===false && <div className="mt-2 text-xs text-amber-700">Pending app credentials — configure Google OAuth to enable.</div>}
        </section>

        {step===0 && SOCIAL_ON && (
          <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900">Instagram</div>
                <div className="text-sm text-slate-600">DMs & comments in Master Inbox</div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs ${onboarding?.inbox_ready ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{onboarding?.inbox_ready? 'Ready' : 'Not linked'}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" disabled={busy || connecting.instagram || onboarding?.providers?.instagram===false} onClick={()=> connect('instagram')}>{connecting.instagram ? 'Connecting…' : UI_STRINGS.ctas.secondary.connectInstagram}</Button>
              <Button variant="outline" disabled={busy} onClick={()=> window.open('/workspace?pane=messages','_self')}>{UI_STRINGS.ctas.secondary.openInbox}</Button>
              <Button variant="outline" disabled={busy} onClick={()=> refresh('instagram')}>{UI_STRINGS.ctas.secondary.refresh}</Button>
            </div>
            {(onboarding?.providers?.instagram===false) && <div className="mt-2 text-xs text-amber-700">Pending app credentials — configure Instagram OAuth to enable.</div>}
          </section>
        )}
        {step===0 && !SOCIAL_ON && (
          <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
            <div className="font-semibold text-slate-900">Instagram</div>
            <div className="text-sm text-slate-600">Social inbox is not enabled for this environment.</div>
            <div className="mt-2 text-xs text-slate-600">Set <code>VITE_FEATURE_SOCIAL=1</code> to enable.</div>
          </section>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-4">
        {step===5 && (
        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Shopify</div>
              <div className="text-sm text-slate-600">Inventory & products</div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs ${onboarding?.connectedMap?.shopify==='connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{onboarding?.connectedMap?.shopify==='connected' ? 'Connected' : (onboarding?.connectedMap?.shopify||'Not linked')}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" disabled={busy || connecting.shopify || onboarding?.providers?.shopify===false} onClick={()=> connect('shopify')}>{connecting.shopify ? 'Connecting…' : UI_STRINGS.ctas.secondary.connectShopify}</Button>
            <Button variant="outline" disabled={busy} onClick={()=> window.open('/workspace?pane=inventory','_self')}>{UI_STRINGS.ctas.secondary.openInventory}</Button>
            <Button variant="outline" disabled={busy} onClick={()=> refresh('shopify')}>{UI_STRINGS.ctas.secondary.refresh}</Button>
          </div>
          {onboarding?.providers?.shopify===false && <div className="mt-2 text-xs text-amber-700">Pending app credentials — configure Shopify OAuth to enable.</div>}
        </section>
        )}
      </div>

      {/* Image generation for users is available on the Vision page; intentionally not exposed here to avoid changing app imagery. */}
      <pre className="whitespace-pre-wrap mt-3 text-sm text-slate-700">{status}</pre>
    </div>
  );
}


