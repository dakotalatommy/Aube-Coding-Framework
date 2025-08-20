// no-op import needed

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  url: string;
  title?: string;
  caption?: string;
};

export default function ShareCard({ open, onOpenChange, url, title = 'Share', caption = '' }: Props){
  if (!open) return null;
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };
  const tw = `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption || title)}&url=${encodeURIComponent(url)}`;
  const sms = `sms:&body=${encodeURIComponent(`${caption ? caption + '\n' : ''}${url}`)}`;
  const mail = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${caption ? caption + '\n\n' : ''}${url}`)}`;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center" style={{background:'rgba(15,23,42,0.45)'}} onClick={()=> onOpenChange(false)}>
      <div className="w-[92vw] max-w-md rounded-2xl bg-white shadow-xl border" onClick={e=> e.stopPropagation()}>
        <div className="px-4 pt-4 pb-2">
          <div className="text-slate-900 font-semibold">{title}</div>
          <div className="text-slate-600 text-sm mt-1">Share this moment with your audience.</div>
        </div>
        <div className="px-4 py-2">
          <div className="text-xs text-slate-600 break-all border rounded-md bg-slate-50 px-2 py-1">{url}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <button className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50" onClick={()=> copy(url)}>Copy link</button>
            <button className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50" onClick={()=> copy(caption || title)}>Copy caption</button>
            <a className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50 text-center" href={tw} target="_blank" rel="noreferrer">Share on X</a>
            <a className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50 text-center" href={sms}>Share via SMS</a>
            <a className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50 text-center" href={mail}>Share via Email</a>
            <button className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50" onClick={()=> copy(`[Discord] ${title} ${url}`)}>Copy for Discord</button>
          </div>
        </div>
        <div className="px-4 pb-4 pt-2 flex justify-end"><button className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50" onClick={()=> onOpenChange(false)}>Close</button></div>
      </div>
    </div>
  );
}


