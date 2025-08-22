import { Link } from 'react-router-dom';
import { track } from '../lib/analytics';

type Props = {
  label?: string;
  sublabel?: string;
  href?: string;
  align?: 'left' | 'center';
  className?: string;
};

export default function FinalCTA({ label = 'Try the demo', sublabel, href = '/ask-vx-demo?demo=1', align = 'center', className }: Props) {
  const cls = align === 'center' ? 'text-center' : 'text-left';
  const onClick = () => {
    try { track('cta_click', { area: 'final', href }); } catch {}
  };
  return (
    <div className={`rounded-2xl bg-gradient-to-r from-pink-50 via-white to-sky-50 p-6 border shadow-sm ${cls} ${className||''}`}>
      {sublabel && <div className="text-sm text-slate-700 mb-2">{sublabel}</div>}
      <Link to={href} onClick={onClick} className="inline-flex items-center px-5 py-3 rounded-xl text-white shadow hover:shadow-md bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600">
        {label}
      </Link>
    </div>
  );
}


