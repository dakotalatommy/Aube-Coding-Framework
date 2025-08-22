type Item = { title: string; text: string };
type Props = { items?: Item[]; columns?: number; className?: string };

export default function WorkflowList({ items = [
  { title: 'Connect tools', text: 'Calendar/booking, messages, payments, CRM (optional).' },
  { title: 'Import data', text: 'Upload CSV/exports; auto-map common columns and confirm.' },
  { title: 'Pick your vibe', text: 'Choose tone and services. We keep it human.' },
  { title: 'Preview & approve', text: 'See messages before anything goes live.' },
  { title: 'Timing / Go live', text: '7d / 3d / 1d / 2h reminders; quiet hours respected.' },
], columns = 2, className }: Props){
  const grid = `grid grid-cols-1 md:grid-cols-${columns} gap-3 ${className || ''}`;
  return (
    <div className={grid}>
      {items.map((it, i)=> (
        <div key={i} className="rounded-2xl border bg-white/70 p-4 shadow-sm">
          <div className="text-slate-900 font-medium">{it.title}</div>
          <div className="text-slate-600 text-sm mt-1">{it.text}</div>
        </div>
      ))}
    </div>
  );
}


