// BeerScore App State Types and Mock Data

export interface User {
  id: string
  name: string
  avatar: string
  initials: string
  membershipId?: string
  role?: CrewRole
}

export type CrewRole = 'creator' | 'admin' | 'member' | 'guest'
export type BetSubtype = 'yesno' | 'overunder' | 'multi' | null
export type BetStatus = 'pending_accept' | 'open' | 'pending_result' | 'disputed' | 'resolved' | 'void' | 'cancelled' | 'declined'

export interface Bet {
  id: string
  type: 'prop' | 'h2h'
  subtype: BetSubtype
  title: string
  description?: string
  line?: number
  creator: User
  challenger?: User
  status: BetStatus
  closesAt?: Date | null
  createdAt: Date
  challengeWager?: number
  respondByAt?: Date
  acceptedAt?: Date
  declinedAt?: Date
  options: BetOption[]
  totalPool: number
  result?: string
  pendingResultOptionId?: string
  pendingResultAt?: Date
  voidReason?: string
  memberOutcomes?: BetMemberOutcome[]
}

export interface BetOption {
  id: string
  label: string
  wagers: Wager[]
  totalDrinks: number
}

export interface Wager {
  id: string
  user: User
  drinks: number
  createdAt: Date
}

export interface BetMemberOutcome {
  user: User
  optionId: string
  stake: number
  netResult: number
}

export interface LedgerEntry {
  fromUser: User
  toUser: User
  drinks: number
  settled: number
  betId?: string
  matchId?: string
}

export type MiniGameKey = 'beer_bomb'
export type MiniGameMatchStatus = 'pending' | 'active' | 'declined' | 'cancelled' | 'completed'
export type BeerBombSlotState = 'idle' | 'draining' | 'safe-empty' | 'bomb-hit'

export interface MiniGameMatch {
  id: string
  gameKey: MiniGameKey
  betId?: string
  title: string
  status: MiniGameMatchStatus
  challenger: User
  opponent: User
  proposedWager: number
  agreedWager?: number
  boardSize: number
  revealedSlots: number[]
  createdAt: Date
  updatedAt: Date
  respondByAt?: Date
  acceptedAt?: Date
  declinedAt?: Date
  cancelledAt?: Date
  startingPlayer?: User
  currentTurn?: User
  winner?: User
  loser?: User
  completedAt?: Date
  bombSlotIndex?: number
}

export interface Night {
  id: string
  name: string
  status: 'active' | 'winding-down' | 'closed'
  startedAt: Date
  bets: Bet[]
  miniGameMatches: MiniGameMatch[]
  participants: User[]
  drinkThemeOverride?: 'beer' | 'cocktails' | 'shots' | 'tequila' | 'wine' | 'whiskey'
}

export interface PastBetSummary {
  title: string
  type: 'prop' | 'h2h'
  winner: string
  pool: number
}

export interface PastNightPlayer {
  user: User
  net: number
}

export interface PastNight {
  id: string
  name: string
  date: string
  bets: number
  winner: string
  duration: string
  betDetails: PastBetSummary[]
  leaderboard: PastNightPlayer[]
}

export interface Crew {
  id: string
  name: string
  members: User[]
  currentNight?: Night
  pastNights: PastNight[]
  inviteCode: string
  drinkTheme?: 'beer' | 'cocktails' | 'shots' | 'tequila' | 'wine' | 'whiskey'
}

export interface CrewSummary {
  crew: Crew
  netPosition: number
  tonightLedger: LedgerEntry[]
  allTimeLedger: LedgerEntry[]
  leaderboard: LeaderboardEntry[]
}

export interface LeaderboardEntry {
  user: User
  totalWon: number
  winRate: number
  bestNight: number
  streak: number
}

// Mock Users
export const mockUsers: User[] = [
  { id: '1', name: 'You', avatar: '/avatars/you.jpg', initials: 'ME' },
  { id: '2', name: 'Sarah', avatar: '/avatars/sarah.jpg', initials: 'SL' },
  { id: '3', name: 'Jake', avatar: '/avatars/jake.jpg', initials: 'JM' },
  { id: '4', name: 'Mike', avatar: '/avatars/mike.jpg', initials: 'MR' },
  { id: '5', name: 'Emma', avatar: '/avatars/emma.jpg', initials: 'EB' },
  { id: '6', name: 'Dave', avatar: '/avatars/dave.jpg', initials: 'DK' },
]

// Work crew users
export const workUsers: User[] = [
  { id: '1', name: 'You', avatar: '/avatars/you.jpg', initials: 'ME' },
  { id: '7', name: 'Priya', avatar: '', initials: 'PK' },
  { id: '8', name: 'Tom', avatar: '', initials: 'TW' },
  { id: '9', name: 'Nadia', avatar: '', initials: 'NR' },
]

// College crew users
export const collegeUsers: User[] = [
  { id: '1', name: 'You', avatar: '/avatars/you.jpg', initials: 'ME' },
  { id: '10', name: 'Brody', avatar: '', initials: 'BT' },
  { id: '11', name: 'Chase', avatar: '', initials: 'CW' },
  { id: '12', name: 'Liam', avatar: '', initials: 'LO' },
  { id: '13', name: 'Marcus', avatar: '', initials: 'MJ' },
  { id: '14', name: 'Zach', avatar: '', initials: 'ZP' },
  { id: '15', name: 'Tyler', avatar: '', initials: 'TG' },
  { id: '16', name: 'Kai', avatar: '', initials: 'KN' },
]

export const currentUser = mockUsers[0]

export function getCrewMemberMembershipId(member?: Pick<User, 'id' | 'membershipId'> | null) {
  return member?.membershipId ?? member?.id ?? null
}

export function isCrewCreator(member?: Pick<User, 'id' | 'role'> | null, memberIndex?: number) {
  if (!member) {
    return false
  }

  if (member.role) {
    return member.role === 'creator'
  }

  return memberIndex === 0
}

// Mock Active Bets
export const mockBets: Bet[] = [
  {
    id: '1',
    type: 'prop',
    subtype: 'overunder',
    title: 'Will Dave mention his ex?',
    description: 'Over/under 2.5 times in the next hour',
    line: 2.5,
    creator: mockUsers[3],
    status: 'open',
    closesAt: new Date(Date.now() + 1000 * 60 * 45),
    createdAt: new Date(Date.now() - 1000 * 60 * 15),
    options: [
      {
        id: 'over',
        label: 'Over 2.5',
        wagers: [
          { id: 'w-1', user: mockUsers[1], drinks: 1, createdAt: new Date(Date.now() - 1000 * 60 * 14) },
          { id: 'w-2', user: mockUsers[4], drinks: 0.5, createdAt: new Date(Date.now() - 1000 * 60 * 12) },
        ],
        totalDrinks: 1.5,
      },
      {
        id: 'under',
        label: 'Under 2.5',
        wagers: [
          { id: 'w-3', user: mockUsers[2], drinks: 2, createdAt: new Date(Date.now() - 1000 * 60 * 10) },
        ],
        totalDrinks: 2,
      },
    ],
    totalPool: 3.5,
  },
  {
    id: '2',
    type: 'h2h',
    subtype: null,
    title: 'Pool match',
    creator: mockUsers[2],
    challenger: mockUsers[0],
    status: 'open',
    closesAt: new Date(Date.now() + 1000 * 60 * 30),
    createdAt: new Date(Date.now() - 1000 * 60 * 5),
    options: [
      {
        id: 'jake',
        label: 'Jake wins',
        wagers: [
          { id: 'w-4', user: mockUsers[2], drinks: 2, createdAt: new Date(Date.now() - 1000 * 60 * 4) },
          { id: 'w-5', user: mockUsers[4], drinks: 1, createdAt: new Date(Date.now() - 1000 * 60 * 3) },
        ],
        totalDrinks: 3,
      },
      {
        id: 'you',
        label: 'You win',
        wagers: [
          { id: 'w-6', user: mockUsers[0], drinks: 2, createdAt: new Date(Date.now() - 1000 * 60 * 2) },
          { id: 'w-7', user: mockUsers[1], drinks: 1.5, createdAt: new Date(Date.now() - 1000 * 60) },
        ],
        totalDrinks: 3.5,
      },
    ],
    totalPool: 6.5,
  },
  {
    id: '3',
    type: 'prop',
    subtype: 'multi',
    title: 'First to order food?',
    creator: mockUsers[1],
    status: 'open',
    closesAt: new Date(Date.now() + 1000 * 60 * 60),
    createdAt: new Date(Date.now() - 1000 * 60 * 8),
    options: [
      { id: 'dave', label: 'Dave', wagers: [{ id: 'w-8', user: mockUsers[3], drinks: 1, createdAt: new Date(Date.now() - 1000 * 60 * 7) }], totalDrinks: 1 },
      { id: 'mike', label: 'Mike', wagers: [{ id: 'w-9', user: mockUsers[2], drinks: 0.5, createdAt: new Date(Date.now() - 1000 * 60 * 6) }], totalDrinks: 0.5 },
      { id: 'emma', label: 'Emma', wagers: [{ id: 'w-10', user: mockUsers[4], drinks: 1, createdAt: new Date(Date.now() - 1000 * 60 * 5) }], totalDrinks: 1 },
      { id: 'other', label: 'Someone else', wagers: [], totalDrinks: 0 },
    ],
    totalPool: 2.5,
  },
  {
    id: '4',
    type: 'h2h',
    subtype: null,
    title: 'Darts showdown',
    creator: mockUsers[1],
    challenger: mockUsers[3],
    status: 'resolved',
    closesAt: new Date(Date.now() - 1000 * 60 * 30),
    createdAt: new Date(Date.now() - 1000 * 60 * 90),
    options: [
      { id: 'sarah', label: 'Sarah wins', wagers: [{ id: 'w-11', user: mockUsers[1], drinks: 2, createdAt: new Date(Date.now() - 1000 * 60 * 89) }, { id: 'w-12', user: mockUsers[4], drinks: 1, createdAt: new Date(Date.now() - 1000 * 60 * 88) }], totalDrinks: 3 },
      { id: 'mike', label: 'Mike wins', wagers: [{ id: 'w-13', user: mockUsers[3], drinks: 2, createdAt: new Date(Date.now() - 1000 * 60 * 87) }], totalDrinks: 2 },
    ],
    totalPool: 5,
    result: 'sarah',
  },
  {
    id: '5',
    type: 'prop',
    subtype: 'yesno',
    title: 'Will someone get kicked out?',
    creator: mockUsers[5],
    status: 'resolved',
    closesAt: new Date(Date.now() - 1000 * 60 * 45),
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
    options: [
      { id: 'yes', label: 'Yes', wagers: [{ id: 'w-14', user: mockUsers[0], drinks: 1, createdAt: new Date(Date.now() - 1000 * 60 * 118) }, { id: 'w-15', user: mockUsers[2], drinks: 0.5, createdAt: new Date(Date.now() - 1000 * 60 * 117) }], totalDrinks: 1.5 },
      { id: 'no', label: 'No', wagers: [{ id: 'w-16', user: mockUsers[5], drinks: 2, createdAt: new Date(Date.now() - 1000 * 60 * 116) }], totalDrinks: 2 },
    ],
    totalPool: 3.5,
    result: 'no',
  },
]

// Mock Ledger Data (tonight)
export const mockTonightLedger: LedgerEntry[] = [
  { fromUser: mockUsers[2], toUser: mockUsers[0], drinks: 1.5, settled: 0 },
  { fromUser: mockUsers[0], toUser: mockUsers[1], drinks: 0.5, settled: 0 },
  { fromUser: mockUsers[3], toUser: mockUsers[0], drinks: 0.3, settled: 0 },
]

// Mock All-time Ledger
export const mockAllTimeLedger: LedgerEntry[] = [
  { fromUser: mockUsers[2], toUser: mockUsers[0], drinks: 4.7, settled: 3 },
  { fromUser: mockUsers[0], toUser: mockUsers[1], drinks: 2.3, settled: 2 },
  { fromUser: mockUsers[3], toUser: mockUsers[0], drinks: 1.8, settled: 1 },
  { fromUser: mockUsers[0], toUser: mockUsers[4], drinks: 3.2, settled: 2 },
  { fromUser: mockUsers[5], toUser: mockUsers[0], drinks: 0.8, settled: 0 },
]

// Mock Leaderboard
export const mockLeaderboard: LeaderboardEntry[] = [
  { user: mockUsers[0], totalWon: 12.4, winRate: 0.62, bestNight: 4.5, streak: 3 },
  { user: mockUsers[1], totalWon: 10.8, winRate: 0.58, bestNight: 3.8, streak: 1 },
  { user: mockUsers[2], totalWon: 8.2, winRate: 0.45, bestNight: 5.2, streak: 0 },
  { user: mockUsers[3], totalWon: 7.5, winRate: 0.52, bestNight: 2.9, streak: 2 },
  { user: mockUsers[4], totalWon: 6.1, winRate: 0.48, bestNight: 2.1, streak: 0 },
  { user: mockUsers[5], totalWon: 4.3, winRate: 0.38, bestNight: 1.8, streak: 0 },
]

// Mock Current Night
export const mockCurrentNight: Night = {
  id: '1',
  name: "Friday at O'Malley's",
  status: 'active',
  startedAt: new Date(Date.now() - 1000 * 60 * 90),
  bets: mockBets,
  miniGameMatches: [],
  participants: mockUsers,
}

// Mock Crews (multiple)
export const mockCrews: Crew[] = [
  {
    id: 'crew-1',
    name: 'The Usual Suspects',
    members: mockUsers,
    currentNight: mockCurrentNight,
    inviteCode: 'USUAL-24',
    drinkTheme: 'beer',
    pastNights: [
      {
        id: 'night-1', name: "Thursday at The Local", date: "Mar 14", bets: 8, winner: "Sarah", duration: "4h 23m",
        betDetails: [
          { title: "Will bartender remember Sarah's order?", type: 'prop', winner: "Yes", pool: 4.5 },
          { title: "Pool match: Jake vs Mike", type: 'h2h', winner: "Jake", pool: 6.0 },
          { title: "Over/under 3 rounds before midnight", type: 'prop', winner: "Over", pool: 3.0 },
          { title: "First to spill a drink", type: 'prop', winner: "Emma", pool: 2.5 },
        ],
        leaderboard: [
          { user: mockUsers[1], net: 3.2 }, { user: mockUsers[0], net: 0.8 },
          { user: mockUsers[2], net: -0.5 }, { user: mockUsers[3], net: -1.2 },
          { user: mockUsers[4], net: -2.3 },
        ],
      },
      {
        id: 'night-2', name: "Saturday Game Night", date: "Mar 9", bets: 12, winner: "You", duration: "6h 10m",
        betDetails: [
          { title: "Darts tournament winner", type: 'h2h', winner: "You", pool: 8.0 },
          { title: "Will Dave mention his ex?", type: 'prop', winner: "Yes", pool: 5.0 },
          { title: "Beer pong: Sarah & Jake vs You & Mike", type: 'h2h', winner: "You & Mike", pool: 4.0 },
        ],
        leaderboard: [
          { user: mockUsers[0], net: 5.4 }, { user: mockUsers[3], net: 1.2 },
          { user: mockUsers[1], net: -0.8 }, { user: mockUsers[2], net: -2.1 },
          { user: mockUsers[4], net: -3.7 },
        ],
      },
      {
        id: 'night-3', name: "Jake's Birthday", date: "Mar 2", bets: 15, winner: "Jake", duration: "7h 45m",
        betDetails: [
          { title: "Jake finishes the birthday challenge", type: 'prop', winner: "Yes", pool: 10.0 },
          { title: "Karaoke: best performance", type: 'prop', winner: "Jake", pool: 6.0 },
          { title: "Last person standing", type: 'prop', winner: "Mike", pool: 4.5 },
        ],
        leaderboard: [
          { user: mockUsers[2], net: 6.8 }, { user: mockUsers[3], net: 1.5 },
          { user: mockUsers[0], net: -1.0 }, { user: mockUsers[1], net: -3.2 },
          { user: mockUsers[4], net: -4.1 },
        ],
      },
    ],
  },
  {
    id: 'crew-2',
    name: 'Work Happy Hour',
    members: workUsers,
    currentNight: undefined,
    inviteCode: 'WORK-24',
    drinkTheme: 'cocktails',
    pastNights: [
      { id: 'wn-1', name: "Friday Beers", date: "Mar 7", bets: 5, winner: "Priya", duration: "3h 15m", betDetails: [], leaderboard: [] },
      { id: 'wn-2', name: "Launch Party", date: "Feb 28", bets: 9, winner: "You", duration: "5h 30m", betDetails: [], leaderboard: [] },
    ],
  },
  {
    id: 'crew-3',
    name: 'College Boys',
    members: collegeUsers,
    currentNight: undefined,
    inviteCode: 'CLGB-24',
    drinkTheme: 'shots',
    pastNights: [
      { id: 'cn-1', name: "Homecoming", date: "Feb 15", bets: 22, winner: "Brody", duration: "8h 20m", betDetails: [], leaderboard: [] },
      { id: 'cn-2', name: "Super Bowl", date: "Feb 9", bets: 18, winner: "Marcus", duration: "5h 45m", betDetails: [], leaderboard: [] },
      { id: 'cn-3', name: "New Year's", date: "Jan 1", bets: 31, winner: "You", duration: "9h 10m", betDetails: [], leaderboard: [] },
    ],
  },
]

// Per-crew mock data
export const mockCrewData: Record<string, {
  tonightLedger: LedgerEntry[]
  allTimeLedger: LedgerEntry[]
  leaderboard: LeaderboardEntry[]
}> = {
  'crew-1': {
    tonightLedger: mockTonightLedger,
    allTimeLedger: mockAllTimeLedger,
    leaderboard: mockLeaderboard,
  },
  'crew-2': {
    tonightLedger: [],
    allTimeLedger: [
      { fromUser: workUsers[1], toUser: workUsers[0], drinks: 2.1, settled: 1 },
      { fromUser: workUsers[0], toUser: workUsers[2], drinks: 1.4, settled: 1 },
    ],
    leaderboard: [
      { user: workUsers[0], totalWon: 5.2, winRate: 0.55, bestNight: 3.1, streak: 0 },
      { user: workUsers[1], totalWon: 4.8, winRate: 0.51, bestNight: 2.9, streak: 1 },
      { user: workUsers[2], totalWon: 3.1, winRate: 0.42, bestNight: 1.8, streak: 0 },
      { user: workUsers[3], totalWon: 2.7, winRate: 0.48, bestNight: 1.5, streak: 0 },
    ],
  },
  'crew-3': {
    tonightLedger: [],
    allTimeLedger: [
      { fromUser: collegeUsers[1], toUser: collegeUsers[0], drinks: 6.3, settled: 4 },
      { fromUser: collegeUsers[0], toUser: collegeUsers[2], drinks: 3.8, settled: 2 },
      { fromUser: collegeUsers[3], toUser: collegeUsers[0], drinks: 4.1, settled: 3 },
      { fromUser: collegeUsers[0], toUser: collegeUsers[4], drinks: 2.5, settled: 1 },
    ],
    leaderboard: [
      { user: collegeUsers[1], totalWon: 18.5, winRate: 0.61, bestNight: 7.2, streak: 2 },
      { user: collegeUsers[0], totalWon: 15.3, winRate: 0.55, bestNight: 5.8, streak: 0 },
      { user: collegeUsers[4], totalWon: 14.1, winRate: 0.52, bestNight: 6.1, streak: 1 },
      { user: collegeUsers[2], totalWon: 11.7, winRate: 0.48, bestNight: 4.3, streak: 0 },
      { user: collegeUsers[3], totalWon: 10.2, winRate: 0.45, bestNight: 3.9, streak: 0 },
      { user: collegeUsers[5], totalWon: 8.8, winRate: 0.42, bestNight: 3.2, streak: 0 },
      { user: collegeUsers[6], totalWon: 6.4, winRate: 0.38, bestNight: 2.8, streak: 0 },
      { user: collegeUsers[7], totalWon: 4.9, winRate: 0.35, bestNight: 2.1, streak: 0 },
    ],
  },
}

// Backward-compatible single crew references
export const mockCrew: Crew = mockCrews[0]

const CENT_SCALE = 100

function toCents(value: number) {
  return Math.round(value * CENT_SCALE)
}

function fromCents(value: number) {
  return value / CENT_SCALE
}

function isFunded(option: BetOption) {
  return option.wagers.some((wager) => wager.drinks > 0)
}

function sortWagersForRemainder(a: Wager, b: Wager) {
  if (b.drinks !== a.drinks) {
    return b.drinks - a.drinks
  }

  const createdAtDiff = a.createdAt.getTime() - b.createdAt.getTime()
  if (createdAtDiff !== 0) {
    return createdAtDiff
  }

  return a.id.localeCompare(b.id)
}

export function recomputeBetTotals(bet: Bet): Bet {
  const options = bet.options.map((option) => {
    const totalDrinks = option.wagers.reduce((sum, wager) => sum + wager.drinks, 0)
    return {
      ...option,
      totalDrinks: fromCents(toCents(totalDrinks)),
    }
  })

  const totalPool = options.reduce((sum, option) => sum + option.totalDrinks, 0)

  return {
    ...bet,
    options,
    totalPool: fromCents(toCents(totalPool)),
  }
}

export function isValidWagerAmount(drinks: number) {
  return Number.isFinite(drinks) && drinks > 0 && drinks <= 5 && Number.isInteger(drinks * 2)
}

export function getBetOptionById(bet: Bet, optionId: string) {
  return bet.options.find((option) => option.id === optionId)
}

export function getUserWagerForBet(bet: Bet, userId: string) {
  for (const option of bet.options) {
    const wager = option.wagers.find((entry) => entry.user.id === userId)
    if (wager) {
      return {
        optionId: option.id,
        wager,
      }
    }
  }

  return null
}

export function projectBetPayout(bet: Bet, optionId: string, stake: number, userId?: string) {
  if (!isValidWagerAmount(stake)) {
    return 0
  }

  const workingBet = recomputeBetTotals({
    ...bet,
    options: bet.options.map((option) => ({
      ...option,
      wagers: option.wagers.filter((wager) => wager.user.id !== userId),
    })),
  })

  const winningOption = getBetOptionById(workingBet, optionId)
  if (!winningOption) {
    return 0
  }

  const totalWinningStake = winningOption.totalDrinks + stake
  const totalLosingStake = workingBet.totalPool - winningOption.totalDrinks

  if (totalLosingStake <= 0 || totalWinningStake <= 0) {
    return 0
  }

  return fromCents(
    Math.floor((toCents(stake) * toCents(totalLosingStake)) / toCents(totalWinningStake))
  )
}

export function placeOrUpdateBetWager(bet: Bet, user: User, optionId: string, drinks: number): Bet {
  if (bet.status !== 'open' || !isValidWagerAmount(drinks)) {
    return bet
  }

  const updatedBet = {
    ...bet,
    options: bet.options.map((option) => ({
      ...option,
      wagers: option.wagers.filter((wager) => wager.user.id !== user.id),
    })),
  }

  const nextOptions = updatedBet.options.map((option) => {
    if (option.id !== optionId) {
      return option
    }

    return {
      ...option,
      wagers: [
        ...option.wagers,
        {
          id: `w-${Date.now()}-${user.id}`,
          user,
          drinks,
          createdAt: new Date(),
        },
      ],
    }
  })

  return recomputeBetTotals({
    ...updatedBet,
    options: nextOptions,
  })
}

export function resolveBetWithParimutuel(bet: Bet, winningOptionId: string): Bet {
  const recomputedBet = recomputeBetTotals(bet)
  const winningOption = getBetOptionById(recomputedBet, winningOptionId)

  if (!winningOption) {
    return bet
  }

  const fundedOptions = recomputedBet.options.filter(isFunded)
  if (fundedOptions.length <= 1) {
    return {
      ...recomputedBet,
      status: 'void',
      result: undefined,
      voidReason: 'No opposing action',
      memberOutcomes: [],
    }
  }

  const totalWinningStakeCents = toCents(winningOption.totalDrinks)
  const totalLosingStakeCents = toCents(recomputedBet.totalPool - winningOption.totalDrinks)

  if (totalWinningStakeCents <= 0 || totalLosingStakeCents <= 0) {
    return {
      ...recomputedBet,
      status: 'void',
      result: undefined,
      voidReason: totalWinningStakeCents <= 0 ? 'Winning option had no wagers' : 'No opposing action',
      memberOutcomes: [],
    }
  }

  const winningWagers = [...winningOption.wagers].sort(sortWagersForRemainder)
  const winnerProfitCents = new Map<string, number>()
  let allocatedWinnerProfitCents = 0

  for (const wager of winningWagers) {
    const cents = Math.floor((toCents(wager.drinks) * totalLosingStakeCents) / totalWinningStakeCents)
    winnerProfitCents.set(wager.id, cents)
    allocatedWinnerProfitCents += cents
  }

  const remainderCents = totalLosingStakeCents - allocatedWinnerProfitCents
  if (remainderCents > 0 && winningWagers[0]) {
    winnerProfitCents.set(
      winningWagers[0].id,
      (winnerProfitCents.get(winningWagers[0].id) ?? 0) + remainderCents
    )
  }

  const memberOutcomes: BetMemberOutcome[] = []
  for (const option of recomputedBet.options) {
    for (const wager of option.wagers) {
      memberOutcomes.push({
        user: wager.user,
        optionId: option.id,
        stake: wager.drinks,
        netResult: option.id === winningOptionId
          ? fromCents(winnerProfitCents.get(wager.id) ?? 0)
          : -wager.drinks,
      })
    }
  }

  return {
    ...recomputedBet,
    status: 'resolved',
    result: winningOptionId,
    memberOutcomes,
  }
}

export function getMemberOutcomeForBet(bet: Bet, userId: string) {
  return bet.memberOutcomes?.find((outcome) => outcome.user.id === userId) ?? null
}

export function deriveLedgerEntriesFromBets(bets: Bet[]): LedgerEntry[] {
  const entries: LedgerEntry[] = []

  for (const bet of bets) {
    if (bet.status !== 'resolved' || !bet.memberOutcomes?.length) {
      continue
    }

    const winners = bet.memberOutcomes
      .filter((outcome) => outcome.netResult > 0)
      .sort((a, b) => {
        if (b.netResult !== a.netResult) {
          return b.netResult - a.netResult
        }

        return a.user.id.localeCompare(b.user.id)
      })
    const losers = bet.memberOutcomes.filter((outcome) => outcome.netResult < 0)
    const totalWinnerProfitCents = winners.reduce((sum, winner) => sum + toCents(winner.netResult), 0)

    if (totalWinnerProfitCents <= 0) {
      continue
    }

    for (const loser of losers) {
      const loserLossCents = toCents(Math.abs(loser.netResult))
      let allocatedCents = 0

      winners.forEach((winner, index) => {
        const remaining = loserLossCents - allocatedCents
        if (remaining <= 0) {
          return
        }

        const isLast = index === winners.length - 1
        const cents = isLast
          ? remaining
          : Math.floor((loserLossCents * toCents(winner.netResult)) / totalWinnerProfitCents)

        if (cents <= 0) {
          return
        }

        allocatedCents += cents
        entries.push({
          fromUser: loser.user,
          toUser: winner.user,
          drinks: fromCents(cents),
          settled: 0,
          betId: bet.id,
        })
      })
    }
  }

  return entries
}

export const BEER_BOMB_BOARD_SIZE = 8

export function createBeerBombSlotStates(match: Pick<MiniGameMatch, 'boardSize' | 'revealedSlots' | 'status' | 'bombSlotIndex'>): BeerBombSlotState[] {
  const states: BeerBombSlotState[] = Array.from({ length: match.boardSize }, () => 'idle')

  match.revealedSlots.forEach((slotIndex, revealIndex) => {
    if (slotIndex < 0 || slotIndex >= match.boardSize) {
      return
    }

    const isBombHit = match.status === 'completed' && match.bombSlotIndex === slotIndex
    if (isBombHit) {
      states[slotIndex] = 'bomb-hit'
      return
    }

    states[slotIndex] = revealIndex === match.revealedSlots.length - 1 && match.status === 'active'
      ? 'draining'
      : 'safe-empty'
  })

  return states
}

export function canTakeBeerBombTurn(match: Pick<MiniGameMatch, 'status' | 'boardSize' | 'revealedSlots' | 'currentTurn'>, membershipId: string) {
  if (match.status !== 'active') {
    return false
  }

  if (match.currentTurn?.membershipId !== membershipId) {
    return false
  }

  return match.revealedSlots.length < match.boardSize
}

export function getNextBeerBombTurn(match: Pick<MiniGameMatch, 'challenger' | 'opponent' | 'currentTurn'>) {
  if (!match.currentTurn) {
    return match.challenger
  }

  return match.currentTurn.membershipId === match.challenger.membershipId
    ? match.opponent
    : match.challenger
}

export function getBeerBombTurnLabel(match: Pick<MiniGameMatch, 'status' | 'challenger' | 'opponent' | 'currentTurn' | 'winner' | 'loser'>, currentUserId?: string) {
  if (match.status === 'pending') {
    return 'Awaiting response'
  }

  if (match.status === 'declined') {
    return 'Challenge declined'
  }

  if (match.status === 'cancelled') {
    return 'Challenge cancelled'
  }

  if (match.status === 'completed') {
    if (match.winner?.id === currentUserId) {
      return 'You won'
    }

    if (match.loser?.id === currentUserId) {
      return 'You lost'
    }

    return `${match.winner?.name ?? 'Winner'} won`
  }

  if (!match.currentTurn) {
    return 'Match loading'
  }

  return match.currentTurn.id === currentUserId ? 'Your turn' : `${match.currentTurn.name}'s turn`
}

export function createBetFromDraft(input: {
  creator: User
  type: Bet['type']
  subtype: Bet['subtype']
  title: string
  description?: string
  line?: number
  challenger?: User
  options: Array<{ label: string }>
  closeTimeMinutes: number
}) {
  return recomputeBetTotals({
    id: `bet-${Date.now()}`,
    type: input.type,
    subtype: input.subtype,
    title: input.title,
    description: input.description,
    line: input.line,
    creator: input.creator,
    challenger: input.challenger,
    status: 'open',
    closesAt: new Date(Date.now() + input.closeTimeMinutes * 60 * 1000),
    createdAt: new Date(),
    options: input.options.map((option, index) => ({
      id: `${index}-${option.label.toLowerCase().replace(/\s+/g, '-')}`,
      label: option.label,
      wagers: [],
      totalDrinks: 0,
    })),
    totalPool: 0,
  })
}

// Utility functions
export function formatDrinks(drinks: number): string {
  const rounded = fromCents(toCents(drinks))
  if (rounded === Math.floor(rounded)) {
    return rounded.toString()
  }
  return rounded.toFixed(1)
}

export function getTimeRemaining(date: Date): string {
  const diff = date.getTime() - Date.now()
  if (diff <= 0) return 'Closed'
  const minutes = Math.floor(diff / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  if (minutes > 60) {
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }

  return `${seconds}s`
}

export function getTimeRemainingOrLabel(date?: Date | null, fallback = 'Waiting'): string {
  if (!date) {
    return fallback
  }

  return getTimeRemaining(date)
}

export interface NotificationPayload {
  betId?: string
  matchId?: string
  nightId?: string
  status?: string
  challengeWager?: number
  proposedWager?: number
  agreedWager?: number
  pendingResultOptionId?: string | null
  winningOptionId?: string | null
  createdByMembershipId?: string
  challengerMembershipId?: string
  opponentMembershipId?: string
  targetMembershipId?: string
  gameKey?: string
  [key: string]: string | number | boolean | null | undefined
}

export interface Notification {
  id: string
  crewId?: string
  type:
    | 'bet_created'
    | 'bet_resolved'
    | 'challenge'
    | 'crew_invite'
    | 'night_started'
    | 'night_closed'
    | 'settlement_requested'
    | 'settlement_confirmed'
    | 'role_updated'
    | 'guest_joined'
    | 'member_joined'
  title: string
  message: string
  crewName: string
  timestamp: Date
  read: boolean
  payload: NotificationPayload
}

export function getNotificationTargetId(notification: Pick<Notification, 'payload'>) {
  return notification.payload.matchId ?? notification.payload.betId ?? notification.payload.nightId ?? null
}

export function getNotificationActionLabel(notification: Pick<Notification, 'type' | 'payload'>) {
  if (notification.payload.matchId) {
    return 'Open challenge'
  }

  if (notification.payload.betId) {
    return 'Open bet'
  }

  return notification.type === 'night_started' ? 'View night' : 'Open'
}

export function getNetPosition(userId: string, ledger: LedgerEntry[]): number {
  let net = 0

  for (const entry of ledger) {
    if (entry.toUser.id === userId) {
      net += (entry.drinks - entry.settled)
    }
    if (entry.fromUser.id === userId) {
      net -= (entry.drinks - entry.settled)
    }
  }

  return net
}

// Session state
export interface Session {
  user: User | null
  crewCode: string | null
  isInCrew: boolean
}

export function generateCrewCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export const mockNotifications: Notification[] = [
  { id: 'n1', type: 'bet_resolved', title: 'Darts showdown settled', message: 'Sarah won! You earned 1.5 drinks', crewName: 'The Usual Suspects', timestamp: new Date(Date.now() - 1000 * 60 * 5), read: false, payload: { betId: 'bet-1' } },
  { id: 'n2', type: 'challenge', title: 'Jake challenged you!', message: 'Pool match - 2 drinks on the line', crewName: 'The Usual Suspects', timestamp: new Date(Date.now() - 1000 * 60 * 15), read: false, payload: { matchId: 'match-1', proposedWager: 2 } },
  { id: 'n3', type: 'night_started', title: 'Night started!', message: "Friday at O'Malley's is live", crewName: 'The Usual Suspects', timestamp: new Date(Date.now() - 1000 * 60 * 90), read: true, payload: { nightId: 'night-1' } },
  { id: 'n4', type: 'bet_created', title: 'New bet created', message: 'Will Dave mention his ex?', crewName: 'The Usual Suspects', timestamp: new Date(Date.now() - 1000 * 60 * 20), read: true, payload: { betId: 'bet-2' } },
]

export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const seededResolvedBets = mockBets.map((bet) =>
  bet.status === 'resolved' && bet.result ? resolveBetWithParimutuel(bet, bet.result) : recomputeBetTotals(bet)
)

mockCurrentNight.bets = seededResolvedBets
mockCrews[0].currentNight = mockCurrentNight
mockCrewData['crew-1'].tonightLedger = deriveLedgerEntriesFromBets(mockCurrentNight.bets)
