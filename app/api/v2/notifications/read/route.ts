import { runMarkNotificationsReadCommand } from '@/lib/server/v2/repository'
import { withActor } from '@/lib/server/v2/route-helpers'

export async function POST(request: Request) {
  return withActor(request, async (actor) => runMarkNotificationsReadCommand(actor))
}
