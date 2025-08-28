import { useState } from 'react'
import { startOAuth } from '../../sdk/connectionsClient'

export default function SceneConnections({ next, back, save }: any){
  const [provider, setProvider] = useState<'square'|'acuity'|'other'|null>(null)
  const allowDeclared = (import.meta as any).env?.VITE_ONBOARDING_ALLOW_DECLARED === '1' || true
  const proceed = async()=> {
    const payload:any = { connections: { bookingProvider: provider, oauth: { provider, linked: provider !== 'other' } } }
    await save(payload)
    next()
  }
  return (
    <section className="rounded-2xl shadow-xl bg-white/60 backdrop-blur border border-white/70 p-5">
      <h2 className="text-xl font-semibold text-slate-900">Let’s look up your book</h2>
      <p className="mt-1 text-sm text-slate-600">Connecting your calendar unlocks confirmations, reschedules, and notify-list magic.</p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {['square','acuity','other'].map((p:any) => (
          <button key={p} onClick={()=>setProvider(p)} className={`rounded-xl border p-4 text-center ${provider===p?'ring-2 ring-sky-300 border-sky-300':'border-white/70 bg-white/70'}`}>
            <div className="text-sm font-medium">{p==='other'?'Other':'Connect ' + p.charAt(0).toUpperCase()+p.slice(1)}</div>
          </button>
        ))}
      </div>
      {provider && (
        <div className="mt-4 flex gap-2">
          {provider!=='other' && (
            <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={()=> startOAuth(provider as any)}>Continue with {provider.charAt(0).toUpperCase()+provider.slice(1)} (OAuth)</button>
          )}
          {allowDeclared && (
            <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={proceed}>Declare for now (dev)</button>
          )}
          {!allowDeclared && (
            <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={proceed}>Continue</button>
          )}
        </div>
      )}
      <div className="mt-6 flex gap-2">
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={back}>Back</button>
        {!provider && <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={()=> next({ connections: { bookingProvider: null } })}>Skip for now</button>}
      </div>
    </section>
  )
}


