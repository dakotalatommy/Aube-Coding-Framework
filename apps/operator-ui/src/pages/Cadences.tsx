import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, getTenant } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import * as Sentry from '@sentry/react';
import Button from '../components/ui/Button';
import { startGuide } from '../lib/guide';
import Skeleton from '../components/ui/Skeleton';
import { Table, THead, TR, TH, TD } from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';

const SEGMENTS: Array<{ id: string; label: string; scope: string; template: string; description: string }> = [
  { id: 'tomorrow', label: 'Tomorrow', scope: 'tomorrow', template: 'reminder_tomorrow', description: 'Clients with visits tomorrow.' },
  { id: 'this_week', label: 'This Week', scope: 'this_week', template: 'reminder_week', description: 'Upcoming appointments later this week.' },
  { id: 'reengage_30d', label: '30 Day', scope: 'reengage_30d', template: 'reengage_30d', description: 'Guests who have not visited in ~30 days.' },
  { id: 'winback_45d', label: '45+ Day', scope: 'winback_45d', template: 'winback_45d', description: 'Guests away for 45+ days.' },
];

const TEMPLATE_OPTIONS: Record<string, { label: string; description: string; cadenceId: string }> = {
  reminder_tomorrow: {
    label: 'Reminder — tomorrow',
    description: 'Friendly confirmation for tomorrow’s appointments with an easy reply CTA.',
    cadenceId: 'reminder',
  },
  reminder_week: {
    label: 'Reminder — this week',
    description: 'Check-in for clients visiting later this week. Offer to adjust the time if needed.',
    cadenceId: 'reminder_week',
  },
  reengage_30d: {
    label: 'Re-engage 30 day',
    description: 'Invite warm guests back around the one-month mark with a helpful prompt.',
    cadenceId: 'reengage_30d',
  },
  winback_45d: {
    label: 'Win-back 45+ day',
    description: 'Encourage long-lapsed guests with a value-forward note and scheduling help.',
    cadenceId: 'winback_45d_plus',
  },
};

export default function Cadences(){
  const loc = useLocation();
  const isDemo = new URLSearchParams(loc.search).get('demo') === '1';
  const { toastSuccess, toastError } = useToast();

  const [tab, setTab] = useState<'actions'|'queue'>('actions');
  const [queue, setQueue] = useState<any>({ items: [] });

  const [activeSegmentId, setActiveSegmentId] = useState<string>(SEGMENTS[0].id);
  const activeSegment = useMemo(() => SEGMENTS.find(s => s.id === activeSegmentId) || SEGMENTS[0], [activeSegmentId]);
  const [segmentLoading, setSegmentLoading] = useState<boolean>(false);
  const [segmentCandidates, setSegmentCandidates] = useState<any[]>([]);

  const [selectedTemplate, setSelectedTemplate] = useState<string>(SEGMENTS[0].template);
  const [draftStatus, setDraftStatus] = useState<'idle'|'generating'|'ready'|'error'|'empty'>('idle');
  const [draftMarkdown, setDraftMarkdown] = useState<string>('');
  const [draftTodoId, setDraftTodoId] = useState<number | null>(null);
  const [draftDownloadUrl, setDraftDownloadUrl] = useState<string>('');
  const [draftError, setDraftError] = useState<string>('');
  const [status, setStatus] = useState('');
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const pollRef = useRef<number | null>(null);

  const clearDraft = React.useCallback(() => {
    setDraftStatus('idle');
    setDraftMarkdown('');
    setDraftTodoId(null);
    setDraftError('');
    setStatus('');
    if (draftDownloadUrl) {
      try { URL.revokeObjectURL(draftDownloadUrl); } catch {}
    }
    setDraftDownloadUrl('');
  }, [draftDownloadUrl]);

  const stopPolling = React.useCallback(() => {
    if (pollRef.current) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadQueue = React.useCallback(async () => {
    try{
      if (isDemo) { setQueue({ items: [] }); return; }
      const tid = await getTenant();
      const r = await api.get(`/cadences/queue?tenant_id=${encodeURIComponent(tid)}`);
      setQueue(r || { items: [] });
    } catch { setQueue({ items: [] }); }
  }, [isDemo]);

  const loadSegmentCandidates = React.useCallback(async (segmentId: string) => {
    const segment = SEGMENTS.find(s => s.id === segmentId) || SEGMENTS[0];
    if (isDemo) { setSegmentCandidates([]); setSelectedTemplate(segment.template); return; }
    setSegmentLoading(true);
    try {
      const tid = await getTenant();
      const res = await api.get(`/followups/candidates?tenant_id=${encodeURIComponent(tid)}&scope=${encodeURIComponent(segment.scope)}`);
      const items = Array.isArray(res?.items) ? res.items : [];
      setSegmentCandidates(items);
      setSelectedTemplate(segment.template);
    } catch (err) {
      console.error('followups candidates failed', err);
      setSegmentCandidates([]);
    } finally {
      setSegmentLoading(false);
    }
  }, [isDemo]);

  const pollDraftStatus = React.useCallback(async () => {
    try {
      const tid = await getTenant();
      const res = await api.get(`/followups/draft_status?tenant_id=${encodeURIComponent(tid)}`);
      setStatus(JSON.stringify(res || {}));
      const statusValue = String(res?.status || 'pending');
      if (statusValue === 'ready') {
        stopPolling();
        const markdown = String(res?.details?.draft_markdown || '');
        setDraftStatus('ready');
        setDraftMarkdown(markdown);
        setDraftTodoId(Number(res?.todo_id || draftTodoId));
        if (markdown) {
          try {
            const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            setDraftDownloadUrl(url);
          } catch {}
        }
      } else if (statusValue === 'error') {
        stopPolling();
        setDraftStatus('error');
        setDraftError(String(res?.details?.error || 'Unable to generate draft'));
      } else {
        setDraftStatus('generating');
        pollRef.current = window.setTimeout(pollDraftStatus, 3200) as unknown as number;
      }
    } catch (err) {
      console.error('followups draft status failed', err);
      pollRef.current = window.setTimeout(pollDraftStatus, 4500) as unknown as number;
    }
  }, [draftTodoId, stopPolling]);

  const startDraft = React.useCallback(async () => {
    if (isDemo) return;
    stopPolling();
    clearDraft();
    setDraftStatus('generating');
    try {
      const tid = await getTenant();
      const segment = SEGMENTS.find(s => s.id === activeSegmentId) || SEGMENTS[0];
      const payload = { tenant_id: tid, scope: segment.scope, template_id: selectedTemplate };
      const res = await api.post('/followups/draft_batch', payload);
      setStatus(JSON.stringify(res || {}));
      if (res?.status === 'empty') {
        setDraftStatus('empty');
        toastError('No clients found', 'Pick a different segment to draft follow-ups.');
        return;
      }
      if (res?.status === 'error') {
        setDraftStatus('error');
        setDraftError(String(res?.detail || 'Unable to create draft'));
        toastError('Draft failed', res?.detail || 'AI was unable to create a draft. Please try again.');
        return;
      }
      if (res?.status === 'ready') {
        const markdown = String(res?.draft_markdown || '');
        setDraftStatus('ready');
        setDraftMarkdown(markdown);
        setDraftTodoId(Number(res?.todo_id || 0));
        if (markdown) {
          try {
            const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            setDraftDownloadUrl(url);
          } catch {}
        }
        toastSuccess('Draft ready', `Generated ${res?.count ?? segmentCandidates.length} follow-up(s).`);
      } else {
        setDraftTodoId(Number(res?.todo_id || 0));
        pollRef.current = window.setTimeout(pollDraftStatus, 2500) as unknown as number;
      }
      trackEvent('cadences.followups.draft_batch', { segment: activeSegmentId, status: res?.status || 'pending', count: res?.count || segmentCandidates.length });
      Sentry.addBreadcrumb({ category: 'cadences', level: 'info', message: 'draft_batch', data: { segment: activeSegmentId, template: selectedTemplate, status: res?.status } });
    } catch (err: any) {
      console.error('draft_batch failed', err);
      setDraftStatus('error');
      setDraftError(String(err?.message || err));
      toastError('Draft failed', String(err?.message || err));
    }
  }, [activeSegmentId, clearDraft, isDemo, pollDraftStatus, segmentCandidates.length, selectedTemplate, stopPolling, toastError, toastSuccess]);

  const approveDraft = React.useCallback(async () => {
    if (!draftTodoId || isDemo) return;
    setIsApproving(true);
    try {
      const tid = await getTenant();
      await api.post('/todo/ack', { tenant_id: tid, id: draftTodoId });
      const templateMeta = TEMPLATE_OPTIONS[selectedTemplate];
      if (templateMeta && segmentCandidates.length > 0) {
        try {
          await api.post('/followups/enqueue', {
            tenant_id: tid,
            contact_ids: segmentCandidates.map((c:any)=> c.contact_id),
            cadence_id: templateMeta.cadenceId,
          });
        } catch (enqueueErr) {
          console.warn('followups enqueue failed', enqueueErr);
        }
      }
      toastSuccess('Draft approved', 'Saved to To-Do and queued the follow-ups.');
      clearDraft();
      loadQueue();
      await loadSegmentCandidates(activeSegmentId);
    } catch (err: any) {
      console.error('approve draft failed', err);
      toastError('Could not approve', String(err?.message || err));
    } finally {
      setIsApproving(false);
    }
  }, [activeSegmentId, clearDraft, draftTodoId, isDemo, loadQueue, loadSegmentCandidates, segmentCandidates, selectedTemplate, toastError, toastSuccess]);

  useEffect(() => {
    return () => {
      stopPolling();
      if (draftDownloadUrl) {
        try { URL.revokeObjectURL(draftDownloadUrl); } catch {}
      }
    };
  }, [draftDownloadUrl]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    loadSegmentCandidates(activeSegmentId);
  }, [activeSegmentId, loadSegmentCandidates]);

  useEffect(() => {
    stopPolling();
    clearDraft();
  }, [activeSegmentId, clearDraft, stopPolling]);

  // Auto-run guide on deep-link removed; tour now runs only when onboardingDone && !guideDone
  React.useEffect(()=>{
    try{ const sp = new URLSearchParams(window.location.search); if (sp.get('tour')==='1') startGuide('cadences'); } catch {}
  },[]);

  const templateOptions = useMemo(() => Object.entries(TEMPLATE_OPTIONS), []);

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h3 className="text-lg font-semibold">Follow‑ups</h3>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={()=> startGuide('cadences')}>Guide me</Button>
          <Button variant="outline" size="sm" onClick={()=>{ window.location.href='/ask'; }}>AskVX</Button>
        </div>
      </div>
      <div className="grid gap-4">
        <div className="flex items-center gap-2">
          <button className={`px-3 py-1 rounded-full border text-sm ${tab==='actions'?'bg-white border-pink-200 text-slate-900':'bg-white border-slate-200 text-slate-600'}`} onClick={()=>setTab('actions')}>Actions</button>
          <button className={`px-3 py-1 rounded-full border text-sm ${tab==='queue'?'bg-white border-pink-200 text-slate-900':'bg-white border-slate-200 text-slate-600'}`} onClick={()=>setTab('queue')}>Queue{Array.isArray(queue.items)&&queue.items.length>0?` (${queue.items.length})`:''}</button>
        </div>
        {tab==='actions' && (
        <section className="border rounded-xl p-3 bg-white shadow-sm" aria-labelledby="followup-builder">
          <div className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">Drafts are saved as To‑Dos for approval before sending.</div>
          <div id="followup-builder" className="font-semibold mb-3">Batch follow‑ups</div>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold">1. Choose segment</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {SEGMENTS.map(segment => {
                  const active = segment.id === activeSegmentId;
                  return (
                    <button
                      key={segment.id}
                      className={`px-3 py-1.5 rounded-full border text-sm transition ${active ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}
                      onClick={() => setActiveSegmentId(segment.id)}
                    >{segment.label}</button>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                {activeSegment.description}
                {segmentLoading ? (
                  <Skeleton className="h-4 w-28 mt-2" />
                ) : (
                  <span className="ml-1 text-slate-500">• {segmentCandidates.length} client{segmentCandidates.length === 1 ? '' : 's'} queued</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold">2. Select template</div>
              <select
                value={selectedTemplate}
                onChange={(e)=> setSelectedTemplate(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {templateOptions.map(([value, meta]) => (
                  <option key={value} value={value}>{meta.label}</option>
                ))}
              </select>
              <div className="mt-1 text-xs text-slate-500">{TEMPLATE_OPTIONS[selectedTemplate]?.description}</div>
            </div>
            <div>
              <div className="text-sm font-semibold">3. Draft messages</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={segmentCandidates.length === 0 || draftStatus === 'generating'}
                  onClick={startDraft}
                >{draftStatus === 'generating' ? 'Drafting…' : 'Draft follow-ups'}</Button>
                <span className="text-xs text-slate-500">Creates a single strategy document for review.</span>
              </div>
            </div>
            {draftStatus === 'generating' && (
              <div className="space-y-2">
                <Skeleton className="h-4" />
                <Skeleton className="h-32" />
              </div>
            )}
            {draftStatus === 'ready' && (
              <div className="border rounded-lg bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Preview</div>
                  <div className="flex items-center gap-2">
                    {draftDownloadUrl && (
                      <a
                        href={draftDownloadUrl}
                        download={`followups_${activeSegmentId}_${new Date().toISOString().slice(0,10)}.md`}
                        className="text-xs text-slate-600 underline"
                      >Download Markdown</a>
                    )}
                    <Button size="sm" variant="outline" disabled={isApproving} onClick={approveDraft}>{isApproving ? 'Saving…' : 'Approve & queue'}</Button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={draftMarkdown}
                  className="mt-2 h-56 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-700"
                />
              </div>
            )}
            {draftStatus === 'error' && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{draftError || 'Unable to generate follow-ups right now.'}</div>
            )}
            {draftStatus === 'empty' && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">No clients matched this segment. Try a different range.</div>
            )}
            {status && <pre className="text-xs text-slate-500 whitespace-pre-wrap break-words">{status}</pre>}
          </div>
        </section>
        )}

        {tab==='queue' && (
        <section className="border rounded-xl p-3 bg-white shadow-sm" aria-labelledby="cadence-queue">
          <div id="cadence-queue" className="font-semibold mb-2">Follow‑up queue</div>
          <Table>
            <THead>
              <TR><TH>Done</TH><TH>Contact</TH><TH>Type</TH><TH>Next Action</TH></TR>
            </THead>
            <tbody className="divide-y">
              {(queue.items||[]).map((r:any,i:number)=> (
                <TR key={i}>
                  <TD>
                    <input type="checkbox" aria-label="Mark done" onChange={()=> setQueue((q:any)=> ({ items: (q.items||[]).filter((_:any,idx:number)=> idx!==i) }))} />
                  </TD>
                  <TD>{r.contact_id}</TD>
                  <TD>{r.cadence_id||'reminder'}</TD>
                  <TD>{r.next_action_at}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>
        )}
      </div>
      <pre className="whitespace-pre-wrap text-sm text-slate-700">{status || 'No recent actions.'}</pre>
    </div>
  );
}
