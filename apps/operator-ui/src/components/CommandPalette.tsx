import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';

const COMMANDS: Array<{ label: string; action: () => void; keywords?: string[] }> = [];

export function useCommandRegistry(){
  const [cmds, setCmds] = React.useState(COMMANDS);
  const register = React.useCallback((c: { label: string; action: () => void; keywords?: string[] }) => {
    setCmds((arr) => [...arr, c]);
  }, []);
  return { cmds, register };
}

export default function CommandPalette(){
  const nav = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const cmds = React.useMemo(() => ([
    { label: 'Go to Dashboard', action: () => nav('/workspace?pane=dashboard'), keywords: ['home','metrics'] },
    { label: 'Go to Messages', action: () => nav('/workspace?pane=messages'), keywords: ['sms','dm','inbox'] },
    { label: 'Go to Contacts', action: () => nav('/workspace?pane=contacts'), keywords: ['csv','import'] },
    { label: 'Go to Cadences', action: () => nav('/workspace?pane=cadences'), keywords: ['automation','flows'] },
    { label: 'Go to Approvals', action: () => nav('/workspace?pane=approvals'), keywords: ['human','review'] },
    { label: 'Connect Tools', action: () => nav('/workspace?pane=integrations'), keywords: ['oauth','integrations'] },
    { label: 'askVX', action: () => nav('/ask'), keywords: ['agent','help'] },
    { label: 'Vision (design-time)', action: () => nav('/vision'), keywords: ['image','analysis'] },
  ]), [nav]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      if ((isMac && e.metaKey && e.key.toLowerCase() === 'k') || (!isMac && e.ctrlKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = cmds.filter(c => {
    if (!q) return true;
    const hay = (c.label + ' ' + (c.keywords||[]).join(' ')).toLowerCase();
    return q.toLowerCase().split(/\s+/).every(part => hay.includes(part));
  });

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/20" />
        <Dialog.Content className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[min(92vw,560px)] rounded-2xl border border-[var(--border)] bg-white shadow-soft">
          <div className="border-b p-3">
            <input
              autoFocus
              value={q}
              onChange={(e)=> setQ(e.target.value)}
              placeholder="Type a command or search... (Cmd/Ctrl+K)"
              className="w-full outline-none text-slate-900 placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-80 overflow-auto p-2">
            {filtered.length === 0 && (
              <div className="p-4 text-sm text-slate-500">No results</div>
            )}
            {filtered.map((c, i) => (
              <button
                key={i}
                onClick={() => { c.action(); setOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-800"
              >{c.label}</button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}



