function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getSupabaseProjectUrl() {
  return getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL')
}

export function getSupabaseAnonKey() {
  return getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export function getSupabaseServiceRoleKey() {
  return getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
}

export function isServerSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}
