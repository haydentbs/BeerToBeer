import { fetchCrewSnapshotState } from '@/lib/server/v2/repository'
import { type RouteParams, withActor } from '@/lib/server/v2/route-helpers'

export async function GET(request: Request, context: RouteParams<{ crewId: string }>) {
  return withActor(request, async (actor) => {
    const { crewId } = await context.params
    return fetchCrewSnapshotState(actor, crewId)
  })
}
