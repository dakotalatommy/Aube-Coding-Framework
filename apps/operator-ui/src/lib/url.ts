export function getQueryParam(name: string, search?: string): string | null {
  try {
    const sp = new URLSearchParams(typeof search === 'string' ? search : (typeof window !== 'undefined' ? window.location.search : ''));
    return sp.get(name);
  } catch {
    return null;
  }
}

export function setQueryParams(params: Record<string, string | number | boolean | null | undefined>, options?: { replace?: boolean; pathname?: string }) {
  try {
    const current = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') current.delete(k);
      else current.set(k, String(v));
    });
    const path = options?.pathname || (typeof window !== 'undefined' ? window.location.pathname : '/');
    const next = `${path}?${current.toString()}`;
    if (options?.replace) {
      window.history.replaceState({}, '', next);
    } else {
      window.history.pushState({}, '', next);
    }
  } catch {}
}

export function syncParamToState(key: string, value: string | number | null | undefined, replace: boolean = true) {
  setQueryParams({ [key]: value ?? '' }, { replace });
}

export function readNumberParam(name: string, fallback: number, search?: string): number {
  try {
    const s = getQueryParam(name, search);
    const n = parseInt(String(s || ''), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}


