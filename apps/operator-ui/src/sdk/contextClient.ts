import { api } from '../lib/api';

export async function getPageContext(stepId: string): Promise<{ pageHints: string[]; safeExamples: string[] }>{
  const q = encodeURIComponent(stepId || 'welcome');
  return await api.get(`/api/onboarding/context?scope=onboarding&step=${q}`);
}

export async function askAssistant(stepId: string, input: string): Promise<{ text: string }>{
  return await api.post('/api/assist', { page: stepId, input });
}


