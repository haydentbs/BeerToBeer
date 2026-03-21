import { runMutationCommand } from '@/lib/server/v2/repository'
import { type RouteParams, withActor } from '@/lib/server/v2/route-helpers'

export async function POST(request: Request, context: RouteParams<{ crewId: string }>) {
  return withActor(request, async (actor) => {
    const { crewId } = await context.params
    return runMutationCommand(actor, 'leaveCrew', { crewId }, {
      crewId,
      eventType: 'crew.left',
      entityTable: 'crew_memberships',
    })
  })
}
