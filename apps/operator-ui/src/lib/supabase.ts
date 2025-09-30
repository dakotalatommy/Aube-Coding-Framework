import { createClient } from '@supabase/supabase-js'
// Ensure a single Supabase client across all code-split chunks.
// Some pages dynamically import modules that also import this file; without a
// guard, multiple clients can be created which leads to repeated auth events
// and "Multiple GoTrueClient instances" warnings.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const existing = (typeof globalThis !== 'undefined' && (globalThis as any).__bvxSupabase) as any

// Guard: only create Supabase client if credentials exist
if (!url || !anon) {
  // In development, throw clear error for debugging
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    throw new Error(`Missing Supabase credentials: URL=${!!url}, ANON=${!!anon}. Check your environment variables.`);
  }

  // For static/landing builds, return a minimal stub that doesn't break
  const stubClient = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Supabase client not initialized - missing credentials' } }),
      signUp: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Supabase client not initialized - missing credentials' } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      insert: () => ({ select: () => Promise.resolve({ data: null, error: null }) }),
      update: () => ({ eq: () => ({ select: () => Promise.resolve({ data: null, error: null }) }) }),
      delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    }),
  } as any;

  const client = stubClient;
} else {
  const client = existing || createClient(
    url,
    anon,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  )
}

if (typeof window !== 'undefined') {
  try { (window as any).__bvxSupabase = client } catch {}
  try { (window as any).supabase = client } catch {}
}

export const supabase = client


