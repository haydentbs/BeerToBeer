import type { AppSession } from '@/lib/auth'
import type { CrewDataBundle } from '@/lib/server/domain'
import type { Crew, Notification, User } from '@/lib/store'

export interface SessionResponse {
  actor?: User | null
  crews: Crew[]
  crewNetPositions: Record<string, number>
  notifications: Notification[]
  unreadCount: number
  defaultCrewId: string | null
}

export interface CrewSettlementSummary {
  outstandingTotalDrinks: number
  unsettledEdges: number
}

export interface CrewSnapshotResponse {
  crewId: string
  crew: Crew | null
  tonight: Crew['currentNight'] | null
  ledger: CrewDataBundle
  notifications: Notification[]
  settlement: CrewSettlementSummary
  cursor: number
  unreadCount: number
  viewerUser?: User | null
}

export interface ChangedEntities {
  session?: SessionResponse
  snapshot?: CrewSnapshotResponse
}

export interface RemovedEntityIds {
  betIds: string[]
  notificationIds: string[]
  memberIds: string[]
  matchIds: string[]
}

export interface CrewFeedResponse {
  crewId: string
  cursor: number
  needsSnapshot: boolean
  changed: ChangedEntities
  removed: RemovedEntityIds
  unreadCount: number
}

export interface CommandResponse {
  ok: boolean
  crewId: string | null
  cursor: number | null
  changed: ChangedEntities
  error?: string
  validationErrors?: Record<string, string>
  session?: AppSession | null
}
