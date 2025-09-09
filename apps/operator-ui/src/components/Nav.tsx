import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, getTenant } from '../lib/api';
import * as Tooltip from '@radix-ui/react-tooltip';

const tabs = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/messages', label: 'Messages' },
  { to: '/contacts', label: 'Clients' },
  { to: '/cadences', label: 'Cadences' },
  { to: '/approvals', label: 'Approvals' },
  { to: '/integrations', label: 'Settings' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/curation', label: 'Curation' },
  { to: '/inbox', label: 'Inbox' },
  { to: '/ask', label: 'Ask VX' },
  { to: '/workflows', label: 'WorkStyles' },
  { to: '/vision', label: 'Vision' },
  { to: '/onboarding', label: 'Onboarding' },
  { to: '/admin', label: 'Admin' },
  { to: '/agent', label: 'Agent' },
];

export default function Nav(){
  const loc = useLocation();
  const [theme, setTheme] = useState<'system'|'light'|'dark'>(()=> (localStorage.getItem('bvx-theme') as any) || 'system');
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  useEffect(()=>{
    localStorage.setItem('bvx-theme', theme);
    const root = document.documentElement;
    root.removeAttribute('data-theme');
    if (theme === 'light') root.setAttribute('data-theme','light');
    if (theme === 'dark') root.setAttribute('data-theme','dark');
  },[theme]);
  useEffect(()=>{
    let stop = false;
    const load = async ()=>{
      try{
        const r = await api.get(`/approvals?tenant_id=${encodeURIComponent(await getTenant())}`);
        const items = Array.isArray(r) ? r : (r.items||[]);
        const count = items.filter((it:any)=> (it.status||'pending')==='pending').length;
        if (!stop) setPendingApprovals(count);
      } catch{}
    };
    void load();
    const id = window.setInterval(load, 15000);
    return ()=>{ stop = true; window.clearInterval(id); };
  },[]);
  return (
    <div className="sticky top-0 z-10">
      <nav className="max-w-5xl mx-auto mt-3 px-4 py-3 flex items-center justify-between gap-3 rounded-2xl border bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 shadow-md" role="navigation" aria-label="Primary">
        <div className="flex items-center gap-2">
          <Link to="/" className="hidden md:inline-flex items-center gap-2 text-slate-900 font-semibold" style={{fontFamily:'var(--font-display)'}}>BrandVX</Link>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto">
          {tabs.map((t, idx)=>{
            const active = loc.pathname === t.to;
            return (
              <div key={t.to} className="flex items-center">
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <Link
                      to={t.to}
                      aria-current={active ? 'page' : undefined}
                      className={`px-3 py-2 rounded-lg text-sm font-medium text-slate-900 transition ${active ? 'bg-gradient-to-r from-pink-50 to-sky-50 border border-pink-100/70 shadow-sm' : 'hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-pink-200'}`}
                    >
                      <span>{t.label}</span>
                      {t.to === '/approvals' && pendingApprovals > 0 && (
                        <span aria-label={`${pendingApprovals} pending approvals`} className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-pink-500 text-white text-[10px]">{pendingApprovals}</span>
                      )}
                    </Link>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content sideOffset={6} className="rounded-md border bg-white px-2 py-1 text-xs text-slate-700 shadow">
                      {t.label}
                      <Tooltip.Arrow className="fill-white" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
                {idx < tabs.length - 1 && <span className="mx-1.5 h-4 w-px bg-slate-200/70" aria-hidden />}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="h-6 w-px bg-slate-200/70 mx-1" aria-hidden />
          <Link to="/login" className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 shadow-sm font-medium">Sign in</Link>
          <Link to="/onboarding" className="px-3 py-2 rounded-lg text-white shadow hover:shadow-md bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 font-medium">Get started</Link>
          <div className="relative">
            <select
              aria-label="Theme"
              className="px-2 py-2 rounded-lg border border-slate-200 bg-white text-slate-900"
              value={theme}
              onChange={e=> setTheme(e.target.value as any)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
      </nav>
    </div>
  );
}
