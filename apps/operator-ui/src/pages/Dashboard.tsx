import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Button, { ButtonLink } from '../components/ui/Button';
import { api, getTenant } from '../lib/api';
import { runUIAction } from '../lib/actions';
import { trackEvent } from '../lib/analytics';
import { motion } from 'framer-motion';
import { useToast } from '../components/ui/Toast';
import { startGuide } from '../lib/guide';
import Skeleton from '../components/ui/Skeleton';
import { UI_STRINGS } from '../lib/strings';
import StatusBadge from '../components/ui/StatusBadge';
import ShareCard from '../components/ui/ShareCard';

export default function Dashboard(){
  // recommendOnly hidden from UI in this pass; keep for future gating if needed
  // const recommendOnly = String((import.meta as any).env?.VITE_BETA_RECOMMEND_ONLY || localStorage.getItem('bvx_recommend_only') || '0') === '1';
  const loc = useLocation();
  const nav = useNavigate();
  const { showToast } = useToast();
  const isDemo = new URLSearchParams(loc.search).get('demo') === '1';
  const [metrics, setMetrics] = useState<any>({});
  const [queue, setQueue] = useState<any>({ items: [] });
  // funnel state removed
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string>('');
  const [nudgesMode, setNudgesMode] = useState<string>(()=> localStorage.getItem('bvx_nudges_mode') || 'on');
  useEffect(()=>{ try{ localStorage.setItem('bvx_nudges_mode', nudgesMode); }catch{} }, [nudgesMode]);
  // Chart removed on dashboard
  // const [planNotice, setPlanNotice] = useState('');
  // removed lastAnalyzed usage in compact dashboard
  // const nudgesEnabled = String((import.meta as any).env?.VITE_FEATURE_NUDGES || '0') === '1';

  // Connection toast from query (?connected=provider)
  useEffect(()=>{
    try{
      const sp = new URLSearchParams(window.location.search);
      const prov = sp.get('connected');
      if (prov) {
        showToast({ title: 'Connected', description: `${prov} linked successfully.` });
      }
    } catch {}
  }, [showToast]);

  useEffect(()=>{
    let mounted = true;
    const abort = new AbortController();
    (async()=>{
      // Post-onboarding quickstart sequence
      try {
        if (localStorage.getItem('bvx_post_onboarding_quickstart') === '1') {
          localStorage.removeItem('bvx_post_onboarding_quickstart');
          setTimeout(()=>{ try{ window.location.assign('/vision'); }catch{} }, 500);
          setTimeout(()=>{ try{ window.location.assign('/contacts'); }catch{} }, 1800);
          setTimeout(async()=>{
            try{
              const tid = await getTenant();
              await api.post('/ai/tools/execute', { tenant_id: tid, name: 'contacts.import.square', params: { tenant_id: tid }, require_approval: false });
            } catch {}
          }, 2200);
          setTimeout(()=>{ try{ window.location.assign('/ask?train=1'); }catch{} }, 3200);
        }
      } catch {}

      if (isDemo) {
        // Friendly demo placeholders (no red error state)
        setMetrics({ messages_sent: 128, time_saved_minutes: 372, revenue_uplift: 1240, referrals_30d: 9 });
        setQueue({ items: [
          { contact_id:'c_demo1', cadence_id:'welcome', step_index:1, next_action_at:'today 3:30 PM' },
          { contact_id:'c_demo2', cadence_id:'no_show_followup', step_index:2, next_action_at:'today 5:10 PM' },
        ]});
        // demo funnel removed
        if (mounted) { setLoading(false); setError(''); }
        return;
      }
      try{
        const tid = await getTenant();
        const timeoutMs = 7000;
        const tasks = [
          api.get(`/metrics?tenant_id=${encodeURIComponent(tid)}`, { signal: abort.signal, timeoutMs }),
          (async()=>{ const sess=(await supabase.auth.getSession()).data.session; if(!sess?.access_token) return { items: [] }; return api.get(`/cadences/queue?tenant_id=${encodeURIComponent(tid)}`, { signal: abort.signal, timeoutMs }); })(),
          api.get(`/funnel/daily?tenant_id=${encodeURIComponent(tid)}&days=30`, { signal: abort.signal, timeoutMs }),
          api.post('/messages/simulate', { tenant_id: tid, contact_id: 'demo', channel: 'email' }, { signal: abort.signal, timeoutMs }),
          api.post('/onboarding/analyze', { tenant_id: tid }, { signal: abort.signal, timeoutMs })
        ];
        const [mRes,qRes,fRes,_simRes,anRes] = await Promise.allSettled(tasks);
        if (!mounted) return;
        const m = mRes.status==='fulfilled'? mRes.value : {};
        const q = qRes.status==='fulfilled'? qRes.value : { items: [] };
        // const f = fRes.status==='fulfilled'? fRes.value : { series: [] };
        setMetrics(m||{}); setQueue(q||{items:[]});
        if (anRes.status==='fulfilled') {
          try {
            const ob = (anRes.value as any)?.summary || (anRes.value as any) || null;
            setOnboarding(ob);
          } catch {}
        }
        // analysis timestamp not shown in compact dashboard
        const failed = [mRes,qRes,fRes].some(r=>r.status==='rejected');
        // Do not show a banner; retry silently below. Keep error state for diagnostics only.
        if (!failed) setError('');
        // plan notice currently unused in decluttered UI
        // Gentle retry for failed widgets without blocking UI
        if (failed) {
          window.setTimeout(async()=>{
            if (!mounted) return;
            try {
              const retry = await Promise.allSettled([
                mRes.status==='rejected'? api.get(`/metrics?tenant_id=${encodeURIComponent(tid)}`, { timeoutMs: 8000 }): Promise.resolve(null as any),
                qRes.status==='rejected'? (async()=>{ const sess=(await supabase.auth.getSession()).data.session; if(!sess?.access_token) return null as any; return api.get(`/cadences/queue?tenant_id=${encodeURIComponent(tid)}`, { timeoutMs: 8000 }); })(): Promise.resolve(null as any),
                fRes.status==='rejected'? api.get(`/funnel/daily?tenant_id=${encodeURIComponent(tid)}&days=30`, { timeoutMs: 8000 }): Promise.resolve(null as any),
                ,
                anRes.status==='rejected'? api.post('/onboarding/analyze', { tenant_id: tid }, { timeoutMs: 8000 }) : Promise.resolve(null as any)
              ]);
              if (!mounted) return;
              if (mRes.status==='rejected' && retry[0].status==='fulfilled') setMetrics(retry[0].value||{});
              if (qRes.status==='rejected' && retry[1].status==='fulfilled') setQueue(retry[1].value||{items:[]});
              if (fRes.status==='rejected' && retry[2].status==='fulfilled') {/* setFunnel removed */}
              // analysis timestamp not shown in compact dashboard
              setError('');
            } catch {}
          }, 2000);
        }
      } catch(e:any){ if (mounted) setError(String(e?.message||e)); }
      finally{ if (mounted) setLoading(false); }
    })();
    return ()=> { mounted = false; try{ abort.abort(); }catch{} };
  },[isDemo]);

  // Chart prefetch/observer removed

  useEffect(()=>{
    try{
      const sp = new URLSearchParams(window.location.search);
      const postVerify = sp.get('postVerify') === '1' || localStorage.getItem('bvx_intro_pending') === '1';
      const signedOut = localStorage.getItem('bvx_signed_out') === '1';
      if (signedOut) { try{ localStorage.removeItem('bvx_signed_out'); }catch{} }
      const seen = localStorage.getItem('bvx_tour_seen_dashboard') === '1';
      // 7-day snooze for billing reminders
      const snooze = Number(localStorage.getItem('bvx_billing_nudge_snooze')||'0');
      if (snooze && Date.now() - snooze < 2*24*60*60*1000) {
        setShowBillingNudge(false);
      }
      if (sp.get('tour') === 'all' && !signedOut && !postVerify) {
        // Use the standard dashboard guide for workspace tour (avoid demo mega tour in real app)
        // Defer slightly to ensure DOM markers are present
        window.setTimeout(()=> startGuide('dashboard'), 200);
        return;
      }
      if (sp.get('tour') === '1' && !seen && !signedOut && !postVerify) {
        startGuide('dashboard');
        return;
      }
    } catch {}
  },[]);

  // const chartData = (funnel.series||[]).map((p:any)=>({ day:p.day || p.date || '', value:p.count || 0 }));

  // const startTour = () => startGuide('dashboard');
  // Signup callout auto-pop removed; user-driven routes/buttons only
  const [refLink, setRefLink] = useState<string>('');
  const [showBillingNudge, setShowBillingNudge] = useState(false);
  const [billingAdded, setBillingAdded] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(0);
  // wfProgress removed from Quick Start compact view
  const [foundingMember, setFoundingMember] = useState<boolean>(false);
  // const [quiet, setQuiet] = useState<{ start?: string; end?: string }>({});
  const [shareUrl] = useState<string>('');
  // removed copied state in streamlined share flow
  const [shareOpen, setShareOpen] = useState<boolean>(false);
  const shareCaption = 'BrandVX — early wins worth sharing';
  // Post-onboarding banner removed; keep state out to avoid unused var
  // Single page dashboard (pager removed)
  const [onboarding, setOnboarding] = useState<any>(null);

  // Plan: Next Best Steps
  const [planLoading, setPlanLoading] = useState<boolean>(false);
  const [planStatus, setPlanStatus] = useState<{ day_today?: number; days_total?: number }|null>(null);
  const [planTasks, setPlanTasks] = useState<string[]>([]);
  const [sessionSummary, setSessionSummary] = useState<string>('');
  const [setupPct, setSetupPct] = useState<number>(0);
  const loadPlan = async () => {
    try{
      setPlanLoading(true);
      const tid = await getTenant();
      const status = await api.get(`/plan/14day/status?tenant_id=${encodeURIComponent(tid)}`);
      setPlanStatus({ day_today: Number(status?.day_today||1), days_total: Number(status?.days_total||14) });
      // Load tasks for today
      try { const day = await api.get(`/plan/14day/day?tenant_id=${encodeURIComponent(tid)}`); setPlanTasks(Array.isArray(day?.tasks) ? day.tasks : []); } catch {}
      // Load last_session_summary memory as a short next-actions summary
      try{
        const mems = await api.get(`/ai/memories/list?tenant_id=${encodeURIComponent(tid)}&limit=10`);
        const last = (Array.isArray(mems?.items) ? mems.items : []).find((it:any)=> String(it?.key||'')==='last_session_summary');
        if (last && last.value) {
          const val = typeof last.value === 'string' ? last.value : (typeof last.value?.toString === 'function' ? last.value.toString() : '');
          setSessionSummary(String(val||''));
        }
      } catch {}
      // Load setup percent for a small indicator
      try{
        const prog = await api.get(`/onboarding/progress/status?tenant_id=${encodeURIComponent(tid)}`);
        setSetupPct(Number(prog?.percent||0));
      } catch {}
    } finally {
      setPlanLoading(false);
    }
  };
  useEffect(()=>{ (async()=>{ try{ await loadPlan(); } catch{} })(); }, []);

  // Reanalyze action removed with micro-wins trim

  // Live Time Saved ticker (gentle optimistic counter)
  const [timeSavedLive, setTimeSavedLive] = useState<number>(0);
  useEffect(()=>{
    const base = Number((metrics?.time_saved_minutes||0));
    setTimeSavedLive(isFinite(base) ? base : 0);
  }, [metrics?.time_saved_minutes]);
  useEffect(()=>{
    const hasWork = (queue?.items||[]).length > 0;
    if (!hasWork) return;
    const id = window.setInterval(()=> setTimeSavedLive(v=> v + 1), 20000);
    return ()=> window.clearInterval(id);
  }, [queue?.items]);

  useEffect(()=>{
    (async()=>{
      try{
        const uid = (await supabase.auth.getUser()).data.user?.id;
        if (!uid) return;
        const { data } = await supabase.from('referral_codes').select('code').eq('user_id', uid).single();
        let code = data?.code as string|undefined;
        if (!code){
          const c = Math.random().toString(36).slice(2,9);
          await supabase.from('referral_codes').insert({ user_id: uid, code: c });
          code = c;
        }
        const link = `${window.location.origin}/brandvx?ref=${code}`;
        setRefLink(link);
      } catch {}
    })();
  },[]);

  useEffect(()=>{
    (async()=>{
      try{
        const tid = await getTenant();
        const r = await api.get(`/settings?tenant_id=${encodeURIComponent(tid)}`);
        try {
          const fm = Boolean(r?.data?.founding_member) || localStorage.getItem('bvx_founding_member') === '1';
          setFoundingMember(fm);
        } catch {}
        // Quiet hours are not displayed on Dashboard in this pass
      } catch {}
    })();
  },[]);

  useEffect(()=>{
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('demo') === '1') {
        const k = 'bvx_demo_started_at';
        if (!localStorage.getItem(k)) localStorage.setItem(k, String(Date.now()));
      }
      const startedAt = Number(localStorage.getItem('bvx_demo_started_at')||'0');
      const covered = localStorage.getItem('bvx_billing_added') === '1';
      setBillingAdded(covered);
      if (startedAt && !covered) {
        const twoDaysMs = 2*24*60*60*1000;
        if (Date.now() - startedAt > twoDaysMs) setShowBillingNudge(true);
      }
    } catch {}
  }, []);

  // Trial tracking (client-side best effort)
  useEffect(()=>{
    try {
      const TRIAL_DAYS = Number((import.meta as any).env?.VITE_STRIPE_TRIAL_DAYS || '7');
      let started = Number(localStorage.getItem('bvx_trial_started_at')||'0');
      if (!started) {
        started = Date.now();
        localStorage.setItem('bvx_trial_started_at', String(started));
      }
      const elapsedDays = Math.floor((Date.now() - started) / (24*60*60*1000));
      const left = Math.max(0, TRIAL_DAYS - elapsedDays);
      setTrialDaysLeft(left);
    } catch {}
  }, []);

  // Share action kept via ShareCard component; direct handler removed from quick wins trim

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
    </div>
  );
  const softError = false; // banner suppressed per UX request
  const socialPlanReady = (()=>{ try{ return localStorage.getItem('bvx_social_plan_ready') === '1'; }catch{ return false; }})();

  // Pager removed

  return (
    <div className="space-y-3">
      {socialPlanReady && (
        <section className="rounded-2xl p-3 border bg-sky-50 border-sky-200 text-sky-900">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm">Your 14‑day social plan is ready.</div>
            <Button size="sm" variant="outline" onClick={()=>{ try{ localStorage.removeItem('bvx_social_plan_ready'); }catch{}; window.location.assign('/workflows'); }}>Open</Button>
          </div>
        </section>
      )}
      {/* Post-onboarding banner removed; replaced by post-tour modal in WorkspaceShell */}
      {/* Founders banner temporarily hidden to reduce clutter on first paint */}
      {false && (
        <section className="rounded-2xl p-4 backdrop-blur bg-white/60 border border-white/70 shadow-sm mt-2">
          <div className="flex flex-wrap items-center gap-2">
            {["Approve next 3 posts","Confirm Friday appointments","Revive 2 dormant","Add booking to IG bio","Invite 1 friend"].map((t)=> (
              <button key={t} className="px-3 py-1.5 rounded-full border bg-white text-sm hover:shadow-sm">{t}</button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={()=>{ try{ localStorage.setItem('bvx_nudges_snooze', String(Date.now())); }catch{} }}>Don't show this week</Button>
              <div className="text-xs text-slate-700">Mode:</div>
              <select className="text-xs border rounded-md px-2 py-1 bg-white" value={nudgesMode} onChange={(e)=> setNudgesMode(e.target.value)}>
                <option value="on">On</option>
                <option value="digest">Email digest</option>
                <option value="off">Off</option>
              </select>
            </div>
          </div>
        </section>
      )}
      {false && softError && (
        <section className="rounded-2xl p-3 border bg-amber-50 border-amber-200 text-amber-900">
          <div className="text-sm">Some widgets failed to load. We’ll retry in the background.</div>
        </section>
      )}
      {/* Beta banner removed from dashboard per declutter request */}
      {/* Trial nearing banner suppressed; trial note will render in bottom stack */}
      {billingAdded && (
        <section className="rounded-2xl p-4 border bg-emerald-50 border-emerald-200 text-emerald-900">
          <div className="flex items-center gap-2 text-sm"><span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-emerald-500" /> You’re covered — billing active.
            {foundingMember && <span className="ml-2 px-2 py-0.5 text-[11px] rounded-full border bg-white text-emerald-800 border-emerald-300">Founding Member</span>}
          </div>
        </section>
      )}
      {false && (
        <section />
      )}
      {/* Top utility row removed; we'll render referral & trial in bottom stack */}
      {false && showBillingNudge && (
        <section className="rounded-2xl p-3 backdrop-blur bg-amber-50/70 border border-amber-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 text-amber-900 justify-center">
            <div className="text-sm">Free trial running — add a payment method anytime to avoid interruptions later.</div>
            <ButtonLink href="/billing" size="sm" className="rounded-full px-3 py-1.5">{UI_STRINGS.ctas.secondary.addPayment}</ButtonLink>
            <Button variant="ghost" size="sm" onClick={()=>{ setShowBillingNudge(false); try{ localStorage.setItem('bvx_billing_nudge_snooze', String(Date.now())); }catch{} }}>Remind me later</Button>
          </div>
        </section>
      )}
      {!billingAdded && trialDaysLeft > 0 && (
        <section className="rounded-2xl p-3 backdrop-blur bg-white/80 border border-white/70 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 justify-center text-slate-800">
            <div className="text-sm">Free trial · {trialDaysLeft} day{trialDaysLeft===1?'':'s'} left</div>
            {/* Removed Add payment button; Lock $97/mo remains */}
            <Button size="sm" variant="outline" onClick={()=> nav('/billing') } className="rounded-full px-3 py-1.5">Lock $97/mo</Button>
          </div>
        </section>
      )}
      {/* Referral card below the top trial banner */}
      {refLink && (
        <section className="px-0" data-guide="referral">
          <div className="max-w-md mx-auto rounded-2xl px-3 py-1 bg-white shadow-sm">
            <div className="text-[11px] text-slate-700 mb-1 text-center">Your referral link</div>
            <div className="flex items-center gap-2">
              <input readOnly value={refLink} className="h-9 text-sm flex-1 border rounded-lg px-2 py-1 bg-white text-slate-800" onFocus={(e)=>e.currentTarget.select()} />
              <Button size="sm" className="rounded-full px-3" onClick={async()=>{ try{ await navigator.clipboard.writeText(refLink); trackEvent('referral.copy'); }catch{} }}>Copy</Button>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 text-center">Referrals (30d): <span className="font-medium text-slate-700">{Number(metrics?.referrals_30d||0)}</span></div>
            <div className="mt-1 text-[11px] text-slate-600 text-center">
              {(() => {
                try{
                  const n = Number(metrics?.referrals_30d||0);
                  if (n >= 2) return 'Price preview: $97/mo locked in with 2+ referrals.';
                  if (n === 1) return 'One more friend → Founding price $97/mo.';
                  return 'Invite 2 friends to lock in $97/mo Founding price.';
                } catch { return null; }
              })()}
            </div>
          </div>
        </section>
      )}
      {/* Provider status badges from onboarding analyze */}
      {(() => {
        try{
          if (!onboarding) return null;
          const connectedMap = (onboarding.connectedMap || onboarding.connected || {}) as Record<string,string>;
          const providersCfg = (onboarding.providers || {}) as Record<string,boolean>;
          const providers = ['google','square','acuity','hubspot','instagram','shopify','twilio','sendgrid'];
          const items = providers.map(p=>{
            const isConn = String(connectedMap[p]||'') === 'connected';
            const cfg = providersCfg[p];
            const status = isConn ? 'connected' : (cfg === true ? 'configured' : 'pending');
            return { key:p, status };
          });
          const any = items.some(i=> i.status);
          if (!any) return null;
          return (
            <section className="rounded-2xl p-2 bg-white border border-white/60 shadow-sm">
              <div className="flex flex-wrap gap-2 items-center text-[11px]">
                <span className="text-slate-700 mr-1">Providers:</span>
                {items.map(i=> (
                  <StatusBadge key={i.key} status={i.status as any} />
                ))}
              </div>
            </section>
          );
        } catch { return null; }
      })()}

      {/* KPI tiles hero band: fixed height, absolute-positioned grid */}
      <section className="relative h-[200px] md:h-[240px] rounded-2xl" data-guide="kpis">
        <div aria-hidden className="absolute inset-0 -z-10" style={{
          background: 'radial-gradient(900px 320px at 10% -10%, rgba(236,72,153,0.08), transparent), radial-gradient(700px 240px at 90% -20%, rgba(99,102,241,0.08), transparent)'
        }} />
        <div className="h-full grid place-items-center">
          <div className="max-w-5xl mx-auto grid grid-cols-4 place-items-center gap-6 px-3 py-6">
            <div className="flex-shrink-0" style={{ width: 'clamp(150px, 19vw, 200px)' }}>
              <KpiAnimated title="Messages sent" value={Number(metrics?.messages_sent||0)} onClick={()=> nav('/messages')} />
            </div>
            <div className="flex-shrink-0" style={{ width: 'clamp(150px, 19vw, 200px)' }}>
              <TimeSavedAnimated title="Time saved" minutes={Number(timeSavedLive||0)} onClick={()=> nav('/cadences')} />
            </div>
            <div className="flex-shrink-0" style={{ width: 'clamp(150px, 19vw, 200px)' }}>
              <KpiAnimated title="Rebook rate (30d)" value={Number(Math.round((metrics?.rebook_rate_30d||0)))} prefix="%" onClick={()=> nav('/calendar')} />
            </div>
            <div className="flex-shrink-0" style={{ width: 'clamp(150px, 19vw, 200px)' }}>
              <KpiAnimated title="Revenue uplift" value={Number(metrics?.revenue_uplift||0)} prefix="$" onClick={()=> nav('/billing')} />
            </div>
          </div>
        </div>
      </section>
      
      {/* Micro-wins and quick wins CTAs removed per UI trim */}
      {/* Quick Start 3 WorkStyles (stacked vertically) */}
      <section className="rounded-2xl p-2 bg-white border border-white/60 shadow-sm" data-guide="quickstart">
        <h4 className="text-base md:text-[17px] font-semibold text-slate-900 text-center">Quick Start</h4>
        <div className="mt-2 max-w-sm mx-auto grid gap-2">
          <Button size="sm" variant="outline" className="w-full" onClick={()=> window.location.assign('/vision')}>Brand Vision</Button>
          <Button size="sm" variant="outline" className="w-full" onClick={async()=>{ window.location.assign('/contacts'); try{ const tid = await getTenant(); await api.post('/ai/tools/execute',{ tenant_id: tid, name:'contacts.import.square', params:{ tenant_id: tid }, require_approval: false }); }catch{} }}>Import Clients</Button>
          <Button size="sm" variant="outline" className="w-full" onClick={()=> window.location.assign('/ask?train=1')}>Train VX</Button>
        </div>
      </section>
      {/* Next Best Steps (Day N/14 + today's tasks) */}
      <section className="rounded-2xl p-3 bg-white border border-white/60 shadow-sm" data-guide="next-best-steps">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900">Next Best Steps</div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            {typeof setupPct === 'number' && setupPct >= 0 && (
              <span aria-label={`Setup ${setupPct}%`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-white">Setup {setupPct}%</span>
            )}
            {planStatus?.day_today && (
              <span>Day {Number(planStatus.day_today||1)}/{Number(planStatus.days_total||14)}</span>
            )}
          </div>
        </div>
        <div className="mt-2 text-sm text-slate-700">
          {planLoading ? (
            <div>Loading plan…</div>
          ) : planTasks.length > 0 ? (
            <ul className="list-disc ml-5">
              {planTasks.slice(0,4).map((t,i)=> <li key={i}>{String(t)}</li>)}
            </ul>
          ) : (
            <div className="text-slate-600">No plan yet. Generate a 14‑day plan to get started.</div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={async()=>{ try{ await api.post('/plan/14day/generate', { tenant_id: await getTenant(), step_key: 'init' }); } catch{} await loadPlan(); }}>Generate 14‑day plan</Button>
          <Button size="sm" variant="outline" onClick={()=> window.location.assign('/ask')}>Open AskVX</Button>
        </div>
        {!!sessionSummary && (
          <div className="mt-3 rounded-md border bg-slate-50 p-2">
            <div className="text-xs text-slate-600">Last session summary</div>
            <div className="text-sm text-slate-800 whitespace-pre-wrap mt-1">{sessionSummary}</div>
          </div>
        )}
      </section>

      {/* Today strip: one primary CTA */}
      <section className="rounded-2xl p-3 bg-white border border-white/60 shadow-sm" data-guide="primary">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Today</div>
          <div className="text-[11px] text-slate-500">{new Date().toLocaleDateString()}</div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="text-sm text-slate-700">Primary action:</div>
          <Button size="sm" onClick={()=> runUIAction('appointments.confirm_friday')}>Confirm Friday appointments</Button>
        </div>
      </section>
      {/* Bottom stack removed (trial/referral now at top) */}
      {/* chart removed */}
      <ShareCard
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        title="Share your BrandVX wins"
        caption={shareCaption}
        templateUrl={"/assets/story-template.png"}
        qrRect={{ x: 263, y: 693, w: 554, h: 592 }}
        hoursRect={{ x: 170, y: 1030, maxW: 430 }}
        hoursValue={Number(metrics?.time_saved_minutes||0)}
      />
      {/* Micro-wins removed */}
      {/* Cadence Queue moved to Cadences page */}
    </div>
  );
}

// old KPI components removed in favor of animated versions above

// Animated counters for top KPIs
function KpiAnimated({ title, value, prefix='', onClick }:{ title:string; value:number; prefix?:string; onClick?: ()=>void }){
  const [display, setDisplay] = useState<number>(0);
  useEffect(()=>{
    const target = Math.max(0, Math.round(value||0));
    const durationMs = 900;
    const start = performance.now();
    const tick = (t:number)=>{
      const p = Math.min(1, (t - start)/durationMs);
      setDisplay(Math.round(target * (p<0.5? 2*p*p : -1 + (4 - 2*p)*p))); // ease-in-out quad
      if (p < 1) requestAnimationFrame(tick); else setDisplay(target);
    };
    setDisplay(0);
    const raf = requestAnimationFrame(tick);
    return ()=> cancelAnimationFrame(raf);
  }, [value]);
  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl p-3 bg-white shadow-md aspect-[4/3] grid place-items-center border border-slate-200 cursor-pointer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(236,72,153,0.12)' }}
      onClick={onClick}
    >
      <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(600px 220px at 20% -20%, rgba(236,72,153,0.12), transparent)' }} />
      <div className="text-center">
        <div className="text-4xl font-extrabold text-slate-900 tracking-tight">{prefix}{display.toLocaleString()}</div>
        <div className="mt-1 text-xs text-slate-500">{title}</div>
      </div>
    </motion.div>
  );
}

function TimeSavedAnimated({ title, minutes, onClick }:{ title:string; minutes:number; onClick?: ()=>void }){
  const hours = Math.floor((minutes||0)/60);
  const [display, setDisplay] = useState<number>(0);
  useEffect(()=>{
    const target = Math.max(0, Math.round(hours||0));
    const durationMs = 900;
    const start = performance.now();
    const tick = (t:number)=>{
      const p = Math.min(1, (t - start)/durationMs);
      setDisplay(Math.round(target * (p<0.5? 2*p*p : -1 + (4 - 2*p)*p)));
      if (p < 1) requestAnimationFrame(tick); else setDisplay(target);
    };
    setDisplay(0);
    const raf = requestAnimationFrame(tick);
    return ()=> cancelAnimationFrame(raf);
  }, [hours]);
  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl p-3 bg-white shadow-md aspect-[4/3] grid place-items-center border border-slate-200 cursor-pointer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(236,72,153,0.12)' }}
      onClick={onClick}
      aria-label={`${title}: ${display}h`}
    >
      <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(600px 220px at 80% -20%, rgba(99,102,241,0.12), transparent)' }} />
      <div className="text-center">
        <div className="text-4xl font-extrabold text-slate-900 tracking-tight">{display}h</div>
        <div className="mt-1 text-xs text-slate-500 flex items-center justify-center gap-2">
          {title}
          <span className="inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
        </div>
      </div>
    </motion.div>
  );
}

// DynamicMicroWins removed per UI trim
