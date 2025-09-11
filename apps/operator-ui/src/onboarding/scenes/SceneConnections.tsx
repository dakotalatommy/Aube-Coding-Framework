import { useState, useEffect } from 'react'
import { startOAuth } from '../../sdk/connectionsClient'
import { api, getTenant } from '../../lib/api'

export default function SceneConnections({ next, back }: any){
  const [busy, setBusy] = useState<boolean>(false)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [linked, setLinked] = useState<Record<string, boolean>>({})

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

  const connect = async (prov: 'square'|'acuity')=>{
    try{
      setBusy(true); setError(''); setStatus('')
      await startOAuth(prov, { returnTo: 'onboarding' })
      setStatus('Opening connect flow…')
    }catch(e:any){ setError(String(e?.message||e)) }
    finally{ setBusy(false) }
  }

  return (
    <section className="rounded-2xl shadow-xl bg-white border border-white/80 p-5">
      <h2 className="text-xl font-semibold text-slate-900">Let’s look up your book</h2>
      <p className="mt-1 text-sm text-slate-600">Connecting your calendar unlocks confirmations, reschedules, and notify-list magic.</p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(['square','acuity'] as const).map((p) => (
          <button key={p} disabled={busy} onClick={()=> connect(p)} className={`rounded-xl border p-4 text-center border-white/70 bg-white/70 ${busy?'opacity-60 cursor-not-allowed':''}`}>
            <div className="text-sm font-medium">Connect {p.charAt(0).toUpperCase()+p.slice(1)}</div>
            <div className={`text-[11px] mt-1 ${linked[p]?'text-emerald-700':'text-slate-500'}`}>{linked[p]?'Linked':'Not linked'}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 text-[11px] text-slate-600">We’ll return you here after you sign in.</div>
      {(status || error) && (
        <div className="mt-3 text-xs">
          {status && <div className="text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1 inline-block">{status}</div>}
          {error && <div className="text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-2 py-1 inline-block ml-2">{error}</div>}
        </div>
      )}
      <div className="mt-6 flex gap-2">
        <button className="rounded-full border px-3 py-2 text-sm bg-white" disabled={busy} onClick={back}>Back</button>
        <button className="rounded-full border px-3 py-2 text-sm bg-white" disabled={busy} onClick={()=> next({ connections: { bookingProvider: null } })}>Skip for now</button>
      </div>
    </section>
  )
}


