import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { API_BASE } from '../lib/api';
import { supabase } from '../lib/supabase';

type ShareData = {
  title: string;
  description: string;
  image_url?: string;
  caption?: string;
  kind?: string;
  metrics?: {
    time_saved_minutes?: number;
    time_saved_hours?: number;
    messages_sent?: number;
  };
};

export default function Share() {
  const { token } = useParams();
  const qs = new URLSearchParams(useLocation().search);
  const ref = qs.get('ref') || '';
  const [data, setData] = useState<ShareData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Get Supabase session for authentication
        const session = (await supabase.auth.getSession()).data.session;
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        const r = await fetch(`${API_BASE}/share/${token}`, { headers });
        if (!r.ok) throw new Error(`${r.status}`);
        const j = await r.json();
        if (!cancelled) setData(j);
      } catch (e: any) {
        if (!cancelled) setErr('not_found');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (err) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-semibold">Link not found</h1>
        <p className="text-slate-600 mt-2">This share link may have expired or is invalid.</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="h-8 w-48 bg-slate-100 rounded mb-4" />
        <div className="h-5 w-96 bg-slate-100 rounded mb-2" />
        <div className="h-24 w-full bg-slate-100 rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
      {data.description && <p className="text-slate-700 mt-2">{data.description}</p>}
      {data.image_url && (
        <img src={data.image_url} alt="share" className="mt-4 rounded-lg shadow" />
      )}
      {data.metrics && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border p-4">
            <div className="text-sm text-slate-500">Time Saved</div>
            <div className="text-2xl font-semibold">{data.metrics.time_saved_hours ?? 0}h</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-sm text-slate-500">Minutes</div>
            <div className="text-2xl font-semibold">{data.metrics.time_saved_minutes ?? 0}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-sm text-slate-500">Messages Sent</div>
            <div className="text-2xl font-semibold">{data.metrics.messages_sent ?? 0}</div>
          </div>
        </div>
      )}
      <div className="mt-8">
        <a
          href={`/signup${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-black text-white hover:bg-slate-800"
        >
          Start free trial
        </a>
      </div>
    </div>
  );
}
