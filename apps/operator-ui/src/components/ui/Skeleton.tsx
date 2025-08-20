import React from 'react';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function Skeleton({ className = '', style = {} }: SkeletonProps) {
  return (
    <div
      className={`relative overflow-hidden bg-slate-100 ${className}`.trim()}
      style={{ borderRadius: 12, ...style }}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0) 100%)',
          transform: 'translateX(-100%)',
          animation: 'bvx-shimmer 1.2s infinite',
        }}
      />
      <style>
        {`@keyframes bvx-shimmer { 100% { transform: translateX(100%); } }`}
      </style>
    </div>
  );
}



