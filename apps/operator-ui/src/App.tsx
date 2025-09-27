import LegacyApp from './AppLegacy';
import V2App from './v2/App';
import { useEffect, useState } from 'react';

type Variant = 'legacy' | 'v2';

function resolveInitialVariant(): Variant {
  const env = (import.meta.env.VITE_UI_VARIANT as string | undefined)?.toLowerCase();
  let variant: Variant = env === 'v2' ? 'v2' : 'legacy';
  if (typeof window === 'undefined') return variant;
  try {
    const params = new URLSearchParams(window.location.search);
    const qp = params.get('ui');
    if (qp === 'legacy' || qp === 'v2') {
      variant = qp;
      try { window.localStorage.setItem('bvx_ui_variant', qp); } catch {}
    } else {
      const stored = window.localStorage.getItem('bvx_ui_variant');
      if (stored === 'legacy' || stored === 'v2') variant = stored;
    }
  } catch {}
  return variant;
}

export default function App() {
  const [variant, setVariant] = useState<Variant>(() => resolveInitialVariant());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const listener = () => setVariant(resolveInitialVariant());
    window.addEventListener('bvx-ui-variant-change', listener);
    return () => window.removeEventListener('bvx-ui-variant-change', listener);
  }, []);

  if (variant === 'v2') {
    return <V2App />;
  }
  return <LegacyApp />;
}

