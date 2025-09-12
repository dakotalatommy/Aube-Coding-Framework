export function isFeatureEnabled(key: string, defaultOn: boolean = true): boolean {
  try {
    // Local override takes precedence
    const ls = localStorage.getItem(`bvx_flag_${key}`);
    if (ls === '1') return true;
    if (ls === '0') return false;
  } catch {}
  try {
    // Env-based toggle (VITE_FLAG_<KEY>)
    const env = (import.meta as any).env || {};
    const v = env[`VITE_FLAG_${key.toUpperCase()}`];
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {}
  return !!defaultOn;
}

export const flags = {
  showcase: () => isFeatureEnabled('showcase', true),
  vision_dnd: () => isFeatureEnabled('vision_dnd', true),
  tour_resume_chip: () => isFeatureEnabled('tour_resume_chip', true),
};


