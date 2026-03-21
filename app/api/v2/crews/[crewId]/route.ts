import { runMutationCommand } from '@/lib/server/v2/repository'
import { type RouteParams, withActor } from '@/lib/server/v2/route-helpers'

export async function PATCH(request: Request, context: RouteParams<{ crewId: string }>) {
  return withActor(request, async (actor) => {
    const { crewId } = await context.params
    const body = await request.json()

    if (body.name) {
      return runMutationCommand(actor, 'renameCrew', { crewId, name: body.name }, {
        crewId,
        eventType: 'crew.renamed',
        entityTable: 'crews',
        entityId: crewId,
      })
    }

    if (body.drinkTheme) {
      return runMutationCommand(actor, 'changeDrinkTheme', { crewId, theme: body.drinkTheme }, {
        crewId,
        eventType: 'crew.theme_changed',
        entityTable: 'crews',
        entityId: crewId,
      })
    }

    throw new Error('No supported crew update was provided.')
  })
}

export async function DELETE(request: Request, context: RouteParams<{ crewId: string }>) {
  return withActor(request, async (actor) => {
    const { crewId } = await context.params
    return runMutationCommand(actor, 'deleteCrew', { crewId }, {
      crewId,
      eventType: 'crew.archived',
      entityTable: 'crews',
      entityId: crewId,
    })
  })
}
