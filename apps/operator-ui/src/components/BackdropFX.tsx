import React, { useEffect, useMemo, useState } from 'react';

type BackdropFXProps = {
  withSpline?: boolean;
};

export function BackdropFX({ withSpline = false }: BackdropFXProps) {
  const [SplineComp, setSplineComp] = useState<React.ComponentType<any> | null>(null);
  const sceneUrl = (import.meta as any)?.env?.VITE_SPLINE_SCENE as string | undefined;
  const reducedMotion = useMemo(()=>{
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  }, []);

  useEffect(() => {
    let mounted = true;
    if (withSpline && sceneUrl && !reducedMotion) {
      import('@splinetool/react-spline').then((m) => {
        if (mounted) setSplineComp(() => m.default);
      }).catch(() => {});
    }
    return () => { mounted = false; };
  }, [withSpline, sceneUrl, reducedMotion]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Base vertical blue gradient wash - smoothed to blend seamlessly */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(186,218,255,0.26) 0%, rgba(186,218,255,0.16) 28%, rgba(186,218,255,0.10) 48%, rgba(255,255,255,0.05) 68%, rgba(255,255,255,0.02) 82%, rgba(255,255,255,0) 100%)',
        }}
      />

      {/* Powdery radial accents — remove pink to avoid tile tint */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(600px 280px at 18% 20%, rgba(96,165,250,0.28), transparent 65%)',
          ].join(', '),
        }}
      />

      {/* Very subtle aurora to add depth (kept extremely light) — remove pink stop to avoid tinting */}
      <div
        className="absolute inset-0 opacity-[0.06] blur-3xl"
        style={{
          background: 'conic-gradient(from 180deg at 50% 50%, #60a5fa, #93c5fd, #60a5fa)',
        }}
      />

      {/* Optional Spline scene (lazy + reduced-motion gated) */}
      {withSpline && SplineComp && sceneUrl && (
        <div className="absolute inset-0 opacity-[0.18] scale-[1.02]">
          <SplineComp scene={sceneUrl} />
        </div>
      )}
    </div>
  );
}

export default BackdropFX;
