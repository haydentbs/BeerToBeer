import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { AppSession } from '@/lib/auth'
import { getInitials } from '@/lib/utils'

export const DEV_AUTH_COOKIE = 'settleup_dev_auth_session'

export interface DevAuthIdentity {
  id: string
  label: string
  email: string
  name: string
  avatar?: string
}

export const DEV_AUTH_IDENTITIES: DevAuthIdentity[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    label: 'Alex Dev',
    email: 'alex.dev@settleup.local',
    name: 'Alex Dev',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    label: 'Riley Dev',
    email: 'riley.dev@settleup.local',
    name: 'Riley Dev',
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    label: 'Jordan Dev',
    email: 'jordan.dev@settleup.local',
    name: 'Jordan Dev',
  },
]

export function isDevAuthEnabled() {
  return process.env.NODE_ENV !== 'production'
}

export function getDevAuthIdentity(identityId: string | null | undefined) {
  if (!identityId) {
    return null
  }

  return DEV_AUTH_IDENTITIES.find((identity) => identity.id === identityId) ?? null
}

export function buildDevAuthenticatedSession(identity: DevAuthIdentity): AppSession {
  return {
    authUserId: identity.id,
    email: identity.email,
    provider: 'dev',
    user: {
      id: identity.id,
      name: identity.name,
      avatar: identity.avatar ?? '',
      initials: getInitials(identity.name),
    },
  }
}

export function buildDevSupabaseUser(identity: DevAuthIdentity): SupabaseUser {
  return {
    id: identity.id,
    email: identity.email,
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date(0).toISOString(),
    app_metadata: {
      provider: 'dev',
    },
    user_metadata: {
      full_name: identity.name,
      name: identity.name,
      avatar_url: identity.avatar ?? '',
    },
    identities: [],
  } as SupabaseUser
}

export function writeDevAuthCookie(identity: DevAuthIdentity) {
  if (typeof document === 'undefined' || !isDevAuthEnabled()) {
    return
  }

  document.cookie = `${DEV_AUTH_COOKIE}=${encodeURIComponent(identity.id)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
}

export function readDevAuthCookie() {
  if (typeof document === 'undefined' || !isDevAuthEnabled()) {
    return null
  }

  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${DEV_AUTH_COOKIE}=`))

  if (!cookie) {
    return null
  }

  const identityId = decodeURIComponent(cookie.slice(`${DEV_AUTH_COOKIE}=`.length))
  return getDevAuthIdentity(identityId)
}

export function clearDevAuthCookie() {
  if (typeof document === 'undefined') {
    return
  }

  document.cookie = `${DEV_AUTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

