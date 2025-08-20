import { motion } from 'framer-motion';
import { fadeUp, staggerContainer, hoverLift } from '../../lib/motion';

const tiles = [
  { a: 'Appointments', g: 'from-pink-200/60 to-white', t: 'radial-gradient(200px 80px at 20% 0%, rgba(236,72,153,0.25), transparent)' },
  { a: 'Messages', g: 'from-sky-200/60 to-white', t: 'radial-gradient(200px 80px at 80% 0%, rgba(56,189,248,0.25), transparent)' },
  { a: 'Cadences', g: 'from-violet-200/60 to-white', t: 'radial-gradient(200px 80px at 50% 0%, rgba(139,92,246,0.25), transparent)' },
  { a: 'Social proof', g: 'from-pink-100/60 to-white', t: 'radial-gradient(200px 80px at 30% 0%, rgba(236,72,153,0.22), transparent)' },
  { a: 'CRM', g: 'from-sky-100/60 to-white', t: 'radial-gradient(200px 80px at 70% 0%, rgba(56,189,248,0.22), transparent)' },
  { a: 'Analytics', g: 'from-violet-100/60 to-white', t: 'radial-gradient(200px 80px at 40% 0%, rgba(139,92,246,0.22), transparent)' },
];

export default function Gallery(){
  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {tiles.map((k, i) => (
        <motion.div
          key={i}
          variants={fadeUp}
          {...hoverLift}
          className={`relative overflow-hidden rounded-2xl border bg-gradient-to-b ${k.g} p-4 shadow-sm`}
          style={{ backgroundImage: `${k.t}` }}
        >
          <div className="text-xs text-slate-500">{k.a}</div>
          <div className="mt-2 h-32 rounded-xl border bg-white/60" />
        </motion.div>
      ))}
    </motion.section>
  );
}



