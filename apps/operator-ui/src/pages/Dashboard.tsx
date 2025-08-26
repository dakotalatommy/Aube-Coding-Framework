import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Button, { ButtonLink } from '../components/ui/Button';
import { api, getTenant } from '../lib/api';
import { track } from '../lib/analytics';
import { motion } from 'framer-motion';
import { lazy, Suspense, useRef } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
const FunnelChart = lazy(()=> import('../components/charts/FunnelChart'));
import { startGuide, startDemoMegaTour } from '../lib/guide';
import { Card, CardBody } from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import { Table, THead, TR, TH, TD } from '../components/ui/Table';

export default function Dashboard(){
  const recommendOnly = String((import.meta as any).env?.VITE_BETA_RECOMMEND_ONLY || localStorage.getItem('bvx_recommend_only') || '0') === '1';
  const loc = useLocation();
  const nav = useNavigate();
  const isDemo = new URLSearchParams(loc.search).get('demo') === '1';
  const [metrics, setMetrics] = useState<any>({});
  const [queue, setQueue] = useState<any>({ items: [] });
  const [funnel, setFunnel] = useState<any>({ series: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const chartRef = useRef<HTMLDivElement|null>(null);
  const [chartVisible, setChartVisible] = useState(false);
  const prefetchChart = () => { try { import('../components/charts/FunnelChart'); } catch {} };
  const [planNotice, setPlanNotice] = useState('');

  useEffect(()=>{
    let mounted = true;
    const abort = new AbortController();
    (async()=>{
      if (isDemo) {
        // Friendly demo placeholders (no red error state)
        setMetrics({ messages_sent: 128, time_saved_minutes: 372, revenue_uplift: 1240, referrals_30d: 9 });
        setQueue({ items: [
          { contact_id:'c_demo1', cadence_id:'welcome', step_index:1, next_action_at:'today 3:30 PM' },
          { contact_id:'c_demo2', cadence_id:'no_show_followup', step_index:2, next_action_at:'today 5:10 PM' },
        ]});
        setFunnel({ series:[{ day:'Mon', count:12 }, { day:'Tue', count:18 }, { day:'Wed', count:16 }, { day:'Thu', count:22 }, { day:'Fri', count:19 }] });
        if (mounted) { setLoading(false); setError(''); }
        return;
      }
      try{
        const tid = await getTenant();
        const timeoutMs = 7000;
        const tasks = [
          api.get(`/metrics?tenant_id=${encodeURIComponent(tid)}`, { signal: abort.signal, timeoutMs }),
          api.get(`/cadences/queue?tenant_id=${encodeURIComponent(tid)}`, { signal: abort.signal, timeoutMs }),
          api.get(`/funnel/daily?tenant_id=${encodeURIComponent(tid)}&days=30`, { signal: abort.signal, timeoutMs }),
          api.post('/messages/simulate', { tenant_id: tid, contact_id: 'demo', channel: 'email' }, { signal: abort.signal, timeoutMs }),
        ];
        const [mRes,qRes,fRes,simRes] = await Promise.allSettled(tasks);
        if (!mounted) return;
        const m = mRes.status==='fulfilled'? mRes.value : {};
        const q = qRes.status==='fulfilled'? qRes.value : { items: [] };
        const f = fRes.status==='fulfilled'? fRes.value : { series: [] };
        setMetrics(m||{}); setQueue(q||{items:[]}); setFunnel(f||{series:[]});
        const failed = [mRes,qRes,fRes].some(r=>r.status==='rejected');
        if (failed && !isDemo) setError('Some widgets failed to load. Retrying soon…');
        try { if (simRes.status==='fulfilled' && simRes.value?.plan_notice) setPlanNotice(String(simRes.value.plan_notice)); } catch {}
        // Gentle retry for failed widgets without blocking UI
        if (failed) {
          window.setTimeout(async()=>{
            if (!mounted) return;
            try {
              const retry = await Promise.allSettled([
                mRes.status==='rejected'? api.get(`/metrics?tenant_id=${encodeURIComponent(tid)}`, { timeoutMs: 8000 }): Promise.resolve(null as any),
                qRes.status==='rejected'? api.get(`/cadences/queue?tenant_id=${encodeURIComponent(tid)}`, { timeoutMs: 8000 }): Promise.resolve(null as any),
                fRes.status==='rejected'? api.get(`/funnel/daily?tenant_id=${encodeURIComponent(tid)}&days=30`, { timeoutMs: 8000 }): Promise.resolve(null as any),
              ]);
              if (!mounted) return;
              if (mRes.status==='rejected' && retry[0].status==='fulfilled') setMetrics(retry[0].value||{});
              if (qRes.status==='rejected' && retry[1].status==='fulfilled') setQueue(retry[1].value||{items:[]});
              if (fRes.status==='rejected' && retry[2].status==='fulfilled') setFunnel(retry[2].value||{series:[]});
              setError('');
            } catch {}
          }, 2000);
        }
      } catch(e:any){ if (mounted) setError(String(e?.message||e)); }
      finally{ if (mounted) setLoading(false); }
    })();
    return ()=> { mounted = false; try{ abort.abort(); }catch{} };
  },[isDemo]);

  useEffect(()=>{
    const el = chartRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries)=>{
      for (const e of entries) {
        if (e.isIntersecting) { setChartVisible(true); obs.disconnect(); break; }
      }
    }, { rootMargin: '0px 0px -20% 0px' });
    obs.observe(el);
    return ()=> obs.disconnect();
  }, []);

  // Idle-time prefetch of chart chunk to reduce first paint when visible
  useEffect(()=>{
    const t = window.setTimeout(()=> { prefetchChart(); }, 2000);
    return ()=> window.clearTimeout(t);
  }, []);

  useEffect(()=>{
    try{
      const sp = new URLSearchParams(window.location.search);
      const signedOut = localStorage.getItem('bvx_signed_out') === '1';
      if (signedOut) { try{ localStorage.removeItem('bvx_signed_out'); }catch{} }
      const seen = localStorage.getItem('bvx_tour_seen_dashboard') === '1';
      if (sp.get('tour') === 'all' && !signedOut) {
        startDemoMegaTour();
        return;
      }
      if (sp.get('tour') === '1' && !seen && !signedOut) {
        startGuide('dashboard');
        const t = window.setTimeout(()=>{
          setShowSignupModal(true);
        }, 4000);
        return () => window.clearTimeout(t);
      }
    } catch {}
  },[]);

  const chartData = (funnel.series||[]).map((p:any)=>({ day:p.day || p.date || '', value: p.count || 0 }));

  const startTour = () => startGuide('dashboard');
  const startFullDemoTour = () => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('demo') !== '1') { window.location.href = '/workspace?pane=dashboard&demo=1&tour=all'; return; }
    startDemoMegaTour();
  };
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [refLink, setRefLink] = useState<string>('');
  const [showBillingNudge, setShowBillingNudge] = useState(false);
  const [billingAdded, setBillingAdded] = useState(false);
  const [wfProgress, setWfProgress] = useState<Record<string, boolean>>({});
  const [foundingMember, setFoundingMember] = useState<boolean>(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareCopied, setShareCopied] = useState<boolean>(false);

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
        const wp = r?.data?.wf_progress || {};
        setWfProgress(wp);
        try {
          const fm = Boolean(r?.data?.founding_member) || localStorage.getItem('bvx_founding_member') === '1';
          setFoundingMember(fm);
        } catch {}
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

  const handleCreateShare = async () => {
    try {
      const tid = await getTenant();
      const title = 'BrandVX Results';
      const description = 'Automation results powered by BrandVX';
      const res = await api.post('/share/create', { tenant_id: tid, title, description });
      const url = String(res?.url || `${window.location.origin}/s/${res?.token || ''}`);
      setShareUrl(url);
      try { await navigator.clipboard.writeText(url); setShareCopied(true); } catch { setShareCopied(false); }
    } catch {}
  };

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
  if (!isDemo && error) return <div style={{color:'#b91c1c'}}>Error: {error}</div>;
  return (
    <div className="space-y-4">
      {(isDemo || recommendOnly) && (
        <section className="rounded-2xl p-3 border bg-amber-50/80 border-amber-200 text-amber-900">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{isDemo ? 'Demo mode — data is simulated.' : 'Beta: Sending via BrandVX is coming soon. Preview & copy now; sending will be enabled automatically later.'}</span>
            <ButtonLink href="/signup" size="sm" className="rounded-full px-3 py-1.5">Create account</ButtonLink>
            <ButtonLink href="/billing" size="sm" variant="outline" className="rounded-full px-3 py-1.5">Add payment</ButtonLink>
          </div>
        </section>
      )}
      {(!billingAdded) && planNotice && (
        <section className="rounded-2xl p-3 border bg-amber-50 border-amber-200 text-amber-900">
          <div className="text-sm">Trial nearing limit — add a payment method to continue without interruptions.</div>
          <div className="mt-1">
            <ButtonLink href="/billing" size="sm" className="rounded-full px-3 py-1.5">Add payment</ButtonLink>
          </div>
        </section>
      )}
      {billingAdded && (
        <section className="rounded-2xl p-3 border bg-emerald-50 border-emerald-200 text-emerald-900">
          <div className="flex items-center gap-2 text-sm"><span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-emerald-500" /> You’re covered — billing active.
            {foundingMember && <span className="ml-2 px-2 py-0.5 text-[11px] rounded-full border bg-white text-emerald-800 border-emerald-300">Founding Member</span>}
          </div>
        </section>
      )}
      {showSignupModal && (
        <section className="rounded-2xl p-4 backdrop-blur bg-white/80 border border-white/70 shadow-lg">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-slate-800">Enjoying the tour? Create your BrandVX to continue — free trial, optional payment now.</div>
            <Button onClick={()=>{ setShowSignupModal(false); nav('/signup?from=tour'); }} className="rounded-full px-4 py-2">Create account</Button>
            <Button variant="outline" onClick={()=>{ setShowSignupModal(false); nav('/billing'); }} className="rounded-full px-4 py-2">Add payment (optional)</Button>
          </div>
        </section>
      )}
      <section className="rounded-2xl p-4 backdrop-blur bg-white/60 border border-white/70 shadow-sm" data-guide="quick-actions">
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/workspace?pane=contacts" variant="outline" size="md" className="px-4 py-2">Import Contacts</ButtonLink>
          <ButtonLink href="/workspace?pane=cadences" variant="outline" size="md" className="px-4 py-2">Start Cadence</ButtonLink>
          <ButtonLink href="/workspace?pane=messages" variant="outline" size="md" className="px-4 py-2">Simulate Message</ButtonLink>
          <ButtonLink href="/workspace?pane=integrations" size="md" className="px-4 py-2">Connect Tools</ButtonLink>
          <ButtonLink href="/billing" variant="outline" size="md" className="px-4 py-2">Billing</ButtonLink>
          <Button variant="outline" size="md" onClick={handleCreateShare} className="px-4 py-2">Share results</Button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="md" onClick={startTour} className="px-4 py-2" aria-label="Open dashboard guide">Guide me</Button>
            <Button variant="ghost" size="sm" onClick={startFullDemoTour} className="px-3 py-2">Run full demo tour</Button>
          </div>
        </div>
        {shareUrl && (
          <div className="mt-3 text-sm flex items-center gap-2">
            <span className="text-slate-700">Share link:</span>
            <input readOnly value={shareUrl} className="flex-1 border rounded-lg px-2 py-1 bg-white text-slate-800" onFocus={(e)=>e.currentTarget.select()} />
            <span className="text-emerald-700">{shareCopied ? 'Copied' : ''}</span>
          </div>
        )}
      </section>
      {showBillingNudge && (
        <section className="rounded-2xl p-4 backdrop-blur bg-amber-50/70 border border-amber-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 text-amber-900">
            <div className="text-sm">Free trial running — add a payment method anytime to avoid interruptions later.</div>
            <ButtonLink href="/billing" size="sm" className="rounded-full px-3 py-1.5">Add payment</ButtonLink>
            <Button variant="ghost" size="sm" onClick={()=>{ setShowBillingNudge(false); try{ localStorage.setItem('bvx_billing_nudge_snooze', String(Date.now())); }catch{} }}>Remind me later</Button>
          </div>
        </section>
      )}
      {refLink && (
        <section className="rounded-2xl p-4 backdrop-blur bg-white/60 border border-white/70 shadow-sm">
          <div className="flex items-center gap-2 text-sm">
            <div className="text-slate-700">Your referral link:</div>
            <input readOnly value={refLink} className="flex-1 border rounded-lg px-2 py-1 bg-white text-slate-800" onFocus={(e)=>e.currentTarget.select()} />
            <button className="px-3 py-2 rounded-full text-sm bg-slate-900 text-white" onClick={async()=>{ try{ await navigator.clipboard.writeText(refLink); track('referral_copy'); }catch{} }}>Copy</button>
          </div>
        </section>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-guide="kpis">
        <Kpi title="Messages Sent" value={metrics?.messages_sent||0} />
        <Kpi title="Time Saved (min)" value={metrics?.time_saved_minutes||0} />
        <Kpi title="Revenue Uplift" value={metrics?.revenue_uplift||0} />
        <Kpi title="Referrals 30d" value={metrics?.referrals_30d||0} />
      </div>
      {/* First 5 workflows tracker */}
      <section className="rounded-2xl p-4 backdrop-blur bg-white/60 border border-white/70 shadow-sm">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-900">Quick Start · 5 workflows</h4>
        </div>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
          {[
            { k:'crm_organization', label:'CRM' },
            { k:'book_filling', label:'Book‑Filling' },
            { k:'inventory_tracking', label:'Inventory' },
            { k:'social_automation', label:'Social 14‑day' },
            { k:'client_communication', label:'Comms' },
          ].map(({k,label})=> (
            <button key={k} className={`px-2 py-2 rounded-md border ${wfProgress?.[k] ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white'}`} onClick={()=>{ window.location.href = '/workflows'; }}>
              <span className="block font-medium">{label}</span>
              <span className="text-[11px]">{wfProgress?.[k] ? 'Completed' : 'Not started'}</span>
            </button>
          ))}
        </div>
      </section>
      <div ref={chartRef as any} data-guide="chart" onMouseEnter={prefetchChart}>
        <Card>
          <CardBody className="h-64 p-2">
            {chartVisible ? (
              <Suspense fallback={<div className="h-full w-full bg-slate-50 rounded" /> }>
                <FunnelChart data={chartData} />
              </Suspense>
            ) : (
              <div className="h-full w-full bg-slate-50 rounded" />
            )}
          </CardBody>
        </Card>
      </div>
      <div data-guide="queue">
        <h3 className="text-lg font-semibold mb-2">Cadence Queue</h3>
        <Table>
          <THead>
            <TR><TH>Contact</TH><TH>Cadence</TH><TH>Step</TH><TH>Next Action</TH></TR>
          </THead>
          <tbody className="divide-y">
            {(queue.items||[]).map((r:any,i:number)=> (
              <TR key={i}>
                <TD>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <span className="underline decoration-dotted underline-offset-4 cursor-help">{r.contact_id}</span>
                    </Tooltip.Trigger>
                    <Tooltip.Content sideOffset={6} className="rounded-md border bg-white px-2 py-1 text-xs text-slate-700 shadow">Contact ID</Tooltip.Content>
                  </Tooltip.Root>
                </TD>
                <TD>{r.cadence_id}</TD>
                <TD>{r.step_index}</TD>
                <TD>{r.next_action_at}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

function Kpi({title,value}:{title:string;value:number}){
  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl p-4 bg:white/70 backdrop-blur border border-white/70 shadow-sm"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(236,72,153,0.12)' }}
    >
      <div className="absolute inset-0 -z-10" style={{
        background:
          'radial-gradient(400px 120px at 10% -10%, rgba(236,72,153,0.08), transparent), radial-gradient(300px 100px at 90% -20%, rgba(124,58,237,0.08), transparent)'
      }} />
      <div className="text-xs text-slate-500">{title}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
    </motion.div>
  );
}
