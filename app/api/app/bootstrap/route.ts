import { NextResponse } from 'next/server'
import { loadAppState } from '@/lib/server/repository'
import { resolveRequestActor } from '@/lib/server/session'

export async function GET(request: Request) {
  const actor = await resolveRequestActor(request as any)
  const payload = await loadAppState(actor)
  return NextResponse.json(payload)
}
