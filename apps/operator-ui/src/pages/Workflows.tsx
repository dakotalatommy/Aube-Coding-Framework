import { Link } from 'react-router-dom';
import { startGuide } from '../lib/guide';
import ShareCard from '../components/ui/ShareCard';
import { useEffect, useState } from 'react';
import { api, getTenant } from '../lib/api';
import { track } from '../lib/analytics';
import { useToast } from '../components/ui/Toast';

type W = { title: string; description: string; to: string; cta?: string };

const workflows: W[] = [
  { title: 'Finish onboarding', description: 'Connect accounts, set brand profile, and preview consent timings (7d/3d/1d/2h).', to: '/onboarding', cta: 'Go to Onboarding' },
  { title: 'Start a cadence', description: 'Send kind, consent-first messages with quiet-hours and approvals.', to: '/cadences', cta: 'Open Cadences' },
  { title: 'Unified calendar', description: 'Sync Google/Apple and merge Square/Acuity bookings.', to: '/calendar', cta: 'Open Calendar' },
  { title: 'Manage inventory', description: 'Sync Shopify/Square, review items and stock levels.', to: '/inventory', cta: 'Open Inventory' },
  { title: 'Master inbox', description: 'Connect Facebook/Instagram and see all messages in one place.', to: '/inbox', cta: 'Open Inbox' },
  { title: 'Client curation', description: 'Hire/Fire with swipe/drag and quick stats.', to: '/curation', cta: 'Open Curation' },
  { title: 'Approvals', description: 'Review pending approvals and confirm risky actions.', to: '/approvals', cta: 'Open Approvals' },
];

export default function Workflows(){
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [lowItems, setLowItems] = useState<Array<{name:string; stock?: number}>>([]);
  const [socialPreview, setSocialPreview] = useState<any>(null);
  const [lastRun, setLastRun] = useState<Record<string, number>>({});
  const [approvals, setApprovals] = useState<number>(0);
  const [hasResume, setHasResume] = useState<boolean>(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

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
    })();
  }, []);

  const runDedupe = async () => {
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
    setBusy(true);
    try {
      const r = await api.post('/ai/tools/execute', {
        tenant_id: await getTenant(),
        name: 'inventory.alerts.get',
        params: { tenant_id: await getTenant(), low_stock_threshold: 5 },
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Workflows</h3>
        <button className="text-sm text-slate-600 hover:underline" aria-label="Open workflows guide" onClick={()=> startGuide('workflows')}>Guide me</button>
      </div>
      <p className="text-sm text-slate-600">Everything you can do in BrandVX, in one place. Consent-first, simple language, step-by-step.</p>
      <div className="grid md:grid-cols-2 gap-4">
        {workflows.map(w => (
          <section key={w.to} className="rounded-2xl p-4 bg-white/70 backdrop-blur border border-white/70 shadow-sm">
            <div className="font-medium text-slate-900">{w.title}</div>
            <div className="text-sm text-slate-600 mt-1">{w.description}</div>
            <div className="mt-3">
              <Link to={w.to} className="px-3 py-2 rounded-md text-white shadow hover:shadow-md bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600">{w.cta || 'Open'}</Link>
            </div>
          </section>
        ))}
      </div>
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
          <button data-tour="wf-dedupe" disabled={busy} onClick={runDedupe} className="px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50">Dedupe contacts</button>
          <button data-tour="wf-lowstock" disabled={busy} onClick={checkLow} className="px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50">Check low stock</button>
          <button data-tour="wf-social" disabled={busy} onClick={draftSocial} className="px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50">Draft social 14‑day</button>
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
              <button className="px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50" onClick={()=>{
                const data = JSON.stringify(socialPreview, null, 2);
                const blob = new Blob([data], { type:'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'social_plan.json'; a.click(); URL.revokeObjectURL(url);
              }}>Export JSON</button>
              <button className="px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50" onClick={()=>{
                const rows = [['date','channels']].concat((socialPreview.days||[]).map((d:any)=> [d.date, (d.channels||[]).join('|')]));
                const csv = rows.map(r=> r.map((x:string)=> '"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n');
                const blob = new Blob([csv], { type:'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'social_plan.csv'; a.click(); URL.revokeObjectURL(url);
              }}>Export CSV</button>
            </div>
          </div>
        )}
      </section>
      <ShareCard open={shareOpen} onOpenChange={setShareOpen} url={shareUrl} title="Share your plan" caption="Just planned two weeks of posts with #BrandVX 🚀" />
      <div className="text-xs text-slate-500">Tip: You can also ask “Get Started!” in AskVX to jump straight into these.</div>
    </div>
  );
}


