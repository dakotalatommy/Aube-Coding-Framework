import { useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { startGuide } from '../lib/guide';
import { runUIAction } from '../lib/actions';

type WorkStyle = { id: string; title: string; description: string; actionId: string };

export default function Workflows(){
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string>('');
  const isDemo = useMemo(()=> new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('demo') === '1', []);

  const top3: WorkStyle[] = [
    { id:'reminders', title:'Fill your week: gentle appointment reminders', description:'Respect quiet hours. Sends when it’s kind, not spammy.', actionId:'workflows.run.reminders' },
    { id:'reengage30', title:'Check‑in at 30 days: “Ready for a refresh?”', description:'Find clients due at ~30 days and draft a friendly note.', actionId:'workflows.run.reengage_30' },
    { id:'winback45', title:'Win‑back list: 6+ weeks love note', description:'Surface 45+ day clients for a warm reconnect.', actionId:'workflows.run.winback_45' },
  ];
  const more: WorkStyle[] = [
    { id:'import', title:'Pull bookings + tidy your list', description:'Import bookings, normalize, and cleanup connectors.', actionId:'workflows.run.import_and_normalize' },
    { id:'sync', title:'Refresh this week’s calendar', description:'Pull the latest Google/Acuity/Square events.', actionId:'workflows.run.calendar_sync' },
    { id:'merge', title:'Fix doubled appointments', description:'Merge duplicate events across providers.', actionId:'workflows.run.calendar_merge' },
    { id:'dedupe', title:'Clean duplicates', description:'Remove duplicate contacts for better deliverability.', actionId:'workflows.run.dedupe_contacts' },
  ];

  const run = async (ws: WorkStyle) => {
    if (isDemo) { showToast({ title:'Demo mode', description:'Create an account to run this.' }); return; }
    setBusyId(ws.id);
    try {
      const r = await runUIAction(ws.actionId);
      const ok = r && !r.error;
      showToast({ title: ok? 'Queued' : 'Error', description: ok? ws.title : String(r?.error||r?.status||'error') });
    } catch (e:any) {
      showToast({ title:'Error', description:String(e?.message||e) });
    } finally { setBusyId(''); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">WorkStyles</h3>
        <Button variant="outline" size="sm" aria-label="Open workflows guide" onClick={()=> startGuide('workflows')}>Guide me</Button>
      </div>

      <section className="rounded-2xl p-4 bg-white/70 backdrop-blur border border-white/70 shadow-sm">
        <div className="font-medium text-slate-900">Top 3</div>
        <div className="mt-2 grid sm:grid-cols-2 gap-3">
          {top3.map(ws=> (
            <div key={ws.id} className="rounded-xl border bg-white p-3">
              <div className="font-medium text-slate-900">{ws.title}</div>
              <div className="text-sm text-slate-600 mt-1">{ws.description}</div>
              <div className="mt-2">
                <Button size="sm" disabled={busyId===ws.id} onClick={()=> run(ws)}>Run</Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl p-4 bg-white/70 backdrop-blur border border-white/70 shadow-sm">
        <div className="font-medium text-slate-900">More WorkStyles</div>
        <div className="mt-2 grid sm:grid-cols-2 gap-3">
          {more.map(ws=> (
            <div key={ws.id} className="rounded-xl border bg-white p-3">
              <div className="font-medium text-slate-900">{ws.title}</div>
              <div className="text-sm text-slate-600 mt-1">{ws.description}</div>
              <div className="mt-2">
                <Button size="sm" disabled={busyId===ws.id} onClick={()=> run(ws)}>Run</Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="text-xs text-slate-500">These actions match the Dashboard Quick Start buttons — one click here or there works the same.</div>
    </div>
  );
}


