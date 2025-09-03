import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement } from '@stripe/react-stripe-js';
import Button from '../components/ui/Button';
import { track } from '../lib/analytics';
import { api } from '../lib/api';

export default function Billing(){
  const navigate = useNavigate();
  // Removed success banner handling (using Checkout redirect flow)
  const [clientSecret, setClientSecret] = useState<string>('');
  const lastGoodSecret = useRef<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const publishableKey = (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY || (import.meta as any).env?.VITE_STRIPE_PK || '';
  const [runtimePk, setRuntimePk] = useState<string>('');
  const pkFinal = publishableKey || runtimePk;
  const stripePromise = useMemo(() => pkFinal ? loadStripe(pkFinal) : null, [pkFinal]);
  const [billingCfg, setBillingCfg] = useState<{ price_147?: string; price_97?: string; trial_days?: number }|null>(null);
  const buyBtn147 = (import.meta as any).env?.VITE_STRIPE_BUY_BUTTON_147 || '';
  const buyBtn97  = (import.meta as any).env?.VITE_STRIPE_BUY_BUTTON_97  || '';
  // If build-time key is missing, fetch a non-secret publishable key from backend config
  useEffect(()=>{
    if (publishableKey) return;
    (async()=>{
      try{
        const cfg = await fetch((window as any)?.API_BASE || 'https://api.brandvx.io/billing/config').then(r=> r.json()).catch(()=> ({} as any));
        if (cfg && typeof cfg.publishable_key === 'string' && cfg.publishable_key) {
          setRuntimePk(cfg.publishable_key);
        }
      }catch{}
    })();
  },[publishableKey]);

  useEffect(()=>{ try { track('billing_view'); } catch{} }, []);

  // Load Stripe Buy Button script if any buy-button id is configured
  useEffect(()=>{
    if (!(buyBtn147 || buyBtn97)) return;
    try{
      const already = document.querySelector('script[src*="buy-button.js"]');
      if (already) return;
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://js.stripe.com/v3/buy-button.js';
      document.head.appendChild(s);
    }catch{}
  }, [buyBtn147, buyBtn97]);

  useEffect(()=>{
    let mounted = true;
    (async()=>{
      try {
        setLoading(true);
        setError('');
        // Fetch server-side billing config (truth for price ids)
        try {
          const cfg = await fetch('https://api.brandvx.io/billing/config').then(r=> r.json());
          if (mounted) setBillingCfg(cfg||{});
          if (!publishableKey && cfg?.publishable_key && !runtimePk) {
            setRuntimePk(String(cfg.publishable_key));
          }
        } catch {}
        const resp = await api.post('/billing/create-setup-intent', {});
        if (!mounted) return;
        const sec = String(resp?.client_secret||'');
        if (sec) { setClientSecret(sec); lastGoodSecret.current = sec; }
        else {
          setError('Billing is misconfigured: setup intent missing client_secret.');
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to initialize billing.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return ()=>{ mounted = false; };
  },[]);

  // Setup-intent success banner removed (flow now focuses on Checkout buttons)

  if (!publishableKey) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="rounded-2xl border bg-white/80 backdrop-blur p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Billing unavailable</h1>
          <p className="text-slate-600 mt-1">Missing publishable key. Set <code>VITE_STRIPE_PUBLISHABLE_KEY</code> and reload.</p>
        </div>
      </div>
    );
  }

  const effectiveSecret = clientSecret || lastGoodSecret.current;
  const maskedPk = pkFinal ? `${pkFinal.slice(0,6)}…${pkFinal.slice(-4)}` : '';
  const showDiag = !!error || new URLSearchParams(window.location.search).has('dev');

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-3">
        <button onClick={()=> navigate('/workspace?pane=dashboard')} className="text-sm text-slate-700 hover:text-slate-900 inline-flex items-center gap-1">
          <span aria-hidden>←</span> Return to workspace
        </button>
      </div>
      <div className="rounded-2xl border bg-white/80 backdrop-blur p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Add payment method</h1>
        <div className="text-slate-600 mt-1">Pay <span className="font-semibold">$97 today</span> to lock your Founding Member price at $97/month — or pay nothing today and get a <span className="font-semibold">7‑day free trial</span> locking in your Founding Member price of $147.</div>
        {error && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/60 text-rose-800 px-3 py-2 text-sm">{error}</div>
        )}
        {showDiag && (
          <div className="mt-2 text-[11px] text-slate-600">
            <div>Stripe publishable: {maskedPk || 'missing'}</div>
            <div>SetupIntent secret present: {effectiveSecret ? 'yes' : 'no'}</div>
          </div>
        )}
        <div className="mt-5">
          {loading || (!stripePromise && !(buyBtn147||buyBtn97)) ? (
            <div className="animate-pulse">
              <div className="h-10 w-full rounded-xl bg-slate-100" />
              <div className="h-10 w-full mt-3 rounded-xl bg-slate-100" />
              <div className="h-10 w-40 mt-4 rounded-xl bg-slate-100" />
            </div>
          ) : (
            <Elements key={effectiveSecret} stripe={stripePromise!} options={{ clientSecret: effectiveSecret, appearance: { theme: 'flat' } }}>
              <div className="grid gap-3">
                {/* Prefer Buy Buttons when configured; otherwise show PaymentElement */}
                {(buyBtn147 || buyBtn97) ? (
                  <div className="grid gap-3">
                    {buyBtn147 && (
                      // @ts-ignore - custom element provided by Stripe script
                      <stripe-buy-button buy-button-id={buyBtn147} publishable-key={(pkFinal || (billingCfg as any)?.publishable_key || '') as any}></stripe-buy-button>
                    )}
                    {buyBtn97 && (
                      // @ts-ignore - custom element provided by Stripe script
                      <stripe-buy-button buy-button-id={buyBtn97} publishable-key={(pkFinal || (billingCfg as any)?.publishable_key || '') as any}></stripe-buy-button>
                    )}
                  </div>
                ) : (
                  <PaymentElement options={{ layout: 'tabs' }} />
                )}
              </div>
            </Elements>
          )}
        </div>
        {!(buyBtn147 || buyBtn97) && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button onClick={async()=>{
            try { track('billing_start_subscription', { plan: '147_monthly' }); } catch {}
            try {
              const price_id = (billingCfg?.price_147 || (import.meta as any).env?.VITE_STRIPE_PRICE_147 || '').trim();
              const trial_days = Number((billingCfg?.trial_days ?? (import.meta as any).env?.VITE_STRIPE_TRIAL_DAYS) || '7');
              if (!price_id) { setError('Price 147 is not configured on the server.'); return; }
              const r = await api.post('/billing/create-checkout-session', { price_id, mode: 'subscription', trial_days });
              if (r?.url) window.location.href = r.url;
            } catch (e) {
              setError('Failed to start subscription.');
            }
          }}>Start subscription — $147/mo</Button>
          <Button variant="outline" onClick={async()=>{
            try { track('billing_start_founder', { plan: 'founder_97_monthly' }); } catch {}
            try {
              const price_id = (billingCfg?.price_97 || (import.meta as any).env?.VITE_STRIPE_PRICE_97 || '').trim();
              const trial_days = 0; // charge today for $97 plan
              if (!price_id) { setError('Price 97 is not configured on the server.'); return; }
              const r = await api.post('/billing/create-checkout-session', { price_id, mode: 'subscription', trial_days });
              if (r?.url) window.location.href = r.url;
            } catch (e) {
              setError('Failed to start $97/mo checkout.');
            }
          }}>Lock $97/mo (Founding Member)</Button>
          <Button variant="ghost" onClick={()=>{ try { track('billing_skip'); } catch {}; navigate('/workspace?pane=dashboard'); }}>Skip for now</Button>
        </div>
        )}
        <div className="mt-3 text-xs text-slate-500">Charges depend on your selection: $97 charges today; $147 starts a 7‑day free trial. You’ll be notified before any future charges.</div>
      </div>
    </div>
  );
}

// Legacy setup-intent form removed; we render PaymentElement read-only and use Checkout buttons


