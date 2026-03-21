import { runMutationCommand } from '@/lib/server/v2/repository'
import { type RouteParams, withActor } from '@/lib/server/v2/route-helpers'

export async function POST(request: Request, context: RouteParams<{ matchId: string }>) {
  return withActor(request, async (actor) => {
    const { matchId } = await context.params
    const body = await request.json()
    return runMutationCommand(actor, 'takeMiniGameTurn', { ...body, matchId }, {
      crewId: body.crewId,
      eventType: 'mini_game.turn_taken',
      entityTable: 'mini_game_matches',
      entityId: matchId,
    })
  })
}
