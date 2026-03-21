import { runUpdateProfileCommand } from '@/lib/server/v2/repository'
import { withActor } from '@/lib/server/v2/route-helpers'

export async function PATCH(request: Request) {
  return withActor(request, async (actor) => {
    const body = await request.json()
    return runUpdateProfileCommand(actor, body.name ?? '')
  })
}
