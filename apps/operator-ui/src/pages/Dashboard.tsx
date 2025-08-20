import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getTenant } from '../lib/api';
import { motion } from 'framer-motion';
import { lazy, Suspense, useRef } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
const FunnelChart = lazy(()=> import('../components/charts/FunnelChart'));
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Card, CardBody } from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import { Table, THead, TR, TH, TD } from '../components/ui/Table';

export default function Dashboard(){
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
  },[]);

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
        startTour();
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const chartData = (funnel.series||[]).map((p:any)=>({ day:p.day || p.date || '', value: p.count || 0 }));
  // chartOption removed in favor of lazy-loaded FunnelChart

  const startTour = () => {
    const d = driver({
      showProgress: true,
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      steps: [
        { element: '[data-tour="kpis"]', popover: { title: 'Key metrics', description: 'Your essentials at a glance: messages, time saved, revenue, referrals.' } },
        { element: '[data-tour="chart"]', popover: { title: 'Trend', description: 'Daily progress over the last 30 days with gentle smoothing.' } },
        { element: '[data-tour="queue"]', popover: { title: 'Cadence queue', description: 'What’s coming next, by contact and flow step.' } },
        { element: '[data-tour="quick-actions"]', popover: { title: 'Quick actions', description: 'Import contacts, start a cadence, simulate a message, or connect tools.' } },
      ]
    } as any);
    d.drive();
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
  if (error) return <div style={{color:'#b91c1c'}}>Error: {error}</div>;
  return (
    <div className="space-y-4">
      <section className="rounded-2xl p-4 backdrop-blur bg-white/60 border border-white/70 shadow-sm" data-tour="quick-actions">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/contacts" className="px-3 py-2 rounded-lg border border-slate-200 text-slate-900">Import Contacts</Link>
          <Link to="/cadences" className="px-3 py-2 rounded-lg border border-slate-200 text-slate-900">Start Cadence</Link>
          <Link to="/messages" className="px-3 py-2 rounded-lg border border-slate-200 text-slate-900">Simulate Message</Link>
          <Link to="/integrations" className="px-3 py-2 rounded-lg bg-pink-500 text-white shadow-sm hover:bg-pink-600">Connect Tools</Link>
          <button onClick={startTour} className="ml-auto px-3 py-2 rounded-lg border border-slate-200 text-slate-900" aria-label="Open dashboard guide">Guide me</button>
        </div>
      </section>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="kpis">
        <Kpi title="Messages Sent" value={metrics?.messages_sent||0} />
        <Kpi title="Time Saved (min)" value={metrics?.time_saved_minutes||0} />
        <Kpi title="Revenue Uplift" value={metrics?.revenue_uplift||0} />
        <Kpi title="Referrals 30d" value={metrics?.referrals_30d||0} />
      </div>
      <div ref={chartRef as any} data-tour="chart" onMouseEnter={prefetchChart}>
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
      <div data-tour="queue">
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
