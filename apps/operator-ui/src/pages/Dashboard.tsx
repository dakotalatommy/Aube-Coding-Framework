import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Button, { ButtonLink } from '../components/ui/Button';
import { api, getTenant } from '../lib/api';
import { motion } from 'framer-motion';
import { lazy, Suspense, useRef } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
const FunnelChart = lazy(()=> import('../components/charts/FunnelChart'));
import { startGuide } from '../lib/guide';
import { Card, CardBody } from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import { Table, THead, TR, TH, TD } from '../components/ui/Table';

export default function Dashboard(){
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

  useEffect(()=>{
    (async()=>{
      if (isDemo) {
        // Friendly demo placeholders (no red error state)
        setMetrics({ messages_sent: 128, time_saved_minutes: 372, revenue_uplift: 1240, referrals_30d: 9 });
        setQueue({ items: [
          { contact_id:'c_demo1', cadence_id:'welcome', step_index:1, next_action_at:'today 3:30 PM' },
          { contact_id:'c_demo2', cadence_id:'no_show_followup', step_index:2, next_action_at:'today 5:10 PM' },
        ]});
        setFunnel({ series:[{ day:'Mon', count:12 }, { day:'Tue', count:18 }, { day:'Wed', count:16 }, { day:'Thu', count:22 }, { day:'Fri', count:19 }] });
        setLoading(false);
        setError('');
        return;
      }
      try{
        const [m,q,f] = await Promise.all([
          api.get(`/metrics?tenant_id=${encodeURIComponent(await getTenant())}`),
          api.get(`/cadences/queue?tenant_id=${encodeURIComponent(await getTenant())}`),
          api.get(`/funnel/daily?tenant_id=${encodeURIComponent(await getTenant())}&days=30`),
        ]);
        setMetrics(m||{}); setQueue(q||{items:[]}); setFunnel(f||{series:[]});
      } catch(e:any){ setError(String(e?.message||e)); }
      finally{ setLoading(false); }
    })();
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
      if (sp.get('tour') === '1') {
        startGuide('dashboard');
        // After the tour completes, prompt signup then onboarding
        // driver.js doesn't expose a promise, so we poll for end by tracking a flag
        const t = window.setTimeout(()=>{
          setShowSignupModal(true);
        }, 4000);
        return () => window.clearTimeout(t);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const chartData = (funnel.series||[]).map((p:any)=>({ day:p.day || p.date || '', value: p.count || 0 }));
  // chartOption removed in favor of lazy-loaded FunnelChart

  const startTour = () => startGuide('dashboard');
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [refLink, setRefLink] = useState<string>('');
  const [showBillingNudge, setShowBillingNudge] = useState(false);
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

  // Demo start marker and 2-day billing reminder
  useEffect(()=>{
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('demo') === '1') {
        const k = 'bvx_demo_started_at';
        if (!localStorage.getItem(k)) localStorage.setItem(k, String(Date.now()));
      }
      const startedAt = Number(localStorage.getItem('bvx_demo_started_at')||'0');
      const billingAdded = localStorage.getItem('bvx_billing_added') === '1';
      if (startedAt && !billingAdded) {
        const twoDaysMs = 2*24*60*60*1000;
        if (Date.now() - startedAt > twoDaysMs) setShowBillingNudge(true);
      }
    } catch {}
  }, []);

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
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="/contacts" variant="outline" size="md" className="rounded-full px-4 py-2">Import Contacts</ButtonLink>
          <ButtonLink href="/cadences" variant="outline" size="md" className="rounded-full px-4 py-2">Start Cadence</ButtonLink>
          <ButtonLink href="/messages" variant="outline" size="md" className="rounded-full px-4 py-2">Simulate Message</ButtonLink>
          <ButtonLink href="/integrations" size="md" className="rounded-full px-4 py-2">Connect Tools</ButtonLink>
          <ButtonLink href="/billing" variant="outline" size="md" className="rounded-full px-4 py-2">Billing</ButtonLink>
          <Button variant="outline" size="md" onClick={startTour} className="ml-auto rounded-full px-4 py-2" aria-label="Open dashboard guide">Guide me</Button>
        </div>
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
            <button className="px-3 py-2 rounded-full text-sm bg-slate-900 text-white" onClick={async()=>{ try{ await navigator.clipboard.writeText(refLink); }catch{} }}>Copy</button>
          </div>
        </section>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-guide="kpis">
        <Kpi title="Messages Sent" value={metrics?.messages_sent||0} />
        <Kpi title="Time Saved (min)" value={metrics?.time_saved_minutes||0} />
        <Kpi title="Revenue Uplift" value={metrics?.revenue_uplift||0} />
        <Kpi title="Referrals 30d" value={metrics?.referrals_30d||0} />
      </div>
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
      className="relative overflow-hidden rounded-2xl p-4 bg-white/70 backdrop-blur border border-white/70 shadow-sm"
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
// unified table components imported
