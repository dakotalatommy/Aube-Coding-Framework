import { useEffect, useState } from 'react';
import LegacyApp from './AppLegacy';
import V2App from './v2/App';

type Variant = 'legacy' | 'v2';

const ENV_VARIANT = (import.meta.env.VITE_UI_VARIANT as string | undefined)?.toLowerCase();
const DEFAULT_VARIANT: Variant = ENV_VARIANT === 'legacy' ? 'legacy' : 'v2';

function resolveInitialVariant(): Variant {
  let variant: Variant = DEFAULT_VARIANT;
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

  if (DEFAULT_VARIANT === 'v2' && variant !== 'v2') {
    variant = 'v2';
    try { window.localStorage.setItem('bvx_ui_variant', 'v2'); } catch {}
  }

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

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body?.classList.toggle('legacy-ui-active', variant === 'legacy');
    if (variant === 'v2') {
      try { window.localStorage.setItem('bvx_ui_variant', 'v2'); } catch {}
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('ui')) {
          url.searchParams.delete('ui');
          window.history.replaceState({}, '', url.toString());
        }
      } catch {}
    }
  }, [variant]);

  if (variant === 'v2') {
    return <V2App />;
  }
  return <LegacyApp />;
}
