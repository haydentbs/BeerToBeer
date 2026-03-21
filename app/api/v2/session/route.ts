import { fetchSessionState } from '@/lib/server/v2/repository'
import { withActor } from '@/lib/server/v2/route-helpers'

export async function GET(request: Request) {
  return withActor(request, async (actor) => fetchSessionState(actor))
}
