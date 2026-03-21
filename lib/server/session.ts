import type { NextRequest } from 'next/server'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { type AppSession } from '@/lib/auth'
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

export async function resolveRequestActor(request: NextRequest): Promise<RequestActor> {
  const authHeader = request.headers.get('authorization')

  if (authHeader?.startsWith('Bearer ')) {
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim()

    if (accessToken) {
      const supabase = getServiceRoleClient()
      const {
        data: { user },
      } = await supabase.auth.getUser(accessToken)

      if (user) {
        return {
          kind: 'authenticated',
          authUser: user,
          accessToken,
        }
      }
    }
  }

  const guestCookie = request.cookies.get('beerscore_guest_session')?.value
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
