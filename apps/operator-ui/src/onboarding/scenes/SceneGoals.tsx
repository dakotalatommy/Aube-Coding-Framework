import { useState } from 'react'

const options = [
  "Fewer no-shows",
  "Fill cancellations fast",
  "Revive dormant clients",
  "Post consistently",
  "Sell more retail",
  "Grow referrals"
]

export default function SceneGoals({ state, next, back, save }: any){
  const prev = state.data.goals || { quarter: [], year: [] }
  const [quarter, setQuarter] = useState<string[]>(prev.quarter)
  const [year, setYear] = useState<string[]>(prev.year)
  const toggle = (arr: string[], setter: (v:string[])=>void, v: string) => setter(arr.includes(v) ? arr.filter(x=>x!==v) : [...arr, v])
  const onContinue = async()=> { await save({ goals: { quarter, year }}); next(); }
  return (
    <section className="rounded-2xl shadow-xl bg-white/60 backdrop-blur border border-white/70 p-5">
      <h2 className="text-xl font-semibold text-slate-900">Goals</h2>
      <p className="mt-1 text-sm text-slate-600">Pick a few goals for the next 3 months; add yearly if you like. We’ll track these as milestones.</p>
      <div className="mt-3">
        <div className="text-sm font-medium">3-month goals</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map(o => (
            <button key={o} onClick={()=>toggle(quarter,setQuarter,o)} className={`px-3 py-1.5 rounded-full border ${quarter.includes(o)?'bg-sky-500 text-white border-sky-500':'bg-white text-slate-700 border-white/70'}`}>{o}</button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <div className="text-sm font-medium">12-month goals (optional)</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map(o => (
            <button key={o} onClick={()=>toggle(year,setYear,o)} className={`px-3 py-1.5 rounded-full border ${year.includes(o)?'bg-sky-500 text-white border-sky-500':'bg-white text-slate-700 border-white/70'}`}>{o}</button>
          ))}
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={back}>Back</button>
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={onContinue}>Continue</button>
      </div>
    </section>
  )
}


