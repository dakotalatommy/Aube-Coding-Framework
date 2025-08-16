import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * BrandVX Onboarding Playground — Beauty Edition
 * Audience: beauty professionals
 * Design: soft light pink + blue, slightly futuristic + ethereal
 * Animations: gentle wave background (PlayStation-style drift)
 * Non-technical copy; interactive + fun
 * Fonts assumed: Space Grotesk (display), Inter (text)
 */

const PINK = "#FDE2F3"; // light pink
const BLUE = "#E0F2FE"; // light blue
const AZURE = "#7DD3FC"; // accent blue
const VIOLET = "#C4B5FD"; // soft violet

const steps = [
  {
    id: 1,
    title: "Welcome",
    blurb: "A quick, friendly tour of what onboarding looks like and how little time it takes.",
  },
  {
    id: 2,
    title: "Connect your tools",
    blurb:
      "Choose what you already use: calendar/booking, messages, payments/POS, and (optionally) CRM.",
  },
  {
    id: 3,
    title: "Your vibe & services",
    blurb:
      "Pick your tone and the services you offer. We’ll tailor reminders and messages to feel like you.",
  },
  {
    id: 4,
    title: "Preview messages",
    blurb:
      "See example messages before anything goes live. You approve everything.",
  },
  {
    id: 5,
    title: "Go live",
    blurb:
      "What the first week looks like: gentle reminders, lead follow‑ups, and a quick check‑in.",
  },
];

const TOOL_PRESETS = {
  booking: { label: "Calendar / Booking (Square, Acuity)", minutes: 3 * 60 },
  messages: { label: "Messages (SMS + Email)", minutes: 2 * 60 },
  payments: { label: "Payments / POS (Square, Shopify)", minutes: 60 },
  crm: { label: "CRM (HubSpot — optional)", minutes: 45 },
  content: { label: "Content helper (captions & posts)", minutes: 2 * 60 },
  inventory: { label: "Inventory assist (optional)", minutes: 60 },
};

const SERVICES = [
  "Hair",
  "Makeup",
  "Brows/Lashes",
  "Nails",
  "Skincare/Facials",
  "Med‑Spa",
  "Barbering",
];

function Chip({ selected, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full border transition shadow-sm text-sm mr-2 mb-2 ${
        selected
          ? "bg-white/80 border-sky-300 text-sky-700"
          : "bg-white/60 border-white/60 text-slate-600 hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function WaveBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* soft gradient wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            `radial-gradient(60% 60% at 30% 20%, ${PINK} 0%, transparent 60%),` +
            `radial-gradient(50% 50% at 80% 10%, ${BLUE} 0%, transparent 60%),` +
            `radial-gradient(70% 60% at 80% 80%, ${VIOLET}55 0%, transparent 60%)`,
          filter: "blur(20px)",
        }}
      />
      {/* layered SVG waves */}
      <svg className="absolute -bottom-20 left-0 w-[180%] h-72 opacity-50" viewBox="0 0 1440 320">
        <defs>
          <linearGradient id="grad1" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={AZURE} stopOpacity="0.7" />
            <stop offset="100%" stopColor={PINK} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <motion.path
          d="M0,96L60,101.3C120,107,240,117,360,122.7C480,128,600,128,720,112C840,96,960,64,1080,69.3C1200,75,1320,117,1380,138.7L1440,160L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
          fill="url(#grad1)"
          initial={{ x: 0 }}
          animate={{ x: [0, -200, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
      <svg className="absolute -top-10 right-0 w-[160%] h-64 opacity-40" viewBox="0 0 1440 320">
        <defs>
          <linearGradient id="grad2" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={VIOLET} stopOpacity="0.6" />
            <stop offset="100%" stopColor={BLUE} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <motion.path
          d="M0,64L60,85.3C120,107,240,149,360,149.3C480,149,600,107,720,112C840,117,960,171,1080,176C1200,181,1320,139,1380,117.3L1440,96L1440,0L1380,0C1320,0,1200,0,1080,0C960,0,840,0,720,0C600,0,480,0,360,0C240,0,120,0,60,0L0,0Z"
          fill="url(#grad2)"
          initial={{ x: 0 }}
          animate={{ x: [0, 220, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
}

function PrettyCard({ children, className = "" }: any) {
  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={`rounded-2xl shadow-xl bg-white/80 backdrop-blur p-5 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function TimeSavedGauge({ minutes }: { minutes: number }) {
  const hrs = (minutes / 60).toFixed(1);
  const pct = Math.min(100, Math.round((minutes / (8 * 60)) * 100));
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 36 36" className="w-20 h-20">
          <path
            className="text-slate-200"
            strokeWidth="4"
            stroke="currentColor"
            fill="none"
            d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32"
          />
          <motion.path
            strokeWidth="4"
            stroke={AZURE}
            fill="none"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: pct / 100 }}
            transition={{ duration: 0.8 }}
            d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-xs font-medium text-slate-700">
          {pct}%
        </div>
      </div>
      <div>
        <div className="text-slate-600 text-sm">Estimated time saved / week</div>
        <div className="text-slate-900 font-semibold text-lg">{hrs} hours</div>
        <div className="text-slate-500 text-xs">(Based on your selections)</div>
      </div>
    </div>
  );
}

function FriendlyFAQ() {
  return (
    <div className="grid gap-3">
      {[{
        q: "Do you message my clients without asking?",
        a: "Nope. You approve tone and timing. Clients can reply STOP/HELP any time, and we honor consent."
      }, {
        q: "How long does setup take?",
        a: "Most pros are done in under 15 minutes. White‑glove is available if you’d like us to do it for you."
      }, {
        q: "What if I don’t use a CRM?",
        a: "Totally fine. Calendar/booking and messages are enough to start. You can add CRM later."
      }, {
        q: "Will this feel like me?",
        a: "Yes. You choose the vibe. We keep it human, short, and in your voice."
      }].map((f, i) => (
        <details key={i} className="bg-white/70 backdrop-blur rounded-xl p-4">
          <summary className="cursor-pointer font-medium text-slate-800">{f.q}</summary>
          <p className="mt-2 text-slate-600 text-sm">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export default function BrandVXOnboardingPlayground() {
  const [step, setStep] = useState(1);
  const [tools, setTools] = useState<Record<string, boolean>>({ booking: true, messages: true, payments: false, crm: false, content: true, inventory: false });
  const [busy, setBusy] = useState(3); // 1..5
  const [tone, setTone] = useState(3); // 1 chill .. 5 professional
  const [services, setServices] = useState<string[]>(["Hair", "Brows/Lashes"]);
  const [whiteGlove, setWhiteGlove] = useState(false);

  const totalMinutes = useMemo(() => {
    const base = Object.entries(tools)
      .filter(([_, v]) => v)
      .reduce((acc, [k]) => acc + (TOOL_PRESETS as any)[k].minutes, 0);
    const busyBoost = (busy - 3) * 20; // +/- minutes
    const whiteGloveAdj = whiteGlove ? -90 : 0; // white glove saves time
    return Math.max(30, base / 6 + busyBoost + whiteGloveAdj); // rough heuristic for weekly saving
  }, [tools, busy, whiteGlove]);

  const toneLabel = ["Super chill", "Warm", "Balanced", "Polished", "Very professional"][tone - 1];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-white via-white/80 to-white">
      <WaveBackground />

      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/70 backdrop-blur shadow grid place-items-center">
              <span className="text-sky-600 font-bold">BVX</span>
            </div>
            <div>
              <h1 className="font-semibold tracking-tight text-slate-900 text-xl" style={{ fontFamily: "Space Grotesk, Inter, system-ui" }}>BrandVX Onboarding</h1>
              <p className="text-slate-600 text-sm">Beauty pros • gentle setup • your voice, your clients</p>
            </div>
          </div>
          <a href="#cta" className="rounded-full bg-sky-500/90 text-white px-4 py-2 text-sm shadow hover:bg-sky-500 transition">Book my onboarding</a>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        {/* Stepper */}
        <PrettyCard>
          <div className="flex flex-wrap items-center gap-3">
            {steps.map((s) => (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`group relative flex items-center gap-2 rounded-full px-3 py-2 text-sm transition ${
                  step === s.id
                    ? "bg-sky-100 text-sky-800"
                    : "bg-white/70 text-slate-600 hover:bg-white"
                }`}
                aria-current={step === s.id}
              >
                <span className={`h-6 w-6 grid place-items-center rounded-full text-xs font-semibold ${
                  step === s.id ? "bg-sky-500 text-white" : "bg-slate-200 text-slate-700"
                }`}>{s.id}</span>
                <span className="font-medium">{s.title}</span>
              </button>
            ))}
          </div>
        </PrettyCard>

        <div className="mt-6 grid lg:grid-cols-3 gap-6">
          {/* Left: interactive content */}
          <div className="lg:col-span-2 grid gap-6">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.section key="s1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                  <PrettyCard>
                    <h2 className="text-lg font-semibold text-slate-900">Welcome 👋</h2>
                    <p className="mt-2 text-slate-600">We’ll connect a couple tools, set your tone, and preview messages — then you’re live. Most pros finish in <strong>under 15 minutes</strong>.</p>
                    <div className="mt-4 grid sm:grid-cols-3 gap-3">
                      {[{title: "Connect", text: "Calendar/booking + messages"}, {title:"Personalize", text:"Your vibe + services"}, {title:"Preview", text:"Approve messages → go live"}].map((b,i)=> (
                        <div key={i} className="rounded-xl bg-gradient-to-b from-white/80 to-white/60 p-4 border border-white/60">
                          <div className="text-slate-900 font-medium">{b.title}</div>
                          <div className="text-slate-600 text-sm">{b.text}</div>
                        </div>
                      ))}
                    </div>
                  </PrettyCard>
                </motion.section>
              )}

              {step === 2 && (
                <motion.section key="s2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                  <PrettyCard>
                    <h2 className="text-lg font-semibold text-slate-900">Connect your tools</h2>
                    <p className="mt-1 text-slate-600">Pick what you already use. We guide you step‑by‑step and keep it human.</p>
                    <div className="mt-4 grid sm:grid-cols-2 gap-3">
                      {Object.entries(TOOL_PRESETS).map(([key, val]) => (
                        <label key={key} className="flex items-center gap-3 rounded-xl bg-white/70 p-3 border border-white/70 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!tools[key]}
                            onChange={(e) => setTools((t) => ({ ...t, [key]: e.target.checked }))}
                            className="h-4 w-4"
                            aria-label={val.label}
                          />
                          <div>
                            <div className="text-slate-800 font-medium">{val.label}</div>
                            <div className="text-slate-500 text-xs">Setup ≈ {Math.round(val.minutes/6)} sec</div>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                      <label className="flex items-center gap-3">
                        <input type="checkbox" checked={whiteGlove} onChange={(e)=> setWhiteGlove(e.target.checked)} className="h-4 w-4" />
                        <span className="text-sm text-slate-700">White‑glove (we set it up for you)</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-700">How busy are you today?</span>
                        <input type="range" min={1} max={5} value={busy} onChange={(e)=> setBusy(parseInt(e.target.value))} />
                        <span className="text-xs text-slate-600">{["Quiet", "Light", "Normal", "Busy", "Slammed"][busy-1]}</span>
                      </div>
                    </div>
                  </PrettyCard>
                </motion.section>
              )}

              {step === 3 && (
                <motion.section key="s3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                  <PrettyCard>
                    <h2 className="text-lg font-semibold text-slate-900">Your vibe & services</h2>
                    <div className="mt-4 grid md:grid-cols-2 gap-6">
                      <div>
                        <div className="text-sm text-slate-700">Tone</div>
                        <input className="w-full" type="range" min={1} max={5} value={tone} onChange={(e)=> setTone(parseInt(e.target.value))} />
                        <div className="text-xs text-slate-500">Current: <span className="font-medium text-slate-800">{toneLabel}</span></div>
                        <p className="mt-2 text-slate-600 text-sm">We’ll match your tone in reminders and replies — short, kind, and you.</p>
                      </div>
                      <div>
                        <div className="text-sm text-slate-700 mb-2">Services</div>
                        <div>
                          {SERVICES.map((s) => (
                            <Chip key={s} selected={services.includes(s)} onClick={() => setServices((arr)=> arr.includes(s)? arr.filter(x=> x!==s) : [...arr, s])}>{s}</Chip>
                          ))}
                        </div>
                        <p className="mt-2 text-slate-600 text-sm">This helps us suggest the right message timing and examples.</p>
                      </div>
                    </div>
                  </PrettyCard>
                </motion.section>
              )}

              {step === 4 && (
                <motion.section key="s4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                  <PrettyCard>
                    <h2 className="text-lg font-semibold text-slate-900">Preview messages</h2>
                    <p className="mt-1 text-slate-600">Examples only — you approve before anything sends.</p>
                    <div className="mt-4 grid gap-3">
                      <div className="rounded-xl bg-white/70 p-4 border border-white/70">
                        <div className="text-xs text-slate-500 mb-1">Reminder • 24 hrs before</div>
                        <div className="text-slate-800">Hey {"{First Name}"} — see you tomorrow at {"{Time}"}! Need to change it? Tap here. 💫</div>
                      </div>
                      <div className="rounded-xl bg-white/70 p-4 border border-white/70">
                        <div className="text-xs text-slate-500 mb-1">Waitlist • Canceled slot</div>
                        <div className="text-slate-800">A spot just opened for {"{Service}"} at {"{Time}"}. Want it? Reply YES and we’ll lock it in. ✨</div>
                      </div>
                      <div className="rounded-xl bg-white/70 p-4 border border-white/70">
                        <div className="text-xs text-slate-500 mb-1">Lead follow‑up</div>
                        <div className="text-slate-800">Hi! I saw you were looking at {"{Service}"}. Happy to help you book — Soonest or Anytime?</div>
                      </div>
                    </div>
                  </PrettyCard>
                </motion.section>
              )}

              {step === 5 && (
                <motion.section key="s5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                  <PrettyCard>
                    <h2 className="text-lg font-semibold text-slate-900">Go live — what to expect</h2>
                    <ol className="mt-3 space-y-3">
                      <li className="flex gap-3"><span className="mt-1 h-6 w-6 rounded-full bg-sky-500 text-white grid place-items-center text-xs">1</span><div><div className="font-medium text-slate-800">Quick check‑in</div><div className="text-sm text-slate-600">We confirm your tone, services, and timing. You can change anything later.</div></div></li>
                      <li className="flex gap-3"><span className="mt-1 h-6 w-6 rounded-full bg-sky-500 text-white grid place-items-center text-xs">2</span><div><div className="font-medium text-slate-800">Gentle reminders</div><div className="text-sm text-slate-600">No‑show reduction and waitlist fill. Clients can reply like normal.</div></div></li>
                      <li className="flex gap-3"><span className="mt-1 h-6 w-6 rounded-full bg-sky-500 text-white grid place-items-center text-xs">3</span><div><div className="font-medium text-slate-800">Lead follow‑ups</div><div className="text-sm text-slate-600">We nudge new leads kindly. "Soonest vs Anytime" keeps it simple.</div></div></li>
                      <li className="flex gap-3"><span className="mt-1 h-6 w-6 rounded-full bg-sky-500 text-white grid place-items-center text-xs">4</span><div><div className="font-medium text-slate-800">Week‑one snapshot</div><div className="text-sm text-slate-600">Time Saved, Revenue Uplift, and any Ambassador candidates.</div></div></li>
                    </ol>
                  </PrettyCard>
                </motion.section>
              )}
            </AnimatePresence>

            <PrettyCard>
              <h3 className="text-slate-900 font-semibold">FAQ</h3>
              <FriendlyFAQ />
            </PrettyCard>
          </div>

          {/* Right: summary */}
          <div className="grid gap-6">
            <PrettyCard>
              <h3 className="text-slate-900 font-semibold">Your plan</h3>
              <div className="mt-3 text-sm text-slate-700">Tone: <span className="font-medium">{toneLabel}</span></div>
              <div className="mt-1 text-sm text-slate-700">Services: <span className="font-medium">{services.join(", ") || "(none yet)"}</span></div>
              <div className="mt-3 text-sm text-slate-700">Tools connected:</div>
              <ul className="mt-1 text-sm text-slate-600 list-disc ml-5">
                {Object.entries(tools).filter(([_, v])=> v).map(([k])=> (
                  <li key={k}>{(TOOL_PRESETS as any)[k].label}</li>
                ))}
              </ul>
              <div className="mt-4">
                <TimeSavedGauge minutes={totalMinutes} />
              </div>
              <div className="mt-4 grid gap-2">
                <div className="rounded-lg bg-white/70 p-3 text-sm text-slate-700 border border-white/70">
                  <span className="font-medium">Week 0:</span> Setup + preview messages (you approve).
                </div>
                <div className="rounded-lg bg-white/70 p-3 text-sm text-slate-700 border border-white/70">
                  <span className="font-medium">Week 1:</span> Reminders + waitlist fill; first Time Saved snapshot.
                </div>
                <div className="rounded-lg bg-white/70 p-3 text-sm text-slate-700 border border-white/70">
                  <span className="font-medium">Week 2:</span> Lead follow‑ups; early retention lift.
                </div>
                <div className="rounded-lg bg-white/70 p-3 text-sm text-slate-700 border border-white/70">
                  <span className="font-medium">Week 4:</span> Ambassadors flagged (if eligible) + mini CX tune‑up.
                </div>
              </div>
            </PrettyCard>

            <PrettyCard>
              <h3 className="text-slate-900 font-semibold">Privacy & respect</h3>
              <p className="mt-2 text-sm text-slate-600">We keep messages short and human. Consent is honored, and you’re always in control. You can pause or edit anything.</p>
            </PrettyCard>

            <PrettyCard>
              <h3 id="cta" className="text-slate-900 font-semibold">Ready when you are</h3>
              <p className="mt-2 text-sm text-slate-600">We can do white‑glove for you, or you can click through in a few minutes. Either way, it’ll feel like you.</p>
              <div className="mt-3 flex gap-3">
                <button onClick={() => setStep(Math.min(5, step + 1))} className="rounded-xl bg-sky-500 text-white px-4 py-2 text-sm shadow hover:bg-sky-600 transition">Next step</button>
                <button onClick={() => setStep(Math.max(1, step - 1))} className="rounded-xl bg-white text-sky-700 px-4 py-2 text-sm shadow border border-sky-200 hover:bg-sky-50 transition">Back</button>
              </div>
            </PrettyCard>
          </div>
        </div>
      </main>

      <footer className="relative z-10 mx-auto max-w-6xl px-6 pb-10 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} AUBE Creative Labs · BrandVX · You’re in good hands ✨
      </footer>
    </div>
  );
}
