import { beforeEach, describe, expect, it } from 'vitest'
import { getCrewMemberMembershipId } from '@/lib/store'
import { joinCrewAsGuest, loadAppState, mutateAppState } from '@/lib/server/repository'
import { createCrewWithNight, makeAuthenticatedActor, resetDatabase } from '../helpers/backend-fixtures'

describe('persistent backend contract', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('persists guest memberships across repeated loads', async () => {
    const { crew } = await createCrewWithNight('Guest Persistence')

    const joinPayload = await joinCrewAsGuest('Taylor Guest', crew.inviteCode)
    expect(joinPayload.session?.isGuest).toBe(true)
    expect(joinPayload.session?.guestIdentityId).toBeTruthy()

    const reloaded = await loadAppState({
      kind: 'guest',
      session: joinPayload.session!,
    })

    const joinedCrew = reloaded.crews.find((entry: any) => entry.id === crew.id)
    expect(joinedCrew).toBeTruthy()
    expect(joinedCrew?.members.some((member: any) => member.name === 'Taylor Guest')).toBe(true)
  }, 30000)

  it('persists wagers, parimutuel resolution, and settlements across reads', async () => {
    const { creator, crew, night } = await createCrewWithNight('Stateful Backend')
    const challenger = makeAuthenticatedActor('Challenger Player')

    await mutateAppState(challenger, 'joinCrew', { code: crew.inviteCode })

    const joinedState = await loadAppState(challenger)
    const joinedCrew = joinedState.crews.find((entry: any) => entry.id === crew.id)
    expect(joinedCrew).toBeTruthy()

    await mutateAppState(creator, 'createBet', {
      crewId: crew.id,
      nightId: night.id,
      type: 'prop',
      title: 'Will the jukebox break before last orders?',
      options: [{ label: 'Yes' }, { label: 'No' }],
      closeTime: 60,
      wager: 1,
      initialOptionIndex: 0,
    })

    const afterCreate = await loadAppState(creator)
    const createdBet = afterCreate.crews
      .find((entry: any) => entry.id === crew.id)
      ?.currentNight?.bets.find((bet: any) => bet.title.includes('jukebox'))

    expect(createdBet).toBeTruthy()

    const noOption = createdBet?.options.find((option: any) => option.label === 'No')
    expect(noOption).toBeTruthy()

    await mutateAppState(challenger, 'placeWager', {
      crewId: crew.id,
      betId: createdBet!.id,
      optionId: noOption!.id,
      drinks: 2,
    })

    await mutateAppState(creator, 'resolveBet', {
      crewId: crew.id,
      betId: createdBet!.id,
      winningOptionId: noOption!.id,
    })

    const resolvedOnce = await loadAppState(creator)
    const resolvedTwice = await loadAppState(creator)
    const resolvedCrew = resolvedOnce.crews.find((entry: any) => entry.id === crew.id)!
    const creatorMember = resolvedCrew.members.find((member: any) => member.role === 'creator')!
    const winnerMember = resolvedCrew.members.find((member: any) => member.name === 'Challenger Player')!

    expect(resolvedCrew.currentNight?.bets.find((bet: any) => bet.id === createdBet!.id)?.status).toBe('resolved')
    expect(resolvedOnce.crewDataById[crew.id].allTimeLedger.length).toBeGreaterThan(0)
    expect(resolvedOnce.crewDataById[crew.id].leaderboard[0]?.user.name).toBe('Challenger Player')
    expect(resolvedTwice.crewDataById[crew.id].allTimeLedger).toEqual(resolvedOnce.crewDataById[crew.id].allTimeLedger)

    await mutateAppState(creator, 'recordSettlement', {
      crewId: crew.id,
      toMembershipId: getCrewMemberMembershipId(winnerMember),
      drinks: 0.5,
    })

    const afterSettlement = await loadAppState(creator)
    const settlementEdge = afterSettlement.crewDataById[crew.id].allTimeLedger.find(
      (entry: any) =>
        getCrewMemberMembershipId(entry.fromUser) === getCrewMemberMembershipId(creatorMember) &&
        getCrewMemberMembershipId(entry.toUser) === getCrewMemberMembershipId(winnerMember)
    )

    expect(settlementEdge?.drinks).toBe(1)
    expect(settlementEdge?.settled).toBe(0.5)
  }, 30000)
})
