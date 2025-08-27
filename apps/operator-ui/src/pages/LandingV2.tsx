import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../lib/analytics';
import BackdropFX from '../components/BackdropFX';

function MetricsInline() {
  return (
    <div className="mt-4 md:mt-6 flex flex-wrap items-center justify-center gap-x-4 md:gap-x-6 text-slate-700 text-sm md:text-base">
      <span className="font-semibold whitespace-nowrap">6.2h weekly time saved</span>
      <span className="text-slate-400">—</span>
      <span className="font-semibold whitespace-nowrap">19% no‑show reduction</span>
      <span className="text-slate-400">—</span>
      <span className="font-semibold whitespace-nowrap">3.1× faster responses</span>
    </div>
  );
}

function GlossyCard({ title, sub, icon }:{ title:string; sub:string; icon?: any }){
  return (
    <div role="button" tabIndex={0} aria-label={`${title}: ${sub}`} className="relative h-full w-full rounded-3xl p-5 bg-white/70 backdrop-blur border border-white/70 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.25)] overflow-hidden transition will-change-transform hover:-translate-y-1 hover:shadow-[0_28px_60px_-28px_rgba(0,0,0,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 flex flex-col items-center justify-center text-center"
      onClick={()=>{ try { track('tile_click', { tile: title }); } catch {} }}
      onKeyDown={(e)=>{ if (e.key === 'Enter' || e.key === ' ') { (e.target as HTMLElement).click(); e.preventDefault(); } }}>
      <div aria-hidden className="absolute inset-0 -z-10" style={{
        background:
          'radial-gradient(380px 150px at 15% -20%, rgba(236,72,153,0.10), transparent 60%), radial-gradient(420px 160px at 85% -20%, rgba(99,102,241,0.10), transparent 65%)'
      }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 to-white/0" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-white/40 blur-md opacity-0 transition-opacity duration-200 hover:opacity-70" />
      <div aria-hidden className="pointer-events-none absolute -top-8 left-0 right-0 h-16 bg-gradient-to-b from-white/60 to-transparent" />
      {icon && (
        <div className="text-slate-700 mb-2" aria-hidden>
          {icon}
        </div>
      )}
      <div className="font-semibold text-slate-900 text-[18px] md:text-[20px]">{title}</div>
      <div className="text-slate-600 text-[13px] md:text-[15px] mt-1">{sub}</div>
    </div>
  );
}

function IconPlug(){
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 7v4a3 3 0 0 0 3 3h0a3 3 0 0 0 3-3V7"/>
      <path d="M9 7V4"/><path d="M15 7V4"/>
      <path d="M12 14v6"/>
    </svg>
  );
}
function IconUser(){
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7.5" r="3.5"/>
      <path d="M4 20c1.8-3 5-4.5 8-4.5s6.2 1.5 8 4.5"/>
    </svg>
  );
}
function IconList(){
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/>
      <circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>
    </svg>
  );
}
function IconClock(){
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v6l3 2"/>
    </svg>
  );
}
function IconSpark(){
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z"/>
    </svg>
  );
}

function WorkflowRow() {
  const items: Array<{title:string; sub:string; icon: any}> = [
    { title:'Connect tools', sub:'Hook up booking, SMS, CRM', icon:<IconPlug/> },
    { title:'Import contacts', sub:'Bring clients in safely', icon:<IconUser/> },
    { title:'Define services', sub:'Menu, durations, prices', icon:<IconList/> },
    { title:'Preview timing', sub:'Cadence + quiet hours', icon:<IconClock/> },
    { title:'Go live', sub:'Flip the switch', icon:<IconSpark/> },
  ];
  return (
    <section className="my-auto mt-6 md:mt-8">
      <div className="grid grid-cols-5 gap-4 md:gap-5 w-full max-md:overflow-x-auto max-md:[scrollbar-width:none] items-center">
        {items.map(({title, sub, icon}, i) => (
          <div key={i} className="mx-auto w-[86%] aspect-square min-w-[160px] md:min-w-0">
            <GlossyCard title={title} sub={sub} icon={icon} />
          </div>
        ))}
      </div>
    </section>
  );
}

function useMotionEnabled(){
  const disableFlag = (import.meta as any).env?.VITE_DISABLE_MOTION === '1';
  const [enabled, setEnabled] = useState(false);
  useEffect(()=>{
    try{
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setEnabled(!disableFlag && !prefersReduced);
    } catch {
      setEnabled(!disableFlag);
    }
  }, [disableFlag]);
  return enabled;
}

function SplitText({ text, startDelayMs=0, as:Tag='p', className='' }:{ text:string; startDelayMs?:number; as?:any; className?:string }){
  const motion = useMotionEnabled();
  const words = useMemo(()=> text.split(' '), [text]);
  const [mounted, setMounted] = useState(false);
  useEffect(()=>{ if (motion) { const t = setTimeout(()=> setMounted(true), 20); return ()=> clearTimeout(t); } }, [motion]);
  if (!motion) return <Tag className={className}>{text}</Tag>;
  return (
    <Tag className={className} aria-label={text}>
      {words.map((w, i)=> (
        <span key={i} style={{display:'inline-block', transform: mounted ? 'translateY(0)' : 'translateY(6px)', opacity: mounted ? 1 : 0, transition: 'opacity .45s ease-out, transform .45s ease-out', transitionDelay: `${startDelayMs + i*60}ms`}}>
          {w}
        </span>
      )).flatMap((span, i) => i < words.length - 1 ? [span, ' '] : [span])}
    </Tag>
  );
}

export default function LandingV2(){
  const nav = useNavigate();

  const goDemo = () => {
    try { track('cta_click',{area:'hero',href:'/demo'}); } catch {}
    nav('/demo');
  };
  const goSignup = () => {
    try { track('cta_click',{area:'hero',href:'/signup'}); } catch {}
    nav('/signup');
  };

  // Capture referral code and persist for attribution
  useEffect(()=>{
    try {
      const sp = new URLSearchParams(window.location.search);
      const ref = sp.get('ref');
      if (ref) localStorage.setItem('bvx_ref', ref);
    } catch {}
  }, []);

  // Optional KickoffLabs beacon for referral analytics
  useEffect(()=>{
    try{
      const KO_ID = (import.meta as any).env?.VITE_KICKOFFLABS_ID;
      if (!KO_ID) return;
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://scripts.kickoffpages.com/kl.js?${KO_ID}`;
      document.head.appendChild(s);
      return () => { try { document.head.removeChild(s); } catch {} };
    } catch {}
  }, []);


  return (
    <div className="mx-auto max-w-6xl relative z-10">
      {/* Use GLB copied to /public/spline */}
      <BackdropFX modelUrl="/spline/swirl.glb" />
      {/* Hairlines */}
      <div aria-hidden className="absolute top-0 left-0 right-0 h-px bg-black/10" />
      <div aria-hidden className="absolute bottom-0 left-0 right-0 h-px bg-black/10" />

      <div className="h-[calc(100vh-140px)] grid grid-cols-1 gap-4 overflow-hidden">
        {/* Header removed for now per design — hero remains primary */}
        <main className="h-full grid grid-rows-[auto_auto_1fr] overflow-hidden">
          {/* Hero (words-only + single CTA) */}
          <section className="relative pt-4 md:pt-6 pb-10 md:pb-12">
            <div
              aria-hidden
              className="absolute inset-0 -z-10"
              style={{
                background:
                  'radial-gradient(520px 220px at 60% 42%, rgba(96,165,250,0.35), transparent 60%), radial-gradient(420px 180px at 75% 58%, rgba(236,72,153,0.18), transparent 65%)',
              }}
            />

            <div className="max-w-5xl mx-auto px-2 md:px-3">
              <SplitText
                as="h1"
                text="Intuitive ops — luxe client experience — brandVX"
                startDelayMs={0}
                className="text-[46px] md:text-[76px] leading-tight text-center"/>

              <SplitText
                text="Cadences, reminders, and follow‑ups that feel human — so you stay in your craft while BrandVX fills your calendar."
                startDelayMs={350}
                className="mt-[23px] md:mt-[31px] text-slate-700 text-[18px] md:text-[24px] text-center"/>

              <SplitText
                text="Made by beauty professionals — for beauty professionals"
                startDelayMs={700}
                className="mt-[35px] md:mt-[43px] text-slate-600 text-[15px] md:text-[18px] text-center"/>

              {/* CTA moved below to sit centered between this line and the squares */}
            </div>
          </section>

          {/* Thin CTA section between hero and squares */}
          <section className="py-2 md:py-3 flex justify-center">
            <div className="flex gap-3 items-center mt-[50px]">
              <div className="relative group">
                <div aria-hidden className="absolute -inset-2 rounded-full bg-sky-300/30 blur-md opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100" />
                <button
                  onClick={goDemo}
                  className="text-black text-lg md:text-xl px-7 md:px-8 py-3.5 md:py-4 rounded-full shadow-md bg-gradient-to-b from-sky-100 to-sky-200 hover:from-sky-200 hover:to-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-px"
                  style={{fontFamily:'\"Fraunces\", ui-serif, Georgia, serif'}}
                >
                  Try the demo today →
                </button>
              </div>
              <button
                onClick={goSignup}
                className="text-white text-lg md:text-xl px-7 md:px-8 py-3.5 md:py-4 rounded-full shadow-md bg-gradient-to-b from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-px"
                style={{fontFamily:'\"Fraunces\", ui-serif, Georgia, serif'}}
              >
                Start free trial
              </button>
            </div>
          </section>

          {/* Inline metrics for social proof */}
          <section className="flex justify-center">
            <MetricsInline />
          </section>

          {/* Squares remain centered in remaining space */}
          <div className="flex flex-col h-full overflow-hidden">
            <WorkflowRow />
          </div>
        </main>
      </div>
    </div>
  );
}


