import React, { useEffect, useMemo, useState } from 'react';
import { getPersisted, setPersisted } from '../lib/state';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { api, getTenant } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
//
import { useToast } from '../components/ui/Toast';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { startGuide } from '../lib/guide';

const PINK = '#FDE2F3';
const BLUE = '#E0F2FE';
const AZURE = '#7DD3FC';
const VIOLET = '#C4B5FD';

const steps = [
  { id: 1, title: 'Welcome', blurb: 'A quick, friendly tour of what onboarding looks like and how little time it takes.' },
  { id: 2, title: 'Connect your tools', blurb: 'Choose what you already use: calendar/booking, messages, payments/POS, and (optionally) CRM.' },
  { id: 3, title: 'Your vibe & services', blurb: 'Pick your tone and the services you offer. We’ll tailor reminders and messages to feel like you.' },
  { id: 4, title: 'Preview messages', blurb: 'See example messages before anything goes live. You approve everything.' },
  { id: 5, title: 'Go live', blurb: 'What the first week looks like: gentle reminders, lead follow‑ups, and a quick check‑in.' },
];

const TOOL_PRESETS: Record<string, { label: string; minutes: number }> = {
  booking: { label: 'Calendar / Booking (Square, Acuity)', minutes: 3 * 60 },
  messages: { label: 'Messages (SMS + Email)', minutes: 2 * 60 },
  payments: { label: 'Payments / POS (Square, Shopify)', minutes: 60 },
  crm: { label: 'CRM (HubSpot — optional)', minutes: 45 },
  content: { label: 'Content helper (captions & posts)', minutes: 2 * 60 },
  inventory: { label: 'Inventory assist (optional)', minutes: 60 },
};

const SERVICES = ['Hair', 'Makeup', 'Brows/Lashes', 'Nails', 'Skincare/Facials', 'Med‑Spa', 'Barbering'];

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }){
  return (
    <button onClick={onClick} className={`px-3 py-1 rounded-full border transition shadow-sm text-sm mr-2 mb-2 ${selected ? 'bg-white/80 border-sky-300 text-sky-700' : 'bg-white/60 border-white/60 text-slate-600 hover:bg-white'}`}>{children}</button>
  );
}

function WaveBackground(){
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: `radial-gradient(60% 60% at 30% 20%, ${PINK} 0%, transparent 60%),radial-gradient(50% 50% at 80% 10%, ${BLUE} 0%, transparent 60%),radial-gradient(70% 60% at 80% 80%, ${VIOLET}55 0%, transparent 60%)`, filter: 'blur(20px)' }} />
      <svg className="absolute -bottom-20 left-0 w-[180%] h-72 opacity-50" viewBox="0 0 1440 320">
        <defs>
          <linearGradient id="grad1" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={AZURE} stopOpacity="0.7" />
            <stop offset="100%" stopColor={PINK} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <motion.path d="M0,96L60,101.3C120,107,240,117,360,122.7C480,128,600,128,720,112C840,96,960,64,1080,69.3C1200,75,1320,117,1380,138.7L1440,160L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z" fill="url(#grad1)" initial={{ x: 0 }} animate={{ x: [0, -200, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} />
      </svg>
      <svg className="absolute -top-10 right-0 w-[160%] h-64 opacity-40" viewBox="0 0 1440 320">
        <defs>
          <linearGradient id="grad2" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={VIOLET} stopOpacity="0.6" />
            <stop offset="100%" stopColor={BLUE} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <motion.path d="M0,64L60,85.3C120,107,240,149,360,149.3C480,149,600,107,720,112C840,117,960,171,1080,176C1200,181,1320,139,1380,117.3L1440,96L1440,0L1380,0C1320,0,1200,0,1080,0C960,0,840,0,720,0C600,0,480,0,360,0C240,0,120,0,60,0L0,0Z" fill="url(#grad2)" initial={{ x: 0 }} animate={{ x: [0, 220, 0] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }} />
      </svg>
    </div>
  );
}

function PrettyCard({ children, className = '' }: { children: React.ReactNode; className?: string }){
  return (
    <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }} className={`rounded-2xl shadow-xl bg-white/60 backdrop-blur border border-white/70 p-5 ${className}`}>{children}</motion.div>
  );
}

function TimeSavedGauge({ minutes }: { minutes: number }){
  const hrs = (minutes / 60).toFixed(1);
  const pct = Math.min(100, Math.round((minutes / (8 * 60)) * 100));
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 36 36" className="w-20 h-20">
          <path className="text-slate-200" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32" />
          <motion.path strokeWidth="4" stroke={AZURE} fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: pct / 100 }} transition={{ duration: 0.8 }} d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32" />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-xs font-medium text-slate-700">{pct}%</div>
      </div>
      <div>
        <div className="text-slate-600 text-sm">Estimated time saved / week</div>
        <div className="text-slate-900 font-semibold text-lg">{hrs} hours</div>
        <div className="text-slate-500 text-xs">(Based on your selections)</div>
      </div>
    </div>
  );
}

function FriendlyFAQ(){
  const items = [
    { q: 'Do you message my clients without asking?', a: 'Nope. You approve tone and timing. Clients can reply STOP/HELP any time, and we honor consent.' },
    { q: 'How long does setup take?', a: 'Most pros are done in under 15 minutes. White‑glove is available if you’d like us to do it for you.' },
    { q: 'What if I don’t use a CRM?', a: 'Totally fine. Calendar/booking and messages are enough to start. You can add CRM later.' },
    { q: 'Will this feel like me?', a: 'Yes. You choose the vibe. We keep it human, short, and in your voice.' },
  ];
  return (
    <div className="grid gap-3">
      {items.map((f, i) => (
        <details key={i} className="bg-white/70 backdrop-blur rounded-xl p-4">
          <summary className="cursor-pointer font-medium text-slate-800">{f.q}</summary>
          <p className="mt-2 text-slate-600 text-sm">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export default function Onboarding(){
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [tools, setTools] = useState<Record<string, boolean>>(()=> getPersisted('ob_tools', { booking: true, messages: true, payments: false, crm: false, content: true, inventory: false }));
  const [busy] = useState(3);
  const [tone, setTone] = useState(()=> getPersisted('ob_tone', 3));
  const [services, setServices] = useState<string[]>(()=> getPersisted('ob_services', ['Hair', 'Brows/Lashes']));
  const [whiteGlove] = useState(false);
  const [brandProfile, setBrandProfile] = useState(()=> getPersisted('ob_brand', { tagline:'', voice:'Balanced', specialties:'' }));
  const [bookingUrl, setBookingUrl] = useState<string>('');
  const [analyzeSummary, setAnalyzeSummary] = useState<any>(null);
  const [consentSteps, setConsentSteps] = useState<{d7:boolean; d3:boolean; d1:boolean; h2:boolean}>(()=> getPersisted('ob_consent', { d7:true, d3:true, d1:true, h2:true }));
  const [leadChoice, setLeadChoice] = useState<'soonest'|'anytime'>('soonest');
  const [showNudge, setShowNudge] = useState(false);
  const [oauthError, setOauthError] = useState<string>('');
  const [invItems, setInvItems] = useState<Array<any>>([]);
  const [toolBusy, setToolBusy] = useState<boolean>(false);

  useEffect(() => {
    setPersisted('ob_tools', tools);
  }, [tools]);
  useEffect(() => {
    setPersisted('ob_tone', tone);
  }, [tone]);
  useEffect(() => {
    setPersisted('ob_services', services);
  }, [services]);
  useEffect(() => {
    setPersisted('ob_brand', brandProfile);
  }, [brandProfile]);
  useEffect(() => {
    setPersisted('ob_consent', consentSteps);
  }, [consentSteps]);

  useEffect(() => { (async()=>{ try{ const j = await api.get('/integrations/booking/square/link'); setBookingUrl(j?.url || ''); } catch{} })(); }, []);

  useEffect(() => {
    // Auto-start tour if ?tour=1
    try{
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('tour') === '1') {
        startTour();
      }
      // If returned from OAuth (?connected=provider), auto-run analyze and toast
      if (sp.get('connected')) {
        (async()=>{
          await analyze();
          showToast({ title:'Connected', description:`${sp.get('connected')} linked. Updated analysis.` });
        })();
      }
      if (sp.get('error')) {
        const e = sp.get('error')||'';
        setOauthError(e);
        showToast({ title: 'Connection failed', description: e });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show post-onboarding nudge on final step
  useEffect(()=>{
    setShowNudge(step === 5);
  }, [step]);

  const connect = async (provider: string) => {
    try{
      const j = await api.get(`/oauth/${provider}/login?tenant_id=${encodeURIComponent(await getTenant())}`);
      if (j?.url) window.open(j.url, '_blank');
    } catch {}
  };

  const analyze = async () => {
    try{
      const j = await api.post('/onboarding/analyze', { tenant_id: await getTenant() });
      setAnalyzeSummary(j?.summary || {});
      showToast({ title: 'Analysis complete', description: 'We reviewed your connections and setup.' });
    } catch {}
  };

  const runDedupe = async () => {
    try {
      setToolBusy(true);
      const r = await api.post('/ai/tools/execute', {
        tenant_id: await getTenant(),
        name: 'contacts.dedupe',
        params: { tenant_id: await getTenant() },
        require_approval: false,
      });
      const removed = r?.removed ?? 0;
      showToast({ title: 'Deduped contacts', description: `${removed} duplicates marked` });
      await analyze();
    } catch (e: any) {
      showToast({ title: 'Error', description: String(e?.message || e) });
    } finally {
      setToolBusy(false);
    }
  };

  const checkLowStock = async () => {
    try {
      setToolBusy(true);
      const r = await api.post('/ai/tools/execute', {
        tenant_id: await getTenant(),
        name: 'inventory.alerts.get',
        params: { tenant_id: await getTenant(), low_stock_threshold: 5 },
        require_approval: false,
      });
      const items = Array.isArray(r?.items) ? r.items : [];
      setInvItems(items);
      showToast({ title: 'Inventory checked', description: items.length ? `${items.length} low‑stock items` : 'No low‑stock items' });
    } catch (e: any) {
      showToast({ title: 'Error', description: String(e?.message || e) });
    } finally {
      setToolBusy(false);
    }
  };

  const startTour = () => {
    // Start at Connect section
    setStep(2);
    setTimeout(() => {
      const d = driver({
        showProgress: true,
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Done',
        steps: [
          { element: '[data-tour="steps"]', popover: { title: 'Steps', description: '5 quick steps — you can jump around anytime.' }, onNextClick: () => setStep(2) },
          { element: '[data-tour="connect"]', popover: { title: 'Connect tools', description: 'Link booking, messages, payments, and CRM. Human and consent‑first.' }, onNextClick: () => setStep(3) },
          { element: '[data-tour="brand"]', popover: { title: 'Your vibe & services', description: 'Pick tone and services so messages feel like you.' }, onNextClick: () => setStep(4) },
          { element: '[data-tour="preview"]', popover: { title: 'Preview messages', description: 'Approve examples before anything goes live.' }, onNextClick: () => setStep(4) },
          { element: '[data-tour="timing"]', popover: { title: 'Timing & defaults', description: 'Choose reminder steps and lead reply defaults.' } },
        ],
      } as any);
      d.drive();
    }, 0);
  };

  const totalMinutes = useMemo(() => {
    const base = Object.entries(tools).filter(([, v]) => v).reduce((acc, [k]) => acc + (TOOL_PRESETS as any)[k].minutes, 0);
    const busyBoost = (busy - 3) * 20;
    const whiteGloveAdj = whiteGlove ? -90 : 0;
    return Math.max(30, base / 6 + busyBoost + whiteGloveAdj);
  }, [tools, busy, whiteGlove]);

  const toneLabel = ['Super chill', 'Warm', 'Balanced', 'Polished', 'Very professional'][tone - 1];

  const onBook = () => {
    if (bookingUrl) window.open(bookingUrl, '_blank');
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-white via-white/80 to-white">
      <WaveBackground />
      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/70 backdrop-blur shadow grid place-items-center"><span className="text-sky-600 font-bold">BVX</span></div>
            <div>
              <h1 className="font-semibold tracking-tight text-slate-900 text-xl" style={{ fontFamily: 'Space Grotesk, Inter, system-ui' }}>Onboarding — 5 quick steps</h1>
              <p className="text-slate-600 text-sm">Beauty pros • gentle setup • your voice, your clients</p>
            </div>
          </div>
          <Button size="sm" onClick={onBook} disabled={!bookingUrl} className="rounded-full">{bookingUrl ? 'Book my onboarding' : 'Loading booking link…'}</Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <PrettyCard data-tour="steps">
          {oauthError && (
            <div className="mb-2 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-2 py-1">OAuth error: {oauthError}</div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {steps.map((s) => (
              <button key={s.id} onClick={() => setStep(s.id)} className={`group relative flex items-center gap-2 rounded-full px-3 py-2 text-sm transition ${step === s.id ? 'bg-gradient-to-r from-pink-50 to-sky-50 text-slate-900' : 'bg-white/70 text-slate-600 hover:bg-white'}`} aria-current={step === s.id}>
                <span className={`h-6 w-6 grid place-items-center rounded-full text-xs font-semibold ${step === s.id ? 'bg-pink-500 text-white' : 'bg-slate-200 text-slate-700'}`}>{s.id}</span>
                <span className="font-medium">{s.title}</span>
              </button>
            ))}
            <button onClick={startTour} className="ml-auto px-3 py-2 rounded-full border border-slate-200 text-slate-900" aria-label="Open onboarding guide">Guide me</button>
          </div>
          <div className="mt-3">
            <div className="text-xs text-slate-600 mb-1">Progress (step {step}/{steps.length})</div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-pink-400 to-violet-400" style={{ width: `${Math.round((step/steps.length)*100)}%` }} />
            </div>
            <div className="text-xs text-slate-500 mt-1">{Math.round((step/steps.length)*100)}% complete</div>
          </div>
          {analyzeSummary?.providers && (
            <div className="mt-2 text-xs text-slate-700 bg-white/70 border border-white/70 rounded-md px-2 py-1 inline-block">
              {(() => {
                const entries = Object.entries(analyzeSummary.providers as Record<string, boolean>);
                const total = entries.length;
                const configured = entries.filter(([,v]) => !!v).length;
                const pending = total - configured;
                return `Configured: ${configured}/${total} · Pending config: ${pending}`;
              })()}
            </div>
          )}
        </PrettyCard>

        <div className="mt-6 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid gap-6">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.section key="s1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                  <PrettyCard>
                    <h2 className="text-lg font-semibold text-slate-900">Welcome 👋</h2>
                    <p className="mt-2 text-slate-600">We’ll connect a couple tools, set your tone, and preview messages — then you’re live. Most pros finish in <strong>under 15 minutes</strong>.</p>
                    <div className="mt-4 grid sm:grid-cols-3 gap-3">
                      {[{title:'Connect', text:'Calendar/booking + messages'}, {title:'Personalize', text:'Your vibe + services'}, {title:'Preview', text:'Approve messages → go live'}].map((b,i)=> (
                        <div key={i} className="rounded-xl bg-gradient-to-b from-white/80 to-white/60 p-4 border border-white/60">
                          <div className="text-slate-900 font-medium">{b.title}</div>
                          <div className="text-slate-600 text-sm">{b.text}</div>
                        </div>
                      ))}
                    </div>
                  </PrettyCard>
                </motion.section>
              )}

              {step === 2 && (
                <motion.section key="s2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                  <PrettyCard data-tour="connect">
                    <h2 className="text-lg font-semibold text-slate-900">Connect your tools</h2>
                    <p className="mt-1 text-slate-600">Pick what you already use. We guide you step‑by‑step and keep it human.</p>
                    <div className="mt-4 grid sm:grid-cols-2 gap-3">
                      {Object.entries(TOOL_PRESETS).map(([key, val]) => (
                        <label key={key} className="flex items-center gap-3 rounded-xl bg-white/70 p-3 border border-white/70 cursor-pointer">
                          <input type="checkbox" checked={!!tools[key]} onChange={(e)=> setTools((t)=> ({ ...t, [key]: e.target.checked }))} className="h-4 w-4" aria-label={val.label} />
                          <div>
                            <div className="text-slate-800 font-medium">{val.label}</div>
                            <div className="text-slate-500 text-xs">Setup ≈ {Math.round(val.minutes/6)} sec</div>
                          </div>
                        </label>
                      ))}
                    </div>
                    <ImportCandidates />
                    <div className="mt-4 grid sm:grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white/70 p-3 border border-white/70">
                        <div className="font-medium text-slate-800">Square</div>
                        <div className="text-xs text-slate-600">Booking & POS</div>
                        <div className="mt-2 flex gap-2">
                          <Button variant="outline" size="sm" onClick={()=> connect('square')} disabled={analyzeSummary?.providers?.square===false}>Connect</Button>
                          <Button variant="outline" size="sm" onClick={onBook} disabled={!bookingUrl}>Open booking</Button>
                        </div>
                        {analyzeSummary?.providers?.square===false && <div className="mt-1 text-[11px] text-amber-700">Pending app credentials — configure Square OAuth to enable.</div>}
                      </div>
                      <div className="rounded-xl bg-white/70 p-3 border border-white/70">
                        <div className="font-medium text-slate-800">Acuity</div>
                        <div className="text-xs text-slate-600">Scheduling</div>
                        <div className="mt-2"><Button variant="outline" size="sm" onClick={()=> connect('acuity')} disabled={analyzeSummary?.providers?.acuity===false}>Connect</Button></div>
                        {analyzeSummary?.providers?.acuity===false && <div className="mt-1 text-[11px] text-amber-700">Pending app credentials — configure Acuity OAuth to enable.</div>}
                      </div>
                      <div className="rounded-xl bg-white/70 p-3 border border-white/70">
                        <div className="font-medium text-slate-800">HubSpot</div>
                        <div className="text-xs text-slate-600">CRM</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <a href="https://app.hubspot.com/signup" target="_blank" rel="noreferrer" className="px-2 py-1 text-xs rounded-md border bg-white hover:bg-slate-50">Create (free)</a>
                          <Button variant="outline" size="sm" onClick={()=> connect('hubspot')} disabled={analyzeSummary?.providers?.hubspot===false}>Connect</Button>
                          <Button variant="outline" size="sm" onClick={async()=>{
                            try{
                              const r = await api.post('/crm/hubspot/import', { tenant_id: await getTenant() });
                              const n = Number(r?.imported||0);
                              showToast({ title:'Imported from HubSpot', description:`${n} contacts imported.` });
                              await analyze();
                            }catch(e:any){ showToast({ title:'Error', description:String(e?.message||e) }); }
                          }}>Import</Button>
                        </div>
                        {analyzeSummary?.providers?.hubspot===false && <div className="mt-1 text-[11px] text-amber-700">Pending app credentials — configure HubSpot OAuth to enable.</div>}
                      </div>
                      <div className="rounded-xl bg-white/70 p-3 border border-white/70">
                        <div className="font-medium text-slate-800">Shopify</div>
                        <div className="text-xs text-slate-600">Inventory</div>
                        <div className="mt-2"><Button variant="outline" size="sm" onClick={()=> connect('shopify')} disabled={analyzeSummary?.providers?.shopify===false}>Connect</Button></div>
                        {analyzeSummary?.providers?.shopify===false && <div className="mt-1 text-[11px] text-amber-700">Pending app credentials — configure Shopify OAuth to enable.</div>}
                      </div>
                      <div className="rounded-xl bg-white/70 p-3 border border-white/70">
                        <div className="font-medium text-slate-800">Google</div>
                        <div className="text-xs text-slate-600">Calendar</div>
                        <div className="mt-2"><Button variant="outline" size="sm" onClick={()=> connect('google')} disabled={analyzeSummary?.providers?.google===false}>Connect</Button></div>
                        {analyzeSummary?.providers?.google===false && <div className="mt-1 text-[11px] text-amber-700">Pending app credentials — configure Google OAuth to enable.</div>}
                      </div>
                      <div className="rounded-xl bg-white/70 p-3 border border-white/70">
                        <div className="font-medium text-slate-800">Facebook</div>
                        <div className="text-xs text-slate-600">Pages & IG</div>
                        <div className="mt-2 flex gap-2">
                          <Button variant="outline" size="sm" onClick={()=> connect('facebook')} disabled={analyzeSummary?.providers?.facebook===false}>Connect</Button>
                          <Button variant="outline" size="sm" onClick={()=> connect('instagram')} disabled={analyzeSummary?.providers?.instagram===false}>Connect IG</Button>
                        </div>
                        {(analyzeSummary?.providers?.facebook===false || analyzeSummary?.providers?.instagram===false) && <div className="mt-1 text-[11px] text-amber-700">Pending app credentials — configure Facebook/Instagram OAuth to enable.</div>}
                      </div>
                    </div>
                    <div className="mt-3">
                      <Button variant="outline" size="sm" onClick={()=> window.open('/curation','_self')}>Open client curation</Button>
                    </div>
                    <div className="mt-3" data-tour="analyze">
                      <Button variant="primary" size="sm" onClick={analyze}>Run analysis</Button>
                      {analyzeSummary && (
                        <div className="mt-2 text-xs text-slate-700">
                          <div className="font-medium mb-1">Status</div>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {['google','square','acuity','hubspot','facebook','instagram','shopify'].map((p)=>{
                              const configured = !!analyzeSummary.providers?.[p];
                              const connected = analyzeSummary.connected?.[p];
                              const label = configured ? (connected ? 'Connected' : 'Awaiting connect') : 'Pending app credentials';
                              const cls = configured && connected ? 'bg-green-50 text-green-700 border-green-200' : configured ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200';
                              return (
                                <div key={p} className={`flex items-center justify-between rounded-md border px-2 py-1 ${cls}`}>
                                  <span className="capitalize">{p}</span>
                                  <span className="text-[11px] font-medium">{label}</span>
                                </div>
                              );
                            })}
                          </div>
                          {analyzeSummary.reconciliation && (
                            <div className="mt-3">
                              <div className="font-medium">Reconciliation</div>
                              <div className="text-slate-600">Contacts: {analyzeSummary.reconciliation.contacts_count} • Booking contacts: {analyzeSummary.reconciliation.booking_contacts_count} • Missing in Contacts: {analyzeSummary.reconciliation.missing_in_contacts}</div>
                              <div className="mt-2 grid sm:grid-cols-2 gap-2 text-xs">
                                <div className="rounded-md border bg-white/70 p-2">
                                  <div className="font-medium text-slate-800 mb-1">Suggested fixes</div>
                                  <ul className="list-disc ml-4 text-slate-700">
                                    <li>Import any missing booking contacts into Contacts</li>
                                    <li>Connect CRM to sync contact properties</li>
                                  </ul>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" onClick={()=> window.open('/contacts','_self')}>Open Contacts</Button>
                                    <Button variant="outline" size="sm" onClick={()=> setStep(2)}>Connect tools</Button>
                                    <Button variant="outline" size="sm" onClick={async()=>{
                                      await api.post('/reconciliation/import_missing_contacts', { tenant_id: await getTenant() });
                                      showToast({ title:'Imported', description:'Missing booking contacts imported.' });
                                      await analyze();
                                    }}>Import missing</Button>
                                    <Button variant="outline" size="sm" disabled={toolBusy} onClick={runDedupe}>Dedupe contacts</Button>
                                    <Button variant="outline" size="sm" disabled={toolBusy} onClick={checkLowStock}>Check low stock</Button>
                                    <div className="text-[11px] text-amber-700">Note: Imports may be queued for approval if auto-approve is disabled.</div>
                                  </div>
                                  {invItems.length > 0 && (
                                    <div className="mt-2">
                                      <div className="font-medium mb-1">Low‑stock items</div>
                                      <ul className="list-disc ml-4 text-slate-700">
                                        {invItems.map((it: any, idx: number)=> (
                                          <li key={idx}>{it.name || it.sku || 'Item'} — stock: {String(it.stock ?? '?')}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                                <div className="rounded-md border bg-white/70 p-2">
                                  <div className="font-medium text-slate-800 mb-1">Next actions</div>
                                  <div className="text-slate-700">Run analysis again after connecting or importing to update counts.</div>
                                  <div className="mt-2"><Button variant="outline" size="sm" onClick={analyze}>Re‑analyze</Button></div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </PrettyCard>
                </motion.section>
              )}

              {step === 3 && (
                <motion.section key="s3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                  <PrettyCard data-tour="brand">
                    <h2 className="text-lg font-semibold text-slate-900">Your vibe & services</h2>
                    <div className="mt-4 grid md:grid-cols-2 gap-6">
                      <div>
                        <div className="text-sm text-slate-700">Tone</div>
                        <input className="w-full" type="range" min={1} max={5} value={tone} onChange={(e)=> setTone(parseInt(e.target.value))} />
                        <div className="text-xs text-slate-500">Current: <span className="font-medium text-slate-800">{toneLabel}</span></div>
                        <p className="mt-2 text-slate-600 text-sm">We’ll match your tone in reminders and replies — short, kind, and you.</p>
                      </div>
                      <div>
                        <div className="text-sm text-slate-700 mb-2">Services</div>
                        <div>
                          {SERVICES.map((s) => (
                            <Chip key={s} selected={services.includes(s)} onClick={() => setServices((arr)=> arr.includes(s)? arr.filter(x=> x!==s) : [...arr, s])}>{s}</Chip>
                          ))}
                        </div>
                        <p className="mt-2 text-slate-600 text-sm">This helps us suggest the right message timing and examples.</p>
                      </div>
                    </div>
                    <div className="mt-6 grid md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-slate-700">Brand tagline</div>
                        <input className="w-full border rounded-md px-3 py-2" value={brandProfile.tagline} onChange={e=>setBrandProfile({...brandProfile, tagline:e.target.value})} placeholder="e.g., Luxury color in a friendly vibe" />
                      </div>
                      <div>
                        <div className="text-sm text-slate-700">Voice</div>
                        <input className="w-full border rounded-md px-3 py-2" value={brandProfile.voice} onChange={e=>setBrandProfile({...brandProfile, voice:e.target.value})} placeholder="e.g., Warm, concise, human" />
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-sm text-slate-700">Specialties</div>
                        <textarea className="w-full border rounded-md px-3 py-2" rows={3} value={brandProfile.specialties} onChange={e=>setBrandProfile({...brandProfile, specialties:e.target.value})} placeholder="e.g., Balayage, blonding, brows" />
                      </div>
                      <div className="md:col-span-2">
                        <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm" onClick={async()=>{
                          await api.post('/settings', { tenant_id: await getTenant(), tone: toneLabel, services, brand_profile: brandProfile });
                          showToast({ title: 'Saved', description: 'Brand profile and tone saved.' });
                        }}>Save brand profile</button>
                      </div>
                    </div>
                  </PrettyCard>
                </motion.section>
              )}

              {step === 4 && (
                <motion.section key="s4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                  <PrettyCard data-tour="preview">
                    <h2 className="text-lg font-semibold text-slate-900">Preview messages</h2>
                    <p className="mt-1 text-slate-600">Examples only — you approve before anything sends.</p>
                    <div className="mt-4 grid gap-3">
                      <div className="rounded-xl bg-white/70 p-4 border border-white/70">
                        <div className="text-xs text-slate-500 mb-1">Reminder • 24 hrs before</div>
                        <div className="text-slate-800">Hey {'{First Name}'} — see you tomorrow at {'{Time}'}! Need to change it? Tap here. 💫</div>
                      </div>
                      <div className="rounded-xl bg-white/70 p-4 border border-white/70">
                        <div className="text-xs text-slate-500 mb-1">Waitlist • Canceled slot</div>
                        <div className="text-slate-800">A spot just opened for {'{Service}'} at {'{Time}'} . Want it? Reply YES and we’ll lock it in. ✨</div>
                      </div>
                      <div className="rounded-xl bg-white/70 p-4 border border-white/70">
                        <div className="text-xs text-slate-500 mb-1">Lead follow‑up</div>
                        <div className="text-slate-800">Hi! I saw you were looking at {'{Service}'} . Happy to help you book — Soonest or Anytime?</div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl bg-white/70 p-4 border border-white/70">
                      <div className="font-medium text-slate-900">Consent & timing preview</div>
                      <div className="text-sm text-slate-700 mt-1">We follow a gentle cadence by default (7 days, 3 days, 1 day, and 2 hours before), and ask “Soonest vs Anytime” to keep it simple.</div>
                      <ul className="mt-2 text-sm text-slate-700 list-disc ml-5">
                        <li>7 days: polite “see you soon?” reminder</li>
                        <li>3 days: confirm details; reschedule option</li>
                        <li>1 day: friendly reminder with directions/parking if relevant</li>
                        <li>2 hours: last nudge with easy reply options</li>
                      </ul>
                      <div className="mt-2 text-xs text-slate-500">Clients can reply STOP/HELP at any time. You can pause or edit messages whenever you like.</div>
                    </div>
                    <div className="mt-4 rounded-xl bg-white/70 p-4 border border-white/70" data-tour="timing">
                      <div className="font-medium text-slate-900">Choose timing & defaults</div>
                      <div className="mt-2 grid sm:grid-cols-2 gap-3 text-sm text-slate-700">
                        <div>
                          <div className="text-xs text-slate-600 mb-1">Reminder steps</div>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={consentSteps.d7} onChange={e=>setConsentSteps(s=>({...s, d7:e.target.checked}))}/> 7 days</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={consentSteps.d3} onChange={e=>setConsentSteps(s=>({...s, d3:e.target.checked}))}/> 3 days</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={consentSteps.d1} onChange={e=>setConsentSteps(s=>({...s, d1:e.target.checked}))}/> 1 day</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={consentSteps.h2} onChange={e=>setConsentSteps(s=>({...s, h2:e.target.checked}))}/> 2 hours</label>
                        </div>
                        <div>
                          <div className="text-xs text-slate-600 mb-1">Lead replies default</div>
                          <label className="flex items-center gap-2"><input type="radio" name="leadChoice" checked={leadChoice==='soonest'} onChange={()=>setLeadChoice('soonest')}/> Soonest</label>
                          <label className="flex items-center gap-2"><input type="radio" name="leadChoice" checked={leadChoice==='anytime'} onChange={()=>setLeadChoice('anytime')}/> Anytime</label>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Button variant="outline" size="sm" onClick={async()=>{
                          const reminders:number[] = [];
                          if (consentSteps.d7) reminders.push(7);
                          if (consentSteps.d3) reminders.push(3);
                          if (consentSteps.d1) reminders.push(1);
                          if (consentSteps.h2) reminders.push(0.0833); // ~2 hours
                          await api.post('/settings', { tenant_id: await getTenant(), consent_timing: { reminders }, lead_choice_default: leadChoice });
                          showToast({ title: 'Saved', description: 'Timing and reply defaults saved.' });
                        }}>Save timing & defaults</Button>
                      </div>
                    </div>
                  </PrettyCard>
                </motion.section>
              )}

              {step === 5 && (
                <motion.section key="s5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                  <PrettyCard>
                    <h2 className="text-lg font-semibold text-slate-900">Go live — what to expect</h2>
                    <div className="mt-2 rounded-md border bg-emerald-50 text-emerald-800 text-sm px-3 py-2">You're all set! You can start using BrandVX now. Choose an action below to begin.</div>
                    <ol className="mt-3 space-y-3">
                      {[
                        { n:1, t:'Quick check‑in', d:'We confirm your tone, services, and timing. You can change anything later.' },
                        { n:2, t:'Gentle reminders', d:'No‑show reduction and waitlist fill. Clients can reply like normal.' },
                        { n:3, t:'Lead follow‑ups', d:'We nudge new leads kindly. "Soonest vs Anytime" keeps it simple.' },
                        { n:4, t:'Week‑one snapshot', d:'Time Saved, Revenue Uplift, and any Ambassador candidates.' },
                      ].map((x)=>(
                        <li key={x.n} className="flex gap-3"><span className="mt-1 h-6 w-6 rounded-full bg-sky-500 text-white grid place-items-center text-xs">{x.n}</span><div><div className="font-medium text-slate-800">{x.t}</div><div className="text-sm text-slate-600">{x.d}</div></div></li>
                      ))}
                    </ol>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="primary" size="sm" onClick={()=> navigate('/workflows')}>Open Workflows</Button>
                      <Button variant="outline" size="sm" onClick={()=> navigate('/dashboard')}>View Dashboard</Button>
                      <Button variant="outline" size="sm" onClick={()=> navigate('/ask')}>Ask VX</Button>
                    </div>
                  </PrettyCard>
                </motion.section>
              )}
            </AnimatePresence>

            <PrettyCard>
              <h3 className="text-slate-900 font-semibold">FAQ</h3>
              <FriendlyFAQ />
            </PrettyCard>
          </div>

          <div className="grid gap-6">
            <PrettyCard>
              <h3 className="text-slate-900 font-semibold">Your plan</h3>
              <div className="mt-3 text-sm text-slate-700">Tone: <span className="font-medium">{toneLabel}</span></div>
              <div className="mt-1 text-sm text-slate-700">Services: <span className="font-medium">{services.join(', ') || '(none yet)'} </span></div>
              <div className="mt-3 text-sm text-slate-700">Tools connected:</div>
              <ul className="mt-1 text-sm text-slate-600 list-disc ml-5">
                {Object.entries(tools).filter(([, v])=> v).map(([k])=> (
                  <li key={k}>{TOOL_PRESETS[k].label}</li>
                ))}
              </ul>
              <div className="mt-4"><TimeSavedGauge minutes={totalMinutes} /></div>
              <div className="mt-4 grid gap-2">
                <div className="rounded-lg bg-white/70 p-3 text-sm text-slate-700 border border-white/70"><span className="font-medium">Week 0:</span> Setup + preview messages (you approve).</div>
                <div className="rounded-lg bg-white/70 p-3 text-sm text-slate-700 border border-white/70"><span className="font-medium">Week 1:</span> Reminders + waitlist fill; first Time Saved snapshot.</div>
                <div className="rounded-lg bg-white/70 p-3 text-sm text-slate-700 border border-white/70"><span className="font-medium">Week 2:</span> Lead follow‑ups; early retention lift.</div>
                <div className="rounded-lg bg-white/70 p-3 text-sm text-slate-700 border border-white/70"><span className="font-medium">Week 4:</span> Ambassadors flagged (if eligible) + mini CX tune‑up.</div>
              </div>
            </PrettyCard>
            <PrettyCard>
              <h3 className="text-slate-900 font-semibold">Privacy & respect</h3>
              <p className="mt-2 text-sm text-slate-600">We keep messages short and human. Consent is honored, and you’re always in control. You can pause or edit anything.</p>
            </PrettyCard>
            <PrettyCard data-tour="cta">
              <h3 id="cta" className="text-slate-900 font-semibold">Ready when you are</h3>
              <p className="mt-2 text-sm text-slate-600">We can do white‑glove for you, or you can click through in a few minutes. Either way, it’ll feel like you.</p>
              <div className="mt-3 flex gap-3">
                <Button variant="primary" size="md" onClick={() => setStep(Math.min(5, step + 1))}>Next step</Button>
                <Button variant="outline" size="md" onClick={() => setStep(Math.max(1, step - 1))}>Back</Button>
                {step === 5 && (
                  <Button variant="outline" size="md" onClick={()=> navigate('/dashboard')}>Finish & view dashboard</Button>
                )}
              </div>
            </PrettyCard>
          </div>
        </div>
      </main>
      <AnimatePresence>
        {showNudge && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
            <div className="rounded-full border border-white/70 bg-white/80 backdrop-blur shadow-lg px-4 py-2 flex items-center gap-3">
              <span className="text-sm text-slate-800">You’re set — want a quick guided start?</span>
              <Button size="sm" variant="primary" onClick={()=> navigate('/workflows')}>Get Started</Button>
              <Button size="sm" variant="outline" onClick={()=> startGuide('workflows')}>Guide me</Button>
              <button className="text-xs text-slate-500 hover:text-slate-700" onClick={()=> setShowNudge(false)}>Dismiss</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <footer className="relative z-10 mx-auto max-w-6xl px-6 pb-10 text-center text-xs text-slate-500">© {new Date().getFullYear()} AUBE Creative Labs · BrandVX · You’re in good hands ✨</footer>
    </div>
  );
}

function ImportCandidates(){
  const [items, setItems] = React.useState<Array<{contact_id:string;service?:string;last_seen?:number}>>([]);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState<boolean>(false);
  const { showToast } = useToast();
  React.useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const r = await api.get(`/import/candidates?tenant_id=${encodeURIComponent(await getTenant())}`);
        setItems(r?.items||[]);
      }catch{}
      setLoading(false);
    })();
  },[]);
  const toggle = (id:string)=> setSelected(s=> ({ ...s, [id]: !s[id] }));
  const importNow = async()=>{
    const chosen = items.filter(i=> selected[i.contact_id]).map(i=> ({ contact_id: i.contact_id, email_hash:null, phone_hash:null, consent_sms:false, consent_email:false }));
    if (chosen.length === 0) { showToast({ title:'Nothing selected', description:'Pick at least one client to import.'}); return; }
    try{
      setLoading(true);
      await api.post('/import/contacts', { tenant_id: await getTenant(), contacts: chosen });
      showToast({ title:'Imported', description:`Imported ${chosen.length} clients.` });
    }catch(e:any){ showToast({ title:'Error', description: String(e?.message||e) }); }
    finally{ setLoading(false); }
  };
  return (
    <div className="mt-4 rounded-xl bg-white/70 p-3 border border-white/70">
      <div className="font-medium text-slate-800 mb-2">Import 10 clients</div>
      {loading ? <div className="text-sm text-slate-600">Loading…</div> : (
        items.length === 0 ? <div className="text-sm text-slate-600">No suggestions yet. Connect booking to see candidates.</div> : (
          <div className="grid sm:grid-cols-2 gap-2">
            {items.map(i=> (
              <label key={i.contact_id} className="flex items-center gap-3 rounded-lg border bg-white/80 p-2 cursor-pointer">
                <input type="checkbox" checked={!!selected[i.contact_id]} onChange={()=> toggle(i.contact_id)} />
                <div className="text-sm text-slate-700">
                  <div className="font-medium">{i.contact_id}</div>
                  <div className="text-xs text-slate-500">{i.service || '—'}{i.last_seen ? ` · ${new Date((i.last_seen<1e12? i.last_seen*1000 : i.last_seen)).toLocaleString()}`:''}</div>
                </div>
              </label>
            ))}
          </div>
        )
      )}
      <div className="mt-2"><Button variant="outline" size="sm" onClick={importNow} disabled={loading}>Import selected</Button></div>
    </div>
  );
}
