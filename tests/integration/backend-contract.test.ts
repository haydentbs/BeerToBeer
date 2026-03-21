import { beforeEach, describe, expect, it } from 'vitest'
import { getCrewMemberMembershipId } from '@/lib/store'
import { joinCrewAsGuest, loadAppState, mutateAppState } from '@/lib/server/repository'
import { createCrewWithNight, makeAuthenticatedActor, resetDatabase } from '../helpers/backend-fixtures'

describe('persistent backend contract', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('creates a crew and allows a guest to join via invite code', async () => {
    const creator = makeAuthenticatedActor('Crew Builder')

    const created = await mutateAppState(creator, 'createCrew', { name: 'Invite Flow Crew' })
    const createdCrew = created.crews.find((entry: any) => entry.name === 'Invite Flow Crew')

    expect(createdCrew).toBeTruthy()
    expect(createdCrew?.inviteCode).toMatch(/^[A-Z0-9-]+$/)
    expect(createdCrew?.members.some((member: any) => member.role === 'creator' && member.name === 'Crew Builder')).toBe(true)

    const guestJoin = await joinCrewAsGuest('Grey Guest', createdCrew!.inviteCode)
    expect(guestJoin.session?.isGuest).toBe(true)

    const reloaded = await loadAppState(creator)
    const joinedCrew = reloaded.crews.find((entry: any) => entry.id === createdCrew!.id)
    const guestMember = joinedCrew?.members.find((member: any) => member.name === 'Grey Guest')

    expect(guestMember?.role).toBe('guest')
  }, 30000)

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

  it('upgrades a live guest session into an authenticated account without losing crew access', async () => {
    const { crew } = await createCrewWithNight('Guest Upgrade')
    const guestJoin = await joinCrewAsGuest('Taylor Guest', crew.inviteCode)
    const authenticatedActor = makeAuthenticatedActor('Taylor Account')

    const claimed = await mutateAppState(authenticatedActor, 'claimGuestMembership', {
      guestMembershipId: guestJoin.session?.membershipId,
      guestIdentityId: guestJoin.session?.guestIdentityId,
      source: 'guest-upgrade',
    })

    expect(claimed.viewerUser?.name).toBe('Taylor Account')
    const claimedCrew = claimed.crews.find((entry: any) => entry.id === crew.id)
    expect(claimedCrew).toBeTruthy()
    expect(claimedCrew?.members.some((member: any) => member.name === 'Taylor Account' && member.role === 'member')).toBe(true)
    expect(claimedCrew?.members.some((member: any) => member.name === 'Taylor Guest')).toBe(false)
    expect(claimed.claimableGuests?.some((guest: any) => guest.guestMembershipId === guestJoin.session?.membershipId)).toBe(false)
  }, 30000)

  it('merges a past guest alias into an existing member account and preserves the stats', async () => {
    const { creator, crew, night } = await createCrewWithNight('Past Guest Claim')
    const guestJoin = await joinCrewAsGuest('Taylor Alias', crew.inviteCode)
    const guestActor = { kind: 'guest' as const, session: guestJoin.session! }

    await mutateAppState(creator, 'createBet', {
      crewId: crew.id,
      nightId: night.id,
      type: 'prop',
      title: 'Will the pub close on time?',
      options: [{ label: 'Yes' }, { label: 'No' }],
      closeTime: 60,
      wager: 1,
      initialOptionIndex: 0,
    })

    const afterCreate = await loadAppState(creator)
    const createdBet = afterCreate.crews
      .find((entry: any) => entry.id === crew.id)
      ?.currentNight?.bets.find((bet: any) => bet.title.includes('pub close'))

    const winningOption = createdBet?.options.find((option: any) => option.label === 'No')
    expect(createdBet).toBeTruthy()
    expect(winningOption).toBeTruthy()

    await mutateAppState(guestActor, 'placeWager', {
      crewId: crew.id,
      betId: createdBet!.id,
      optionId: winningOption!.id,
      drinks: 2,
    })

    await mutateAppState(creator, 'resolveBet', {
      crewId: crew.id,
      betId: createdBet!.id,
      winningOptionId: winningOption!.id,
    })

    const memberActor = makeAuthenticatedActor('Taylor Account')
    await mutateAppState(memberActor, 'joinCrew', { code: crew.inviteCode })

    const beforeClaim = await loadAppState(memberActor)
    expect(beforeClaim.claimableGuests?.some((guest: any) => guest.guestMembershipId === guestJoin.session?.membershipId)).toBe(true)

    const claimed = await mutateAppState(memberActor, 'claimGuestMembership', {
      guestMembershipId: guestJoin.session?.membershipId,
      source: 'manual-claim',
    })

    const claimedCrew = claimed.crews.find((entry: any) => entry.id === crew.id)
    expect(claimedCrew?.members.some((member: any) => member.name === 'Taylor Alias')).toBe(false)
    expect(claimed.claimableGuests?.some((guest: any) => guest.guestMembershipId === guestJoin.session?.membershipId)).toBe(false)
    expect(claimed.crewDataById[crew.id].leaderboard.some((entry: any) => entry.user.name === 'Taylor Account' && entry.totalWon > 0)).toBe(true)

    const creatorMember = claimedCrew?.members.find((member: any) => member.role === 'creator')
    const claimedMember = claimedCrew?.members.find((member: any) => member.name === 'Taylor Account')
    const ledgerEdge = claimed.crewDataById[crew.id].allTimeLedger.find(
      (entry: any) =>
        getCrewMemberMembershipId(entry.fromUser) === getCrewMemberMembershipId(creatorMember) &&
        getCrewMemberMembershipId(entry.toUser) === getCrewMemberMembershipId(claimedMember)
    )

    expect(ledgerEdge?.drinks).toBe(1)
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

  it('persists creator crew settings changes and blocks non-managers from using them', async () => {
    const { creator, crew } = await createCrewWithNight('Crew Settings')
    const member = makeAuthenticatedActor('Regular Member')

    await mutateAppState(member, 'joinCrew', { code: crew.inviteCode })
    await mutateAppState(creator, 'renameCrew', { crewId: crew.id, name: 'Renamed Crew' })
    await mutateAppState(creator, 'changeDrinkTheme', { crewId: crew.id, theme: 'wine' })

    const afterChanges = await loadAppState(creator)
    const updatedCrew = afterChanges.crews.find((entry: any) => entry.id === crew.id)

    expect(updatedCrew?.name).toBe('Renamed Crew')
    expect(updatedCrew?.drinkTheme).toBe('wine')

    await expect(
      mutateAppState(member, 'renameCrew', { crewId: crew.id, name: 'Sneaky Rename' })
    ).rejects.toThrow(/creator or admin permissions/i)
  }, 30000)

  it('persists the leave-night and rejoin-night flow for active participants', async () => {
    const { creator, crew, night } = await createCrewWithNight('Leave Rejoin')
    const wingmate = makeAuthenticatedActor('Wingmate')

    await mutateAppState(wingmate, 'joinCrew', { code: crew.inviteCode })

    let state = await loadAppState(creator)
    let currentCrew = state.crews.find((entry: any) => entry.id === crew.id)

    expect(currentCrew?.currentNight?.participants.some((member: any) => member.name === 'Leave Rejoin Creator')).toBe(true)
    expect(currentCrew?.currentNight?.participants.some((member: any) => member.name === 'Wingmate')).toBe(true)

    await mutateAppState(creator, 'leaveNight', {
      crewId: crew.id,
      nightId: night.id,
    })

    state = await loadAppState(creator)
    currentCrew = state.crews.find((entry: any) => entry.id === crew.id)

    expect(currentCrew?.currentNight?.participants.some((member: any) => member.name === 'Leave Rejoin Creator')).toBe(false)
    expect(currentCrew?.currentNight?.participants.some((member: any) => member.name === 'Wingmate')).toBe(true)

    await mutateAppState(creator, 'rejoinNight', {
      crewId: crew.id,
      nightId: night.id,
    })

    state = await loadAppState(creator)
    currentCrew = state.crews.find((entry: any) => entry.id === crew.id)

    expect(currentCrew?.currentNight?.participants.some((member: any) => member.name === 'Leave Rejoin Creator')).toBe(true)
  }, 30000)
})
