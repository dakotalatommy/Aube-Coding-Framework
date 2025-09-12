import { useState } from 'react'
import { startOAuth } from '../../sdk/connectionsClient'
import { api, getTenant } from '../../lib/api'

export default function SceneSocialEmail({ state, next, back, save }: any){
  const prev = state.data.social || { instagram: '', email: '' }
  const [instagram, setInstagram] = useState(prev.instagram)
  const [email, setEmail] = useState(prev.email)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [error, setError] = useState('')
  const onContinue = async()=> { await save({ social: { instagram, email }}); next(); }
  const runAnalysis = async()=>{
    try{
      setError(''); setAnalyzing(true)
      const r = await api.post('/ai/tools/execute', { name: 'brand.vision.analyze', params: { tenant_id: await getTenant(), sample: 12 }})
      if (r?.status === 'ok') setAnalyzed(true)
    }catch(e:any){ setError(String(e?.message||e)) }
    finally{ setAnalyzing(false) }
  }
  return (
    <section className="rounded-2xl shadow-xl bg-white border border-white/80 p-5">
      <h2 className="text-xl font-semibold text-slate-900">Instagram & Email</h2>
      <p className="mt-1 text-sm text-slate-600">These enable content helper and respectful communication.</p>
      <div className="mt-4 grid grid-cols-1 gap-3">
        <div className="rounded-xl bg-white/70 p-3 border border-white/70">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div>
              <div className="text-sm font-medium text-slate-800">Connect Instagram</div>
              <div className="text-xs text-slate-600">We’ll tune your 14‑day plan to your recent posts. You approve first.</div>
            </div>
            <button aria-label="Connect Instagram" className="rounded-full border px-3 py-1.5 text-sm bg-white focus-visible:ring-2 focus-visible:ring-[var(--ring)]" onClick={()=> startOAuth('instagram' as any, { returnTo: 'onboarding' })}>Connect</button>
          </div>
          {analyzing ? (
            <div className="mt-3 animate-pulse">
              <div className="h-3 w-40 bg-slate-200 rounded" />
              <div className="mt-2 h-20 bg-slate-100 rounded" />
            </div>
          ) : analyzed ? (
            <div className="mt-2 text-xs text-slate-600">Brand page scanned. Ready to generate your 14‑day plan.</div>
          ) : null}
          <div className="mt-2 flex gap-2 text-xs">
            <button className="rounded-full border px-3 py-1 bg-white" onClick={runAnalysis} disabled={analyzing}>Analyze now</button>
            {error && <span className="text-rose-700">{error}</span>}
          </div>
        </div>
        <label className="block"><div className="text-sm">Instagram handle</div><input className="w-full border rounded-md px-3 py-2" value={instagram} onChange={(e)=>setInstagram(e.target.value)} placeholder="@yourhandle" /></label>
        <label className="block"><div className="text-sm">Email</div><input className="w-full border rounded-md px-3 py-2" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@business.com" /></label>
      </div>
      <div className="mt-2 text-[11px] text-slate-600">No Instagram? Add your handle; we’ll still draft with your brand voice. Draft confidence shows when IG isn’t connected.</div>
      <div className="mt-6 flex gap-2">
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={back}>Back</button>
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={onContinue}>Continue</button>
      </div>
    </section>
  )
}


