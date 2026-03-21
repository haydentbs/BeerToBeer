import { describe, expect, it } from 'vitest'
import {
  BEER_BOMB_BOARD_SIZE,
  canTakeBeerBombTurn,
  createBeerBombSlotStates,
  getBeerBombTurnLabel,
  getNextBeerBombTurn,
  isValidWagerAmount,
  placeOrUpdateBetWager,
  projectBetPayout,
  resolveBetWithParimutuel,
  type Bet,
  type MiniGameMatch,
} from '@/lib/store'

const creator = { id: 'creator', name: 'Creator', avatar: '', initials: 'CR' }
const alice = { id: 'alice', name: 'Alice', avatar: '', initials: 'AL' }
const bob = { id: 'bob', name: 'Bob', avatar: '', initials: 'BO' }
const cara = { id: 'cara', name: 'Cara', avatar: '', initials: 'CA' }

function makeBet(): Bet {
  return {
    id: 'bet-1',
    type: 'prop',
    subtype: 'yesno',
    title: 'Fixture',
    creator,
    status: 'open',
    closesAt: new Date(Date.now() + 10_000),
    createdAt: new Date(),
    options: [
      {
        id: 'yes',
        label: 'Yes',
        wagers: [
          { id: 'w-1', user: alice, drinks: 1, createdAt: new Date() },
        ],
        totalDrinks: 1,
      },
      {
        id: 'no',
        label: 'No',
        wagers: [
          { id: 'w-2', user: bob, drinks: 1, createdAt: new Date() },
        ],
        totalDrinks: 1,
      },
    ],
    totalPool: 2,
  }
}

function makeMatch(overrides: Partial<MiniGameMatch> = {}): MiniGameMatch {
  return {
    id: 'match-1',
    gameKey: 'beer_bomb',
    title: 'Beer Bomb',
    status: 'active',
    challenger: { ...creator, membershipId: 'm-creator' },
    opponent: { ...alice, membershipId: 'm-alice' },
    proposedWager: 2,
    agreedWager: 2,
    boardSize: BEER_BOMB_BOARD_SIZE,
    revealedSlots: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    startingPlayer: { ...creator, membershipId: 'm-creator' },
    currentTurn: { ...creator, membershipId: 'm-creator' },
    ...overrides,
  }
}

describe('store wagering helpers', () => {
  it('accepts only half-drink increments', () => {
    expect(isValidWagerAmount(0.5)).toBe(true)
    expect(isValidWagerAmount(5)).toBe(true)
    expect(isValidWagerAmount(1.25)).toBe(false)
    expect(isValidWagerAmount(5.5)).toBe(false)
  })

  it('projects a net profit from the current pool', () => {
    expect(projectBetPayout(makeBet(), 'yes', 1, cara.id)).toBe(0.5)
  })

  it('replaces an existing user wager atomically', () => {
    const updated = placeOrUpdateBetWager(makeBet(), alice, 'no', 2)
    expect(updated.options[0].wagers).toHaveLength(0)
    expect(updated.options[1].wagers.find((wager) => wager.user.id === alice.id)?.drinks).toBe(2)
  })

  it('keeps settlement zero-sum', () => {
    const bet = placeOrUpdateBetWager(makeBet(), cara, 'yes', 2)
    const resolved = resolveBetWithParimutuel(bet, 'yes')
    const total = (resolved.memberOutcomes ?? []).reduce((sum, outcome) => sum + outcome.netResult, 0)
    expect(total).toBe(0)
  })

  it('gives the entire remainder to the top-ranked winning wager', () => {
    const bet: Bet = {
      ...makeBet(),
      options: [
        {
          id: 'yes',
          label: 'Yes',
          wagers: [
            { id: 'w-1', user: alice, drinks: 0.5, createdAt: new Date('2026-01-01T00:00:00Z') },
            { id: 'w-2', user: bob, drinks: 0.5, createdAt: new Date('2026-01-01T00:00:01Z') },
            { id: 'w-3', user: cara, drinks: 0.5, createdAt: new Date('2026-01-01T00:00:02Z') },
          ],
          totalDrinks: 1.5,
        },
        {
          id: 'no',
          label: 'No',
          wagers: [
            { id: 'w-4', user: creator, drinks: 0.5, createdAt: new Date('2026-01-01T00:00:03Z') },
          ],
          totalDrinks: 0.5,
        },
      ],
      totalPool: 2,
    }

    const resolved = resolveBetWithParimutuel(bet, 'yes')
    const profits = Object.fromEntries(
      (resolved.memberOutcomes ?? []).map((outcome) => [outcome.user.id, outcome.netResult])
    )

    expect(profits.alice).toBe(0.18)
    expect(profits.bob).toBe(0.16)
    expect(profits.cara).toBe(0.16)
    expect(profits.creator).toBe(-0.5)
  })
})

describe('beer bomb helpers', () => {
  it('marks revealed safe beers as draining then safe-empty', () => {
    expect(createBeerBombSlotStates(makeMatch({ revealedSlots: [2] }))[2]).toBe('draining')
    expect(createBeerBombSlotStates(makeMatch({ revealedSlots: [2], status: 'completed', bombSlotIndex: 5 }))[2]).toBe('safe-empty')
  })

  it('marks the bomb slot when the match completes', () => {
    const states = createBeerBombSlotStates(
      makeMatch({
        status: 'completed',
        revealedSlots: [1, 4],
        bombSlotIndex: 4,
      })
    )

    expect(states[1]).toBe('safe-empty')
    expect(states[4]).toBe('bomb-hit')
  })

  it('validates turn ownership and remaining slots', () => {
    expect(canTakeBeerBombTurn(makeMatch(), 'm-creator')).toBe(true)
    expect(canTakeBeerBombTurn(makeMatch(), 'm-alice')).toBe(false)
    expect(canTakeBeerBombTurn(makeMatch({ status: 'pending' }), 'm-creator')).toBe(false)
    expect(canTakeBeerBombTurn(makeMatch({ revealedSlots: Array.from({ length: BEER_BOMB_BOARD_SIZE }, (_, index) => index) }), 'm-creator')).toBe(false)
  })

  it('swaps to the other player for the next turn', () => {
    const match = makeMatch()
    expect(getNextBeerBombTurn(match).id).toBe(alice.id)
    expect(getNextBeerBombTurn({ ...match, currentTurn: match.opponent }).id).toBe(creator.id)
  })

  it('returns readable turn labels', () => {
    expect(getBeerBombTurnLabel(makeMatch(), creator.id)).toBe('Your turn')
    expect(getBeerBombTurnLabel(makeMatch(), bob.id)).toBe(`${creator.name}'s turn`)
    expect(getBeerBombTurnLabel(makeMatch({ status: 'pending' }), creator.id)).toBe('Awaiting response')
    expect(
      getBeerBombTurnLabel(
        makeMatch({
          status: 'completed',
          winner: { ...creator, membershipId: 'm-creator' },
          loser: { ...alice, membershipId: 'm-alice' },
        }),
        creator.id
      )
    ).toBe('You won')
  })
})
