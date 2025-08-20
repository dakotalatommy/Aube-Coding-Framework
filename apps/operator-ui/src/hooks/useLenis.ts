import { useEffect } from 'react';
import Lenis from 'lenis';

export function useLenis(){
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
      wheelMultiplier: 1,
      touchMultiplier: 1,
    } as any);
    let raf = 0;
    const rafFn = (time: number) => { lenis.raf(time); raf = requestAnimationFrame(rafFn); };
    raf = requestAnimationFrame(rafFn);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);
}


