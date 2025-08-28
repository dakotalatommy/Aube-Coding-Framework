import { useState } from 'react'

export default function SceneOpsMetrics({ state, next, back, save }: any){
  const prev = state.data.ops || { clientsPerWeek: 10, avgMinutes: 90, avgPrice: 120, hrsAdmin: 4, hrsContent: 3 }
  const [clientsPerWeek, setClientsPerWeek] = useState(prev.clientsPerWeek)
  const [avgMinutes, setAvgMinutes] = useState(prev.avgMinutes)
  const [avgPrice, setAvgPrice] = useState(prev.avgPrice)
  const [hrsAdmin, setHrsAdmin] = useState(prev.hrsAdmin)
  const [hrsContent, setHrsContent] = useState(prev.hrsContent)
  const timeSavedEst = Math.max(0, Math.round((hrsAdmin*0.5 + hrsContent*0.4) * 10) / 10)
  const onContinue = async()=> { await save({ ops: { clientsPerWeek, avgMinutes, avgPrice, hrsAdmin, hrsContent }}); next(); }
  return (
    <section className="rounded-2xl shadow-xl bg-white/60 backdrop-blur border border-white/70 p-5">
      <h2 className="text-xl font-semibold text-slate-900">How busy are your weeks?</h2>
      <div className="mt-4 grid grid-cols-1 gap-3">
        <label className="block"><div className="text-sm">Clients per week</div><input type="number" className="w-full border rounded-md px-3 py-2" value={clientsPerWeek} onChange={(e)=>setClientsPerWeek(parseInt(e.target.value||'0'))} /></label>
        <label className="block"><div className="text-sm">Average minutes per service</div><input type="number" className="w-full border rounded-md px-3 py-2" value={avgMinutes} onChange={(e)=>setAvgMinutes(parseInt(e.target.value||'0'))} /></label>
        <label className="block"><div className="text-sm">Average price per service ($)</div><input type="number" className="w-full border rounded-md px-3 py-2" value={avgPrice} onChange={(e)=>setAvgPrice(parseInt(e.target.value||'0'))} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><div className="text-sm">Hours/week on admin</div><input type="number" className="w-full border rounded-md px-3 py-2" value={hrsAdmin} onChange={(e)=>setHrsAdmin(parseFloat(e.target.value||'0'))} /></label>
          <label className="block"><div className="text-sm">Hours/week on content</div><input type="number" className="w-full border rounded-md px-3 py-2" value={hrsContent} onChange={(e)=>setHrsContent(parseFloat(e.target.value||'0'))} /></label>
        </div>
      </div>
      <div className="mt-3 text-sm text-slate-700">Estimated time back: <strong>+{timeSavedEst}h/week</strong></div>
      <div className="mt-6 flex gap-2">
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={back}>Back</button>
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={onContinue}>Continue</button>
      </div>
    </section>
  )
}


