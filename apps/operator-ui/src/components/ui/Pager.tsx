export default function Pager({ page, pageSize, total, onPrev, onNext }:{ page:number; pageSize:number; total:number; onPrev:()=>void; onNext:()=>void }){
  const start = Math.min(total, (page-1)*pageSize + 1);
  const end = Math.min(total, page*pageSize);
  return (
    <nav className="flex items-center justify-between text-xs sticky bottom-[calc(env(safe-area-inset-bottom,0px)+8px)] bg-white/70 backdrop-blur rounded-md px-2 py-1 border" role="navigation" aria-label="Pagination">
      <div aria-live="polite">{total>0 ? `Items ${start}–${end} of ${total}` : 'No items'}</div>
      <div className="flex items-center gap-2">
        <button className="px-2 py-1 rounded-md border bg-white disabled:opacity-50" onClick={onPrev} disabled={page<=1} aria-label="Previous page" aria-controls="main">&larr; Prev</button>
        <button className="px-2 py-1 rounded-md border bg-white disabled:opacity-50" onClick={onNext} disabled={end>=total} aria-label="Next page" aria-controls="main">Next &rarr;</button>
      </div>
    </nav>
  );
}


