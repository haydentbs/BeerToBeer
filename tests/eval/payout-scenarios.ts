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
  expectedNetByUser?: Record<string, number>
  expectedVoid?: boolean
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
    name: 'single winner takes full losing pool',
    winningOptionId: 'a',
    options: [
      { id: 'a', wagers: [{ userId: 'alice', drinks: 2 }] },
      {
        id: 'b',
        wagers: [
          { userId: 'bob', drinks: 1 },
          { userId: 'cara', drinks: 1.5 },
          { userId: 'dan', drinks: 0.5 },
        ],
      },
    ],
    expectedNetByUser: { alice: 3, bob: -1, cara: -1.5, dan: -0.5 },
  },
  {
    name: 'large stake imbalance',
    winningOptionId: 'a',
    options: [
      { id: 'a', wagers: [{ userId: 'alice', drinks: 5 }] },
      { id: 'b', wagers: [{ userId: 'bob', drinks: 0.5 }] },
    ],
    expectedNetByUser: { alice: 0.5, bob: -0.5 },
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
  {
    name: '5 options distributed wagers - option c wins',
    winningOptionId: 'c',
    options: [
      { id: 'a', wagers: [{ userId: 'alice', drinks: 1 }] },
      { id: 'b', wagers: [{ userId: 'bob', drinks: 1 }, { userId: 'cara', drinks: 0.5 }] },
      { id: 'c', wagers: [{ userId: 'dan', drinks: 2 }] },
      { id: 'd', wagers: [{ userId: 'emma', drinks: 1 }] },
      { id: 'e', wagers: [] },
    ],
    expectedNetByUser: { dan: 3.5, alice: -1, bob: -1, cara: -0.5, emma: -1 },
  },
  {
    name: 'void - no opposing action (all on same side)',
    winningOptionId: 'a',
    options: [
      { id: 'a', wagers: [{ userId: 'alice', drinks: 2 }, { userId: 'bob', drinks: 1 }] },
      { id: 'b', wagers: [] },
    ],
    expectedVoid: true,
  },
  {
    name: 'void - winning option has no wagers',
    winningOptionId: 'a',
    options: [
      { id: 'a', wagers: [] },
      { id: 'b', wagers: [{ userId: 'alice', drinks: 1 }, { userId: 'bob', drinks: 2 }] },
    ],
    expectedVoid: true,
  },
  {
    name: 'h2h with side bets',
    winningOptionId: 'jake',
    options: [
      {
        id: 'jake',
        wagers: [
          { userId: 'jake', drinks: 2 },
          { userId: 'emma', drinks: 1 },
        ],
      },
      {
        id: 'you',
        wagers: [
          { userId: 'you', drinks: 2 },
          { userId: 'sarah', drinks: 1.5 },
        ],
      },
    ],
    expectedNetByUser: {
      jake: 2.34,
      emma: 1.16,
      you: -2,
      sarah: -1.5,
    },
  },
  {
    name: '3-way even split',
    winningOptionId: 'a',
    options: [
      { id: 'a', wagers: [{ userId: 'alice', drinks: 1 }] },
      { id: 'b', wagers: [{ userId: 'bob', drinks: 1 }] },
      { id: 'c', wagers: [{ userId: 'cara', drinks: 1 }] },
    ],
    expectedNetByUser: { alice: 2, bob: -1, cara: -1 },
  },
  {
    name: 'rounding stress test - 3 winners splitting 0.5',
    winningOptionId: 'a',
    options: [
      {
        id: 'a',
        wagers: [
          { userId: 'alice', drinks: 0.5 },
          { userId: 'ben', drinks: 0.5 },
          { userId: 'cara', drinks: 0.5 },
        ],
      },
      { id: 'b', wagers: [{ userId: 'dan', drinks: 0.5 }] },
    ],
    expectedNetByUser: { alice: 0.18, ben: 0.16, cara: 0.16, dan: -0.5 },
  },
]
