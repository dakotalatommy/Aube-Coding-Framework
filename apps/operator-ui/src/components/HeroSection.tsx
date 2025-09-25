import { useEffect, useRef } from 'react';
import { ButtonLink } from './ui/Button';

type Props = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaOffsetY?: number; // px from subtitle block
  haloColor?: 'blue' | 'pink';
  haloIntensity?: number; // 0..1
  className?: string;
};

export default function HeroSection({
  eyebrow = 'Made by a beauty professional — for beauty professionals',
  title = 'Intuitive ops — luxe client experience',
  subtitle = 'Cadences, reminders, and follow‑ups that feel human — so you stay in your craft while BrandVX fills your calendar.',
  ctaLabel = 'Book onboarding',
  ctaHref = '/signup',
  ctaOffsetY = 200,
  haloColor = 'blue',
  haloIntensity = 0.7,
  className = '',
}: Props){
  const ribbonRef = useRef<SVGSVGElement|null>(null);
  const blossomRef = useRef<SVGSVGElement|null>(null);

  useEffect(()=>{
    try{
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) return;
      let raf = 0;
      const onScroll = () => {
        if (raf) return;
        raf = window.requestAnimationFrame(()=>{
          raf = 0;
          const y = window.scrollY || 0;
          const ribbon = ribbonRef.current as any;
          const blossom = blossomRef.current as any;
          if (ribbon) ribbon.style.transform = `translateY(${Math.min(30, y*0.05)}px)`;
          if (blossom) blossom.style.transform = `translateY(${Math.min(50, y*0.1)}px)`;
        });
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      return ()=> { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
    } catch {}
  },[]);

  const halo = haloColor === 'blue'
    ? 'radial-gradient(60% 60% at 50% 50%, rgba(96,165,250,0.22), rgba(96,165,250,0))'
    : 'radial-gradient(60% 60% at 50% 50%, rgba(236,72,153,0.22), rgba(236,72,153,0))';

  return (
    <section className={`grid grid-cols-1 md:grid-cols-2 overflow-hidden rounded-3xl border shadow-md ${className}`}>
      {/* Left editorial panel */}
      <div className="relative z-10 p-10 md:p-16 bg-white/80 backdrop-blur flex flex-col justify-center min-h-[320px] md:min-h-[560px]">
        <div className="absolute left-0 right-0 -top-2 md:top-2 px-10 md:px-16 text-[12px] text-slate-700">
          {eyebrow}
        </div>
        <h1 className="text-slate-900 font-semibold tracking-tight" style={{fontFamily:'"Fraunces", ui-serif, Georgia, serif', fontSize:'clamp(40px,6.5vw,92px)', lineHeight:1.05}}>{title}</h1>
        <p className="mt-6 text-slate-700 text-[18px] md:text-[20px] leading-relaxed max-w-2xl">{subtitle}</p>
        <div className="flex justify-center relative" style={{ marginTop: `${ctaOffsetY}px` }}>
          <div className="absolute -z-10 w-[560px] h-[240px] rounded-full blur-3xl" style={{opacity: haloIntensity, background: halo}} />
          <ButtonLink href={ctaHref} size="lg" className="px-20 py-8 rounded-full text-3xl shadow-[inset_0_2px_0_rgba(255,255,255,.6),0_56px_128px_rgba(96,165,250,.35)] bg-gradient-to-r from-blue-100 to-blue-300 text-black hover:text-black hover:shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_72px_160px_rgba(96,165,250,.48)] hover:from-blue-200 hover:to-blue-400 transition" style={{fontFamily:'"Fraunces", ui-serif, Georgia, serif'}}>
            <span className="text-black">{ctaLabel}</span><span className="ml-2 text-black">→</span>
          </ButtonLink>
        </div>
      </div>
      {/* Right visual canvas */}
      <div className="relative min-h-[320px] md:min-h-[560px]" aria-hidden>
        <div className="absolute inset-0" style={{
          background:'radial-gradient(50% 40% at 90% 0%, #E7F0FF 0%, rgba(231,240,255,0) 60%), linear-gradient(180deg, #FFF 0%, #F7F3F7 100%)'
        }} />
        <svg ref={ribbonRef} className="absolute -right-4 md:-right-2 top-6 w-[140%] h-[140%] opacity-70 will-change-transform" viewBox="0 0 800 600">
          <defs>
            <linearGradient id="r1" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#F3B3CF" />
              <stop offset="100%" stopColor="#E48DBA" />
            </linearGradient>
            <linearGradient id="r2" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#BFD7FF" />
            </linearGradient>
          </defs>
          <path d="M-50,200 C150,100 250,350 450,260 C650,170 750,420 950,320" fill="none" stroke="url(#r1)" strokeWidth="28" strokeLinecap="round" />
          <path d="M-70,360 C120,260 260,520 480,420 C680,330 800,520 980,420" fill="none" stroke="url(#r1)" strokeWidth="20" strokeLinecap="round" opacity=".65" />
          <path d="M-40,210 C140,120 260,330 460,260 C660,190 760,400 960,330" fill="none" stroke="url(#r2)" strokeWidth="6" strokeLinecap="round" opacity="0.35" />
        </svg>
        <div className="absolute inset-0" style={{background:'radial-gradient(800px 240px at 80% -10%, rgba(47,93,159,0.12), transparent)'}} />
        <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(70% 70% at 50% 40%, rgba(15,23,42,0.06), transparent 60%)'}} />
      </div>
    </section>
  );
}



