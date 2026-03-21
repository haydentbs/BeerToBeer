export interface PayoutScenario {
  name: string
  winningOptionId: string
  options: Array<{
    id: string
    wagers: Array<{
      userId: string
      drinks: number
    }>
  }>
  expectedNetByUser: Record<string, number>
}

export const payoutScenarios: PayoutScenario[] = [
  {
    name: 'unequal yes-no pool',
    winningOptionId: 'yes',
    options: [
      {
        id: 'yes',
        wagers: [
          { userId: 'alice', drinks: 1 },
          { userId: 'ben', drinks: 2 },
        ],
      },
      {
        id: 'no',
        wagers: [
          { userId: 'cara', drinks: 1 },
          { userId: 'dan', drinks: 0.5 },
        ],
      },
    ],
    expectedNetByUser: {
      alice: 0.5,
      ben: 1,
      cara: -1,
      dan: -0.5,
    },
  },
  {
    name: 'multi-option winner takes all losing pool',
    winningOptionId: 'b',
    options: [
      { id: 'a', wagers: [{ userId: 'alice', drinks: 1 }] },
      { id: 'b', wagers: [{ userId: 'ben', drinks: 2.5 }] },
      { id: 'c', wagers: [{ userId: 'cara', drinks: 1.5 }] },
    ],
    expectedNetByUser: {
      alice: -1,
      ben: 2.5,
      cara: -1.5,
    },
  },
]
