import { createClient } from '@supabase/supabase-js'
// Ensure a single Supabase client across all code-split chunks.
// Some pages dynamically import modules that also import this file; without a
// guard, multiple clients can be created which leads to repeated auth events
// and "Multiple GoTrueClient instances" warnings.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const existing = (typeof globalThis !== 'undefined' && (globalThis as any).__bvxSupabase) as any

// Declare client variable that will be assigned in the conditional blocks
let client: any

// Guard: only create Supabase client if credentials exist
if (!url || !anon) {
  // In development, throw clear error for debugging
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    throw new Error(`Missing Supabase credentials: URL=${!!url}, ANON=${!!anon}. Check your environment variables.`);
  }

  // For static/landing builds, return a stub that mirrors expected methods
  const noop = () => {};
  const resolved = (data: any = null, error: any = null) => Promise.resolve({ data, error });
  const stubSubscription = { unsubscribe: noop };
  const stubAuth = {
    getSession: () => resolved({ session: null }, null),
    onAuthStateChange: (_cb?: any) => ({ data: { subscription: stubSubscription }, error: null }),
    getUser: () => resolved({ user: null }, null),
    setSession: () => resolved({ user: null, session: null }, null),
    exchangeCodeForSession: () => resolved({ user: null, session: null }, null),
    resetPasswordForEmail: () => resolved({}, null),
    signInWithOAuth: () => resolved({ user: null, session: null, url: undefined }, null),
    resend: () => resolved({}, null),
    signOut: () => resolved(null, null),
    signInWithPassword: () => resolved({ user: null, session: null }, { message: 'Supabase client not initialized - missing credentials' }),
    signUp: () => resolved({ user: null, session: null }, { message: 'Supabase client not initialized - missing credentials' }),
  } as any;

  const stubClient = {
    auth: stubAuth,
    from: () => ({
      select: () => ({ eq: () => ({ single: () => resolved(null, null) }) }),
      insert: () => ({ select: () => resolved(null, null) }),
      update: () => ({ eq: () => ({ select: () => resolved(null, null) }) }),
      delete: () => ({ eq: () => resolved(null, null) }),
    }),
  } as any;

  client = stubClient;
} else {
  client = existing || createClient(
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


