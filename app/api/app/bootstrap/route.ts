import { NextResponse } from 'next/server'
import { loadAppState } from '@/lib/server/repository'
import { resolveRequestActor } from '@/lib/server/session'

export async function GET(request: Request) {
  const actor = await resolveRequestActor(request as any)
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode')
  const activeCrewId = searchParams.get('activeCrewId')

  const payload = await loadAppState(actor, {
    mode: mode === 'crew' ? 'crew' : 'full',
    activeCrewId,
  })
  return NextResponse.json(payload)
}
