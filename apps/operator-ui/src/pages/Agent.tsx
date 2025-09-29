import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Tool = {
  name: string;
  public: boolean;
  description?: string;
  params?: Record<string, unknown>;
};

export default function Agent() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [status, setStatus] = useState('');
  const [draft, setDraft] = useState({ contact_id: 'c_demo', channel: 'sms', service: 'service' });
  const [cadence, setCadence] = useState({ contact_id: 'c_demo', cadence_id: 'warm_lead_default' });
  const [audit, setAudit] = useState<any[]>([]);
  const [proxyOut, setProxyOut] = useState<any | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{id:string;name:string}>>([]);
  const [showSug, setShowSug] = useState(false);

  useEffect(() => {
    (async () => {
      try { const s = await api.get('/ai/tools/schema'); setTools(s?.tools || []); } catch {}
      try {
        const a = await api.get(`/admin/audit?limit=50`);
        setAudit(a || []);
      } catch {}
    })();
  }, []);
  // Contact typeahead
  useEffect(()=>{
    const t = setTimeout(async () => {
      try {
        const q = (draft.contact_id||cadence.contact_id||'').trim();
        if (!q) { setSuggestions([]); return; }
        const r = await api.get(`/contacts/search?q=${encodeURIComponent(q)}&limit=8`);
        setSuggestions(Array.isArray(r?.items)? r.items : []);
      } catch { setSuggestions([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [draft.contact_id, cadence.contact_id]);

  const runDraft = async () => {
    setStatus('');
    try {
      const r = await api.post('/ai/tools/execute', {
        name: 'draft_message',
        params: { ...draft },
        require_approval: false,
      });
      setStatus(JSON.stringify(r));
    } catch (e:any) { setStatus(String(e?.message||e)); }
  };

  const requestStartCadence = async () => {
    setStatus('');
    try {
      const r = await api.post('/ai/tools/execute', {
        name: 'start_cadence',
        params: { ...cadence },
        require_approval: true,
      });
      setStatus(JSON.stringify(r));
    } catch (e:any) { setStatus(String(e?.message||e)); }
  };

  const callProxy = async (name: string, payload: Record<string, unknown> = {}) => {
    setProxyOut(null);
    try {
      const r = await api.post(`/ai/proxy/${name}`, { payload });
      setProxyOut(r);
    } catch (e:any) {
      setProxyOut({ error: String(e?.message||e) });
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Agent Panel</h3>

      <section className="border rounded-xl p-3 bg-white shadow-sm">
        <div className="font-semibold mb-2">Tool Registry</div>
        <div className="grid gap-2">
          {tools.map(t => (
            <div key={t.name} className="flex items-start justify-between border rounded-md p-2">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-sm text-slate-600">{t.description}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-md ${t.public ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>{t.public ? 'Public' : 'Gated'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="border rounded-xl p-3 bg-white shadow-sm">
        <div className="font-semibold mb-2">Run a Public Tool: draft_message</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <input className="border rounded-md px-3 py-2 w-full" placeholder="contact_id" value={draft.contact_id} onFocus={()=>setShowSug(true)} onBlur={()=> setTimeout(()=>setShowSug(false), 120)} onChange={e=>setDraft({...draft, contact_id: e.target.value})} />
            {showSug && suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-40 overflow-auto bg-white border rounded-md shadow-sm text-xs w-full">
                {suggestions.map(s => (
                  <button key={s.id} className="block w-full text-left px-2 py-1 hover:bg-slate-50" onMouseDown={(ev)=>{ ev.preventDefault(); setDraft({...draft, contact_id: s.id}); setShowSug(false); }}>
                    {s.name || s.id}
                  </button>
                ))}
              </div>
            )}
          </div>
          <select className="border rounded-md px-3 py-2" value={draft.channel} onChange={e=>setDraft({...draft, channel: e.target.value})}>
            <option value="sms">sms</option>
            <option value="email">email</option>
          </select>
          <input className="border rounded-md px-3 py-2" placeholder="service" value={draft.service} onChange={e=>setDraft({...draft, service: e.target.value})} />
        </div>
        <button className="mt-2 border rounded-md px-3 py-2 bg-white hover:shadow-sm" onClick={runDraft}>Draft</button>
      </section>

      <section className="border rounded-xl p-3 bg-white shadow-sm">
        <div className="font-semibold mb-2">Request a Gated Action: start_cadence (approval)</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <input className="border rounded-md px-3 py-2 w-full" placeholder="contact_id" value={cadence.contact_id} onFocus={()=>setShowSug(true)} onBlur={()=> setTimeout(()=>setShowSug(false), 120)} onChange={e=>setCadence({...cadence, contact_id: e.target.value})} />
            {showSug && suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-40 overflow-auto bg-white border rounded-md shadow-sm text-xs w-full">
                {suggestions.map(s => (
                  <button key={s.id} className="block w-full text-left px-2 py-1 hover:bg-slate-50" onMouseDown={(ev)=>{ ev.preventDefault(); setCadence({...cadence, contact_id: s.id}); setShowSug(false); }}>
                    {s.name || s.id}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input className="border rounded-md px-3 py-2" placeholder="cadence_id" value={cadence.cadence_id} onChange={e=>setCadence({...cadence, cadence_id: e.target.value})} />
        </div>
        <button className="mt-2 border rounded-md px-3 py-2 bg-white hover:shadow-sm" onClick={requestStartCadence}>Request Approval</button>
      </section>

      <pre className="whitespace-pre-wrap text-sm text-slate-700">{status}</pre>

      <section className="border rounded-xl p-3 bg-white shadow-sm">
        <div className="font-semibold mb-2">Edge Function Proxies</div>
        <div className="flex flex-wrap gap-2">
          <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm" onClick={()=>callProxy('specialist-router', { query: 'Route this to the right specialist' })}>Specialist Router</button>
          <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm" onClick={()=>callProxy('ai-recommendations', { topic: 'dashboard_insights' })}>AI Recommendations</button>
          <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm" onClick={()=>callProxy('master-agent-orchestrator', { task: 'plan_daily_actions' })}>Master Orchestrator</button>
          <button className="border rounded-md px-3 py-2 bg-white hover:shadow-sm" onClick={()=>callProxy('realtime-token', { channel: 'voice' })}>Realtime Token</button>
        </div>
        <div className="mt-2 text-sm">
          <div className="font-medium">Response</div>
          <pre className="whitespace-pre-wrap text-slate-700">{proxyOut ? JSON.stringify(proxyOut, null, 2) : '—'}</pre>
        </div>
      </section>

      <section className="border rounded-xl p-3 bg-white shadow-sm">
        <div className="font-semibold mb-2">Recent Tool Audit</div>
        <div className="overflow-hidden rounded-md border">
          <table className="min-w-full">
            <thead className="bg-slate-50"><tr><Th>Time</Th><Th>Tool</Th><Th>Status</Th></tr></thead>
            <tbody className="divide-y">
              {(audit||[]).map((r:any)=> (
                <tr key={r.id} className="hover:bg-slate-50"><Td>{new Date((Number(r.ts)||0)*1000).toLocaleString()}</Td><Td>{r.action||r.tool}</Td><Td>{r.status||'-'}</Td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Th({children}:{children:React.ReactNode}){return <th className="text-left px-3 py-2 text-sm font-medium text-slate-600">{children}</th>}
function Td({children}:{children:React.ReactNode}){return <td className="px-3 py-2 text-sm text-slate-800">{children}</td>}


