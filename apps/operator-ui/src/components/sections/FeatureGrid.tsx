import { motion } from 'framer-motion';
import { staggerContainer, fadeUp, hoverLift } from '../../lib/motion';

export default function FeatureGrid({ items }: { items: Array<{ icon: React.ReactNode; title: string; text: string }> }){
  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="grid md:grid-cols-3 gap-6">
      {items.map((f) => (
        <motion.div key={f.title} variants={fadeUp} {...hoverLift} className="rounded-2xl p-6 bg-white shadow-sm border">
          {f.icon}
          <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
          <p className="text-slate-600 mt-1">{f.text}</p>
        </motion.div>
      ))}
    </motion.section>
  );
}



