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

export interface Crew {
  id: string
  name: string
  members: User[]
  currentNight?: Night
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
export const mockLeaderboard = [
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

// Mock Crew
export const mockCrew: Crew = {
  id: '1',
  name: 'The Usual Suspects',
  members: mockUsers,
  currentNight: mockCurrentNight,
}

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
