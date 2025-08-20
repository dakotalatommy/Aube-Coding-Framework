import { useEffect } from 'react';
import { startGuide } from '../lib/guide';
import { Link } from 'react-router-dom';

export default function Tutorial(){
  useEffect(()=>{ try{ startGuide('workflows'); } catch{} },[]);
  const steps = [
    { id: 1, title: 'Onboarding', desc: 'Connect tools and set tone. We’ll autosave as you go.', href: '/onboarding?tour=1' },
    { id: 2, title: 'Workflows', desc: 'Run dedupe, low‑stock, and social plan quick actions.', href: '/workflows?tour=1' },
    { id: 3, title: 'Inbox', desc: 'See unified messages; filters and guides are ready.', href: '/inbox?tour=1' },
  ];
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Guided Tutorial</h3>
      <p className="text-sm text-slate-600">Follow these steps to experience BrandVX end‑to‑end. Each step opens with a guided tour.</p>
      <ol className="grid sm:grid-cols-3 gap-3">
        {steps.map(s => (
          <li key={s.id} className="rounded-2xl p-4 bg-white/70 backdrop-blur border border-white/70 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-pink-500 text-white grid place-items-center text-xs font-semibold">{s.id}</span>
              <div className="font-medium text-slate-900">{s.title}</div>
            </div>
            <div className="text-sm text-slate-600 mt-1">{s.desc}</div>
            <div className="mt-3">
              <Link to={s.href} className="px-3 py-2 rounded-md text-white shadow hover:shadow-md bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600">Start tour</Link>
            </div>
          </li>
        ))}
      </ol>
      <div className="text-xs text-slate-500">Tip: You can also use AskVX to “Run plan: Social/CRM/Book‑Filling”, which will guide and execute with approvals.</div>
    </div>
  );
}


