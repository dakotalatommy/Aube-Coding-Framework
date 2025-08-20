import { motion } from 'framer-motion';
import { staggerContainer, fadeUp, hoverLift } from '../../lib/motion';

type TItem = { initials: string; name: string; role: string; quote: string; color: 'pink'|'violet'|'sky' };

export default function TestimonialCards({ items }: { items: TItem[] }){
  const colorToClasses: Record<TItem['color'], string> = {
    pink: 'bg-pink-50 text-pink-600',
    violet: 'bg-violet-50 text-violet-600',
    sky: 'bg-sky-50 text-sky-600',
  };
  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="grid md:grid-cols-3 gap-4">
      {items.map((t, i) => (
        <motion.div key={i} variants={fadeUp} {...hoverLift} className="rounded-2xl p-4 bg-white shadow-sm border">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-full grid place-items-center ${colorToClasses[t.color]}`}>{t.initials}</div>
            <div>
              <div className="text-sm font-medium text-slate-900">{t.name}</div>
              <div className="text-xs text-slate-500">{t.role}</div>
            </div>
          </div>
          <p className="mt-3 text-slate-700 text-sm">{t.quote}</p>
        </motion.div>
      ))}
    </motion.section>
  );
}



