import React from 'react';

export default function EmptyState({ title, description, children }:{ title:string; description?:string; children?:React.ReactNode }){
  return (
    <div className="rounded-2xl bg-white/60 backdrop-blur border border-white/70 shadow-sm p-6 text-center text-slate-700">
      <div className="text-slate-900 font-medium">{title}</div>
      {description && <div className="text-sm text-slate-600 mt-1">{description}</div>}
      {children && <div className="mt-3 flex items-center justify-center gap-2">{children}</div>}
      {!children && (
        <div className="mt-3 text-[11px] text-slate-500">Tip: Look for a “Guide me” button to get started.</div>
      )}
    </div>
  );
}




