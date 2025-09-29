import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const client = createClient(
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
  try {
    ;(window as any).supabase = client
  } catch {
    /* no-op */
  }
}

export const supabase = client


