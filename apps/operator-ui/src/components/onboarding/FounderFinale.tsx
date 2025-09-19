import { useMemo, useState } from 'react';
import OverlayPortal from '../OverlayPortal';
import { api, getTenant } from '../../lib/api';

interface FounderFinaleProps {
  open: boolean;
  imageSrc: string;
  onClose: (opts?: { contactSent?: boolean }) => void;
}

const slideCopy = [
  {
    title: 'From Dakota',
    body: `Hi! My name is Dakota LaTommy and I created this platform for beauty professionals like YOU!
In a world that underestimates your ability, hustle, and drive, I wanted to design something that lets you know I see you.`,
  },
  {
    title: 'Our tribe',
    body: `From my girlfriend Rachel to my business partner Jaydn, I have deep connections with the beauty industry.
You are hustlers, business-savvy ARTISTS — but the mounting pressure to survive has stripped the joy from a craft you once loved.`,
    showImage: true,
  },
  {
    title: 'Why brandVX exists',
    body: `brandVX is designed to help you optimize your business, save time, and generate more revenue.
It grows with you — as a CEO, brand, salesperson, content-creator, and PERSON — by accelerating every aspect of your passion.
We are in open beta with 1,000 users and rolling out new features weekly. If you have any issues or questions, please reach out at **support@aubecreativelabs.com**.`,
  },
  {
    title: 'Let’s stay in touch',
    body: `I appreciate you trying brandVX and would love any feedback.
If you enter your contact info below, I will personally call you to thank you.

Go be great!`,
    isForm: true,
  },
];

export default function FounderFinale({ open, imageSrc, onClose }: FounderFinaleProps) {
  const [index, setIndex] = useState(0);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const total = slideCopy.length;
  const slide = slideCopy[index];

  const progress = useMemo(() => Math.round(((index + 1) / total) * 100), [index, total]);

  const resetAndClose = (contactSent = false) => {
    setIndex(0);
    setEmail('');
    setPhone('');
    setSubmitting(false);
    setError('');
    onClose({ contactSent });
  };

  const next = () => {
    if (index < total - 1) {
      setIndex((i) => Math.min(total - 1, i + 1));
    } else {
      resetAndClose(false);
    }
  };

  const prev = () => {
    setIndex((i) => Math.max(0, i - 1));
  };

  const submit = async () => {
    if (submitting) return;
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedEmail && !trimmedPhone) {
      resetAndClose(false);
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      const tenant = await getTenant();
      await api.post('/onboarding/founder/contact', {
        tenant_id: tenant,
        email: trimmedEmail || undefined,
        phone: trimmedPhone || undefined,
      });
      resetAndClose(true);
    } catch (err: any) {
      setError(String(err?.message || err || 'Something went wrong'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrimary = () => {
    if (slide.isForm) {
      void submit();
    } else {
      next();
    }
  };

  if (!open) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[2147483602] flex items-center justify-center bg-slate-950/70 p-4">
        <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl p-6 md:p-8 text-slate-900">
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-3xl bg-slate-200 overflow-hidden">
            <div className="h-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-4 md:mt-6 text-xs uppercase tracking-[0.4em] text-slate-500">Founder message</div>
          <h2 className="mt-2 text-2xl md:text-3xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{slide.title}</h2>
          <div className="mt-4 whitespace-pre-line text-sm md:text-base leading-relaxed">
            {slide.body.split('**').map((chunk, idx) => idx % 2 === 1 ? <strong key={idx}>{chunk}</strong> : <span key={idx}>{chunk}</span>)}
          </div>
          {slide.showImage && (
            <div className="mt-4 flex justify-center">
              <img
                src={imageSrc}
                alt="Dakota and Rachel"
                className="h-40 w-40 rounded-2xl object-cover shadow-md"
              />
            </div>
          )}
          {slide.isForm && (
            <div className="mt-4 grid gap-3">
              <div className="grid gap-1 text-sm">
                <label className="text-xs uppercase tracking-wide text-slate-500">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/40"
                  placeholder="you@example.com"
                />
              </div>
              <div className="grid gap-1 text-sm">
                <label className="text-xs uppercase tracking-wide text-slate-500">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/40"
                  placeholder="(555) 555-5555"
                />
              </div>
              {error && <div className="text-xs text-rose-600">{error}</div>}
              <div className="text-[11px] text-slate-500">Optional — share either email or phone if you’d like me to follow up.</div>
            </div>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              className="text-xs text-slate-500 underline-offset-4 hover:underline disabled:opacity-40"
              onClick={prev}
              disabled={index === 0 || submitting}
            >
              Back
            </button>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                className="rounded-full border border-slate-900 bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                onClick={handlePrimary}
                disabled={submitting}
              >
                {slide.isForm ? (submitting ? 'Sending…' : 'Send & Finish') : 'Next'}
              </button>
              <button
                className="text-xs text-slate-500 hover:underline disabled:opacity-60"
                onClick={() => resetAndClose(false)}
                disabled={submitting}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
