import { useState } from 'react'
import { api, getTenant } from '../../lib/api'

const STYLE_KEYS = [
  { key: 'no_show_shield', name: 'No-Show Shield', desc: 'Confirmations + friendly reschedule helper.' },
  { key: 'dormant_revive', name: 'Dormant Revive', desc: 'Reawaken 60+ day clients with one gentle nudge.' },
  { key: 'soonest_fill', name: 'Soonest Slot Fill', desc: 'Notify-list to fill cancellations first.' },
  { key: 'content_helper', name: 'Content Helper (14-day)', desc: 'Auto-drafted posts in your voice.' },
  { key: 'retail_push', name: 'Retail Push', desc: 'Suggest retail at the right moments.' },
]

export default function SceneStyles({ state, next, back, save }: any){
  const prev = state.data.styles || { selected: [] as string[] }
  const [selected, setSelected] = useState<string[]>(prev.selected)
  const toggle = (k:string) => setSelected(sel => sel.includes(k) ? sel.filter(x=>x!==k) : (sel.length>=3 ? sel : [...sel, k]))
  const instagramLinked = Boolean(state?.data?.social?.oauth?.instagram?.linked)
  const [q1, setQ1] = useState('')
  const [q2, setQ2] = useState('')
  const [q3, setQ3] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const onContinue = async()=> { await save({ styles: { selected }}); next(); }
  return (
    <section className="rounded-2xl shadow-xl bg-white/60 backdrop-blur border border-white/70 p-5">
      <h2 className="text-xl font-semibold text-slate-900">Pick your first 3 WorkStyles</h2>
      <p className="mt-1 text-sm text-slate-600">These are your signature automations. Start with three—add more anytime.</p>
      {!instagramLinked && (
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900 text-sm">
          <div className="font-medium">Instagram not connected</div>
          <div className="text-xs">Connect on the Social step to tune your 14‑day plan to recent posts.</div>
        </div>
      )}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {STYLE_KEYS.map(s => (
          <button key={s.key} onClick={()=>toggle(s.key)} className={`p-3 rounded-xl text-left border ${selected.includes(s.key)?'border-sky-400 ring-1 ring-sky-400 bg-white':'border-white/70 bg-white/70'}`}>
            <div className="font-medium text-slate-900">{s.name}</div>
            <div className="text-sm text-slate-600">{s.desc}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-white/70 border border-white/70 p-3">
        <div className="font-medium text-slate-900">14‑day plan</div>
        <div className="text-xs text-slate-600">We’ll generate posts in your voice. You approve first.</div>
        <div className="mt-2 grid gap-2">
          {[1,2,3].map((i)=> (
            <div key={i} className="rounded-lg border bg-white p-2 text-sm text-slate-800">Sample post {i}: “Warm, human copy in your brand vibe.”</div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {['Shorter','More luxe','More playful','Add retail'].map((t)=> (
            <button key={t} className="px-2 py-1 rounded-full border bg-white">{t}</button>
          ))}
        </div>
        <div className="mt-3"><button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={async()=>{
          try{
            setBusy(true); setStatus(''); setError('')
            const r = await api.post('/ai/tools/execute', { name:'social.schedule.14days', params:{ tenant_id: await getTenant() }, require_approval: true })
            setStatus(r?.status==='ok'||r?.status==='pending' ? 'Plan requested — check Approvals' : (r?.status||'error'))
            await save({ plan: { requested: true, ts: Date.now() }})
          }catch(e:any){ setError(String(e?.message||e)) }
          finally{ setBusy(false) }
        }}>Generate 14‑day plan</button></div>
        {(status||error) && <div className="mt-2 text-xs"><span className="text-emerald-700">{status}</span> {error && <span className="text-rose-700 ml-2">{error}</span>}</div>}
        {/* Milestone share slot */}
        <div className="mt-3 rounded-lg border bg-white p-2">
          <div className="text-sm font-medium text-slate-900">Milestone ready</div>
          <div className="text-xs text-slate-600">When you publish your first plan, share it with your audience.</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <button className="px-2 py-1 rounded-md border bg-white" onClick={()=>{ try{ navigator.clipboard.writeText('Published our first 14‑day plan — warm, human posts only.'); }catch{} }}>Copy caption</button>
            <button className="px-2 py-1 rounded-md border bg-white" onClick={()=>{ try{ navigator.clipboard.writeText(window.location.origin+'/s/demo'); }catch{} }}>Copy share link</button>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-white/70 border border-white/70 p-3">
        <div className="font-medium text-slate-900">Train VX — three quick inputs</div>
        <div className="text-xs text-slate-600">These guide tone and priorities in drafts.</div>
        <label className="block mt-2 text-sm">Audience focus<input className="w-full border rounded-md px-3 py-2 mt-1" placeholder="Ex: Balayage + lived‑in color" value={q1} onChange={e=>setQ1(e.target.value)} /></label>
        <label className="block mt-2 text-sm">Signature services<input className="w-full border rounded-md px-3 py-2 mt-1" placeholder="Ex: Copper melt, gloss, bond repair" value={q2} onChange={e=>setQ2(e.target.value)} /></label>
        <label className="block mt-2 text-sm">Tone preferences<input className="w-full border rounded-md px-3 py-2 mt-1" placeholder="Ex: Warm, kind, no hard sell" value={q3} onChange={e=>setQ3(e.target.value)} /></label>
        <div className="mt-2"><button className="rounded-full border px-3 py-2 text-sm bg-white" disabled={busy} onClick={async()=>{
          try{ setBusy(true); setStatus(''); setError('');
            await save({ trainvx: { audience: q1, services: q2, tone: q3 } });
            setStatus('Saved');
          }catch(e:any){ setError(String(e?.message||e)) } finally { setBusy(false) }
        }}>Save</button></div>
        {(status||error) && <div className="mt-2 text-xs"><span className="text-emerald-700">{status}</span> {error && <span className="text-rose-700 ml-2">{error}</span>}</div>}
      </div>
      <div className="mt-6 flex gap-2">
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={back}>Back</button>
        <button disabled={selected.length===0} className="rounded-full border px-3 py-2 text-sm bg-white disabled:opacity-50" onClick={onContinue}>Continue</button>
      </div>
    </section>
  )
}


