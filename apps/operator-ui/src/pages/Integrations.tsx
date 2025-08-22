import { useEffect, useState } from 'react';
import { api, getTenant } from '../lib/api';
import { track } from '../lib/analytics';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export default function Integrations(){
  const [settings, setSettings] = useState<any>({ tone:'helpful', services:['sms','email'], auto_approve_all:false, quiet_hours:{ start:'21:00', end:'08:00' }, preferences:{} });
  const [status, setStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [onboarding, setOnboarding] = useState<any>({ connected:false, first_sync_done:false, counts:{}, connectedMap:{}, providers:{} });
  const [squareLink, setSquareLink] = useState<string>('');
  const reanalyze = async () => {
    try{
      const a = await api.post('/onboarding/analyze', { tenant_id: await getTenant() });
      setOnboarding({ ...a?.summary, connectedMap: a?.summary?.connected || {}, providers: a?.summary?.providers || {} });
      setStatus('Re‑analyzed.');
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
    })();
  },[]);

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

  const save = async () => {
    try{
      setBusy(true);
      const prefs = { ...(settings.preferences||{}), user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, user_timezone_offset: computeOffsetHours() };
      const r = await api.post('/settings',{ tenant_id: await getTenant(), ...settings, preferences: prefs });
      setStatus(JSON.stringify(r));
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
    try{ setBusy(true); const r = await api.post('/messages/send',{ tenant_id: await getTenant(), contact_id:'c_demo', channel:'sms', body:'Test SMS from BrandVX (reply STOP/HELP to opt out)' }); setStatus(JSON.stringify(r)); }
    catch(e:any){ setStatus(String(e?.message||e)); }
    finally{ setBusy(false); }
  };
  const sendTestEmail = async () => {
    try{ setBusy(true); const r = await api.post('/messages/send',{ tenant_id: await getTenant(), contact_id:'c_demo', channel:'email', subject:'BrandVX Test', body:'<p>Hello from BrandVX</p>' }); setStatus(JSON.stringify(r)); }
    catch(e:any){ setStatus(String(e?.message||e)); }
    finally{ setBusy(false); }
  };
  const enableSms = async () => {
    try{
      setBusy(true);
      const r = await api.post('/integrations/twilio/provision', { tenant_id: await getTenant(), area_code: '' });
      setStatus(JSON.stringify(r));
      if (r?.status === 'ok') setStatus('SMS enabled: ' + (r?.from || '')); else setErrorMsg(r?.detail||r?.status||'Enable failed');
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
    } catch(e:any){ setStatus(String(e?.message||e)); }
    finally{ setBusy(false); }
  };

  const acuityImportSample = async () => {
    try{
      setBusy(true);
      const r = await api.post('/integrations/booking/acuity/import', { tenant_id: await getTenant(), since:'0', until:'', cursor:'' });
      setStatus(JSON.stringify(r));
    } catch(e:any){ setStatus(String(e?.message||e)); }
    finally{ setBusy(false); }
  };

  const openSquare = () => { if (squareLink) window.open(squareLink, '_blank'); };
  const connect = async (provider: string) => {
    try{
      setConnecting((m)=> ({ ...m, [provider]: true }));
      setErrorMsg('');
      const r = await api.get(`/oauth/${provider}/login?tenant_id=${encodeURIComponent(await getTenant())}`);
      if (r?.url) window.open(r.url, '_blank');
    }catch(e:any){
      setErrorMsg(String(e?.message||e));
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Integrations & Settings</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 px-2 py-1 rounded-md border bg-white/70">
            TZ: {Intl.DateTimeFormat().resolvedOptions().timeZone} (UTC{computeOffsetHours()>=0?'+':''}{computeOffsetHours()})
          </span>
          <Button variant="outline" size="sm" onClick={reanalyze}>Re‑analyze</Button>
          <Button variant="outline" size="sm" aria-label="Open integrations guide" onClick={()=>{
            try { track('guide_open', { area: 'integrations' }); } catch {}
            const d = driver({ showProgress: true, steps: [
              { popover: { title: 'Integrations', description: 'Connect booking, CRM, messaging, and inventory.' } },
              { element: '[data-guide="providers"]', popover: { title: 'Providers', description: 'Each card shows connection status and actions.' } },
              { element: '[data-guide="twilio"]', popover: { title: 'SMS via Twilio', description: 'Use a dedicated business number. Personal numbers are not supported yet.' } },
            ] } as any);
            d.drive();
          }}>Guide me</Button>
        </div>
      </div>
      {onboarding?.providers && (
        <div className="text-xs text-slate-700 bg-white/70 border border-white/70 rounded-md px-2 py-1 inline-block">
          {(() => {
            const entries = Object.entries(onboarding.providers as Record<string, boolean>);
            const total = entries.length;
            const configured = entries.filter(([,v]) => !!v).length;
            const pending = total - configured;
            return `Configured: ${configured}/${total} · Pending config: ${pending}`;
          })()}
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
      <div className="grid gap-3 max-w-xl">
        {onboarding?.providers && Object.entries(onboarding.providers).some(([,v])=> (v as boolean)===false) && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">Some providers are pending app credentials; connect buttons will be disabled for those until configured.</div>
        )}
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">Note: Some integration actions may be gated by approvals. You can review and approve in the Approvals page.</div>
        <label className="flex items-center gap-2 text-sm"> Tone
          <Input value={settings.tone||''} onChange={e=>setSettings({...settings,tone:e.target.value})} />
        </label>
        <div className="text-sm text-slate-700">Provider mode</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {['google','square','acuity','hubspot','facebook','instagram','shopify'].map(p=> (
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
          <div className="text-slate-700">Quiet hours</div>
          <input className="border rounded-md px-2 py-1 bg-white" type="time" value={settings.quiet_hours?.start||'21:00'} onChange={e=> setSettings({...settings, quiet_hours:{ ...(settings.quiet_hours||{}), start:e.target.value }})} aria-label="Quiet hours start" />
          <input className="border rounded-md px-2 py-1 bg-white" type="time" value={settings.quiet_hours?.end||'08:00'} onChange={e=> setSettings({...settings, quiet_hours:{ ...(settings.quiet_hours||{}), end:e.target.value }})} aria-label="Quiet hours end" />
        </div>
        <label className="flex items-center gap-2 text-sm"> Auto-approve risky tools
          <input type="checkbox" checked={!!settings.auto_approve_all} onChange={e=>setSettings({...settings, auto_approve_all: e.target.checked})} />
        </label>
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">Some actions may require approval when auto-approve is off. Review in Approvals.</div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy} onClick={save}>Save</Button>
          <Button variant="outline" disabled={busy} onClick={sendTestSms}>Send Test SMS</Button>
          <Button variant="outline" disabled={busy} onClick={sendTestEmail}>Send Test Email</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-4" data-guide="providers">
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

        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm" id="twilio-card" data-guide="twilio">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Twilio SMS</div>
              <div className="text-sm text-slate-600">Business SMS only — personal numbers not supported (yet)</div>
            </div>
            <span className="px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700">Requires Twilio</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={enableSms}>Enable SMS</Button>
            <Button variant="outline" disabled={busy} onClick={()=>{ try{ track('twilio_test_sms'); }catch{}; sendTestSms(); }}>Send test SMS</Button>
            <Button variant="outline" disabled={busy} onClick={()=>{ try{ track('twilio_console_open'); }catch{}; window.open('https://www.twilio.com/console', '_blank', 'noreferrer'); }}>Open Twilio Console</Button>
            <Button variant="outline" disabled={busy} onClick={()=>{ try{ track('twilio_docs_open'); }catch{}; window.open('https://www.twilio.com/en-us/messaging/channels/sms', '_blank', 'noreferrer'); }}>Twilio SMS Guide</Button>
          </div>
          <div className="mt-2 text-xs text-amber-700">
            Use a dedicated Twilio business number for SMS. We’ll add number porting support later. For now, personal mobile numbers are not supported.
          </div>
        </section>

        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Square / Acuity</div>
              <div className="text-sm text-slate-600">Booking & appointments</div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs ${onboarding?.connectedMap?.square==='connected' || onboarding?.connectedMap?.acuity==='connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{(onboarding?.connectedMap?.square==='connected' || onboarding?.connectedMap?.acuity==='connected') ? 'Connected' : 'Not linked'}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" disabled={busy || !squareLink || onboarding?.providers?.square===false} onClick={openSquare}>{squareLink ? 'Open Square booking' : 'No link set'}</Button>
            <Button variant="outline" disabled={busy || connecting.square || onboarding?.providers?.square===false} onClick={()=> connect('square')}>{connecting.square ? 'Connecting…' : 'Connect Square'}</Button>
            <Button variant="outline" disabled={busy || connecting.acuity || onboarding?.providers?.acuity===false} onClick={()=> connect('acuity')}>{connecting.acuity ? 'Connecting…' : 'Connect Acuity'}</Button>
            <Button variant="outline" disabled={busy || onboarding?.providers?.acuity===false} onClick={acuityImportSample}>Import sample appointments</Button>
            <Button variant="outline" disabled={busy} onClick={()=> refresh('square')}>Refresh</Button>
          </div>
          {(onboarding?.providers?.square===false || onboarding?.providers?.acuity===false) && <div className="mt-2 text-xs text-amber-700">Pending app credentials — configure Square/Acuity OAuth to enable.</div>}
          <div className="mt-2 text-xs text-amber-700">Note: Imports and booking merges may queue approvals when auto-approve is off.</div>
        </section>

        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">SendGrid</div>
              <div className="text-sm text-slate-600">Transactional email</div>
            </div>
            <span className="px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700">Webhook ready</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" disabled={busy} onClick={sendTestEmail}>Send test email</Button>
          </div>
          <div className="mt-2 text-xs text-amber-700">Note: Test emails may require approval if auto-approve is disabled.</div>
        </section>

        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Google / Apple Calendar</div>
              <div className="text-sm text-slate-600">Two-way calendar (merge bookings)</div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs ${onboarding?.calendar_ready ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{onboarding?.calendar_ready? 'Ready' : 'Not linked'}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" disabled={busy || connecting.google || onboarding?.providers?.google===false} onClick={()=> connect('google')}>{connecting.google ? 'Connecting…' : 'Connect Google'}</Button>
            <Button variant="outline" disabled={busy} onClick={()=> window.open('/calendar','_self')}>Open Calendar</Button>
            <Button variant="outline" disabled={busy} onClick={()=> refresh('google')}>Refresh</Button>
          </div>
          {onboarding?.providers?.google===false && <div className="mt-2 text-xs text-amber-700">Pending app credentials — configure Google OAuth to enable.</div>}
        </section>

        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Facebook / Instagram</div>
              <div className="text-sm text-slate-600">DMs & comments in Master Inbox</div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs ${onboarding?.inbox_ready ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{onboarding?.inbox_ready? 'Ready' : 'Not linked'}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" disabled={busy || connecting.facebook || onboarding?.providers?.facebook===false} onClick={()=> connect('facebook')}>{connecting.facebook ? 'Connecting…' : 'Connect Facebook'}</Button>
            <Button variant="outline" disabled={busy || connecting.instagram || onboarding?.providers?.instagram===false} onClick={()=> connect('instagram')}>{connecting.instagram ? 'Connecting…' : 'Connect Instagram'}</Button>
            <Button variant="outline" disabled={busy} onClick={()=> window.open('/inbox','_self')}>Open Inbox</Button>
            <Button variant="outline" disabled={busy} onClick={()=> refresh('facebook')}>Refresh</Button>
          </div>
          {(onboarding?.providers?.facebook===false || onboarding?.providers?.instagram===false) && <div className="mt-2 text-xs text-amber-700">Pending app credentials — configure Facebook/Instagram OAuth to enable.</div>}
        </section>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <section className="rounded-2xl p-4 bg-white/60 backdrop-blur border border-white/70 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Shopify</div>
              <div className="text-sm text-slate-600">Inventory & products</div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs ${onboarding?.connectedMap?.shopify==='connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{onboarding?.connectedMap?.shopify==='connected' ? 'Connected' : (onboarding?.connectedMap?.shopify||'Not linked')}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" disabled={busy || connecting.shopify || onboarding?.providers?.shopify===false} onClick={()=> connect('shopify')}>{connecting.shopify ? 'Connecting…' : 'Connect Shopify'}</Button>
            <Button variant="outline" disabled={busy} onClick={()=> window.open('/inventory','_self')}>Open Inventory</Button>
            <Button variant="outline" disabled={busy} onClick={()=> refresh('shopify')}>Refresh</Button>
          </div>
          {onboarding?.providers?.shopify===false && <div className="mt-2 text-xs text-amber-700">Pending app credentials — configure Shopify OAuth to enable.</div>}
        </section>
      </div>

      {/* Image generation for users is available on the Vision page; intentionally not exposed here to avoid changing app imagery. */}
      <pre className="whitespace-pre-wrap mt-3 text-sm text-slate-700">{status}</pre>
    </div>
  );
}


