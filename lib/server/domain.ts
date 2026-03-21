import type { Crew, LedgerEntry, LeaderboardEntry, Notification, User } from '@/lib/store'
import type { AppSession } from '@/lib/auth'

export interface CrewDataBundle {
  tonightLedger: LedgerEntry[]
  allTimeLedger: LedgerEntry[]
  leaderboard: LeaderboardEntry[]
}

export interface ClaimableGuest {
  guestMembershipId: string
  guestIdentityId: string
  guestName: string
  crewId: string
  crewName: string
  status: 'active' | 'left' | 'removed'
  joinedAt: string
}

export interface AppBootstrapPayload {
  crews: Crew[]
  crewDataById: Record<string, CrewDataBundle>
  notifications: Notification[]
  viewerUser?: User | null
  claimableGuests?: ClaimableGuest[]
}

export interface AppMutationPayload extends AppBootstrapPayload {
  session?: AppSession | null
}
