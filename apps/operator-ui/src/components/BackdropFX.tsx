import React, { useEffect, useMemo, useState } from 'react';

type BackdropFXProps = {
  withSpline?: boolean;
  modelUrl?: string; // optional GLB served from /public
};

export function BackdropFX({ withSpline = false, modelUrl }: BackdropFXProps) {
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
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Base vertical blue gradient wash */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'linear-gradient(180deg, rgba(186,218,255,0.28) 0%, rgba(255,255,255,0) 55%)',
          ].join(', '),
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

      {/* Optional GLB via <model-viewer> (always render; keep static for a11y) */}
      {!withSpline && modelUrl && (
        // @ts-ignore
        <model-viewer
          src={modelUrl}
          auto-rotate
          camera-controls
          interaction-prompt="none"
          ar="false"
          style={{ position:'absolute', inset:'0', width:'100%', height:'100%', opacity:0.32, transform:'scale(1.04)' }}
          exposure="0.9"
          disable-zoom
          disable-pan
          disable-tap
          shadow-intensity="0"
        />
      )}
    </div>
  );
}

export default BackdropFX;


