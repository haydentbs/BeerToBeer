import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function isSupabaseConfigured() {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      !supabaseUrl.includes('<project-ref>') &&
      !supabaseAnonKey.includes('<')
  )
}

export function getSupabaseConfigError() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return 'Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env file to enable authentication.'
  }

  if (supabaseUrl.includes('<project-ref>') || supabaseAnonKey.includes('<')) {
    return 'Replace the placeholder Supabase environment values in .env before testing authentication.'
  }

  return null
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(getSupabaseConfigError() ?? 'Supabase is not configured.')
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }

  return browserClient
}

export function getAuthRedirectUrl() {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.location.origin
}
