type Status = 'connected' | 'configured' | 'pending';

export default function StatusBadge({ status, label, warn }: { status: Status; label?: string; warn?: boolean }){
  const classes = status === 'connected'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : status === 'configured'
      ? 'bg-sky-50 border-sky-200 text-sky-700'
      : 'bg-slate-50 border-slate-200 text-slate-600';
  const text = label || status;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${classes}`}>
      <span className="capitalize">{text}</span>
      {warn && <span className="inline-flex w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="expiring soon" />}
    </span>
  );
}


