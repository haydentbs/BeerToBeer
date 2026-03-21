import { runMutationCommand } from '@/lib/server/v2/repository'
import { type RouteParams, withActor } from '@/lib/server/v2/route-helpers'

export async function POST(request: Request, context: RouteParams<{ betId: string }>) {
  return withActor(request, async (actor) => {
    const { betId } = await context.params
    const body = await request.json()
    return runMutationCommand(actor, 'placeWager', { ...body, betId }, {
      crewId: body.crewId,
      eventType: 'bet.wagered',
      entityTable: 'wagers',
      entityId: betId,
    })
  })
}
