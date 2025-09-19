import type { PropsWithChildren } from 'react';
import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

function getOrCreateOverlayRoot(): HTMLElement | null {
  try {
    let el = document.getElementById('bvx-overlay-root') as HTMLElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'bvx-overlay-root';
      Object.assign(el.style as unknown as Record<string, string>, {
        position: 'fixed',
        inset: '0',
        zIndex: String(2147483647),
        isolation: 'isolate',
        pointerEvents: 'none',
        // Stabilize compositing
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitFontSmoothing: 'antialiased',
      });
      document.body.appendChild(el);
    }
    return el;
  } catch { return null; }
}

function ensureLast(el: HTMLElement | null): () => void {
  if (!el || !el.parentElement) return () => {};
  try {
    const parent = el.parentElement;
    const moveLast = () => {
      try {
        // Only move if not already last to avoid self-trigger loops
        if (parent.lastElementChild !== el) parent.appendChild(el);
      } catch {}
    };
    // Keep as last child to win same-z conflicts
    const mo = new MutationObserver(() => moveLast());
    mo.observe(parent, { childList: true });
    // Move once now
    moveLast();
    return () => { try { mo.disconnect(); } catch {} };
  } catch { return () => {} }
}

export default function OverlayPortal({ children }: PropsWithChildren) {
  const root = useMemo(()=> (typeof window !== 'undefined' ? getOrCreateOverlayRoot() : null), []);
  useEffect(()=>{ const off = ensureLast(root); return off; }, [root]);
  if (!root) return null;
  return createPortal(children, root);
}

