import { runMutationCommand } from '@/lib/server/v2/repository'
import { type RouteParams, withActor } from '@/lib/server/v2/route-helpers'

export async function POST(request: Request, context: RouteParams<{ crewId: string; memberId: string }>) {
  return withActor(request, async (actor) => {
    const { crewId, memberId } = await context.params
    return runMutationCommand(actor, 'kickMember', { crewId, memberId }, {
      crewId,
      eventType: 'crew.member_removed',
      entityTable: 'crew_memberships',
      entityId: memberId,
    })
  })
}
