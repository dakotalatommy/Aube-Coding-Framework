 

import { useState } from 'react'
import Button from '../../components/ui/Button'
import { api } from '../../lib/api'

export default function SceneReview({ state, back, onFinish }: any){
  const d = state.data
  const hrs = (d.ops?.hrsAdmin||0)*0.5 + (d.ops?.hrsContent||0)*0.4
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const startCheckout = async (mode: 'sub_147_trial'|'one_time_97')=>{
    try{
      setBusy(true); setError(''); setStatus('')
      const cfg = await api.get('/billing/config')
      const priceId = mode==='sub_147_trial' ? (cfg?.price_147||'') : (cfg?.price_97||'')
      const payload: any = { mode: mode==='one_time_97'?'payment':'subscription' }
      if (priceId) payload.price_id = priceId
      if (mode==='sub_147_trial') payload.trial_days = cfg?.trial_days || 7
      const r = await api.post('/billing/create-checkout-session', payload)
      if (r?.url) window.location.href = r.url
    }catch(e:any){ setError(String(e?.message||e)) }
    finally{ setBusy(false) }
  }

  const uploadShareScreenshot = async (file: File)=>{
    try{
      setBusy(true); setError(''); setStatus('')
      const b64 = await fileToDataUrl(file)
      const r = await api.post('/share/screenshot', { data_url: b64, title: 'onboarding_share' })
      if (r?.token) setStatus('Thanks! Referral applied if subscribed.')
      // Attempt referral apply (+1) best-effort
      try{ await api.post('/billing/referral', { delta: 1 }) }catch{}
    }catch(e:any){ setError(String(e?.message||e)) }
    finally{ setBusy(false) }
  }

  const fileToDataUrl = (file: File)=> new Promise<string>((resolve, reject)=>{
    const fr = new FileReader()
    fr.onload = ()=> resolve(String(fr.result||''))
    fr.onerror = reject
    fr.readAsDataURL(file)
  })

  return (
    <section className="rounded-2xl shadow-xl bg-white/60 backdrop-blur border border-white/70 p-5">
      <h2 className="text-xl font-semibold text-slate-900">You’re live 🎉</h2>
      <p className="mt-1 text-sm text-slate-600">Here’s a quick summary. You can adjust anything later in Settings / Connections.</p>
      <div className="mt-3 grid grid-cols-1 gap-3">
        <div className="p-3 rounded-xl border bg-white/70"><div className="font-medium">Brand voice</div><div className="text-sm text-slate-600">{d.voice?.purpose || '—'}</div></div>
        <div className="p-3 rounded-xl border bg-white/70"><div className="font-medium">Operations</div><div className="text-sm text-slate-600">{d.ops?.clientsPerWeek || '—'} clients/week • {d.ops?.avgMinutes || '—'} min/service • ${d.ops?.avgPrice || '—'}</div></div>
        <div className="p-3 rounded-xl border bg-white/70"><div className="font-medium">Connections</div><div className="text-sm text-slate-600">{d.connections?.bookingProvider || 'Not set'}</div></div>
        <div className="p-3 rounded-xl border bg-white/70"><div className="font-medium">Goals</div><div className="text-sm text-slate-600">{(d.goals?.quarter||[]).join(', ') || '—'}</div></div>
        <div className="p-3 rounded-xl border bg-white/70"><div className="font-medium">WorkStyles</div><div className="text-sm text-slate-600">{(d.styles?.selected||[]).join(', ') || '—'}</div></div>
      </div>
      <div className="mt-4 text-sm">Estimated time saved: <strong>≈{Math.round(hrs*10)/10} hrs/week</strong></div>
      {/* Shareable milestone slot */}
      <div className="mt-3 rounded-xl border bg-white p-3">
        <div className="font-medium text-slate-900 text-sm">Milestone: Onboarding complete</div>
        <div className="text-xs text-slate-600 mt-1">Share your first win — you just saved setup time and connected your tools.</div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <button className="px-2 py-1 rounded-md border bg-white" onClick={()=>{ try{ navigator.clipboard.writeText('Just finished BrandVX onboarding — short, kind messages in our voice.'); }catch{} }}>Copy caption</button>
          <button className="px-2 py-1 rounded-md border bg-white" onClick={()=>{ try{ navigator.clipboard.writeText(window.location.origin+'/s/demo'); }catch{} }}>Copy share link</button>
        </div>
      </div>
      {/* Billing choice */}
      <div className="mt-5 rounded-xl border bg-white p-3">
        <div className="font-medium text-slate-900 text-sm">Choose billing</div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Button variant="outline" size="sm" disabled={busy} onClick={()=> startCheckout('sub_147_trial')}>$147/mo + {7}‑day free trial</Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={()=> startCheckout('one_time_97')}>$97 today (one‑time)</Button>
        </div>
        <div className="mt-2 text-[11px] text-slate-600">If you share now, your subscription can drop to $127/mo immediately.</div>
      </div>
      {/* Quick insights */}
      <div className="mt-3 rounded-xl border bg-white p-3">
        <div className="font-medium text-slate-900 text-sm">Quick insights</div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Button variant="outline" size="sm" disabled={busy} onClick={async()=>{
            try{ setBusy(true); setStatus(''); setError('');
              await api.post('/ai/tools/execute', { name: 'db.query.named', params: { name: 'metric.weekly_revenue_last_week', params: {} } });
              setStatus('Computed last week revenue');
            } catch(e:any){ setError(String(e?.message||e)); } finally{ setBusy(false); }
          }}>Weekly revenue</Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={async()=>{
            try{ setBusy(true); setStatus(''); setError('');
              await api.post('/ai/tools/execute', { name: 'contacts.list.top_ltv', params: { limit: 5 } });
              setStatus('Fetched top clients by LTV');
            } catch(e:any){ setError(String(e?.message||e)); } finally{ setBusy(false); }
          }}>Top clients</Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={async()=>{
            try{ setBusy(true); setStatus(''); setError('');
              await api.post('/ai/tools/execute', { name: 'contacts.import.square', params: {} });
              setStatus('Import from Square started');
            } catch(e:any){ setError(String(e?.message||e)); } finally{ setBusy(false); }
          }}>Import clients</Button>
        </div>
      </div>
      {/* Share to unlock */}
      <div className="mt-3 rounded-xl border bg-white p-3">
        <div className="font-medium text-slate-900 text-sm">Share to unlock $127/mo</div>
        <div className="text-xs text-slate-600 mt-1">Post anywhere. Upload a screenshot here; we won’t over‑verify.</div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <input type="file" accept="image/*" onChange={(e)=>{ const f=e.target.files?.[0]; if (f) uploadShareScreenshot(f) }} />
          {status && <span className="text-emerald-700">{status}</span>}
          {error && <span className="text-rose-700">{error}</span>}
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={back}>Back</button>
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={onFinish}>Take me to my workspace</button>
      </div>
    </section>
  )
}


