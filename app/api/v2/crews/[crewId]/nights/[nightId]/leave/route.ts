import { runMutationCommand } from '@/lib/server/v2/repository'
import { type RouteParams, withActor } from '@/lib/server/v2/route-helpers'

export async function POST(request: Request, context: RouteParams<{ crewId: string; nightId: string }>) {
  return withActor(request, async (actor) => {
    const { crewId, nightId } = await context.params
    return runMutationCommand(actor, 'leaveNight', { crewId, nightId }, {
      crewId,
      eventType: 'night.left',
      entityTable: 'nights',
      entityId: nightId,
    })
  })
}
