import { useState, useEffect } from 'react'
import { startOAuth } from '../../sdk/connectionsClient'
import { api, getTenant } from '../../lib/api'

export default function SceneConnections({ next, back, save }: any){
  const [provider, setProvider] = useState<'square'|'acuity'|'other'|null>(null)
  const [busy, setBusy] = useState<boolean>(false)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [linked, setLinked] = useState<Record<string, boolean>>({})
  const allowDeclared = (import.meta as any).env?.VITE_ONBOARDING_ALLOW_DECLARED === '1' || true

  useEffect(()=>{
    (async()=>{
      try{
        const tid = await getTenant()
        const st = await api.get(`/integrations/status?tenant_id=${encodeURIComponent(tid)}`)
        const provs = (st?.providers||{}) as Record<string, { linked:boolean }>
        const map: Record<string, boolean> = {}
        Object.entries(provs).forEach(([k,v])=> map[k] = !!v?.linked)
        setLinked(map)
      }catch{}
    })()
  },[])

  const proceed = async()=> {
    const payload:any = { connections: { bookingProvider: provider, oauth: { provider, linked: provider !== 'other' } } }
    await save(payload)
    next()
  }

  const connect = async (prov: 'square'|'acuity')=>{
    try{
      setBusy(true); setError(''); setStatus('')
      await startOAuth(prov, { returnTo: 'onboarding' })
      setStatus('Opening connect flow…')
    }catch(e:any){ setError(String(e?.message||e)) }
    finally{ setBusy(false) }
  }

  const importOrBackfill = async (action: 'import'|'backfill')=>{
    try{
      setBusy(true); setError(''); setStatus('')
      const tid = await getTenant()
      if (action==='import'){
        const r = await api.post('/integrations/booking/square/sync-contacts', { tenant_id: tid })
        if (typeof r?.imported === 'number') setStatus(`Imported ${r.imported} contacts from Square`)
        else if (r?.error) setError(`Import failed: ${r.error}${r?.detail?` — ${r.detail}`:''}`)
      } else {
        const r = await api.post('/integrations/booking/square/backfill-metrics', { tenant_id: tid })
        if (typeof r?.updated === 'number') setStatus(`Backfill complete — ${r.updated} customers updated`)
        else if (r?.error) setError(`Backfill failed: ${r.error}${r?.detail?` — ${r.detail}`:''}`)
      }
      // Refresh linked status
      try{
        const st = await api.get(`/integrations/status?tenant_id=${encodeURIComponent(tid)}`)
        const provs = (st?.providers||{}) as Record<string, { linked:boolean }>
        const map: Record<string, boolean> = {}
        Object.entries(provs).forEach(([k,v])=> map[k] = !!v?.linked)
        setLinked(map)
      }catch{}
    }catch(e:any){ setError(String(e?.message||e)) }
    finally{ setBusy(false) }
  }

  return (
    <section className="rounded-2xl shadow-xl bg-white border border-white/80 p-5">
      <h2 className="text-xl font-semibold text-slate-900">Let’s look up your book</h2>
      <p className="mt-1 text-sm text-slate-600">Connecting your calendar unlocks confirmations, reschedules, and notify-list magic.</p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {['square','acuity','other'].map((p:any) => (
          <button key={p} disabled={busy} onClick={()=>setProvider(p)} className={`rounded-xl border p-4 text-center ${provider===p?'ring-2 ring-sky-300 border-sky-300':'border-white/70 bg-white/70'} ${busy?'opacity-60 cursor-not-allowed':''}`}>
            <div className="text-sm font-medium">{p==='other'?'Other':'Connect ' + p.charAt(0).toUpperCase()+p.slice(1)}</div>
            {p!=='other' && (
              <div className="text-[11px] mt-1 {linked[p]?'text-emerald-700':'text-slate-500'}">{linked[p]?'Linked':'Not linked'}</div>
            )}
          </button>
        ))}
      </div>
      {provider && (
        <div className="mt-4 flex gap-2 flex-wrap">
          {provider!=='other' && (
            <button className="rounded-full border px-3 py-2 text-sm bg-white" disabled={busy} onClick={()=> connect(provider as any)}>{busy? 'Connecting…':'Continue with '}{provider.charAt(0).toUpperCase()+provider.slice(1)} (OAuth)</button>
          )}
          {provider==='square' && (
            <>
              <button className="rounded-full border px-3 py-2 text-sm bg-white" disabled={busy || !linked.square} onClick={()=> importOrBackfill('import')}>{busy? 'Working…':'Import contacts'}</button>
              <button className="rounded-full border px-3 py-2 text-sm bg-white" disabled={busy || !linked.square} onClick={()=> importOrBackfill('backfill')}>{busy? 'Working…':'Backfill metrics'}</button>
            </>
          )}
          {allowDeclared && (
            <button className="rounded-full border px-3 py-2 text-sm bg-white" disabled={busy} onClick={proceed}>Declare for now (dev)</button>
          )}
          {!allowDeclared && (
            <button className="rounded-full border px-3 py-2 text-sm bg-white" disabled={busy} onClick={proceed}>Continue</button>
          )}
        </div>
      )}
      {(status || error) && (
        <div className="mt-3 text-xs">
          {status && <div className="text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1 inline-block">{status}</div>}
          {error && <div className="text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-2 py-1 inline-block ml-2">{error}</div>}
        </div>
      )}
      <div className="mt-6 flex gap-2">
        <button className="rounded-full border px-3 py-2 text-sm bg-white" disabled={busy} onClick={back}>Back</button>
        {!provider && <button className="rounded-full border px-3 py-2 text-sm bg-white" disabled={busy} onClick={()=> next({ connections: { bookingProvider: null } })}>Skip for now</button>}
      </div>
    </section>
  )
}


