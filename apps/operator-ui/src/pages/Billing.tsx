import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import Button from '../components/ui/Button';
import { track } from '../lib/analytics';
import { api } from '../lib/api';

export default function Billing(){
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [clientSecret, setClientSecret] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const publishableKey = (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY || (import.meta as any).env?.VITE_STRIPE_PK || '';
  const stripePromise = useMemo(() => publishableKey ? loadStripe(publishableKey) : null, [publishableKey]);

  useEffect(()=>{ try { track('billing_view'); } catch{} }, []);

  useEffect(()=>{
    let mounted = true;
    (async()=>{
      try {
        setLoading(true);
        const resp = await api.post('/billing/create-setup-intent', {});
        if (!mounted) return;
        setClientSecret(resp?.client_secret || '');
      } catch (e: any) {
        setError(e?.message || 'Failed to initialize billing.');
      } finally {
        setLoading(false);
      }
    })();
    return ()=>{ mounted = false; };
  },[]);

  const success = sp.get('success') === '1';

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

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-3">
        <button onClick={()=> navigate('/workspace?pane=dashboard')} className="text-sm text-slate-700 hover:text-slate-900 inline-flex items-center gap-1">
          <span aria-hidden>←</span> Return to workspace
        </button>
      </div>
      <div className="rounded-2xl border bg-white/80 backdrop-blur p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Add payment method</h1>
        <p className="text-slate-600 mt-1">Free trial starts now. Add a card to avoid interruptions later — optional today.</p>
        <div className="mt-2 text-xs text-slate-700">Choosing <span className="font-medium">$97 today</span> locks your <span className="font-medium">Founding Member</span> price at $97/month (recurring), not a one‑time payment.</div>
        {success && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 text-emerald-800 px-3 py-2 text-sm">Payment method saved.</div>
        )}
        {error && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/60 text-rose-800 px-3 py-2 text-sm">{error}</div>
        )}
        <div className="mt-5">
          {loading || !clientSecret || !stripePromise ? (
            <div className="animate-pulse">
              <div className="h-10 w-full rounded-xl bg-slate-100" />
              <div className="h-10 w-full mt-3 rounded-xl bg-slate-100" />
              <div className="h-10 w-40 mt-4 rounded-xl bg-slate-100" />
            </div>
          ) : (
            <Elements stripe={stripePromise!} options={{ clientSecret, appearance: { theme: 'flat' } }}>
              <PaymentSetupForm onSuccess={()=>{
                try { localStorage.setItem('bvx_billing_added','1'); } catch {}
                try { track('billing_submit', { method: 'setup_intent' }); } catch {}
                navigate('/workspace?pane=dashboard&billing=success', { replace: true });
              }} />
            </Elements>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button onClick={async()=>{
            try { track('billing_start_subscription', { plan: '147_monthly' }); } catch {}
            try {
              const r = await api.post('/billing/create-checkout-session', { price_id: (import.meta as any).env?.VITE_STRIPE_PRICE_147 || '', mode: 'subscription', trial_days: Number((import.meta as any).env?.VITE_STRIPE_TRIAL_DAYS || '7') });
              if (r?.url) window.location.href = r.url;
            } catch (e) {
              setError('Failed to start subscription.');
            }
          }}>Start subscription — $147/mo</Button>
          <Button variant="outline" onClick={async()=>{
            try { track('billing_start_founder', { plan: 'founder_97_monthly' }); } catch {}
            try {
              const r = await api.post('/billing/create-checkout-session', { price_id: (import.meta as any).env?.VITE_STRIPE_PRICE_97 || '', mode: 'subscription', trial_days: Number((import.meta as any).env?.VITE_STRIPE_TRIAL_DAYS || '7') });
              if (r?.url) window.location.href = r.url;
            } catch (e) {
              setError('Failed to start $97/mo checkout.');
            }
          }}>Lock $97/mo (Founding Member)</Button>
          <Button variant="ghost" onClick={()=>{ try { track('billing_skip'); } catch {}; navigate('/workspace?pane=dashboard'); }}>Skip for now</Button>
        </div>
        <div className="mt-3 text-xs text-slate-500">We charge nothing today. You’ll be notified before any charges after your trial.</div>
      </div>
    </div>
  );
}

function PaymentSetupForm({ onSuccess }: { onSuccess: () => void }){
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setMessage('');
    try {
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/billing?success=1`,
        },
        redirect: 'if_required',
      });
      if (result.error) {
        setMessage(result.error.message || 'Could not save payment method.');
        try { track('billing_submit', { ok: false, code: result.error.type }); } catch {}
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setMessage(err?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {message && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/60 text-rose-800 px-3 py-2 text-sm">{message}</div>
      )}
      <Button type="submit" disabled={!stripe || submitting} className="rounded-full">
        {submitting ? 'Saving…' : 'Save payment'}
      </Button>
    </form>
  );
}


