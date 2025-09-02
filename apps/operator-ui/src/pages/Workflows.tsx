import { Link, useNavigate, useLocation } from 'react-router-dom';
import Button, { ButtonLink } from '../components/ui/Button';
import { startGuide } from '../lib/guide';
import ShareCard from '../components/ui/ShareCard';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api, getTenant } from '../lib/api';
import { track } from '../lib/analytics';
import { useToast } from '../components/ui/Toast';
// removed duplicate useLocation import

type W = { title: string; description: string; to: string; cta?: string };

const workflows: W[] = [
  { title: 'Finish onboarding', description: 'Connect accounts, set brand profile, and preview consent timings (7d/3d/1d/2h).', to: '/onboarding', cta: 'Go to Onboarding' },
  { title: 'Follow‑ups', description: 'Send kind, consent-first messages with quiet-hours and approvals.', to: '/cadences', cta: 'Open Follow‑ups' },
  { title: 'Unified calendar', description: 'Sync Google/Apple and merge Square/Acuity bookings (scheduling from BrandVX disabled).', to: '/calendar', cta: 'Open Calendar' },
  { title: 'Manage inventory', description: 'Sync Shopify/Square, review items and stock levels.', to: '/inventory', cta: 'Open Inventory' },
  { title: 'Master inbox', description: 'Connect Instagram and see all messages in one place.', to: '/inbox', cta: 'Open Inbox' },
  { title: 'Client curation', description: 'Hire/Fire with swipe/drag and quick stats.', to: '/curation', cta: 'Open Curation' },
  { title: 'Approvals', description: 'Review pending approvals and confirm risky actions.', to: '/approvals', cta: 'Open Approvals' },
];

export default function Workflows(){
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<number>(()=>{
    try{ const sp = new URLSearchParams(window.location.search); const s = Number(sp.get('step')||'1'); return Math.max(1, Math.min(2, isFinite(s)? s : 1)) - 1; } catch { return 0; }
  });
  // Actions first, Overview last
  // Sub-pages inside Actions: 1) Playbooks + progress, 2) Impact pack + quick actions
  const [actionPage, setActionPage] = useState<number>(()=>{
    try{ const sp = new URLSearchParams(window.location.search); const a = Number(sp.get('ap')||'1'); return Math.max(1, Math.min(2, isFinite(a)? a : 1)) - 1; } catch { return 0; }
  });
  const recommendOnly = String((import.meta as any).env?.VITE_BETA_RECOMMEND_ONLY || localStorage.getItem('bvx_recommend_only') || '0') === '1';
  const { showToast } = useToast();
  const isDemo = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('demo') === '1';
  const [busy, setBusy] = useState(false);
  const [lowItems, setLowItems] = useState<Array<{name:string; stock?: number}>>([]);
  const [socialPreview, setSocialPreview] = useState<any>(null);
  const [lastRun, setLastRun] = useState<Record<string, number>>({});
  const [approvals, setApprovals] = useState<number>(0);
  const [hasResume, setHasResume] = useState<boolean>(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const loc = useLocation(); void loc; // avoid TS6133 when not used
  const [connected, setConnected] = useState<Record<string,string>>({});
  const [playbooks, setPlaybooks] = useState<Record<string, boolean>>({});
  const [wfProgress, setWfProgress] = useState<Record<string, boolean>>({});
  const [activeWf, setActiveWf] = useState<'crm_organization'|'book_filling'|'inventory_tracking'|'social_automation'|'client_communication'>('crm_organization');
  const [packState, setPackState] = useState<Record<string, 'pending'|'skipped'|'done'>>({
    warm5: 'pending',
    reminders: 'pending',
    dormantPreview: 'pending',
    dedupe: 'pending',
    lowstock: 'pending',
  });
  // const [skipNote, setSkipNote] = useState<Record<string,string>>({});

  useEffect(()=>{
    (async()=>{
      try {
        const r = await api.get(`/approvals?tenant_id=${encodeURIComponent(await getTenant())}`);
        const items = Array.isArray(r) ? r : (r.items || []);
        setApprovals(items.filter((it:any)=> (it.status||'pending')==='pending').length);
      } catch {}
      try {
        const tid = (await getTenant());
        const v = localStorage.getItem(`bvx_plan_queue_${tid}`);
        setHasResume(!!v);
      } catch { setHasResume(false); }
      try {
        const a = await api.post('/onboarding/analyze', { tenant_id: await getTenant() });
        if (a?.summary?.connected) setConnected(a.summary.connected);
      } catch {}
      try {
        const s = await api.get(`/settings?tenant_id=${encodeURIComponent(await getTenant())}`);
        const pb = s?.data?.preferences?.playbooks || {};
        setPlaybooks(pb);
        const wp = s?.data?.wf_progress || {};
        setWfProgress(wp);
      } catch {}
    })();
  }, []);

  // Sync step with pretty routes
  useEffect(()=>{
    try{
      if (location.pathname.startsWith('/styles/actions')) setStep(0);
      else if (location.pathname.startsWith('/styles')) setStep(1);
      else {
        const sp = new URLSearchParams(location.search);
        const s = Number(sp.get('step')||'1');
        if (s>=1 && s<=2) setStep(s-1);
      }
    } catch {}
  }, [location.pathname, location.search]);

  const gotoStep = (idx: number) => {
    const clamped = Math.max(0, Math.min(1, idx|0));
    setStep(clamped);
    // Stay inside the workspace — map steps into querystring
    const sp = new URLSearchParams(window.location.search);
    sp.set('pane', 'workflows');
    sp.set('step', String(clamped + 1));
    navigate(`/workspace?${sp.toString()}`);
  };

  const gotoActionPage = (idx: number) => {
    const clamped = Math.max(0, Math.min(1, idx|0));
    setActionPage(clamped);
    const sp = new URLSearchParams(window.location.search);
    sp.set('pane','workflows');
    sp.set('step', String(step + 1));
    sp.set('ap', String(clamped + 1));
    navigate(`/workspace?${sp.toString()}`);
  };

  const prev = () => gotoStep(step - 1);
  const next = () => gotoStep(step + 1);

  const twilioReady = (connected['twilio']||'') === 'connected';

  const markDone = (k: string) => setPackState(s=> ({ ...s, [k]: 'done' }));
  const markSkip = (k: string) => setPackState(s=> ({ ...s, [k]: 'skipped' }));

  const runWarmFive = async () => {
    if (isDemo) { showToast({ title:'Demo mode', description:'Create an account to run this.' }); return; }
    if (recommendOnly) { showToast({ title:'Beta', description:'Recommend-only mode — preview recipients & draft instead of sending.' }); return; }
    if (!twilioReady) { showToast({ title:'Connect Twilio', description:'Please connect Twilio to send SMS.' }); return; }
    setBusy(true);
    try {
      const r = await api.post('/ai/tools/execute', {
        tenant_id: await getTenant(),
        name: 'notify_trigger_send',
        params: { tenant_id: await getTenant(), max_candidates: 5, message_template: 'Quick nudge to book or confirm.' },
        require_approval: true,
      });
      showToast({ title: 'Warm leads', description: r.status === 'pending' ? 'Awaiting approval for 5 texts.' : 'Sent 5 warm nudges.' });
      markDone('warm5');
    } catch(e:any) {
      showToast({ title:'Error', description:String(e?.message||e) });
    } finally { setBusy(false); }
  };

  const runReminders = async () => {
    if (isDemo) { showToast({ title:'Demo mode', description:'Create an account to run this.' }); return; }
    if (recommendOnly) { showToast({ title:'Beta', description:'Recommend-only mode — preview reminders in Dashboard today’s outreach.' }); return; }
    setBusy(true);
    try {
      const r = await api.post('/ai/tools/execute', { tenant_id: await getTenant(), name:'appointments.schedule_reminders', params:{ tenant_id: await getTenant() }, require_approval: false });
      showToast({ title: 'Reminders', description: r?.status||'ok' });
      markDone('reminders'); setLastRun(s=>({...s, reminders: Date.now()}));
    } catch(e:any) { showToast({ title:'Error', description:String(e?.message||e) }); }
    finally { setBusy(false); }
  };

  const runDormantPreview = async () => {
    if (isDemo) { showToast({ title:'Demo mode', description:'Create an account to run this.' }); return; }
    setBusy(true);
    try {
      const r = await api.post('/ai/tools/execute', { tenant_id: await getTenant(), name:'campaigns.dormant.preview', params:{ tenant_id: await getTenant(), threshold_days: 60 }, require_approval: false });
      showToast({ title:'Dormant preview', description:`Preview ready${r?.count? ` for ${r.count}`:''}.` });
      markDone('dormantPreview'); setLastRun(s=>({...s, dormantPreview: Date.now()}));
    } catch(e:any){ showToast({ title:'Error', description:String(e?.message||e) }); }
    finally { setBusy(false); }
  };

  // Playbooks installer
  const installPlaybook = async (id: 'warm_leads'|'no_show_reminders'|'dormant_reengage') => {
    if (isDemo) { showToast({ title:'Demo mode', description:'Create an account to install playbooks.' }); return; }
    setBusy(true);
    try {
      const tid = await getTenant();
      const s = await api.get(`/settings?tenant_id=${encodeURIComponent(tid)}`);
      const prefs = { ...(s?.data?.preferences||{}) };
      const current = { ...(prefs.playbooks||{}) } as Record<string, boolean>;
      current[id] = true;
      prefs.playbooks = current;
      await api.post('/settings', { tenant_id: tid, preferences: prefs });
      setPlaybooks(current);
    } catch(e:any){
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const runDedupe = async () => {
    if (isDemo) { showToast({ title:'Demo mode', description:'Create an account to run this.' }); return; }
    setBusy(true);
    try {
      const r = await api.post('/ai/tools/execute', {
        tenant_id: await getTenant(),
        name: 'contacts.dedupe',
        params: { tenant_id: await getTenant() },
        require_approval: true,
      });
      setLastRun(s=>({...s, dedupe: Date.now()}));
      showToast({ title: 'Dedupe', description: r.status === 'pending' ? 'Awaiting approval.' : 'Done.' });
      try { track('wf_dedupe', { status: r?.status }); } catch {}
    } catch (e: any) {
      showToast({ title: 'Error', description: String(e?.message||e) });
    } finally {
      setBusy(false);
    }
  };

  const checkLow = async () => {
    if (isDemo) { showToast({ title:'Demo mode', description:'Create an account to run this.' }); return; }
    setBusy(true);
    try {
      const r = await api.post('/ai/tools/execute', {
        tenant_id: await getTenant(),
        name: 'inventory.alerts.get',
        params: { tenant_id: await getTenant(), low_stock_threshold: Number(localStorage.getItem('bvx_low_threshold')||'5') },
        require_approval: false,
      });
      setLowItems(r?.items || []);
      setLastRun(s=>({...s, low: Date.now()}));
      showToast({ title: 'Inventory', description: `Found ${r?.items?.length || 0} low stock items.` });
      try { track('wf_low_stock', { count: r?.items?.length||0 }); } catch {}
    } catch (e: any) {
      showToast({ title: 'Error', description: String(e?.message||e) });
    } finally {
      setBusy(false);
    }
  };

  const draftSocial = async () => {
    if (isDemo) { showToast({ title:'Demo mode', description:'Create an account to run this.' }); return; }
    setBusy(true);
    try {
      const r = await api.post('/ai/tools/execute', {
        tenant_id: await getTenant(),
        name: 'social.schedule.14days',
        params: { tenant_id: await getTenant() },
        require_approval: true,
      });
      setSocialPreview(r);
      setLastRun(s=>({...s, social: Date.now()}));
      showToast({ title: 'Social plan', description: r.status === 'pending' ? 'Awaiting approval.' : 'Draft ready.' });
      try {
        const sh = await api.post('/share/create', { tenant_id: await getTenant(), title:'My 14‑day social plan is live!', description:'Drafted with BrandVX.', image_url:'', caption:'Just planned two weeks of posts with #BrandVX 🚀' });
        if (sh?.url) { setShareUrl(sh.url); setShareOpen(true); }
      } catch {}
      try { track('wf_social_plan', { status: r?.status }); } catch {}
    } catch (e: any) {
      showToast({ title: 'Error', description: String(e?.message||e) });
    } finally {
      setBusy(false);
    }
  };

  const wfList: Array<{k:'crm_organization'|'book_filling'|'inventory_tracking'|'social_automation'|'client_communication'; title:string; desc:string}> = [
    { k:'crm_organization', title:'CRM organization', desc:'Import, dedupe, consent setup.' },
    { k:'book_filling', title:'Book‑filling', desc:'Reminders (7d/3d/1d/2h) with quiet hours.' },
    { k:'inventory_tracking', title:'Inventory tracking', desc:'Sync Square/Shopify; low‑stock alerts.' },
    { k:'social_automation', title:'Social (14‑day)', desc:'Draft 14 days of posts in your voice.' },
    { k:'client_communication', title:'Client communication', desc:'Unified inbox + approvals.' },
  ];

  const persistProgress = async (k: string) => {
    try{
      const tid = await getTenant();
      const s = await api.get(`/settings?tenant_id=${encodeURIComponent(tid)}`);
      const next = { ...(s?.data?.wf_progress||{}), [k]: true };
      await api.post('/settings', { tenant_id: tid, wf_progress: next });
      setWfProgress(next);
      showToast({ title:'Step completed', description:'Progress saved.' });
    }catch(e:any){ showToast({ title:'Error', description:String(e?.message||e) }); }
  };

  // --- Workflow progress panel (bottom half reflects active step) ---
  const active = wfList.find(x=> x.k===activeWf) || wfList[0];
  const markActiveComplete = async()=>{ await persistProgress(active.k); };

  return (
    <div className="space-y-3">
      {/* StepPager removed; header Prev/Next + buttons control steps */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Work Styles</h3>
        <div className="flex items-center gap-2">
          <button
            aria-label="Previous"
            disabled={step===0}
            onClick={prev}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border ${step===0? 'opacity-50 cursor-not-allowed' : 'bg-white hover:shadow-sm'}`}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <button
            aria-label="Next"
            disabled={step===1}
            onClick={next}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border ${step===1? 'opacity-50 cursor-not-allowed' : 'bg-white hover:shadow-sm'}`}
          >
            Next <ChevronRight size={16} />
          </button>
          <Button variant="outline" size="sm" onClick={()=> gotoStep(0)}>Actions</Button>
          <Button variant="outline" size="sm" onClick={()=> gotoStep(1)}>Overview</Button>
          <Button variant="outline" size="sm" aria-label="Open workflows guide" onClick={()=> startGuide('workflows')}>Guide me</Button>
        </div>
      </div>
      {step===0 && (
        <div className="mt-2 inline-flex items-center gap-2 text-xs">
          <span className="text-slate-600">Page</span>
          <button className={`px-2 py-1 rounded-md border ${actionPage===0? 'bg-white' : 'bg-slate-50'}`} onClick={()=> gotoActionPage(0)}>1</button>
          <button className={`px-2 py-1 rounded-md border ${actionPage===1? 'bg-white' : 'bg-slate-50'}`} onClick={()=> gotoActionPage(1)}>2</button>
        </div>
      )}
      {step===1 && (
        <>
          <p className="text-sm text-slate-600">Everything you can do in BrandVX, in one place. Consent-first, simple language, step-by-step.</p>
          <div className="grid md:grid-cols-2 gap-4">
            {workflows.map(w => (
              <section key={w.to} className="rounded-2xl p-4 bg-white/70 backdrop-blur border border-white/70 shadow-sm">
                <div className="font-medium text-slate-900">{w.title}</div>
                <div className="text-sm text-slate-600 mt-1">{w.description}</div>
                <div className="mt-3">
                  <ButtonLink href={w.to}>{w.cta || 'Open'}</ButtonLink>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
      {step===0 && actionPage===0 && (
      <section className="rounded-2xl p-4 bg-white/70 backdrop-blur border border-white/70 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-semibold">Playbooks</h4>
        </div>
        <p className="text-sm text-slate-600 mt-1">Install starter cadences you can customize later.</p>
        <div className="mt-3 grid sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border bg-white p-3">
            <div className="font-medium text-slate-900">Warm leads (gentle nudge)</div>
            <div className="text-slate-600 mt-1">Quick SMS/email sequence for engaged prospects.</div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={busy || !!playbooks['warm_leads']} onClick={()=> installPlaybook('warm_leads')}>{playbooks['warm_leads']? 'Installed' : 'Install'}</Button>
            </div>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <div className="font-medium text-slate-900">No‑show reminders</div>
            <div className="text-slate-600 mt-1">Reminder cadence (7d/3d/1d/2h) respecting quiet hours.</div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={busy || !!playbooks['no_show_reminders']} onClick={()=> installPlaybook('no_show_reminders')}>{playbooks['no_show_reminders']? 'Installed' : 'Install'}</Button>
            </div>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <div className="font-medium text-slate-900">Dormant re‑engage</div>
            <div className="text-slate-600 mt-1">60‑day retargeter with friendly follow‑ups.</div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={busy || !!playbooks['dormant_reengage']} onClick={()=> installPlaybook('dormant_reengage')}>{playbooks['dormant_reengage']? 'Installed' : 'Install'}</Button>
            </div>
          </div>
        </div>
      </section>
      )}
      {/* Workflow tracker: select a workflow and complete current step */}
      {step===0 && actionPage===0 && (
      <section className="rounded-2xl p-4 bg-white/70 backdrop-blur border border-white/70 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-semibold">Your 5 workflows</h4>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {wfList.map(w=> (
            <button key={w.k} onClick={()=> setActiveWf(w.k)}
              className={`px-3 py-2 rounded-full border text-sm ${activeWf===w.k? 'bg-sky-50 border-sky-200 text-sky-800' : 'bg-white'}`}>
              {w.title} {wfProgress?.[w.k] && <span className="ml-1 text-[11px] text-emerald-700">• done</span>}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-xl border bg-white p-3">
          <div className="font-medium text-slate-900">{active.title}</div>
          <div className="text-sm text-slate-600 mt-1">{active.desc}</div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={markActiveComplete} disabled={!!wfProgress?.[active.k]}> {wfProgress?.[active.k] ? 'Completed' : 'Complete step'} </Button>
            <Button variant="outline" size="sm" onClick={()=> window.scrollTo({ top: 0, behavior:'smooth' })}>Open actions above</Button>
          </div>
        </div>
      </section>
      )}
      {step===0 && actionPage===1 && (
      <section className="rounded-2xl p-4 bg-white/70 backdrop-blur border border-white/70 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-semibold">48‑hour impact pack</h4>
          {Object.values(packState).every(s=> s!=='pending') && (
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">Completed</span>
          )}
        </div>
        <p className="text-sm text-slate-600 mt-1">Run a few high‑impact steps now. You can skip any step.</p>
        <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border bg-white p-3">
            <div className="font-medium text-slate-900">Text 5 warm leads</div>
            <div className="text-slate-600 mt-1">Send 5 consent‑first nudges to likely bookers.</div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={busy || packState.warm5!=='pending'} onClick={runWarmFive}>Run</Button>
              <Button size="sm" variant="outline" disabled={packState.warm5!=='pending'} onClick={()=> markSkip('warm5')}>Skip</Button>
            </div>
            {packState.warm5==='skipped' && (
              <div className="mt-2 text-xs text-slate-600">Skipped</div>
            )}
          </div>
          <div className="rounded-xl border bg-white p-3">
            <div className="font-medium text-slate-900">Schedule reminders</div>
            <div className="text-slate-600 mt-1">Gentle reminders with quiet hours respected.</div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={busy || packState.reminders!=='pending'} onClick={runReminders}>Run</Button>
              <Button size="sm" variant="outline" disabled={packState.reminders!=='pending'} onClick={()=> markSkip('reminders')}>Skip</Button>
            </div>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <div className="font-medium text-slate-900">Preview dormant (≥60d)</div>
            <div className="text-slate-600 mt-1">See who to re‑engage; approve campaign later.</div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={busy || packState.dormantPreview!=='pending'} onClick={runDormantPreview}>Run</Button>
              <Button size="sm" variant="outline" disabled={packState.dormantPreview!=='pending'} onClick={()=> markSkip('dormantPreview')}>Skip</Button>
            </div>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <div className="font-medium text-slate-900">Dedupe contacts</div>
            <div className="text-slate-600 mt-1">Clean duplicates for better deliverability.</div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={busy || packState.dedupe!=='pending'} onClick={runDedupe}>Run</Button>
              <Button size="sm" variant="outline" disabled={packState.dedupe!=='pending'} onClick={()=> markSkip('dedupe')}>Skip</Button>
            </div>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <div className="font-medium text-slate-900">Low‑stock alerts</div>
            <div className="text-slate-600 mt-1">Find items to restock or promote as add‑ons.</div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={busy || packState.lowstock!=='pending'} onClick={checkLow}>Run</Button>
              <Button size="sm" variant="outline" disabled={packState.lowstock!=='pending'} onClick={()=> markSkip('lowstock')}>Skip</Button>
            </div>
          </div>
        </div>
        {Object.values(packState).some(s=> s==='skipped') && (
          <div className="mt-3 text-xs text-slate-600">You skipped some steps. You can run them later from here.</div>
        )}
      </section>
      )}
      {/* End-of-pack summary */}
      {step===0 && actionPage===1 && (() => {
        const vals = Object.values(packState);
        const done = vals.filter(v=> v==='done').length;
        const skipped = vals.filter(v=> v==='skipped').length;
        const pending = vals.filter(v=> v==='pending').length;
        if (done + skipped === 0) return null;
        return (
          <section className="rounded-2xl p-4 bg-white/70 backdrop-blur border border-white/70 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-semibold">Impact pack summary</h4>
              {pending === 0 && <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">All steps reviewed</span>}
            </div>
            <div className="text-sm text-slate-700 mt-1">{done} completed · {skipped} skipped{pending? ` · ${pending} pending`: ''}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/workspace?pane=dashboard" className="px-3 py-2 rounded-full bg-slate-900 text-white text-sm">Back to dashboard</Link>
              {pending > 0 && <button className="px-3 py-2 rounded-full border bg-white text-sm" onClick={()=> window.scrollTo({ top: 0, behavior: 'smooth' })}>Review pending</button>}
            </div>
          </section>
        );
      })()}
      {step===0 && actionPage===1 && (
      <section className="rounded-2xl p-4 bg-white/70 backdrop-blur border border-white/70 shadow-sm" data-tour="wf-quick">
        <div className="font-medium text-slate-900">Quick actions</div>
        <div className="text-sm text-slate-600 mt-1 flex flex-wrap gap-2 items-center">
          <span>Run common workflow steps right here.</span>
          {approvals > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700">{approvals} pending approvals</span>
          )}
          {hasResume && (
            <Link to="/ask" className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-sky-50 border-sky-200 text-sky-700">Resume last plan</Link>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" data-tour="wf-dedupe" disabled={busy} onClick={runDedupe}>Dedupe contacts</Button>
          <Button variant="outline" size="sm" data-tour="wf-lowstock" disabled={busy} onClick={checkLow}>Check low stock</Button>
          <Button variant="outline" size="sm" data-tour="wf-social" disabled={busy} onClick={draftSocial}>Draft social 14‑day</Button>
        </div>
        <div className="mt-2 grid sm:grid-cols-3 gap-2 text-xs text-slate-600">
          <div className="rounded-md border bg-white p-2"><div className="font-medium text-slate-800">Dedupe</div><div>{lastRun.dedupe ? `Last run: ${new Date(lastRun.dedupe).toLocaleTimeString()}` : 'Not run yet'}</div></div>
          <div className="rounded-md border bg-white p-2"><div className="font-medium text-slate-800">Low stock</div><div>{lastRun.low ? `Last run: ${new Date(lastRun.low).toLocaleTimeString()}` : 'Not run yet'}</div></div>
          <div className="rounded-md border bg-white p-2"><div className="font-medium text-slate-800">Social plan</div><div>{lastRun.social ? `Last run: ${new Date(lastRun.social).toLocaleTimeString()}` : 'Not run yet'}</div></div>
        </div>
        {lowItems.length > 0 && (
          <div className="mt-3 text-sm text-slate-700">
            <div className="font-medium">Low stock items</div>
            <ul className="list-disc ml-5">
              {lowItems.map((i, idx) => (<li key={idx}>{i.name}{typeof i.stock === 'number' ? ` (Stock: ${i.stock})` : ''}</li>))}
            </ul>
          </div>
        )}
        {socialPreview?.days && Array.isArray(socialPreview.days) && (
          <div className="mt-3 text-sm text-slate-700">
            <div className="font-medium">Social plan preview</div>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              {socialPreview.days.slice(0,6).map((d: any, idx: number) => (
                <div key={idx} className="rounded-md border bg-white p-2">
                  <div className="text-slate-800 text-sm">{d.date}</div>
                  <div className="text-slate-600 text-xs">Channels: {(d.channels||[]).join(', ')}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-500 mt-1">Showing first 6 of {socialPreview.days.length} days.</div>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" onClick={()=>{
                const data = JSON.stringify(socialPreview, null, 2);
                const blob = new Blob([data], { type:'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'social_plan.json'; a.click(); URL.revokeObjectURL(url);
              }}>Export JSON</Button>
              <Button variant="outline" size="sm" onClick={()=>{
                const rows = [['date','channels']].concat((socialPreview.days||[]).map((d:any)=> [d.date, (d.channels||[]).join('|')]));
                const csv = rows.map(r=> r.map((x:string)=> '"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n');
                const blob = new Blob([csv], { type:'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'social_plan.csv'; a.click(); URL.revokeObjectURL(url);
              }}>Export CSV</Button>
            </div>
          </div>
        )}
      </section>
      )}
      <ShareCard open={shareOpen} onOpenChange={setShareOpen} url={shareUrl} title="Share your plan" caption="Just planned two weeks of posts with #BrandVX 🚀" />
      <div className="text-xs text-slate-500">Tip: You can also ask “Get Started!” in AskVX to jump straight into these.</div>
    </div>
  );
}


