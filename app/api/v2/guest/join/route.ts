import { NextResponse } from 'next/server'
import { runGuestJoinCommand } from '@/lib/server/v2/repository'
import { jsonError } from '@/lib/server/v2/route-helpers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = await runGuestJoinCommand(body.name, body.crewCode, { matchId: body.matchId })
    const response = NextResponse.json(payload)

    if (payload.session) {
      response.cookies.set(
        'settleup_guest_session',
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
  } catch (error) {
    return jsonError(error)
  }
}
