import { describe, expect, it } from 'vitest'
import {
  isValidWagerAmount,
  placeOrUpdateBetWager,
  projectBetPayout,
  resolveBetWithParimutuel,
  type Bet,
} from '@/lib/store'

const creator = { id: 'creator', name: 'Creator', avatar: '', initials: 'CR' }
const alice = { id: 'alice', name: 'Alice', avatar: '', initials: 'AL' }
const bob = { id: 'bob', name: 'Bob', avatar: '', initials: 'BO' }
const cara = { id: 'cara', name: 'Cara', avatar: '', initials: 'CA' }

function makeBet(): Bet {
  return {
    id: 'bet-1',
    type: 'prop',
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

describe('store wagering helpers', () => {
  it('accepts only half-drink increments', () => {
    expect(isValidWagerAmount(0.5)).toBe(true)
    expect(isValidWagerAmount(1.25)).toBe(false)
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
})
