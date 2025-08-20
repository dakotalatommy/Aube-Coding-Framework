import { motion } from 'framer-motion';
import { staggerContainer, fadeUp } from '../../lib/motion';

export default function FAQ(){
  const items = [
    { q: 'Do you message my clients without asking?', a: 'No. You approve tone and timing. Clients can reply STOP/HELP any time.' },
    { q: 'How long does setup take?', a: 'Most pros are done in under 15 minutes. White‑glove is available.' },
    { q: 'What tools do I need?', a: 'Start with calendar/booking and messages. CRM is optional and can be added later.' },
    { q: 'Will this feel like me?', a: 'Yes. You pick the vibe. We keep it short, kind, and human.' },
  ];
  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="grid md:grid-cols-2 gap-3">
      {items.map((f,i)=> (
        <motion.details key={i} variants={fadeUp} className="rounded-2xl p-4 bg-white border shadow-sm">
          <summary className="cursor-pointer font-medium text-slate-900">{f.q}</summary>
          <p className="mt-2 text-sm text-slate-600">{f.a}</p>
        </motion.details>
      ))}
    </motion.section>
  );
}



