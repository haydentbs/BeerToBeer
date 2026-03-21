import { runMutationCommand } from '@/lib/server/v2/repository'
import { type RouteParams, withActor } from '@/lib/server/v2/route-helpers'

export async function POST(request: Request, context: RouteParams<{ disputeId: string }>) {
  return withActor(request, async (actor) => {
    const { disputeId } = await context.params
    const body = await request.json()
    return runMutationCommand(actor, 'castDisputeVote', { ...body, disputeId }, {
      crewId: body.crewId,
      eventType: 'dispute.vote_cast',
      entityTable: 'disputes',
      entityId: disputeId,
    })
  })
}
