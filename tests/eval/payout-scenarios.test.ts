import { describe, expect, it } from 'vitest'
import { resolveBetWithParimutuel } from '@/lib/store'
import { payoutScenarios } from '@/tests/eval/payout-scenarios'

describe('payout evaluation scenarios', () => {
  it.each(payoutScenarios)('$name', (scenario) => {
    const bet = {
      id: 'bet-1',
      type: 'prop' as const,
      title: 'Fixture bet',
      creator: { id: 'creator', name: 'Creator', avatar: '', initials: 'CR' },
      status: 'open' as const,
      closesAt: new Date(),
      createdAt: new Date(),
      options: scenario.options.map((option) => ({
        id: option.id,
        label: option.id,
        wagers: option.wagers.map((wager, index) => ({
          id: `${option.id}-${index}`,
          user: {
            id: wager.userId,
            name: wager.userId,
            avatar: '',
            initials: wager.userId.slice(0, 2).toUpperCase(),
          },
          drinks: wager.drinks,
          createdAt: new Date(),
        })),
        totalDrinks: option.wagers.reduce((sum, wager) => sum + wager.drinks, 0),
      })),
      totalPool: scenario.options.flatMap((option) => option.wagers).reduce((sum, wager) => sum + wager.drinks, 0),
    }

    const resolved = resolveBetWithParimutuel(bet, scenario.winningOptionId)
    const actual = Object.fromEntries(
      (resolved.memberOutcomes ?? []).map((outcome) => [outcome.user.id, outcome.netResult])
    )

    expect(actual).toEqual(scenario.expectedNetByUser)
    expect(
      (resolved.memberOutcomes ?? []).reduce((sum, outcome) => sum + outcome.netResult, 0)
    ).toBe(0)
  })
})
