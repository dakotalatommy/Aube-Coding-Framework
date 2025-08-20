import { Link, useLocation } from 'react-router-dom';

const LABELS: Record<string, string> = {
  '': 'Home',
  'dashboard': 'Dashboard',
  'messages': 'Messages',
  'contacts': 'Contacts',
  'cadences': 'Cadences',
  'approvals': 'Approvals',
  'integrations': 'Integrations',
  'ask': 'Ask VX',
  'vision': 'Vision',
  'onboarding': 'Onboarding',
  'admin': 'Admin',
  'agent': 'Agent',
  'login': 'Login',
  'signup': 'Signup',
};

export default function Breadcrumbs() {
  const loc = useLocation();
  const parts = loc.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  const segments = ['/', ...parts.map((_, i) => '/' + parts.slice(0, i + 1).join('/'))];
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-600">
      <ol className="flex items-center gap-1 flex-wrap">
        {segments.map((seg, idx) => {
          const nameKey = seg.replace(/^\/+/, '').split('/').filter(Boolean).pop() || '';
          const label = LABELS[nameKey] || nameKey || 'Home';
          const isLast = idx === segments.length - 1;
          return (
            <li key={seg} className="flex items-center gap-1">
              {idx > 0 && <span className="text-slate-300">/</span>}
              {isLast ? (
                <span className="text-slate-800">{label}</span>
              ) : (
                <Link to={seg} className="hover:underline text-slate-600">{label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}



