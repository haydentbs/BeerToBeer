// BeerScore App State Types and Mock Data

export interface User {
  id: string
  name: string
  avatar: string
  initials: string
}

export interface Bet {
  id: string
  type: 'prop' | 'h2h'
  title: string
  description?: string
  creator: User
  challenger?: User
  status: 'open' | 'locked' | 'resolved' | 'disputed'
  closesAt: Date
  createdAt: Date
  options: BetOption[]
  totalPool: number
  result?: string
}

export interface BetOption {
  id: string
  label: string
  wagers: Wager[]
  totalDrinks: number
}

export interface Wager {
  user: User
  drinks: number
}

export interface LedgerEntry {
  fromUser: User
  toUser: User
  drinks: number
  settled: number
}

export interface Night {
  id: string
  name: string
  status: 'active' | 'winding-down' | 'closed'
  startedAt: Date
  bets: Bet[]
  participants: User[]
}

export interface PastNight {
  name: string
  date: string
  bets: number
  winner: string
}

export interface Crew {
  id: string
  name: string
  members: User[]
  currentNight?: Night
  pastNights: PastNight[]
  inviteCode: string
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

// Mock Active Bets
export const mockBets: Bet[] = [
  {
    id: '1',
    type: 'prop',
    title: 'Will Dave mention his ex?',
    description: 'Over/under 2.5 times in the next hour',
    creator: mockUsers[3],
    status: 'open',
    closesAt: new Date(Date.now() + 1000 * 60 * 45),
    createdAt: new Date(Date.now() - 1000 * 60 * 15),
    options: [
      {
        id: 'over',
        label: 'Over 2.5',
        wagers: [
          { user: mockUsers[1], drinks: 1 },
          { user: mockUsers[4], drinks: 0.5 },
        ],
        totalDrinks: 1.5,
      },
      {
        id: 'under',
        label: 'Under 2.5',
        wagers: [
          { user: mockUsers[2], drinks: 2 },
        ],
        totalDrinks: 2,
      },
    ],
    totalPool: 3.5,
  },
  {
    id: '2',
    type: 'h2h',
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
          { user: mockUsers[2], drinks: 2 },
          { user: mockUsers[4], drinks: 1 },
        ],
        totalDrinks: 3,
      },
      {
        id: 'you',
        label: 'You win',
        wagers: [
          { user: mockUsers[0], drinks: 2 },
          { user: mockUsers[1], drinks: 1.5 },
        ],
        totalDrinks: 3.5,
      },
    ],
    totalPool: 6.5,
  },
  {
    id: '3',
    type: 'prop',
    title: 'First to order food?',
    creator: mockUsers[1],
    status: 'open',
    closesAt: new Date(Date.now() + 1000 * 60 * 60),
    createdAt: new Date(Date.now() - 1000 * 60 * 8),
    options: [
      { id: 'dave', label: 'Dave', wagers: [{ user: mockUsers[3], drinks: 1 }], totalDrinks: 1 },
      { id: 'mike', label: 'Mike', wagers: [{ user: mockUsers[2], drinks: 0.5 }], totalDrinks: 0.5 },
      { id: 'emma', label: 'Emma', wagers: [{ user: mockUsers[4], drinks: 1 }], totalDrinks: 1 },
      { id: 'other', label: 'Someone else', wagers: [], totalDrinks: 0 },
    ],
    totalPool: 2.5,
  },
  {
    id: '4',
    type: 'h2h',
    title: 'Darts showdown',
    creator: mockUsers[1],
    challenger: mockUsers[3],
    status: 'resolved',
    closesAt: new Date(Date.now() - 1000 * 60 * 30),
    createdAt: new Date(Date.now() - 1000 * 60 * 90),
    options: [
      { id: 'sarah', label: 'Sarah wins', wagers: [{ user: mockUsers[1], drinks: 2 }, { user: mockUsers[4], drinks: 1 }], totalDrinks: 3 },
      { id: 'mike', label: 'Mike wins', wagers: [{ user: mockUsers[3], drinks: 2 }], totalDrinks: 2 },
    ],
    totalPool: 5,
    result: 'sarah',
  },
  {
    id: '5',
    type: 'prop',
    title: 'Will someone get kicked out?',
    creator: mockUsers[5],
    status: 'resolved',
    closesAt: new Date(Date.now() - 1000 * 60 * 45),
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
    options: [
      { id: 'yes', label: 'Yes', wagers: [{ user: mockUsers[0], drinks: 1 }, { user: mockUsers[2], drinks: 0.5 }], totalDrinks: 1.5 },
      { id: 'no', label: 'No', wagers: [{ user: mockUsers[5], drinks: 2 }], totalDrinks: 2 },
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
    pastNights: [
      { name: "Thursday at The Local", date: "Mar 14", bets: 8, winner: "Sarah" },
      { name: "Saturday Game Night", date: "Mar 9", bets: 12, winner: "You" },
      { name: "Jake's Birthday", date: "Mar 2", bets: 15, winner: "Jake" },
    ],
  },
  {
    id: 'crew-2',
    name: 'Work Happy Hour',
    members: workUsers,
    currentNight: undefined,
    inviteCode: 'WORK-24',
    pastNights: [
      { name: "Friday Beers", date: "Mar 7", bets: 5, winner: "Priya" },
      { name: "Launch Party", date: "Feb 28", bets: 9, winner: "You" },
    ],
  },
  {
    id: 'crew-3',
    name: 'College Boys',
    members: collegeUsers,
    currentNight: undefined,
    inviteCode: 'CLGB-24',
    pastNights: [
      { name: "Homecoming", date: "Feb 15", bets: 22, winner: "Brody" },
      { name: "Super Bowl", date: "Feb 9", bets: 18, winner: "Marcus" },
      { name: "New Year's", date: "Jan 1", bets: 31, winner: "You" },
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

// Utility functions
export function formatDrinks(drinks: number): string {
  if (drinks === Math.floor(drinks)) {
    return drinks.toString()
  }
  return drinks.toFixed(1)
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

// Notifications
export interface Notification {
  id: string
  type: 'bet_created' | 'bet_resolved' | 'challenge' | 'crew_invite' | 'night_started'
  title: string
  message: string
  crewName: string
  timestamp: Date
  read: boolean
}

export const mockNotifications: Notification[] = [
  { id: 'n1', type: 'bet_resolved', title: 'Darts showdown settled', message: 'Sarah won! You earned 1.5 drinks', crewName: 'The Usual Suspects', timestamp: new Date(Date.now() - 1000 * 60 * 5), read: false },
  { id: 'n2', type: 'challenge', title: 'Jake challenged you!', message: 'Pool match - 2 drinks on the line', crewName: 'The Usual Suspects', timestamp: new Date(Date.now() - 1000 * 60 * 15), read: false },
  { id: 'n3', type: 'night_started', title: 'Night started!', message: "Friday at O'Malley's is live", crewName: 'The Usual Suspects', timestamp: new Date(Date.now() - 1000 * 60 * 90), read: true },
  { id: 'n4', type: 'bet_created', title: 'New bet created', message: 'Will Dave mention his ex?', crewName: 'The Usual Suspects', timestamp: new Date(Date.now() - 1000 * 60 * 20), read: true },
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
