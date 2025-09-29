import { createClient } from '@supabase/supabase-js'
// Ensure a single Supabase client across all code-split chunks.
// Some pages dynamically import modules that also import this file; without a
// guard, multiple clients can be created which leads to repeated auth events
// and "Multiple GoTrueClient instances" warnings.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const existing = (typeof globalThis !== 'undefined' && (globalThis as any).__bvxSupabase) as any
const client = existing || createClient(
  url || '',
  anon || '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

if (typeof window !== 'undefined') {
  try { (window as any).__bvxSupabase = client } catch {}
  try { (window as any).supabase = client } catch {}
}

export const supabase = client


