import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { BEER_BOMB_BOARD_SIZE, getCrewMemberMembershipId } from '@/lib/store'
import { getServiceRoleClient } from '@/lib/server/supabase'
import { joinCrewAsGuest, loadAppState, mutateAppState } from '@/lib/server/repository'
import { ageDispute, createCrewWithNight, makeAuthenticatedActor, resetDatabase } from '../helpers/backend-fixtures'

async function expirePendingResult(betId: string) {
  await getServiceRoleClient()
    .from('bets')
    .update({
      pending_result_at: new Date(Date.now() - 61_000).toISOString(),
    })
    .eq('id', betId)
}

async function expirePendingAccept(betId: string) {
  await getServiceRoleClient()
    .from('bets')
    .update({
      respond_by_at: new Date(Date.now() - 61_000).toISOString(),
    })
    .eq('id', betId)
}

async function getMiniGameMatchRow(matchId: string) {
  const { data, error } = await getServiceRoleClient()
    .from('mini_game_matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (error) throw error
  return data
}

let miniGameTablesAvailable = true

describe('persistent backend contract', () => {
  beforeAll(async () => {
    const { error } = await getServiceRoleClient()
      .from('mini_game_matches')
      .select('id')
      .limit(1)

    miniGameTablesAvailable = !error
  }, 30000)

  beforeEach(async () => {
    await resetDatabase()
  }, 30000)

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

    await mutateAppState(creator, 'proposeResult', {
      crewId: crew.id,
      betId: createdBet!.id,
      optionId: winningOption!.id,
    })

    await expirePendingResult(createdBet!.id)

    await mutateAppState(creator, 'confirmResult', {
      crewId: crew.id,
      betId: createdBet!.id,
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

    await mutateAppState(creator, 'proposeResult', {
      crewId: crew.id,
      betId: createdBet!.id,
      optionId: noOption!.id,
    })

    await expirePendingResult(createdBet!.id)

    await mutateAppState(creator, 'confirmResult', {
      crewId: crew.id,
      betId: createdBet!.id,
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

  it('creates a pending h2h invite, targets the challenged player, and opens after acceptance', async () => {
    const { creator, crew, night } = await createCrewWithNight('H2H Invite Flow')
    const rival = makeAuthenticatedActor('Invite Rival')
    const spectator = makeAuthenticatedActor('Invite Spectator')

    await mutateAppState(rival, 'joinCrew', { code: crew.inviteCode })
    await mutateAppState(spectator, 'joinCrew', { code: crew.inviteCode })

    let state = await loadAppState(creator)
    let currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    const creatorMembership = currentCrew.members.find((member: any) => member.role === 'creator')!.membershipId!
    const rivalMembership = currentCrew.members.find((member: any) => member.name === 'Invite Rival')!.membershipId!

    await mutateAppState(creator, 'createBet', {
      crewId: crew.id,
      nightId: night.id,
      type: 'h2h',
      title: 'Pool race',
      options: [{ label: 'Creator wins' }, { label: 'Invite Rival wins' }],
      closeTime: 20,
      wager: 2,
      challengerMembershipId: rivalMembership,
    })

    state = await loadAppState(creator)
    currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    const pendingBet = currentCrew.currentNight?.bets.find((bet: any) => bet.title === 'Pool race')

    expect(pendingBet).toBeTruthy()
    expect(pendingBet?.status).toBe('pending_accept')
    expect(pendingBet?.challengeWager).toBe(2)
    expect(pendingBet?.closesAt).toBeNull()
    expect(pendingBet?.respondByAt).toBeTruthy()
    expect(pendingBet?.options.every((option: any) => option.wagers.length === 0)).toBe(true)

    const rivalState = await loadAppState(rival)
    const inviteNotification = rivalState.notifications.find((notification: any) => notification.payload?.betId === pendingBet!.id)
    expect(inviteNotification?.type).toBe('bet_created')
    expect(inviteNotification?.payload?.status).toBe('pending_accept')
    expect(inviteNotification?.payload?.challengeWager).toBe(2)

    const spectatorState = await loadAppState(spectator)
    expect(spectatorState.notifications.some((notification: any) => notification.payload?.betId === pendingBet!.id)).toBe(false)

    await mutateAppState(rival, 'respondToBetOffer', {
      crewId: crew.id,
      betId: pendingBet!.id,
      accepted: true,
    })

    state = await loadAppState(creator)
    currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    const liveBet = currentCrew.currentNight?.bets.find((bet: any) => bet.id === pendingBet!.id)

    expect(liveBet?.status).toBe('open')
    expect(liveBet?.acceptedAt).toBeTruthy()
    expect(liveBet?.closesAt).toBeTruthy()
    expect(liveBet?.options[0].wagers.some((wager: any) => wager.user.membershipId === creatorMembership && wager.drinks === 2)).toBe(true)
    expect(liveBet?.options[1].wagers.some((wager: any) => wager.user.membershipId === rivalMembership && wager.drinks === 2)).toBe(true)
  }, 30000)

  it('declines and expires pending h2h invites without creating wagers', async () => {
    const { creator, crew, night } = await createCrewWithNight('H2H Invite Decisions')
    const rival = makeAuthenticatedActor('Decision Rival')

    await mutateAppState(rival, 'joinCrew', { code: crew.inviteCode })

    let state = await loadAppState(creator)
    let currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    const rivalMembership = currentCrew.members.find((member: any) => member.name === 'Decision Rival')!.membershipId!

    await mutateAppState(creator, 'createBet', {
      crewId: crew.id,
      nightId: night.id,
      type: 'h2h',
      title: 'Decline this',
      options: [{ label: 'Creator wins' }, { label: 'Decision Rival wins' }],
      closeTime: 15,
      wager: 1.5,
      challengerMembershipId: rivalMembership,
    })

    state = await loadAppState(creator)
    currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    const declinedBet = currentCrew.currentNight?.bets.find((bet: any) => bet.title === 'Decline this')

    await mutateAppState(rival, 'respondToBetOffer', {
      crewId: crew.id,
      betId: declinedBet!.id,
      accepted: false,
    })

    state = await loadAppState(creator)
    currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    const declinedState = currentCrew.currentNight?.bets.find((bet: any) => bet.id === declinedBet!.id)
    expect(declinedState?.status).toBe('declined')
    expect(declinedState?.declinedAt).toBeTruthy()
    expect(declinedState?.options.every((option: any) => option.wagers.length === 0)).toBe(true)

    await mutateAppState(creator, 'createBet', {
      crewId: crew.id,
      nightId: night.id,
      type: 'h2h',
      title: 'Expire this',
      options: [{ label: 'Creator wins' }, { label: 'Decision Rival wins' }],
      closeTime: 15,
      wager: 1,
      challengerMembershipId: rivalMembership,
    })

    state = await loadAppState(creator)
    currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    const expiringBet = currentCrew.currentNight?.bets.find((bet: any) => bet.title === 'Expire this')
    expect(expiringBet?.status).toBe('pending_accept')

    await expirePendingAccept(expiringBet!.id)

    state = await loadAppState(creator)
    currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    const expiredState = currentCrew.currentNight?.bets.find((bet: any) => bet.id === expiringBet!.id)
    expect(expiredState?.status).toBe('cancelled')
    expect(expiredState?.voidReason).toMatch(/expired/i)
    expect(expiredState?.options.every((option: any) => option.wagers.length === 0)).toBe(true)

    expect(state.notifications.some((notification: any) => notification.payload?.betId === expiringBet!.id && /expired/i.test(notification.message))).toBe(true)
  }, 30000)

  it('creates a linked H2H bet for Beer Bomb, accepts side bets, and settles through the canonical bet flow', async () => {
    if (!miniGameTablesAvailable) {
      return
    }

    const { creator, crew, night } = await createCrewWithNight('Beer Bomb Flow')
    const challenger = makeAuthenticatedActor('Beer Bomb Rival')
    const observer = makeAuthenticatedActor('Beer Bomb Spectator')

    await mutateAppState(challenger, 'joinCrew', { code: crew.inviteCode })
    await mutateAppState(observer, 'joinCrew', { code: crew.inviteCode })

    let state = await loadAppState(creator)
    let currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    const creatorMember = currentCrew.members.find((member: any) => member.role === 'creator')!
    const opponentMember = currentCrew.members.find((member: any) => member.name === 'Beer Bomb Rival')!
    const observerMember = currentCrew.members.find((member: any) => member.name === 'Beer Bomb Spectator')!

    expect(currentCrew.currentNight?.miniGameMatches ?? []).toHaveLength(0)

    await mutateAppState(creator, 'createMiniGameChallenge', {
      crewId: crew.id,
      nightId: night.id,
      opponentMembershipId: opponentMember.membershipId!,
      title: 'Beer Bomb',
      proposedWager: 2,
      gameKey: 'beer_bomb',
    })

    state = await loadAppState(creator)
    currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    const pendingMatch = currentCrew.currentNight?.miniGameMatches.find((match: any) => match.title === 'Beer Bomb')

    expect(pendingMatch).toBeTruthy()
    expect(pendingMatch?.status).toBe('pending')
    expect(pendingMatch?.proposedWager).toBe(2)
    expect(pendingMatch?.revealedSlots).toEqual([])
    expect(pendingMatch?.opponent.membershipId).toBe(opponentMember.membershipId)
    expect(pendingMatch?.respondByAt).toBeTruthy()

    await mutateAppState(challenger, 'respondToMiniGameChallenge', {
      crewId: crew.id,
      matchId: pendingMatch!.id,
      accepted: true,
    })

    state = await loadAppState(creator)
    currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    let activeMatch = currentCrew.currentNight?.miniGameMatches.find((match: any) => match.id === pendingMatch!.id)

    expect(activeMatch).toBeTruthy()
    expect(activeMatch?.status).toBe('active')
    expect(activeMatch?.agreedWager).toBe(2)
    expect(activeMatch?.currentTurn).toBeTruthy()
    expect(activeMatch?.betId).toBeTruthy()

    const linkedBet = currentCrew.currentNight?.bets.find((bet: any) => bet.id === activeMatch?.betId)
    expect(linkedBet).toBeTruthy()
    expect(linkedBet?.type).toBe('h2h')
    expect(linkedBet?.status).toBe('open')
    expect(linkedBet?.options).toHaveLength(2)
    expect(linkedBet?.options[0].wagers.some((wager: any) => wager.user.membershipId === creatorMember.membershipId && wager.drinks === 2)).toBe(true)
    expect(linkedBet?.options[1].wagers.some((wager: any) => wager.user.membershipId === opponentMember.membershipId && wager.drinks === 2)).toBe(true)

    const acceptedRow = await getMiniGameMatchRow(pendingMatch!.id)
    expect(acceptedRow.current_turn_membership_id).toBe(activeMatch?.currentTurn?.membershipId)
    expect(acceptedRow.bet_id).toBe(activeMatch?.betId)

    await mutateAppState(observer, 'placeWager', {
      crewId: crew.id,
      betId: linkedBet!.id,
      optionId: linkedBet!.options[0].id,
      drinks: 1.5,
    })

    let duplicateTurnTested = false
    while (true) {
      const row = await getMiniGameMatchRow(pendingMatch!.id)
      if (row.status !== 'active') {
        break
      }

      const actingActor = row.current_turn_membership_id === creatorMember.membershipId ? creator : challenger
      const actingMembershipId = actingActor === creator ? creatorMember.membershipId : opponentMember.membershipId
      const nextActor = actingActor === creator ? challenger : creator
      const revealed = new Set<number>((row.revealed_slots ?? []).map((slot: any) => Number(slot)))
      const safeSlot = Array.from({ length: BEER_BOMB_BOARD_SIZE }, (_, index) => index).find(
        (index) => index !== row.hidden_slot_index && !revealed.has(index)
      )
      const slotIndex = safeSlot ?? row.hidden_slot_index

      await mutateAppState(actingActor, 'takeMiniGameTurn', {
        crewId: crew.id,
        matchId: pendingMatch!.id,
        slotIndex,
      })

      const afterTurn = await getMiniGameMatchRow(pendingMatch!.id)

      if (slotIndex !== row.hidden_slot_index && !duplicateTurnTested) {
        await expect(
          mutateAppState(nextActor, 'takeMiniGameTurn', {
            crewId: crew.id,
            matchId: pendingMatch!.id,
            slotIndex,
          })
        ).rejects.toThrow(/already been tapped/i)
        duplicateTurnTested = true
      }

      if (afterTurn.status === 'completed') {
        const expectedWinnerId =
          actingMembershipId === creatorMember.membershipId
            ? opponentMember.membershipId
            : creatorMember.membershipId

        expect(afterTurn.winner_membership_id).toBe(expectedWinnerId)
        expect(afterTurn.loser_membership_id).toBe(actingMembershipId)
        expect(afterTurn.revealed_slots).toContain(afterTurn.hidden_slot_index)
        break
      }
    }

    state = await loadAppState(creator)
    currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    activeMatch = currentCrew.currentNight?.miniGameMatches.find((match: any) => match.id === pendingMatch!.id)

    expect(activeMatch).toBeTruthy()
    expect(activeMatch?.status).toBe('completed')
    expect(activeMatch?.bombSlotIndex).not.toBeUndefined()
    expect(activeMatch?.revealedSlots).toContain(activeMatch?.bombSlotIndex)
    expect(activeMatch?.winner).toBeTruthy()
    expect(activeMatch?.loser).toBeTruthy()

    const pendingLinkedBet = currentCrew.currentNight?.bets.find((bet: any) => bet.id === activeMatch?.betId)
    expect(pendingLinkedBet?.status).toBe('pending_result')

    await expirePendingResult(pendingLinkedBet!.id)
    await mutateAppState(creator, 'confirmResult', {
      crewId: crew.id,
      betId: pendingLinkedBet!.id,
    })

    state = await loadAppState(creator)
    currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    const resolvedLinkedBet = currentCrew.currentNight?.bets.find((bet: any) => bet.id === activeMatch?.betId)
    expect(resolvedLinkedBet?.status).toBe('resolved')

    const ledgerEntries = state.crewDataById[crew.id].allTimeLedger.filter((entry: any) => entry.betId === pendingLinkedBet!.id)
    expect(ledgerEntries.length).toBeGreaterThan(0)

    const { data: ledgerRows } = await getServiceRoleClient()
      .from('ledger_events')
      .select('event_type, bet_id, metadata')
      .eq('bet_id', pendingLinkedBet!.id)

    expect(ledgerRows?.every((row: any) => row.event_type === 'bet_result')).toBe(true)
    expect(ledgerRows?.some((row: any) => row.metadata?.matchId === pendingMatch!.id)).toBe(false)

    const { data: events } = await getServiceRoleClient()
      .from('mini_game_match_events')
      .select('event_type')
      .eq('match_id', pendingMatch!.id)

    expect(events?.map((event: any) => event.event_type)).toEqual(
      expect.arrayContaining([
        'challenge_created',
        'challenge_accepted',
        'turn_taken',
        'match_completed',
      ])
    )
  }, 30000)

  it('declines and cancels pending Beer Bomb challenges', async () => {
    if (!miniGameTablesAvailable) {
      return
    }

    const { creator, crew, night } = await createCrewWithNight('Beer Bomb Decisions')
    const challenger = makeAuthenticatedActor('Beer Bomb Opponent')

    await mutateAppState(challenger, 'joinCrew', { code: crew.inviteCode })

    let state = await loadAppState(creator)
    let currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    const opponentMember = currentCrew.members.find((member: any) => member.name === 'Beer Bomb Opponent')!

    await mutateAppState(creator, 'createMiniGameChallenge', {
      crewId: crew.id,
      nightId: night.id,
      opponentMembershipId: opponentMember.membershipId!,
      title: 'Decline Me',
      proposedWager: 1.5,
      gameKey: 'beer_bomb',
    })

    state = await loadAppState(creator)
    currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    const declinedMatch = currentCrew.currentNight?.miniGameMatches.find((match: any) => match.title === 'Decline Me')

    expect(declinedMatch).toBeTruthy()

    await mutateAppState(challenger, 'respondToMiniGameChallenge', {
      crewId: crew.id,
      matchId: declinedMatch!.id,
      accepted: false,
    })

    const declinedRow = await getMiniGameMatchRow(declinedMatch!.id)
    expect(declinedRow.status).toBe('declined')
    expect(declinedRow.declined_at).toBeTruthy()
    expect(declinedRow.bet_id).toBeNull()

    await mutateAppState(creator, 'createMiniGameChallenge', {
      crewId: crew.id,
      nightId: night.id,
      opponentMembershipId: opponentMember.membershipId!,
      title: 'Cancel Me',
      proposedWager: 1,
      gameKey: 'beer_bomb',
    })

    state = await loadAppState(creator)
    currentCrew = state.crews.find((entry: any) => entry.id === crew.id)!
    const cancelledMatch = currentCrew.currentNight?.miniGameMatches.find((match: any) => match.title === 'Cancel Me')

    expect(cancelledMatch).toBeTruthy()

    await mutateAppState(creator, 'cancelMiniGameChallenge', {
      crewId: crew.id,
      matchId: cancelledMatch!.id,
    })

    const cancelledRow = await getMiniGameMatchRow(cancelledMatch!.id)
    expect(cancelledRow.status).toBe('cancelled')
    expect(cancelledRow.cancelled_at).toBeTruthy()
    expect(cancelledRow.bet_id).toBeNull()
  }, 30000)

  it('persists dispute voting and resolves with non-voters backing the proposed result', async () => {
    const { creator, crew, night } = await createCrewWithNight('Dispute Flow')
    const challenger = makeAuthenticatedActor('Dispute Challenger')
    const observer = makeAuthenticatedActor('Dispute Observer')

    await mutateAppState(challenger, 'joinCrew', { code: crew.inviteCode })
    await mutateAppState(observer, 'joinCrew', { code: crew.inviteCode })

    await mutateAppState(creator, 'createBet', {
      crewId: crew.id,
      nightId: night.id,
      type: 'prop',
      subtype: 'yesno',
      title: 'Will the karaoke machine survive?',
      options: [{ label: 'Yes' }, { label: 'No' }],
      closeTime: 60,
      wager: 1,
      initialOptionIndex: 0,
    })

    const afterCreate = await loadAppState(creator)
    const createdBet = afterCreate.crews
      .find((entry: any) => entry.id === crew.id)
      ?.currentNight?.bets.find((bet: any) => bet.title.includes('karaoke'))

    const noOption = createdBet?.options.find((option: any) => option.label === 'No')
    expect(createdBet).toBeTruthy()
    expect(noOption).toBeTruthy()

    await mutateAppState(challenger, 'placeWager', {
      crewId: crew.id,
      betId: createdBet!.id,
      optionId: noOption!.id,
      drinks: 2,
    })

    await mutateAppState(observer, 'placeWager', {
      crewId: crew.id,
      betId: createdBet!.id,
      optionId: noOption!.id,
      drinks: 0.5,
    })

    await mutateAppState(creator, 'proposeResult', {
      crewId: crew.id,
      betId: createdBet!.id,
      optionId: noOption!.id,
    })

    await mutateAppState(challenger, 'disputeResult', {
      crewId: crew.id,
      betId: createdBet!.id,
      reason: 'Wanted to force a vote',
    })

    const stateWithDispute = await loadAppState(creator)
    const disputedBet = stateWithDispute.crews
      .find((entry: any) => entry.id === crew.id)
      ?.currentNight?.bets.find((bet: any) => bet.id === createdBet!.id)

    expect(disputedBet?.status).toBe('disputed')

    const dispute = await getServiceRoleClient()
      .from('disputes')
      .select('id')
      .eq('bet_id', createdBet!.id)
      .eq('status', 'open')
      .single()

    expect(dispute.error).toBeNull()

    await mutateAppState(challenger, 'castDisputeVote', {
      crewId: crew.id,
      disputeId: dispute.data!.id,
      optionId: noOption!.id,
    })

    await ageDispute(dispute.data!.id)

    await mutateAppState(creator, 'confirmResult', {
      crewId: crew.id,
      betId: createdBet!.id,
    })

    const settledState = await loadAppState(creator)
    const resolvedBet = settledState.crews
      .find((entry: any) => entry.id === crew.id)
      ?.currentNight?.bets.find((bet: any) => bet.id === createdBet!.id)

    expect(resolvedBet?.status).toBe('resolved')
    expect(resolvedBet?.result).toBe(noOption!.id)
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
