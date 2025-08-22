//
import { MessageSquareText, CalendarClock, Timer, ShieldCheck, Sparkles, Users } from 'lucide-react';
import AnnouncementBar from '../components/AnnouncementBar';
import Hero from '../components/Hero';
import Hero3D from '../components/Hero3D';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import FeatureGrid from '../components/sections/FeatureGrid';
import TestimonialCards from '../components/sections/TestimonialCards';
import FAQ from '../components/sections/FAQ';
import Pricing from '../components/sections/Pricing';
import Gallery from '../components/sections/Gallery';

export default function Landing() {
  // testimonial set available for future carousel use
  useEffect(()=>{
    // CTA analytics stub
    try{ (window as any).posthog?.capture?.('landing_view'); } catch {}
    // Idle prefetch common onboarding/integrations flows to smooth first click
    try{
      const idle = (cb:()=>void)=> (window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb) : setTimeout(cb, 1200);
      idle(()=> { import('./Onboarding'); import('./Integrations'); });
    } catch {}
  },[]);

  return (
    <div className="mx-auto max-w-6xl">
      <AnnouncementBar />
      <div className="mt-4">
        {/* Place copy first to avoid a blank first viewport; Spline follows as cinematic section */}
        <Hero />
        <div className="mt-6" />
        <Hero3D height="64vh" className="rounded-3xl overflow-hidden" />
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[{v:'6.2h', l:'Time Saved / wk'},{v:'19%', l:'No‑show reduction'},{v:'4.8/5', l:'CSAT'}].map((k)=> (
          <div key={k.l} className="rounded-2xl bg-white shadow-sm border p-4 text-center">
            <div className="text-2xl font-semibold text-slate-900">{k.v}</div>
            <div className="text-xs text-slate-600">{k.l}</div>
          </div>
        ))}
      </div>

      <FeatureGrid items={[
        { icon: <MessageSquareText className="text-pink-500" />, title: 'Smart cadences', text: 'Gentle SMS‑first flows with email fallback, consent‑aware and respectful.' },
        { icon: <CalendarClock className="text-violet-500" />, title: 'Appointments', text: '7d / 3d / 1d / 2h reminders, plus notify‑list for last‑minute openings.' },
        { icon: <Timer className="text-slate-700" />, title: 'Time Saved', text: 'See hours saved from automation with shareable milestones.' }
      ]} />

      <section className="mt-10 grid lg:grid-cols-2 gap-6 items-center">
        <div className="rounded-2xl p-6 bg-white shadow-sm border">
          <div className="inline-flex items-center gap-2 text-xs text-pink-600 bg-pink-50 rounded-full px-2 py-1 border border-pink-100"><ShieldCheck size={14}/> Consent‑first, always</div>
          <h3 className="mt-3 text-2xl font-semibold text-slate-900">Short, kind, in your voice</h3>
          <p className="text-slate-600 mt-2">Clients can reply STOP/HELP any time. You approve tone and timing. We keep messages human — and you’re always in control.</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-pink-500" aria-hidden /> Soonest vs Anytime, simple and clear</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-pink-500" aria-hidden /> Quiet‑hours respected per tenant</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-pink-500" aria-hidden /> One attempt per cadence step</li>
          </ul>
          <div className="mt-4 flex gap-3">
            <Link to="/onboarding" className="px-4 py-2 rounded-xl text-white shadow hover:shadow-md bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600" aria-label="Begin onboarding">Get started</Link>
            <Link to="/vision" className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 shadow-sm">See design tools</Link>
          </div>
        </div>
        <div className="rounded-2xl p-6 bg-white shadow-sm border min-h-[240px] grid place-items-center text-slate-500">
          <div className="text-center">
            <Sparkles className="mx-auto text-pink-500" />
            <div className="mt-2 text-sm">Preview of your brand vibe, services, and messages</div>
          </div>
        </div>
      </section>

      <TestimonialCards items={[
        { initials: 'A', name: 'Alex — Color Lab', role: 'Owner', quote: '“The nudges feel human and my calendar stays full.”', color: 'pink' },
        { initials: 'B', name: 'Brooke — Lash Co.', role: 'Lead Artist', quote: '“Setup took minutes and clients love the reminders.”', color: 'violet' },
        { initials: 'C', name: 'Cara — Modern Salon', role: 'Stylist', quote: '“Finally, follow‑ups that sound like me.”', color: 'sky' }
      ]} />

      <section className="mt-10">
        <div className="rounded-2xl bg-gradient-to-r from-pink-50 via-white to-sky-50 p-6 text-sm text-slate-800 flex items-center justify-between gap-3 border shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="text-pink-500" />
            <div>
              <strong>Consent‑first</strong> messaging. Clients can reply <strong>STOP/HELP</strong> any time. Reminders default to <strong>7d / 3d / 1d / 2h</strong>. Lead replies offer <strong>Soonest vs Anytime</strong>.
            </div>
          </div>
          <Link to="/onboarding" className="px-4 py-2 rounded-xl text-white shadow hover:shadow-md bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600">Get started</Link>
        </div>
      </section>

      <section className="mt-10">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Frequently asked</h3>
        <FAQ />
      </section>

      <section className="mt-10">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">A peek inside</h3>
        <Gallery />
      </section>

      <section className="mt-10">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Simple pricing</h3>
        <Pricing />
      </section>
    </div>
  );
}


