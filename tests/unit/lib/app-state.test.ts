import { describe, expect, it } from 'vitest'
import { mapMiniGameMatchRowToUpdate } from '@/lib/app-state'

describe('app state beer bomb realtime helpers', () => {
  it('maps a realtime mini_game_matches row into the client match update shape', () => {
    expect(
      mapMiniGameMatchRowToUpdate({
        id: 'match-1',
        status: 'completed',
        revealed_slots: [1, '4', 7],
        current_turn_membership_id: null,
        winner_membership_id: 'winner-1',
        loser_membership_id: 'loser-1',
        agreed_wager: '2.5',
        accepted_at: '2026-03-22T10:00:00.000Z',
        declined_at: null,
        cancelled_at: null,
        completed_at: '2026-03-22T10:01:00.000Z',
        updated_at: '2026-03-22T10:01:01.000Z',
        hidden_slot_index: 4,
      })
    ).toEqual({
      matchId: 'match-1',
      status: 'completed',
      revealedSlotIndices: [1, 4, 7],
      currentTurnMembershipId: null,
      winnerMembershipId: 'winner-1',
      loserMembershipId: 'loser-1',
      agreedWager: 2.5,
      acceptedAt: '2026-03-22T10:00:00.000Z',
      declinedAt: null,
      cancelledAt: null,
      completedAt: '2026-03-22T10:01:00.000Z',
      updatedAt: '2026-03-22T10:01:01.000Z',
      bombSlotIndex: 4,
    })
  })
})
