import { useEffect, useState } from 'react';
import { api, getTenant } from '../lib/api';

export default function Admin(){
  const [kpis, setKpis] = useState<any>({});
  const [aiCosts, setAiCosts] = useState<any>({});
  const [status, setStatus] = useState('');
  const [checklist, setChecklist] = useState<string>('');
  const [tools, setTools] = useState<Array<{name:string; public:boolean; description?:string; params?:any}>>([]);
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [toolParams, setToolParams] = useState<string>('{}');
  const [qaOut, setQaOut] = useState<string>('');
  const [telemetry, setTelemetry] = useState<any>({ items: [], counts: {} });
  useEffect(()=>{ (async()=>{
    try{ const r = await api.get(`/admin/kpis?tenant_id=${encodeURIComponent(await getTenant())}`); setKpis(r||{}); }catch{}
    try{ const d = await api.get('/docs/checklist'); setChecklist(d?.content||''); }catch{}
    try{ const c = await api.get(`/ai/costs?tenant_id=${encodeURIComponent(await getTenant())}`); setAiCosts(c||{}); }catch{}
    try{ const s = await api.get('/ai/tools/schema'); setTools(Array.isArray(s?.tools)? s.tools: []); }catch{}
    try{ const t = await api.get(`/admin/tools/telemetry?tenant_id=${encodeURIComponent(await getTenant())}&limit=50`); setTelemetry(t||{items:[],counts:{}}); }catch{}
  })(); },[]);
  const recompute = async () => {
    try{ const r = await api.post('/marts/recompute',{ tenant_id: await getTenant() }); setStatus(JSON.stringify(r)); }
    catch(e:any){ setStatus(String(e?.message||e)); }
  };
  const provisionCreator = async () => {
    try{
      const r = await api.post('/admin/provision_creator', { tenant_id: await getTenant(), rate_limit_multiplier: 5 });
      setStatus('Creator mode provisioned: ' + JSON.stringify(r));
    } catch(e:any){ setStatus(String(e?.message||e)); }
  };
  const checkHealth = async () => {
    try{
      const r = await api.get('/health');
      setStatus('Health: ' + JSON.stringify(r));
    } catch(e:any){ setStatus('Health check failed: ' + String(e?.message||e)); }
  };
  const checkCache = async () => {
    try{
      const r = await api.get('/cache/health');
      setStatus('Cache: ' + JSON.stringify(r));
    } catch(e:any){ setStatus('Cache health failed: ' + String(e?.message||e)); }
  };
  const checkAuthConfig = async () => {
    try{
      const r = await api.get('/auth/config_check');
      setStatus('Auth config: ' + JSON.stringify(r));
    } catch(e:any){ setStatus('Auth config check failed: ' + String(e?.message||e)); }
  };
  const clearCache = async (scope: 'all'|'inbox'|'inventory'|'calendar'='all') => {
    try{
      const r = await api.post('/admin/cache/clear', { tenant_id: await getTenant(), scope });
      setStatus('Cache cleared: ' + JSON.stringify(r));
    } catch(e:any){ setStatus(String(e?.message||e)); }
  };
  const runQA = async () => {
    try{
      const tid = await getTenant();
      const params = JSON.parse(toolParams||'{}');
      const r = await api.post('/ai/tools/qa',{ tenant_id: tid, name: selectedTool, params });
      setQaOut(JSON.stringify(r, null, 2));
      try{ const t = await api.get(`/admin/tools/telemetry?tenant_id=${encodeURIComponent(tid)}&limit=50`); setTelemetry(t||{items:[],counts:{}});}catch{}
    } catch(e:any){ setQaOut(String(e?.message||e)); }
  };
  return (
    <div>
      <h3 style={{margin:'8px 0'}}>Admin</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
        <Card title="Active Tenants" value={kpis?.active_tenants||0}/>
        <Card title="Messages 24h" value={kpis?.messages_24h||0}/>
        <Card title="Errors 24h" value={kpis?.errors_24h||0}/>
        <Card title="Uptime %" value={kpis?.uptime_pct||0}/>
      </div>
      <section style={{border:'1px solid #eee',borderRadius:8,padding:12,marginBottom:12}}>
        <div style={{fontWeight:600, marginBottom:6}}>AI Metrics</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
          <Card title="AI chats" value={kpis?.ai_chat_used||0}/>
          <Card title="DB queries (tools)" value={kpis?.db_query_tool_used||0}/>
          <Card title="Insights served" value={kpis?.insights_served||0}/>
        </div>
      </section>
      <section style={{border:'1px solid #eee',borderRadius:8,padding:12,marginBottom:12}}>
        <div style={{fontWeight:600, marginBottom:6}}>AI Costs & Caps (today)</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          <Card title="Tenant tokens" value={aiCosts?.tenant_tokens_today||0}/>
          <Card title="Global tokens" value={aiCosts?.global_tokens_today||0}/>
          <Card title="Tenant $" value={Number(aiCosts?.tenant_cost_usd_today||0).toFixed ? Number(aiCosts?.tenant_cost_usd_today||0).toFixed(4) : (aiCosts?.tenant_cost_usd_today||0) as any}/>
          <Card title="Global $" value={Number(aiCosts?.global_cost_usd_today||0).toFixed ? Number(aiCosts?.global_cost_usd_today||0).toFixed(4) : (aiCosts?.global_cost_usd_today||0) as any}/>
        </div>
      </section>
      <div style={{display:'flex', gap:8, marginBottom:12}}>
        <button onClick={recompute}>Recompute Marts</button>
        <button onClick={provisionCreator}>Provision Creator Mode</button>
        <button onClick={checkHealth}>Check Health</button>
        <button onClick={checkCache}>Check Cache</button>
        <button onClick={checkAuthConfig}>Check Auth Config</button>
        <button onClick={()=> clearCache('all')}>Clear Tenant Cache</button>
      </div>
      <section style={{border:'1px solid #eee',borderRadius:8,padding:12,marginBottom:12}}>
        <div style={{fontWeight:600, marginBottom:6}}>Tools QA</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div>
            <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8}}>
              <select value={selectedTool} onChange={e=> setSelectedTool(e.target.value)} style={{padding:8, border:'1px solid #eee', borderRadius:8}}>
                <option value="">Select a tool</option>
                {tools.map(t=> (<option key={t.name} value={t.name}>{t.name}</option>))}
              </select>
              <button onClick={runQA} disabled={!selectedTool}>Run QA</button>
            </div>
            <div style={{fontSize:12, color:'#666', marginBottom:4}}>Params (JSON)</div>
            <textarea value={toolParams} onChange={e=> setToolParams(e.target.value)} rows={6} style={{width:'100%', border:'1px solid #eee', borderRadius:8, padding:8}} />
          </div>
          <div>
            <div style={{fontSize:12, color:'#666', marginBottom:4}}>Output</div>
            <pre style={{whiteSpace:'pre-wrap', fontSize:12, border:'1px solid #eee', borderRadius:8, padding:12, maxHeight:220, overflow:'auto'}}>{qaOut || '—'}</pre>
            <div style={{fontSize:12, color:'#666', margin:'8px 0'}}>Recent tool executions</div>
            <div style={{fontSize:12, border:'1px solid #eee', borderRadius:8, padding:8, maxHeight:160, overflow:'auto'}}>
              {(telemetry.items||[]).map((it:any, idx:number)=> (
                <div key={idx} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #f2f2f2', padding:'4px 0'}}>
                  <span>{new Date((Number(it.ts)||0)*1000).toLocaleTimeString()}</span>
                  <span>{it.tool}</span>
                  <span>{it.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <pre style={{whiteSpace:'pre-wrap',marginTop:12}}>{status}</pre>
      <div style={{marginTop:16}}>
        <div style={{fontWeight:600, marginBottom:6}}>Session Checklist</div>
        <div style={{whiteSpace:'pre-wrap',fontSize:12,border:'1px solid #eee',borderRadius:8,padding:12,maxHeight:320,overflow:'auto'}}>{checklist || 'Loading…'}</div>
      </div>
    </div>
  );
}

function Card({title,value}:{title:string;value:number}){
  return (
    <div style={{border:'1px solid #eee',borderRadius:8,padding:12}}>
      <div style={{fontSize:12,color:'#666'}}>{title}</div>
      <div style={{fontSize:22,fontWeight:700}}>{value}</div>
    </div>
  );
}


