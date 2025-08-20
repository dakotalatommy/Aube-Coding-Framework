import React from 'react';

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <table className="min-w-full">
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-slate-50">{children}</thead>;
}

export function TR({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return <tr className={`hover:bg-slate-50 ${className}`} onClick={onClick}>{children}</tr>;
}

export function TH({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-3 py-2 text-sm font-medium text-slate-600 border-b">{children}</th>;
}

export function TD({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-sm text-slate-800 border-b ${className}`}>{children}</td>;
}


