import { fetchCrewFeedState } from '@/lib/server/v2/repository'
import { type RouteParams, withActor } from '@/lib/server/v2/route-helpers'

export async function GET(request: Request, context: RouteParams<{ crewId: string }>) {
  return withActor(request, async (actor) => {
    const { crewId } = await context.params
    const { searchParams } = new URL(request.url)
    const afterParam = searchParams.get('after')
    const after = afterParam != null && afterParam !== '' ? Number(afterParam) : null

    return fetchCrewFeedState(actor, crewId, Number.isFinite(after) ? after : null)
  })
}
