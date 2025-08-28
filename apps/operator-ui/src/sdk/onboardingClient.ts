import { api } from '../lib/api';

export async function saveStep(step: string, data: Record<string, unknown>): Promise<void> {
  // Write-through: optimistic local cache for smoother UX
  try {
    const key = 'bvxo:' + step;
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    const merged = { ...existing, ...(data || {}) };
    localStorage.setItem(key, JSON.stringify(merged));
  } catch {}
  await api.post('/api/onboarding/save', { step, data: data || {} });
}

export async function loadLocalSnapshot(): Promise<Record<string, unknown>> {
  const steps = ['welcome','voice','basics','ops','connections','social','goals','styles','review'];
  const data: Record<string, unknown> = {};
  try {
    for (const s of steps) {
      const v = localStorage.getItem('bvxo:' + s);
      if (v) data[s] = JSON.parse(v);
    }
  } catch {}
  return data;
}


