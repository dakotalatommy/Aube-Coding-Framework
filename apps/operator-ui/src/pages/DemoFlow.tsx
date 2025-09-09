import { useEffect, useMemo, useState } from 'react';
import { track } from '../lib/analytics';
import Button, { ButtonLink } from '../components/ui/Button';

type BrandBrief = {
  businessName: string;
  vibe: string;
  primaryColor: string;
  serviceType: string;
};

function StepHeader({ title, subtitle }: { title: string; subtitle?: string }){
  return (
    <div className="mb-4">
      <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="text-slate-600 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}

export default function DemoFlow(){
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<BrandBrief>(()=>{
    try { return JSON.parse(localStorage.getItem('bvx_demo_brief')||'') as BrandBrief; } catch { return { businessName:'', vibe:'Balanced', primaryColor:'#E03C91', serviceType:'Hair' }; }
  });

  useEffect(()=>{ try { localStorage.setItem('bvx_demo_brief', JSON.stringify(brief)); } catch {} },[brief]);
  useEffect(()=>{ track('started_demo'); },[]);

  const dayOnePlan = useMemo(()=>{
    return [
      'Import your clients and booking history',
      'Enable 7d / 3d / 1d / 2h reminders',
      'Draft a friendly follow‑up in your voice',
    ];
  },[]);

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="fixed bottom-4 right-4 z-50">
        <ButtonLink href={`/signup?redirectTo=${encodeURIComponent(window.location.origin + '/onboarding?tour=1')}`}>Start your trial now</ButtonLink>
      </div>
      {step===0 && (
        <div className="min-h-[70vh] grid place-items-center">
          <div className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-sm text-center">
            <h1 className="text-3xl font-semibold text-slate-900">BrandVX</h1>
            <p className="text-slate-600 mt-1">Answer a few quick questions to personalize your demo.</p>
            <div className="mt-4 grid gap-3 text-left">
              <label className="grid gap-1">
                <span className="text-sm text-slate-700">Business name</span>
                <input className="border rounded-md px-3 py-2" value={brief.businessName} onChange={e=> setBrief({ ...brief, businessName: e.target.value })} placeholder="e.g., Color Lab" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm text-slate-700">Vibe</span>
                <select className="border rounded-md px-3 py-2" value={brief.vibe} onChange={e=> setBrief({ ...brief, vibe: e.target.value })}>
                  {['Balanced','Playful','Elegant','Bold'].map(v=> <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-4 flex justify-center">
              <Button onClick={()=> setStep(1)}>Continue</Button>
            </div>
          </div>
        </div>
      )}

      {step>0 && (
        <div className="mb-6">
          <div className="text-xs text-slate-600">Demo • Step {step} / 3</div>
          <h1 className="text-3xl font-semibold text-slate-900">Experience BrandVX</h1>
        </div>
      )}

      {step===1 && (
        <section className="min-h-[70vh] grid place-items-center">
          <div className="w-full max-w-xl rounded-2xl border bg-white p-6 shadow-sm">
          <StepHeader title="Your brand brief" subtitle="Creates a private brief to personalize this demo. Nothing is sent to your clients." />
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm text-slate-700">Primary color</span>
              <input className="border rounded-md px-3 py-2" type="color" value={brief.primaryColor} onChange={e=> setBrief({ ...brief, primaryColor: e.target.value })} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm text-slate-700">Service type</span>
              <select className="border rounded-md px-3 py-2" value={brief.serviceType} onChange={e=> setBrief({ ...brief, serviceType: e.target.value })}>
                {['Hair','Makeup','Brows/Lashes','Nails','Skincare/Facials','Med‑Spa','Barbering'].map(v=> <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={()=> { track('intake_saved'); setStep(2); }}>Continue</Button>
          </div>
          </div>
        </section>
      )}

      {step===2 && (
        <section className="min-h-[70vh] grid place-items-center">
          <div className="w-full max-w-xl rounded-2xl border bg-white p-6 shadow-sm">
          <StepHeader title="Preview your Day‑1 plan" subtitle="Nothing is sent in the demo—these are previews only." />
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-slate-900 font-medium">Plan for {brief.businessName || 'your business'}</div>
            <ul className="list-disc ml-5 mt-2 text-slate-700 text-sm">
              {dayOnePlan.map((it,i)=> <li key={i}>{it}</li>)}
            </ul>
            <div className="mt-4">
              <div className="text-slate-900 font-medium mb-1">Sample text message</div>
              <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">Hi there — this is {brief.businessName||'our studio'}. I can hold Friday at 2pm or notify you if sooner pops up. Prefer soonest or anytime?</div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={()=> setStep(1)}>Back</Button>
            <Button onClick={()=> { track('preview_viewed'); setStep(3); }}>Continue</Button>
          </div>
          </div>
        </section>
      )}

      {step===3 && (
        <section className="min-h-[70vh] grid place-items-center">
          <div className="w-full max-w-xl rounded-2xl border bg-white p-6 shadow-sm">
          <StepHeader title="What just happened" subtitle="We built the plan, drafted previews in your tone, and calculated time saved." />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-white p-4 shadow-sm text-center">
              <div className="text-2xl font-semibold text-slate-900">6.2h</div>
              <div className="text-xs text-slate-600">Time Saved / wk</div>
            </div>
            <div className="rounded-2xl border bg-white p-4 shadow-sm text-center">
              <div className="text-2xl font-semibold text-slate-900">19%</div>
              <div className="text-xs text-slate-600">No‑show reduction</div>
            </div>
            <div className="rounded-2xl border bg-white p-4 shadow-sm text-center">
              <div className="text-2xl font-semibold text-slate-900">4.8/5</div>
              <div className="text-xs text-slate-600">CSAT</div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <ButtonLink href="/onboarding">Begin onboarding</ButtonLink>
            <Button variant="outline" onClick={()=> setStep(2)}>Back</Button>
          </div>
          </div>
        </section>
      )}
    </div>
  );
}


