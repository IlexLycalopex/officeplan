import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in your project credentials.',
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Use PKCE so the server sends ?code= in the query string rather than
    // #access_token= in the hash. The query string is reliably preserved
    // through the GitHub Pages 404→index SPA routing redirect, whereas
    // the hash can be lost or trigger browser bounce-tracking mitigations.
    flowType: 'pkce',
  },
})
