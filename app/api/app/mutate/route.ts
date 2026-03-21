import { NextResponse } from 'next/server'
import { joinCrewAsGuest, mutateAppState } from '@/lib/server/repository'
import { resolveRequestActor } from '@/lib/server/session'

export async function POST(request: Request) {
  try {
    const actor = await resolveRequestActor(request as any)
    const body = await request.json()

    if (body.action === 'guestJoin') {
      const payload = await joinCrewAsGuest(body.payload.name, body.payload.crewCode)
      const response = NextResponse.json(payload)

      if (payload.session) {
        response.cookies.set(
          'beerscore_guest_session',
          JSON.stringify(payload.session),
          {
            path: '/',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30,
            httpOnly: false,
          }
        )
      }

      return response
    }

    const payload = await mutateAppState(actor, body.action, body.payload ?? {})
    return NextResponse.json(payload)
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : 'Unexpected error', {
      status: 500,
    })
  }
}
