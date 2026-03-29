import { runMutationCommand } from '@/lib/server/v2/repository'
import { withActor } from '@/lib/server/v2/route-helpers'

export async function POST(request: Request) {
  return withActor(request, async (actor) => {
    const body = await request.json()
    return runMutationCommand(actor, 'claimGuestMembership', body, {
      eventType: 'guest.claimed',
      entityTable: 'crew_memberships',
      entityId: body.guestMembershipId,
    })
  })
}
