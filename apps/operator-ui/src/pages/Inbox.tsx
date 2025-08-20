import { useEffect, useState } from 'react';
import { api, getTenant } from '../lib/api';
import { startGuide } from '../lib/guide';

type InboxItem = { channel?: string; from?: string; to?: string; ts?: number; preview?: string };

export default function Inbox(){
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [oauthError, setOauthError] = useState('');
  const [ready, setReady] = useState<boolean>(false);
  const [channel, setChannel] = useState<string>('all');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [connected, setConnected] = useState<Record<string,string>>({});
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<InboxItem|null>(null);
  const loadMsgs = async()=>{
    try{ const tid = await getTenant(); const r = await api.get(`/inbox/list?tenant_id=${encodeURIComponent(tid)}`); setItems(r?.items||[]); }
    catch(e:any){ setError(String(e?.message||e)); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ (async()=>{ await loadMsgs(); })(); },[]);
  useEffect(()=>{
    try{
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('error')) setOauthError(sp.get('error')||'');
    }catch{}
  },[]);
  useEffect(()=>{
    (async()=>{
      try{
        const tid = await getTenant();
        const r = await api.post('/onboarding/analyze', { tenant_id: tid });
        setReady(Boolean(r?.summary?.inbox_ready));
        if (r?.summary?.connected) setConnected(r.summary.connected);
      }catch{}
    })();
  },[]);
  const connect = async (provider: string) => {
    setConnecting(c => ({...c, [provider]: true}));
    const devAuto = (import.meta.env.VITE_DEV_AUTOCONNECT as any) === '1';
    try{
      if (devAuto) {
        await api.post('/dev/connect', { tenant_id: await getTenant(), provider });
        await refreshStatus();
      } else {
        const j = await api.get(`/oauth/${provider}/login?tenant_id=${encodeURIComponent(await getTenant())}`);
        if (j?.url) window.open(j.url, '_blank');
      }
    } finally {
      setConnecting(c => ({...c, [provider]: false}));
    }
  };
  const refreshStatus = async () => {
    try{
      const r = await api.post('/onboarding/analyze', { tenant_id: await getTenant() });
      setReady(Boolean(r?.summary?.inbox_ready));
      if (r?.summary?.connected) setConnected(r.summary.connected);
    }catch{}
  };
  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{color:'#b91c1c'}}>Error: {error}</div>;
  const filteredBase = channel === 'all' ? items : items.filter(i => (i.channel||'').toLowerCase() === channel);
  const filteredText = q ? filteredBase.filter(i=> [i.channel,i.from,i.to,i.preview].join(' ').toLowerCase().includes(q.toLowerCase())) : filteredBase;
  const filtered = (dateFrom || dateTo) ? filteredText.filter(i=>{
    const ts = Number(i.ts||0)*1000;
    if (dateFrom) { const from = new Date(dateFrom+'T00:00:00').getTime(); if (ts < from) return false; }
    if (dateTo) { const to = new Date(dateTo+'T23:59:59').getTime(); if (ts > to) return false; }
    return true;
  }) : filteredText;
  const channelLabel = channel === 'all' ? 'inbox' : channel;
  const counts = {
    all: items.length,
    facebook: items.filter(i => (i.channel||'').toLowerCase()==='facebook').length,
    instagram: items.filter(i => (i.channel||'').toLowerCase()==='instagram').length,
    sms: items.filter(i => (i.channel||'').toLowerCase()==='sms').length,
    email: items.filter(i => (i.channel||'').toLowerCase()==='email').length,
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Inbox</h3>
        <button className="text-sm text-slate-600 hover:underline" aria-label="Open inbox guide" onClick={()=> startGuide('inbox')}>Guide me</button>
      </div>
      {oauthError && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-2 py-1 inline-block">OAuth error: {oauthError}</div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs" data-guide="channels">
        {(['all','facebook','instagram','sms','email'] as const).map(key=> (
          <button key={key} className={`px-2 py-1 rounded-full border ${channel===key? 'bg-slate-900 text-white border-slate-900':'bg-white text-slate-700 hover:shadow-sm'}`} onClick={()=> setChannel(key)}>
            {key} · {counts[key] as number}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-slate-700">
        {Object.entries(connected).map(([prov, status])=> (
          <span key={prov} className={`px-2 py-1 rounded-md border bg-white ${status==='connected' ? 'border-emerald-200 text-emerald-700' : status==='pending_config' ? 'border-amber-200 text-amber-700':'border-slate-200'}`}>{prov}: {status}</span>
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm" data-guide="filters">
        <span className="text-slate-600">Filter:</span>
        <select className="border rounded-md px-2 py-1 bg-white" value={channel} onChange={e=>setChannel(e.target.value)}>
          <option value="all">All</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
          <option value="sms">SMS</option>
          <option value="email">Email</option>
        </select>
        <input className="border rounded-md px-2 py-1 bg-white" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} data-guide="search" />
        <input className="border rounded-md px-2 py-1 bg-white" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} data-guide="date-from" />
        <input className="border rounded-md px-2 py-1 bg-white" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} data-guide="date-to" />
        <button className="px-2 py-1 rounded-md border bg-white hover:shadow-sm" onClick={loadMsgs}>Refresh messages</button>
        <button className="ml-auto px-2 py-1 rounded-md border bg-white hover:shadow-sm" onClick={refreshStatus}>Refresh status</button>
      </div>
      <div className="rounded-xl border bg-white p-3 shadow-sm flex items-center justify-between">
        <div className={`text-sm ${ready ? 'text-emerald-700' : 'text-slate-700'}`}>{ready ? 'Ready: Facebook/Instagram connected' : 'Connect Facebook/Instagram to enable unified inbox.'}</div>
        {!ready && (
          <div className="flex gap-2">
            <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm text-sm disabled:opacity-50" disabled={!!connecting.facebook} onClick={()=>connect('facebook')}>{connecting.facebook ? 'Connecting…' : 'Connect Facebook'}</button>
            <button className="px-3 py-2 rounded-md border bg-white hover:shadow-sm text-sm disabled:opacity-50" disabled={!!connecting.instagram} onClick={()=>connect('instagram')}>{connecting.instagram ? 'Connecting…' : 'Connect Instagram'}</button>
          </div>
        )}
      </div>
      {Object.values(connected).some(s=>s==='pending_config') && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">Some connections are pending configuration. Complete app credentials to activate.</div>
      )}
      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-3 shadow-sm text-sm text-slate-600">
          No {channelLabel} messages yet.
          <div className="block text-xs text-slate-500 mt-1 space-y-2">
            {channel === 'facebook' && (
              connected.facebook !== 'connected' ? (
                <div className="flex items-center gap-2">
                  <span>Connect Facebook to receive messages here.</span>
                  <button className="px-2 py-1 rounded-md border bg-white hover:shadow-sm text-xs disabled:opacity-50" disabled={!!connecting.facebook} onClick={()=>connect('facebook')}>
                    {connecting.facebook ? 'Connecting…' : 'Connect Facebook'}
                  </button>
                </div>
              ) : <span>Connected. New DMs and comments will appear.</span>
            )}
            {channel === 'instagram' && (
              connected.instagram !== 'connected' ? (
                <div className="flex items-center gap-2">
                  <span>Connect Instagram to receive messages here.</span>
                  <button className="px-2 py-1 rounded-md border bg-white hover:shadow-sm text-xs disabled:opacity-50" disabled={!!connecting.instagram} onClick={()=>connect('instagram')}>
                    {connecting.instagram ? 'Connecting…' : 'Connect Instagram'}
                  </button>
                </div>
              ) : <span>Connected. New DMs and comments will appear.</span>
            )}
            {channel === 'sms' && (
              <div className="flex items-center gap-2">
                <span>Connect SMS provider (Twilio) in Integrations to receive texts.</span>
                <a href="/integrations" className="px-2 py-1 rounded-md border bg-white hover:shadow-sm text-xs">Open Integrations</a>
              </div>
            )}
            {channel === 'email' && (
              <div className="flex items-center gap-2">
                <span>Connect Email provider (SendGrid) in Integrations to receive emails.</span>
                <a href="/integrations" className="px-2 py-1 rounded-md border bg-white hover:shadow-sm text-xs">Open Integrations</a>
              </div>
            )}
            {channel === 'all' && (
              <div className="flex items-center gap-2">
                <span>Once providers are connected, new DMs, comments, texts, and emails will appear here.</span>
                <a href="/integrations" className="px-2 py-1 rounded-md border bg-white hover:shadow-sm text-xs">Connect providers</a>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-0 shadow-sm overflow-hidden" data-guide="table">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">Channel</th><th className="px-3 py-2 text-left">From</th><th className="px-3 py-2 text-left">To</th><th className="px-3 py-2 text-left">Preview</th><th className="px-3 py-2 text-left">Time</th></tr></thead>
            <tbody className="divide-y">
              {filtered.map((m,i)=> (
                <tr key={i} className="hover:bg-slate-50 cursor-pointer" onClick={()=> setSelected(m)}>
                  <td className="px-3 py-2">{m.channel||'—'}</td>
                  <td className="px-3 py-2">{m.from||'—'}</td>
                  <td className="px-3 py-2">{m.to||'—'}</td>
                  <td className="px-3 py-2">{m.preview||'—'}</td>
                  <td className="px-3 py-2">{m.ts ? new Date((m.ts as number) * 1000).toLocaleString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/20" onClick={()=> setSelected(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl border-l p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-slate-900">Message</h4>
              <button className="text-slate-500 hover:text-slate-700" onClick={()=> setSelected(null)}>Close</button>
            </div>
            <div className="text-sm text-slate-700 space-y-2">
              <div><span className="text-slate-500">Channel:</span> {selected.channel||'—'}</div>
              <div><span className="text-slate-500">From:</span> {selected.from||'—'}</div>
              <div><span className="text-slate-500">To:</span> {selected.to||'—'}</div>
              <div><span className="text-slate-500">Time:</span> {selected.ts ? new Date((selected.ts as number) * 1000).toLocaleString() : '—'}</div>
              <div className="mt-3"><span className="text-slate-500 block">Preview:</span>
                <div className="mt-1 rounded-md border bg-slate-50 p-2 text-slate-800">{selected.preview||'—'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


