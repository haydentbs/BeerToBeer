import type { NextRequest } from 'next/server'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { type AppSession } from '@/lib/auth'
import { buildDevSupabaseUser, DEV_AUTH_COOKIE, getDevAuthIdentity, isDevAuthEnabled } from '@/lib/dev-auth'
import { getServiceRoleClient } from '@/lib/server/supabase'

export interface AuthenticatedActor {
  kind: 'authenticated'
  authUser: SupabaseUser
  accessToken: string
}

export interface GuestActor {
  kind: 'guest'
  session: AppSession
}

export interface AnonymousActor {
  kind: 'anonymous'
}

export type RequestActor = AuthenticatedActor | GuestActor | AnonymousActor

function buildAuthUserFromClaims(claims: Record<string, any>): SupabaseUser | null {
  if (typeof claims.sub !== 'string' || !claims.sub) {
    return null
  }

  const aud =
    typeof claims.aud === 'string'
      ? claims.aud
      : Array.isArray(claims.aud) && typeof claims.aud[0] === 'string'
      ? claims.aud[0]
      : 'authenticated'

  return {
    id: claims.sub,
    aud,
    role: typeof claims.role === 'string' ? claims.role : 'authenticated',
    email: typeof claims.email === 'string' ? claims.email : undefined,
    app_metadata:
      claims.app_metadata && typeof claims.app_metadata === 'object' && !Array.isArray(claims.app_metadata)
        ? claims.app_metadata
        : {},
    user_metadata:
      claims.user_metadata && typeof claims.user_metadata === 'object' && !Array.isArray(claims.user_metadata)
        ? claims.user_metadata
        : {},
    identities: [],
    created_at: typeof claims.created_at === 'string' ? claims.created_at : new Date(0).toISOString(),
  } as unknown as SupabaseUser
}

export async function resolveRequestActor(request: NextRequest): Promise<RequestActor> {
  const authHeader = request.headers.get('authorization')

  if (authHeader?.startsWith('Bearer ')) {
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim()

    if (accessToken) {
      const supabase = getServiceRoleClient()
      const { data } = await supabase.auth.getClaims(accessToken)
      const user = data?.claims ? buildAuthUserFromClaims(data.claims as Record<string, any>) : null

      if (user) {
        return {
          kind: 'authenticated',
          authUser: user,
          accessToken,
        }
      }
    }
  }

  if (isDevAuthEnabled()) {
    const devAuthCookie = request.cookies.get(DEV_AUTH_COOKIE)?.value
    const devIdentity = getDevAuthIdentity(devAuthCookie ? decodeURIComponent(devAuthCookie) : null)

    if (devIdentity) {
      return {
        kind: 'authenticated',
        authUser: buildDevSupabaseUser(devIdentity),
        accessToken: `dev:${devIdentity.id}`,
      }
    }
  }

  const guestCookie = request.cookies.get('settleup_guest_session')?.value
  if (guestCookie) {
    try {
      const session = JSON.parse(decodeURIComponent(guestCookie)) as AppSession
      if (session?.isGuest && session.user?.name) {
        return {
          kind: 'guest',
          session,
        }
      }
    } catch {
      return { kind: 'anonymous' }
    }
  }

  return { kind: 'anonymous' }
}
