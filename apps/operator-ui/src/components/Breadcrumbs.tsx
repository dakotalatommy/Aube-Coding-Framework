import { Link, useLocation } from 'react-router-dom';

const LABELS: Record<string, string> = {
  '': 'Home',
  'dashboard': 'Dashboard',
  'messages': 'Messages',
  'contacts': 'Contacts',
  'cadences': 'Cadences',
  'approvals': 'Approvals',
  'integrations': 'Settings',
  'workflows': 'WorkStyles',
  'ask': 'Ask VX',
  'vision': 'Vision',
  'onboarding': 'Onboarding',
  'admin': 'Admin',
  'agent': 'Agent',
  'login': 'Login',
  'signup': 'Signup',
  'landing-v2': 'BrandVX',
  'brandvx': 'BrandVX',
  'workspace': 'Workspace',
};

export default function Breadcrumbs() {
  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);

  // Special-case workspace: show plain 'Workspace' only (no duplicate segments)
  if (loc.pathname === '/workspace') {
    return (
      <nav aria-label="Breadcrumb" className="text-sm text-slate-600">
        <ol className="flex items-center gap-1 flex-wrap">
          <li className="flex items-center gap-1">
            <span className="text-slate-800">Workspace</span>
          </li>
        </ol>
      </nav>
    );
  }

  // On the landing surface, hide crumbs unless demo mode is active
  if (loc.pathname === '/brandvx') {
    if (qs.get('demo') === '1') {
      return (
        <nav aria-label="Breadcrumb" className="text-sm text-slate-600">
          <ol className="flex items-center gap-1 flex-wrap">
            <li className="flex items-center gap-1">
              <span className="text-slate-800">Workspace</span>
            </li>
          </ol>
        </nav>
      );
    }
    return null;
  }

  const parts = loc.pathname.replace(/^\/+/,'').split('/').filter(Boolean);
  const segments = ['/', ...parts.map((_, i) => '/' + parts.slice(0, i + 1).join('/'))];
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-600">
      <ol className="flex items-center gap-1 flex-wrap">
        {segments.map((seg, idx) => {
          const nameKey = seg.replace(/^\/+/,'').split('/').filter(Boolean).pop() || '';
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



