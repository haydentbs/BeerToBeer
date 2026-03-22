import type { User as SupabaseUser } from '@supabase/supabase-js'
import { type User } from '@/lib/store'
import { getInitials } from '@/lib/utils'

const GUEST_SESSION_COOKIE = 'settleup_guest_session'

export interface AppSession {
  authUserId?: string
  email?: string
  provider?: string | null
  isGuest?: boolean
  guestIdentityId?: string
  membershipId?: string
  user: User
}

export function buildAppSession(authUser: SupabaseUser): AppSession {
  const name = getDisplayName(authUser)

  return {
    authUserId: authUser.id,
    email: authUser.email ?? '',
    provider: typeof authUser.app_metadata.provider === 'string' ? authUser.app_metadata.provider : null,
    user: {
      id: authUser.id,
      name,
      avatar: typeof authUser.user_metadata.avatar_url === 'string' ? authUser.user_metadata.avatar_url : '',
      initials: getInitials(name),
    },
  }
}

export function buildGuestSession(name: string): AppSession {
  const cleanName = name.trim()

  return {
    provider: 'guest',
    isGuest: true,
    user: {
      id: `guest-${cleanName.toLowerCase().replace(/\s+/g, '-')}`,
      name: cleanName,
      avatar: '',
      initials: getInitials(cleanName),
    },
  }
}

export function writeGuestSessionCookie(session: AppSession) {
  if (typeof document === 'undefined') {
    return
  }

  const payload = encodeURIComponent(JSON.stringify(session))
  document.cookie = `${GUEST_SESSION_COOKIE}=${payload}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
}

export function readGuestSessionCookie() {
  if (typeof document === 'undefined') {
    return null
  }

  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${GUEST_SESSION_COOKIE}=`))

  if (!cookie) {
    return null
  }

  const value = cookie.slice(`${GUEST_SESSION_COOKIE}=`.length)

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as AppSession

    if (!parsed?.isGuest || !parsed.user?.name) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function clearGuestSessionCookie() {
  if (typeof document === 'undefined') {
    return
  }

  document.cookie = `${GUEST_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

function getDisplayName(authUser: SupabaseUser) {
  const metadataName =
    authUser.user_metadata.full_name ??
    authUser.user_metadata.name ??
    authUser.user_metadata.user_name ??
    authUser.user_metadata.preferred_username

  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName.trim()
  }

  if (authUser.email) {
    return authUser.email.split('@')[0]
  }

  return 'Player'
}

