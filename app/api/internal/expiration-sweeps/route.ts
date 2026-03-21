import { NextResponse } from 'next/server'
import { getExpirationSweepSecret } from '@/lib/server/env'
import { runExpirationSweepCommand } from '@/lib/server/v2/repository'

export async function POST(request: Request) {
  const expectedSecret = getExpirationSweepSecret()
  const authHeader = request.headers.get('authorization')
  const suppliedSecret = authHeader?.replace(/^Bearer\s+/i, '').trim()

  if (!suppliedSecret || suppliedSecret !== expectedSecret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const payload = await runExpirationSweepCommand()
  return NextResponse.json(payload)
}
