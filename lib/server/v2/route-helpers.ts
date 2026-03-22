import { NextResponse } from 'next/server'
import { resolveRequestActor } from '@/lib/server/session'

export type RouteParams<T extends Record<string, string>> = {
  params: Promise<T>
}

export function jsonError(error: unknown, status = 500) {
  console.error('Route error:', error)
  const message = error instanceof Error ? error.message : 'Unexpected error'
  return NextResponse.json({ error: message }, { status })
}

export async function withActor<T>(
  request: Request,
  handler: (actor: Awaited<ReturnType<typeof resolveRequestActor>>) => Promise<T | Response>
) {
  try {
    const actor = await resolveRequestActor(request as any)
    const result = await handler(actor)
    return result instanceof Response ? result : NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
