import { runMutationCommand } from '@/lib/server/v2/repository'
import { type RouteParams, withActor } from '@/lib/server/v2/route-helpers'

export async function POST(request: Request, context: RouteParams<{ crewId: string }>) {
  return withActor(request, async (actor) => {
    const { crewId } = await context.params
    const body = await request.json()

    return runMutationCommand(actor, 'startNight', { crewId, ...body }, {
      crewId,
      eventType: 'night.started',
      entityTable: 'nights',
    })
  })
}
