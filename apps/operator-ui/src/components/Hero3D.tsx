import React, { Suspense, useEffect, useRef, useState } from 'react';

const LazySpline = React.lazy(() => import('@splinetool/react-spline'));

type Hero3DProps = {
  scene?: string;
  height?: string;
  className?: string;
};

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function shouldAnimate(): boolean {
  try {
    const qp = new URLSearchParams(window.location.search).get('motion');
    if (qp === 'off') return false;
    if (qp === 'on') return true;
    const saved = localStorage.getItem('bvx_motion');
    if (saved === 'off') return false;
    if (saved === 'on') return true;
    // Network heuristics
    const conn: any = (navigator as any).connection;
    const slow = !!(conn && (conn.saveData || /2g|slow-2g|3g/.test(conn.effectiveType || '')));
    if (slow) return false;
    return !prefersReducedMotion() && (import.meta.env.VITE_DISABLE_MOTION !== '1');
  } catch {
    return true;
  }
}

export default function Hero3D({ scene, height = '80vh', className }: Hero3DProps) {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const enabled = shouldAnimate();
  const sceneUrl = scene || (import.meta.env.VITE_SPLINE_SCENE_HERO as string | undefined) || '';

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setInView(true);
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={{ height, position: 'relative' }}>
      <Suspense fallback={<div className="h-full w-full" style={{ background: 'linear-gradient(180deg,#fdf2f8,#eff6ff)' }} /> }>
        {enabled && inView && sceneUrl ? (
          <LazySpline scene={sceneUrl} />
        ) : (
          <div aria-hidden className="h-full w-full" style={{
            background:
              'radial-gradient(1200px 400px at 10% -10%, rgba(236,72,153,0.14), transparent), radial-gradient(900px 300px at 90% -20%, rgba(99,102,241,0.12), transparent)'
          }} />
        )}
      </Suspense>
    </div>
  );
}


