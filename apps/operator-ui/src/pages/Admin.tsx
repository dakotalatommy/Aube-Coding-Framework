import { useEffect, useState } from 'react';
import { api, getTenant } from '../lib/api';

export default function Admin(){
  const [kpis, setKpis] = useState<any>({});
  const [status, setStatus] = useState('');
  const [checklist, setChecklist] = useState<string>('');
  useEffect(()=>{ (async()=>{ try{ const r = await api.get(`/admin/kpis?tenant_id=${encodeURIComponent(await getTenant())}`); setKpis(r||{}); }catch{} try{ const d = await api.get('/docs/checklist'); setChecklist(d?.content||''); }catch{} })(); },[]);
  const recompute = async () => {
    try{ const r = await api.post('/marts/recompute',{ tenant_id: await getTenant() }); setStatus(JSON.stringify(r)); }
    catch(e:any){ setStatus(String(e?.message||e)); }
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
      <button onClick={recompute}>Recompute Marts</button>
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


