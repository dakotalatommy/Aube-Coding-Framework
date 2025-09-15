// Extended ShareCard: optional story PNG generation with QR code
import QRCode from 'qrcode'

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  url: string;
  title?: string;
  caption?: string;
  templateUrl?: string;
  qrRect?: { x: number; y: number; w: number; h: number };
  hoursRect?: { x: number; y: number; maxW: number };
  hoursValue?: number;
};

export default function ShareCard({ open, onOpenChange, url, title = 'Share', caption = '', templateUrl, qrRect, hoursRect, hoursValue }: Props){
  if (!open) return null;
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };
  const download = (filename: string, contents: string) => {
    try {
      const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  };
  const generateStory = async (): Promise<HTMLCanvasElement|null> => {
    try{
      if (!templateUrl || !qrRect) return null;
      const img = await new Promise<HTMLImageElement>((resolve, reject)=>{ const i = new Image(); i.crossOrigin='anonymous'; i.onload=()=>resolve(i); i.onerror=reject; i.src=templateUrl; });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d'); if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      const inset = 12;
      const qrW = Math.max(0, (qrRect.w||0) - inset*2);
      const qrH = Math.max(0, (qrRect.h||0) - inset*2);
      const qrSize = Math.min(qrW, qrH);
      const qrDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, color: { dark:'#000000', light:'#FFFFFF' }, width: qrSize });
      const qrImg = await new Promise<HTMLImageElement>((resolve,reject)=>{ const i = new Image(); i.onload=()=>resolve(i); i.onerror=reject; i.src=qrDataUrl; });
      const qx = Math.round(qrRect.x + inset + (qrW - qrSize)/2);
      const qy = Math.round(qrRect.y + inset + (qrH - qrSize)/2);
      ctx.drawImage(qrImg, qx, qy, qrSize, qrSize);
      if (hoursRect && typeof hoursValue === 'number'){
        const hrs = Math.max(0, Math.round(hoursValue / 60));
        const text = String(hrs);
        let fontSize = 160; const maxW = Math.max(120, hoursRect.maxW||500);
        do { ctx.font = `bold ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto`; } while (ctx.measureText(text).width > maxW && --fontSize > 24);
        ctx.fillStyle = '#111'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(text).width; const tx = Math.round(hoursRect.x + (maxW - tw)/2); const ty = Math.round(hoursRect.y);
        ctx.fillText(text, tx, ty);
      }
      return canvas;
    } catch { return null; }
  };
  const shareStory = async () => {
    try{
      const c = await generateStory();
      if (!c) { await copy(url); return; }
      const blob: Blob = await new Promise(res=> c.toBlob(b=> res(b as Blob), 'image/png'));
      try{ await navigator.clipboard.writeText(url); } catch{}
      if ((navigator as any).share && (navigator as any).canShare?.({ files:[new File([blob],'brandvx-story.png',{type:'image/png'})] })){
        await (navigator as any).share({ files:[new File([blob],'brandvx-story.png',{type:'image/png'})], text: caption || title, url });
      } else {
        const dl = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = dl; a.download = 'brandvx-story.png'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(dl);
      }
    } catch {}
  };
  const tw = `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption || title)}&url=${encodeURIComponent(url)}`;
  const sms = `sms:&body=${encodeURIComponent(`${caption ? caption + '\n' : ''}${url}`)}`;
  const mail = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${caption ? caption + '\n\n' : ''}${url}`)}`;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20" onClick={()=> onOpenChange(false)}>
      <div className="w-[min(92vw,420px)] rounded-2xl bg-white shadow-soft border border-[var(--border)]" onClick={e=> e.stopPropagation()}>
        <div className="px-4 pt-4 pb-2">
          <div className="text-slate-900 font-semibold">{title}</div>
          <div className="text-slate-600 text-sm mt-1">Share this moment with your audience.</div>
        </div>
        <div className="px-4 py-2">
          <div className="text-xs text-slate-600 break-all border rounded-md bg-slate-50 px-2 py-1">{url}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <button aria-label="Copy share link" className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50" onClick={()=> copy(url)}>Copy link</button>
            <button aria-label="Copy share caption" className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50" onClick={()=> copy(caption || title)}>Copy caption</button>
            <a aria-label="Share on X" className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50 text-center" href={tw} target="_blank" rel="noreferrer">Share on X</a>
            <a aria-label="Share via SMS" className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50 text-center" href={sms}>Share via SMS</a>
            <a aria-label="Share via Email" className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50 text-center" href={mail}>Share via Email</a>
            <button aria-label="Copy for Discord" className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50" onClick={()=> copy(`[Discord] ${title} ${url}`)}>Copy for Discord</button>
            <button aria-label="Download link" className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50" onClick={()=> download('brandvx-share-link.txt', `${url}`)}>Download link</button>
            <button aria-label="Download caption and link" className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50" onClick={()=> download('brandvx-share.txt', `${caption || title}\n${url}`)}>Download caption+link</button>
            {templateUrl && qrRect && (
              <button aria-label="Share to socials" className="col-span-2 px-3 py-2 rounded-md border bg-white hover:bg-slate-50" onClick={shareStory}>Share to socials (story PNG)</button>
            )}
          </div>
        </div>
        <div className="px-4 pb-4 pt-2 flex justify-end"><button className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50" onClick={()=> onOpenChange(false)}>Close</button></div>
      </div>
    </div>
  );
}


