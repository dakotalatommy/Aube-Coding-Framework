import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, getTenant } from '../lib/api';
import { track } from '../lib/analytics';

type Step = {
  key: string;
  title: string;
  subtitle?: string;
  render: React.ReactNode;
  cta?: { label: string; onClick: () => void };
};

export default function OnboardingStepper(){
  const [tenantId, setTenantId] = useState<string>('');
  const [active, setActive] = useState<number>(0);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{ (async()=>{ try { setTenantId(await getTenant()); } catch {} })(); },[]);

  // Load progress from backend settings and local cache
  useEffect(()=>{
    (async()=>{
      try {
        const r = await api.get('/settings');
        const d = (r?.data || {}) as Record<string, any>;
        const prog = (d.onboarding_progress || {}) as Record<string, boolean>;
        const fromLocal = JSON.parse(localStorage.getItem('bvx_onb_progress') || '{}');
        setCompleted({ ...(prog||{}), ...(fromLocal||{}) });
      } catch {}
      setSettingsLoaded(true);
    })();
  }, []);

  const saveProgress = async (next: Record<string, boolean>) => {
    setCompleted(next);
    try { localStorage.setItem('bvx_onb_progress', JSON.stringify(next)); } catch {}
    try { await api.post('/settings', { onboarding_progress: next }); } catch {}
  };

  const markDone = async (key: string) => {
    const next = { ...completed, [key]: true };
    await saveProgress(next);
  };

  const goto = (path: string) => { window.location.href = path; };

  const steps: Step[] = useMemo(()=>[
    {
      key: 'connect_tools',
      title: 'Connect your tools',
      subtitle: 'Square/Acuity, Instagram, HubSpot, SMS',
      render: (
        <div className="space-y-2 text-sm">
          <p>Hook up your calendar, messaging, and CRM so BrandVX can automate for you.</p>
          <div className="flex flex-wrap gap-2">
            <button data-tour="onb-integrations" className="px-3 py-1.5 rounded-md border bg-white" onClick={()=>goto('/workspace?pane=integrations&tour=1')}>Open Integrations</button>
            <button className="px-3 py-1.5 rounded-md border bg-white" onClick={()=>markDone('connect_tools')}>Mark connected</button>
          </div>
        </div>
      )
    },
    {
      key: 'import_contacts',
      title: 'Import your clients',
      subtitle: 'We dedupe and sync safely',
      render: (
        <div className="space-y-2 text-sm">
          <p>Start by importing from your CRM or upload a CSV.</p>
          <div className="flex flex-wrap gap-2">
            <button data-tour="onb-contacts" className="px-3 py-1.5 rounded-md border bg-white" onClick={()=>goto('/workspace?pane=contacts&tour=1')}>Open Contacts</button>
            <button className="px-3 py-1.5 rounded-md border bg-white" onClick={()=>markDone('import_contacts')}>Mark imported</button>
          </div>
        </div>
      )
    },
    {
      key: 'preview_segments',
      title: 'Preview segments',
      subtitle: 'Confirm who we’ll message and when',
      render: (
        <div className="space-y-2 text-sm">
          <p>Review segments like “Dormant 60d” and confirm counts are expected.</p>
          <div className="flex flex-wrap gap-2">
            <button data-tour="onb-workflows" className="px-3 py-1.5 rounded-md border bg-white" onClick={()=>goto('/workspace?pane=workflows&tour=1')}>Open Workflows</button>
            <button className="px-3 py-1.5 rounded-md border bg-white" onClick={()=>markDone('preview_segments')}>Mark previewed</button>
          </div>
        </div>
      )
    },
    {
      key: 'timing_cadences',
      title: 'Set timing and cadences',
      subtitle: 'Respect quiet hours and spacing',
      render: (
        <div className="space-y-2 text-sm">
          <p>Adjust quiet hours, sending windows, and follow‑up spacing.</p>
          <div className="flex flex-wrap gap-2">
            <button data-tour="onb-cadences" className="px-3 py-1.5 rounded-md border bg-white" onClick={()=>goto('/workspace?pane=cadences&tour=1')}>Open Cadences</button>
            <button className="px-3 py-1.5 rounded-md border bg-white" onClick={()=>markDone('timing_cadences')}>Mark set</button>
          </div>
        </div>
      )
    },
    {
      key: 'review_launch',
      title: 'Review and launch',
      subtitle: 'You’re in control — start when ready',
      render: (
        <div className="space-y-2 text-sm">
          <p>Give things a final look. When you start, BrandVX will take it from here.</p>
          <div className="flex flex-wrap gap-2">
            <button data-tour="onb-dashboard" className="px-3 py-1.5 rounded-md border bg-white" onClick={()=>goto('/workspace?pane=dashboard')}>Go to Dashboard</button>
            <button className="px-3 py-1.5 rounded-md border bg-white" onClick={()=>markDone('review_launch')}>Mark done</button>
          </div>
        </div>
      )
    },
  ], [tenantId, completed]);

  useEffect(()=>{
    if (!settingsLoaded) return;
    try { track('onboarding_stepper_open'); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded]);

  const onNext = async () => {
    const step = steps[active];
    if (step) await markDone(step.key);
    setActive(i=> Math.min(i+1, steps.length-1));
    try { scrollerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  };
  const onPrev = () => {
    setActive(i=> Math.max(i-1, 0));
    try { scrollerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  };

  return (
    <div className="h-full grid grid-rows-[auto_1fr_auto]" aria-labelledby="onb-title" role="region">
      <div className="p-4 border-b bg-white/80 backdrop-blur">
        <div className="text-slate-900 text-lg font-semibold" id="onb-title">Getting set up</div>
        <div className="text-slate-600 text-sm">Personalize your BrandVX — progress is saved automatically</div>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Onboarding steps">
          {steps.map((s, i)=>{
            const done = !!completed[s.key];
            const activeTab = i===active;
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={activeTab}
                aria-controls={`panel_${s.key}`}
                className={`px-3 py-1.5 rounded-full border text-xs ${activeTab? 'bg-gradient-to-r from-pink-50 to-white text-slate-900 ring-1 ring-pink-100' : 'bg-white text-slate-700'} ${done? 'after:content-["✓"] after:ml-1 after:text-emerald-600' : ''}`}
                onClick={()=> setActive(i)}
              >{i+1}. {s.title}</button>
            );
          })}
        </div>
      </div>
      <div ref={scrollerRef} className="overflow-auto p-4" role="tabpanel" id={`panel_${steps[active]?.key||'step'}`} aria-labelledby={steps[active]? `tab_${steps[active].key}` : undefined} tabIndex={0}>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-slate-900 font-medium">{steps[active]?.title}</div>
          {steps[active]?.subtitle && <div className="text-slate-600 text-sm mt-0.5">{steps[active]?.subtitle}</div>}
          <div className="mt-3">{steps[active]?.render}</div>
        </div>
      </div>
      <div className="sticky bottom-0 p-3 border-t bg-white/80 backdrop-blur flex items-center justify-between">
        <button className="px-3 py-2 rounded-xl border bg-white text-sm" onClick={onPrev} disabled={active===0} aria-disabled={active===0}>Back</button>
        <div className="text-xs text-slate-600">Step {active+1} of {steps.length}</div>
        <button className="px-3 py-2 rounded-xl text-sm text-white shadow bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600" onClick={onNext} aria-label={active===steps.length-1? 'Finish onboarding' : 'Next step'}>{active===steps.length-1? 'Finish' : 'Next'}</button>
      </div>
    </div>
  );
}


