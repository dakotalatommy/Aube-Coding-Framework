import { useState } from 'react'

export default function SceneVoice({ state, next, back, save }: any){
  const prev = state.data.voice || { calmBold: 0.5, friendlyLuxe: 0.5, playfulPro: 0.5, purpose: '' }
  const [calmBold, setCalmBold] = useState(prev.calmBold)
  const [friendlyLuxe, setFriendlyLuxe] = useState(prev.friendlyLuxe)
  const [playfulPro, setPlayfulPro] = useState(prev.playfulPro)
  const [purpose, setPurpose] = useState(prev.purpose)

  const onContinue = async()=> {
    await save({ voice: { calmBold, friendlyLuxe, playfulPro, purpose }})
    next()
  }

  return (
    <section className="rounded-2xl shadow-xl bg-white/60 backdrop-blur border border-white/70 p-5">
      <h2 className="text-xl font-semibold text-slate-900">Set your vibe</h2>
      <p className="mt-1 text-sm text-slate-600">These sliders guide your brand voice across confirmations, follow-ups, and posts.</p>
      <div className="mt-4 grid gap-4">
        <label className="block"><div className="text-sm">Calm ↔ Bold</div><input type="range" min="0" max="1" step="0.01" value={calmBold} onChange={(e)=>setCalmBold(parseFloat(e.target.value))} className="w-full" /></label>
        <label className="block"><div className="text-sm">Friendly ↔ Luxe</div><input type="range" min="0" max="1" step="0.01" value={friendlyLuxe} onChange={(e)=>setFriendlyLuxe(parseFloat(e.target.value))} className="w-full" /></label>
        <label className="block"><div className="text-sm">Playful ↔ Professional</div><input type="range" min="0" max="1" step="0.01" value={playfulPro} onChange={(e)=>setPlayfulPro(parseFloat(e.target.value))} className="w-full" /></label>
        <label className="block"><div className="text-sm">If your brand could talk… (one line)</div><input className="w-full border rounded-md px-3 py-2" value={purpose} onChange={(e)=>setPurpose(e.target.value)} placeholder="Warm, human, and precise — here to make booking easy." /></label>
      </div>
      <div className="mt-6 flex gap-2">
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={back}>Back</button>
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={onContinue}>Continue</button>
      </div>
    </section>
  )
}


