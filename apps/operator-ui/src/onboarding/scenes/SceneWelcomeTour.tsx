 

export default function SceneWelcomeTour({ next }: any){
  return (
    <section className="rounded-2xl shadow-xl bg-white/60 backdrop-blur border border-white/70 p-5">
      <h2 className="text-xl md:text-2xl font-semibold text-slate-900">Welcome 👋</h2>
      <p className="mt-2 text-slate-700 text-sm md:text-base">We’ll connect a couple tools, set your tone, and preview messages — then you’re live. Most pros finish in under 15 minutes.</p>
      <div className="mt-4">
        <button className="rounded-full border px-3 py-2 text-sm bg-white hover:shadow-sm" onClick={()=> next()}>Let’s set this up</button>
      </div>
    </section>
  )
}


