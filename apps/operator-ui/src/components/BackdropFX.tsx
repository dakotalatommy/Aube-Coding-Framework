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

      {/* Powdery radial accents (blue + pink) */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(600px 280px at 18% 20%, rgba(96,165,250,0.43), transparent 65%)',
            'radial-gradient(520px 240px at 85% 28%, rgba(236,72,153,0.30), transparent 65%)',
          ].join(', '),
        }}
      />

      {/* Very subtle aurora to add depth (kept extremely light) */}
      <div
        className="absolute inset-0 opacity-[0.08] blur-3xl"
        style={{
          background: 'conic-gradient(from 180deg at 50% 50%, #60a5fa, #f472b6, #60a5fa)',
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


