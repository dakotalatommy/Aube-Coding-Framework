import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { track } from '../lib/analytics';
import BackdropFX from '../components/BackdropFX';
import './landing-v2-fixes.css';

// Metrics line removed

// GlossyCard inlined inside WorkflowRow; leaving placeholder export removed to avoid unused warning.

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
  const items: Array<{title:string; sub:string; proof?:string; icon: any}> = [
    { title:'Fill cancellations first', sub:'Text your waitlist first so open spots get taken in minutes.', proof:'Typical: +2–4 slots/week', icon:<IconPlug/> },
    { title:'Cut no‑shows', sub:'Friendly confirmations and day‑of nudges that keep clients on track.', proof:'Typical: 15–25% fewer no‑shows', icon:<IconClock/> },
    { title:'Seamless professional photo edits', sub:'Polish before/afters with brandVZN; preserve skin texture and natural tone.', icon:<IconUser/> },
    { title:'Give your brand a voice', sub:'Short, on‑brand messages and captions — nothing happens without your approval.', icon:<IconSpark/> },
  ];
  return (
    <section className="my-auto mt-6 md:mt-8">
      <div className="grid grid-cols-4 gap-3 md:gap-4 w-full max-md:overflow-x-auto max-md:[scrollbar-width:none] items-center mt-[8px]">
        {items.map(({title, sub, icon}, i) => (
          <div key={i} className="mx-auto aspect-square min-w-[147px] md:min-w-0" style={{ width: 'calc(76% + 10px)' }}>
            <div className="relative group h-full w-full">
              <div role="button" tabIndex={0} aria-label={`${title}: ${sub}`} className="relative h-full w-full rounded-3xl p-5 md:p-6 bg-white border-[3px] border-white shadow-[0_24px_48px_-22px_rgba(0,0,0,0.28)] overflow-hidden transition will-change-transform hover:-translate-y-1.5 hover:shadow-[0_40px_80px_-32px_rgba(0,0,0,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] isolate mix-blend-normal">
              {/* Force isolation: solid white backdrop inside tile */}
              <div aria-hidden className="absolute inset-0 bg-white z-0" />
              {/* Keep subtle white sheen only; remove any color that could tint */}
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 to-white/0 z-10" />
              <div className="relative z-20 flex flex-col items-center justify-center text-center h-full w-full">
                {icon && (
                  <div className="text-slate-700 mb-2" aria-hidden>
                    {icon}
                  </div>
                )}
                <div className="font-semibold text-slate-900 text-[20px] md:text-[22px]">{title}</div>
                <div className="text-slate-600 text-[14px] md:text-[16px] mt-1">{sub}</div>
                {/* proof removed per request */}
              </div>
              </div>
            </div>
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
  const mainRef = useRef<HTMLDivElement|null>(null);
  // const signInRef = useRef<HTMLDivElement|null>(null);

  const goSignup = () => {
    try { track('cta_click',{area:'hero',href:'/signup'}); } catch {}
    nav('/signup');
  };
  const goLogin = () => {
    try { track('cta_click',{area:'hero',href:'/login'}); } catch {}
    nav('/login');
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

  // Metrics removed; spacer preserves layout.


  return (
    <div className="relative w-full min-h-[100dvh]" style={{ backgroundColor: '#F7CBDD' }}>
      <div className="mx-auto max-w-6xl relative z-10 flex flex-col min-h-[100dvh]">
      {/* Use GLB copied to /public/spline */}
      <BackdropFX modelUrl="/spline/swirl.glb" />
      {/* Hairlines */}
      <div aria-hidden className="absolute top-0 left-0 right-0 h-px bg-black/10" />
      {/* bottom hairline removed to avoid visible white line on short laptops */}

      <div className="min-h-[calc(100vh-140px)] grid grid-cols-1 gap-4">
        {/* Header removed for now per design — hero remains primary */}
        <main ref={mainRef} className="min-h-full grid grid-rows-[auto_auto_1fr] overflow-visible relative">
          {/* Hero (words-only + single CTA) */}
          <section className="relative pt-4 md:pt-6 pb-10 md:pb-12 mt-[7px]">
            <div
              aria-hidden
              className="absolute inset-0 -z-10"
              style={{
                background:
                  'radial-gradient(65vw 48vh at 60% 42%, rgba(96,165,250,0.48), transparent 70%), radial-gradient(54vw 40vh at 75% 58%, rgba(236,72,153,0.28), transparent 76%)',
              }}
            />

            <div className="max-w-7xl mx-auto px-2 md:px-3">
              <div className="relative inline-block w-full">
                <div className="w-full flex justify-center mb-2 md:mb-3">
                  <img
                    src="/assets/bVX_logo-removebg-preview.png"
                    alt="brandVX logo"
                    className="max-w-[140px] md:max-w-[180px] opacity-95"
                  />
                </div>
                <SplitText
                  as="h1"
                  text="Book more clients. Fewer no‑shows. Less stress."
                  startDelayMs={0}
                  className="text-[64px] md:text-[112px] leading-[1.06] tracking-tight text-center font-extrabold"/>
                {/* Subtle hero shimmer sweep */}
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-[18%] bg-gradient-to-r from-white/0 via-white/12 to-white/0"
                  initial={{ x: '-20%' }}
                  animate={{ x: ['-20%','120%'] }}
                  transition={{ duration: 1.2, delay: 2, repeat: Infinity, repeatDelay: 11, ease: 'easeInOut' }}
                />
                {/* Very faint background sparkles */}
                <motion.span aria-hidden className="pointer-events-none absolute -top-4 left-[18%] w-2 h-2 rounded-full bg-white/20 blur-[2px]" initial={{ opacity: 0.05 }} animate={{ opacity: [0.05,0.18,0.05] }} transition={{ duration: 8, repeat: Infinity, repeatDelay: 6 }} />
                <motion.span aria-hidden className="pointer-events-none absolute -bottom-3 right-[22%] w-1.5 h-1.5 rounded-full bg-white/18 blur-[1.5px]" initial={{ opacity: 0.04 }} animate={{ opacity: [0.04,0.16,0.04] }} transition={{ duration: 9, repeat: Infinity, repeatDelay: 7 }} />
              </div>

              <SplitText
                text="Automations that save you time — made by beauty pros, for beauty pros."
                startDelayMs={350}
                className="mt-[23px] md:mt-[31px] text-slate-700 text-[26px] md:text-[36px] font-medium text-center"/>

              {/* CTA moved below to sit centered between this line and the squares */}
            </div>
          </section>

          {/* Thin CTA section between hero and squares */}
          <section className="py-2 md:py-2.5 flex justify-center">
            <div className="flex flex-col items-center mt-[22px] md:mt-[42px]">
              {/* slightly reduce top margin on laptops to fit common Mac heights */}
              <div className="flex gap-4 md:gap-5 items-center">
                <button
                  onClick={goLogin}
                  className="relative overflow-hidden text-slate-900 text-[20px] md:text-[24px] px-9 md:px-10 py-4 md:py-5 rounded-full border bg-white hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-px"
                  style={{fontFamily:'\"Fraunces\", ui-serif, Georgia, serif'}}
                >
                  Sign in
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-1 h-1.5 bg-white/60 blur-[2px]" />
                </button>
                <button
                  onClick={goSignup}
                  className="relative overflow-hidden text-slate-900 text-[20px] md:text-[24px] px-9 md:px-10 py-4 md:py-5 rounded-full border bg-white hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-px"
                  style={{fontFamily:'\"Fraunces\", ui-serif, Georgia, serif'}}
                >
                  Create your brandVX
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-1 h-1.5 bg-white/60 blur-[2px]" />
                </button>
              </div>
              <div style={{height: 'clamp(10px, 1.4vw, 18px)'}} />
              <div className="mt-2 md:mt-3" />
            </div>
          </section>

          {/* Spacer preserves original flow height so squares don't shift */}
          <div aria-hidden className="h-[25px] md:h-[33px]" />


          {/* Squares remain centered in remaining space */}
          <div id="bvx-squares-anchor" className="flex flex-col min-h-[320px] overflow-visible">
            <WorkflowRow />
          </div>
        </main>
        {/* Footer over pink background pinned to bottom */}
        <section className="mt-auto pb-6">
          <div className="p-3 text-center text-[11px] text-slate-700">
            © {new Date().getFullYear()} brandVX · <a href="/privacy" className="underline">Privacy</a> · <a href="/terms" className="underline">Terms</a>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
