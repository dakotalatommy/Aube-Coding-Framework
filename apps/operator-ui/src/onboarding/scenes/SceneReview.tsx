 

export default function SceneReview({ state, back, onFinish }: any){
  const d = state.data
  const hrs = (d.ops?.hrsAdmin||0)*0.5 + (d.ops?.hrsContent||0)*0.4
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
      <div className="mt-4 text-sm">Estimated time back: <strong>+{Math.round(hrs*10)/10}h/week</strong></div>
      {/* Shareable milestone slot */}
      <div className="mt-3 rounded-xl border bg-white p-3">
        <div className="font-medium text-slate-900 text-sm">Milestone: Onboarding complete</div>
        <div className="text-xs text-slate-600 mt-1">Share your first win — you just saved setup time and connected your tools.</div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <button className="px-2 py-1 rounded-md border bg-white" onClick={()=>{ try{ navigator.clipboard.writeText('Just finished BrandVX onboarding — short, kind messages in our voice.'); }catch{} }}>Copy caption</button>
          <button className="px-2 py-1 rounded-md border bg-white" onClick={()=>{ try{ navigator.clipboard.writeText(window.location.origin+'/s/demo'); }catch{} }}>Copy share link</button>
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={back}>Back</button>
        <button className="rounded-full border px-3 py-2 text-sm bg-white" onClick={onFinish}>Take me to my workspace</button>
      </div>
    </section>
  )
}


