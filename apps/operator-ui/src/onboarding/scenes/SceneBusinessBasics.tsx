import { useState } from 'react'

export default function SceneBusinessBasics({ state, next, back, save }: any){
  const prev = state.data.basics || { name:'', business:'', city:'', inspiration:'' }
  const [name, setName] = useState(prev.name)
  const [business, setBusiness] = useState(prev.business)
  const [city, setCity] = useState(prev.city)
  const [inspiration, setInspiration] = useState(prev.inspiration)
  const onContinue = async()=> { await save({ basics: { name, business, city, inspiration }}); next(); }
  return (
    <section className="rounded-2xl shadow-xl bg-white/60 backdrop-blur border border-white/70 p-5">
      <h2 className="text-xl font-semibold text-slate-900">You, briefly</h2>
      <p className="mt-1 text-sm text-slate-600">This helps drafts feel like you.</p>
      <div className="mt-4 grid grid-cols-1 gap-3">
        <label className="block"><div className="text-sm">Full name</div><input className="w-full border rounded-md px-3 py-2" value={name} onChange={(e)=>setName(e.target.value)} /></label>
        <label className="block"><div className="text-sm">Business name</div><input className="w-full border rounded-md px-3 py-2" value={business} onChange={(e)=>setBusiness(e.target.value)} /></label>
        <label className="block"><div className="text-sm">City / area</div><input className="w-full border rounded-md px-3 py-2" value={city} onChange={(e)=>setCity(e.target.value)} /></label>
        <label className="block"><div className="text-sm">What inspired you to start your brand?</div><input className="w-full border rounded-md px-3 py-2" value={inspiration} onChange={(e)=>setInspiration(e.target.value)} placeholder="One line is perfect." /></label>
      </div>
      <div className="mt-6 flex gap-2">
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={back}>Back</button>
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={onContinue}>Continue</button>
      </div>
    </section>
  )
}


