import { runMutationCommand } from '@/lib/server/v2/repository'
import { withActor } from '@/lib/server/v2/route-helpers'

export async function POST(request: Request) {
  return withActor(request, async (actor) => {
    const body = await request.json()
    return runMutationCommand(actor, 'recordSettlement', body, {
      crewId: body.crewId,
      eventType: 'settlement.recorded',
      entityTable: 'ledger_events',
    })
  })
}
