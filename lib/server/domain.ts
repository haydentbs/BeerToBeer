import type { Crew, LedgerEntry, LeaderboardEntry, Notification } from '@/lib/store'
import type { AppSession } from '@/lib/auth'

export interface CrewDataBundle {
  tonightLedger: LedgerEntry[]
  allTimeLedger: LedgerEntry[]
  leaderboard: LeaderboardEntry[]
}

export interface AppBootstrapPayload {
  crews: Crew[]
  crewDataById: Record<string, CrewDataBundle>
  notifications: Notification[]
}

export interface AppMutationPayload extends AppBootstrapPayload {
  session?: AppSession | null
}
