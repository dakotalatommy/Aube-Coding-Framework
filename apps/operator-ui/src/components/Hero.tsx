import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function Hero(){
  return (
    <div className="relative overflow-hidden rounded-3xl p-8 md:p-14 backdrop-blur bg-white/60 border border-white/70 shadow-md">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl mx-auto text-center"
      >
        <span className="inline-flex items-center rounded-full bg-pink-50 text-pink-600 px-3 py-1 text-sm border border-pink-100">For beauty professionals</span>
        <h1 className="mt-4 font-semibold tracking-tight text-slate-900" style={{fontFamily:'"Space Grotesk", Inter, ui-sans-serif', fontSize:'var(--fs-hero)'}}>
          Intuitive ops, luxe client experience
        </h1>
        <p className="mt-3 text-slate-600 text-lg md:text-xl">Cadences, reminders, and follow-ups that feel human—so you stay in your craft while BrandVX fills your calendar.</p>
        <div className="flex flex-wrap justify-center gap-4 mt-7">
          {/* Keep primary CTA only in the header nav; remove duplicate here per UX decision */}
          <Link to="/onboarding" className="px-6 py-3 rounded-xl text-white shadow hover:shadow-md bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 transition">Get started</Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center"
      >
        {[{label:'Time Saved / wk', value:'6.2h'}, {label:'No‑show reduction', value:'19%'}, {label:'Faster bookings', value:'2.4×'}, {label:'CSAT', value:'4.8/5'}].map((k)=> (
          <div key={k.label} className="rounded-2xl border bg-white/70 p-3 shadow-sm">
            <div className="text-2xl font-semibold text-slate-900">{k.value}</div>
            <div className="text-xs text-slate-600">{k.label}</div>
          </div>
        ))}
      </motion.div>

      <div className="mt-6 flex items-center justify-center gap-6 opacity-80">
        {['Modern Salon','Pro Beauty','Color Lab','Lash Co.'].map((brand)=> (
          <div key={brand} className="text-xs text-slate-500">{brand}</div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        aria-hidden
        style={{position:'absolute', inset: -2, zIndex: -2,
          background:
            "radial-gradient(700px 220px at 10% -10%, rgba(236,72,153,0.15), transparent), radial-gradient(600px 200px at 90% -20%, rgba(96,165,250,0.12), transparent)"}}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.9 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        aria-hidden
        style={{position:'absolute', inset: 0, zIndex: -1,
          background: "url('/hero.png') center / cover no-repeat",
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0))',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0))',
          opacity: 0.35
        }}
      />
    </div>
  );
}


