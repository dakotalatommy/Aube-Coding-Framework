import React from 'react';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border rounded-2xl bg-white shadow-sm transition hover:shadow-md hover:-translate-y-0.5 ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-4 py-3 border-b">
      <div className="text-sm text-slate-500">{subtitle}</div>
      <div className="text-lg font-semibold text-slate-900">{title}</div>
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-4 py-4 ${className}`}>{children}</div>;
}


