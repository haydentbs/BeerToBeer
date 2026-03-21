import { NextResponse } from 'next/server'
import { resetPublicAppData } from '@/lib/server/repository'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const payload = await resetPublicAppData()
  return NextResponse.json(payload)
}
