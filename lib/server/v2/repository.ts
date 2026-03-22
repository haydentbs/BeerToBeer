import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { AppSession } from '@/lib/auth'
import type { CrewDataBundle } from '@/lib/server/domain'
import {
  joinCrewAsGuest,
  loadAppState,
  mutateAppState,
  runExpirationSweep,
} from '@/lib/server/repository'
import type { RequestActor } from '@/lib/server/session'
import { getServiceRoleClient } from '@/lib/server/supabase'
import type { Crew, LedgerEntry, Notification, PastNight, User } from '@/lib/store'
import { getNetPosition } from '@/lib/store'
import type {
  CommandResponse,
  CrewFeedResponse,
  CrewSnapshotResponse,
  CrewSettlementSummary,
  RemovedEntityIds,
  SessionResponse,
} from './domain'

const PROFILE_SELECT = 'id, auth_user_id, email, display_name, avatar_url, initials, created_at, updated_at'
const PROFILE_VIEWER_SELECT = 'id, email, display_name, avatar_url, initials'
const GUEST_IDENTITY_SELECT = 'id, display_name, initials, created_at, updated_at'
const CREW_MEMBERSHIP_SELECT = 'id, crew_id, actor_type, profile_id, guest_identity_id, role, status, joined_at, left_at, created_at, updated_at'
const CREW_MEMBERSHIP_WITH_ACTOR_SELECT =
  `${CREW_MEMBERSHIP_SELECT}, profiles(${PROFILE_VIEWER_SELECT}), guest_identities(${GUEST_IDENTITY_SELECT})`
const NOTIFICATION_SELECT = 'id, crew_id, membership_id, profile_id, type, title, message, payload, read_at, created_at'

interface ActorContext {
  profile: any | null
  guestIdentityId: string | null
  memberships: any[]
  activeMemberships: any[]
  viewerUser: User | null
  crewIds: string[]
  membershipIds: string[]
  membershipIdByCrewId: Map<string, string>
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'BS'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function normalizeInviteCode(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function asDate(value: string | Date | null | undefined) {
  return value ? new Date(value) : new Date()
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value ?? undefined
}

function compareMemberships(a: any, b: any) {
  const roleOrder: Record<string, number> = {
    creator: 0,
    admin: 1,
    member: 2,
    guest: 3,
  }

  const roleDelta = (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99)
  if (roleDelta !== 0) {
    return roleDelta
  }

  return asDate(a.joined_at).getTime() - asDate(b.joined_at).getTime()
}

function buildUserFromMembership(membership: any): User {
  const profile = unwrapRelation(membership.profiles)
  const guest = unwrapRelation(membership.guest_identities)
  const name = profile?.display_name ?? profile?.email ?? guest?.display_name ?? 'Player'

  return {
    id: profile?.id ?? guest?.id ?? membership.id,
    membershipId: membership.id,
    role: membership.role,
    name,
    avatar: profile?.avatar_url ?? '',
    initials: profile?.initials ?? guest?.initials ?? getInitials(name),
  }
}

function buildViewerUser(profile: any, memberships: any[]): User {
  const primaryMembership = memberships
    .slice()
    .sort(compareMemberships)
    .find((membership: any) => membership.profile_id === profile.id)

  return {
    id: profile.id,
    membershipId: primaryMembership?.id,
    role: primaryMembership?.role ?? 'member',
    name: profile.display_name ?? profile.email ?? 'Player',
    avatar: profile.avatar_url ?? '',
    initials: profile.initials ?? getInitials(profile.display_name ?? profile.email ?? 'Player'),
  }
}

function formatPastNightDate(value: string | Date | null | undefined) {
  return asDate(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function formatDuration(startedAt: string | Date | null | undefined, endedAt: string | Date | null | undefined) {
  if (!endedAt) {
    return 'Finished'
  }

  const durationMs = Math.max(0, asDate(endedAt).getTime() - asDate(startedAt).getTime())
  const totalMinutes = Math.max(1, Math.round(durationMs / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours && minutes) {
    return `${hours}h ${minutes}m`
  }

  if (hours) {
    return `${hours}h`
  }

  return `${minutes}m`
}

function buildPastNightSummary(row: any): PastNight {
  return {
    id: row.id,
    name: row.name,
    date: formatPastNightDate(row.started_at),
    bets: Number(row.bet_count ?? 0),
    winner: row.winner_name ?? '-',
    duration: formatDuration(row.started_at, row.ended_at),
    betDetails: [],
    leaderboard: [],
  }
}

function mapNotificationRow(row: any, crewNameById: Map<string, string>): Notification {
  return {
    id: row.id,
    crewId: row.crew_id,
    type: row.type,
    title: row.title,
    message: row.message,
    crewName: crewNameById.get(row.crew_id) ?? 'SettleUp',
    timestamp: asDate(row.created_at),
    read: Boolean(row.read_at),
    payload: row.payload ?? {},
  }
}

function emptyCrewDataBundle(): CrewDataBundle {
  return {
    tonightLedger: [],
    allTimeLedger: [],
    leaderboard: [],
  }
}

function buildSettlementSummary(entries: LedgerEntry[]): CrewSettlementSummary {
  const outstandingEntries = entries
    .map((entry) => Number((Math.max(0, entry.drinks - entry.settled)).toFixed(2)))
    .filter((drinks) => drinks > 0)

  return {
    outstandingTotalDrinks: Number(outstandingEntries.reduce((sum, drinks) => sum + drinks, 0).toFixed(2)),
    unsettledEdges: outstandingEntries.length,
  }
}

function normalizeRemovedIds(input: unknown): RemovedEntityIds {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      betIds: [],
      notificationIds: [],
      memberIds: [],
      matchIds: [],
    }
  }

  const raw = input as Record<string, unknown>
  const readIds = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      : []

  return {
    betIds: readIds(raw.betIds),
    notificationIds: readIds(raw.notificationIds),
    memberIds: readIds(raw.memberIds),
    matchIds: readIds(raw.matchIds),
  }
}

function isCrewEventLogMissingError(error: { message?: string } | null | undefined) {
  const message = error?.message ?? ''
  return /crew_event_log|schema cache|could not find the table/i.test(message)
}

async function ensureActorProfile(authUser: SupabaseUser) {
  const supabase = getServiceRoleClient()
  const displayName =
    typeof authUser.user_metadata.full_name === 'string' && authUser.user_metadata.full_name.trim()
      ? authUser.user_metadata.full_name.trim()
      : authUser.email?.split('@')[0] ?? 'Player'

  const payload = {
    auth_user_id: authUser.id,
    email: authUser.email ?? null,
    display_name: displayName,
    avatar_url: typeof authUser.user_metadata.avatar_url === 'string' ? authUser.user_metadata.avatar_url : null,
    initials: getInitials(displayName),
  }

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('auth_user_id', authUser.id)
    .maybeSingle()

  if (existingProfileError) {
    throw existingProfileError
  }

  let profile = existingProfile

  if (!profile) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'auth_user_id' })
      .select(PROFILE_SELECT)
      .single()

    if (error) {
      throw error
    }

    profile = data
  }

  const { data: existingPreferences, error: preferencesError } = await supabase
    .from('profile_preferences')
    .select('profile_id')
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (preferencesError) {
    throw preferencesError
  }

  if (!existingPreferences) {
    const { error } = await supabase
      .from('profile_preferences')
      .insert({ profile_id: profile.id })

    if (error && error.code !== '23505') {
      throw error
    }
  }

  return profile
}

async function resolveActorContext(actor: RequestActor): Promise<ActorContext> {
  const supabase = getServiceRoleClient()
  let profile: any | null = null
  let guestIdentityId: string | null = null

  if (actor.kind === 'authenticated') {
    profile = await ensureActorProfile(actor.authUser)
  } else if (actor.kind === 'guest') {
    guestIdentityId = actor.session.guestIdentityId ?? null
  } else {
    return {
      profile: null,
      guestIdentityId: null,
      memberships: [],
      activeMemberships: [],
      viewerUser: null,
      crewIds: [],
      membershipIds: [],
      membershipIdByCrewId: new Map(),
    }
  }

  let membershipsQuery = supabase
    .from('crew_memberships')
    .select(CREW_MEMBERSHIP_WITH_ACTOR_SELECT)

  if (profile) {
    membershipsQuery = membershipsQuery.eq('profile_id', profile.id)
  } else if (guestIdentityId) {
    membershipsQuery = membershipsQuery.eq('guest_identity_id', guestIdentityId)
  }

  const { data: memberships, error } = await membershipsQuery
  if (error) {
    throw error
  }

  const activeMemberships = (memberships ?? [])
    .filter((membership: any) => membership.status === 'active')
    .sort(compareMemberships)
  const crewIds = [...new Set(activeMemberships.map((membership: any) => membership.crew_id))]
  const membershipIds = activeMemberships.map((membership: any) => membership.id)
  const membershipIdByCrewId = new Map<string, string>()

  activeMemberships.forEach((membership: any) => {
    if (!membershipIdByCrewId.has(membership.crew_id)) {
      membershipIdByCrewId.set(membership.crew_id, membership.id)
    }
  })

  const viewerUser = profile
    ? buildViewerUser(profile, activeMemberships)
    : activeMemberships[0]
      ? buildUserFromMembership(activeMemberships[0])
      : null

  return {
    profile,
    guestIdentityId,
    memberships: memberships ?? [],
    activeMemberships,
    viewerUser,
    crewIds,
    membershipIds,
    membershipIdByCrewId,
  }
}

async function loadNotificationsForActor(context: ActorContext) {
  const supabase = getServiceRoleClient()

  if (context.profile) {
    const query =
      context.membershipIds.length > 0
        ? supabase
            .from('notifications')
            .select(NOTIFICATION_SELECT)
            .or(`profile_id.eq.${context.profile.id},membership_id.in.(${context.membershipIds.join(',')})`)
            .order('created_at', { ascending: false })
            .limit(50)
        : supabase
            .from('notifications')
            .select(NOTIFICATION_SELECT)
            .eq('profile_id', context.profile.id)
            .order('created_at', { ascending: false })
            .limit(50)

    const { data, error } = await query
    if (error) {
      throw error
    }

    return data ?? []
  }

  if (context.membershipIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .in('membership_id', context.membershipIds)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    throw error
  }

  return data ?? []
}

async function loadCrewCursor(crewId: string) {
  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from('crew_event_log')
    .select('id')
    .eq('crew_id', crewId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isCrewEventLogMissingError(error)) {
      return 0
    }
    throw error
  }

  return Number(data?.id ?? 0)
}

async function appendCrewEvent(
  crewId: string,
  eventType: string,
  payload: Record<string, unknown> = {},
  entityTable?: string,
  entityId?: string | null
) {
  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from('crew_event_log')
    .insert({
      crew_id: crewId,
      event_type: eventType,
      entity_table: entityTable ?? null,
      entity_id: entityId ?? null,
      payload,
    })
    .select('id')
    .single()

  if (error) {
    if (isCrewEventLogMissingError(error)) {
      return null
    }
    throw error
  }

  return Number(data.id)
}

function resolveCrewIdFromPayload(payload: { activeCrewId?: string | null; crews?: Crew[] }, fallbackCrewId?: string | null) {
  if (fallbackCrewId) {
    return fallbackCrewId
  }

  if (payload.activeCrewId) {
    return payload.activeCrewId
  }

  return payload.crews?.[0]?.id ?? null
}

async function buildSnapshotFromBootstrapPayload(
  crewId: string,
  payload: {
    crews: Crew[]
    crewDataById: Record<string, CrewDataBundle>
    notifications: Notification[]
    viewerUser?: User | null
  },
  cursor?: number
): Promise<CrewSnapshotResponse> {
  const crew = payload.crews.find((entry) => entry.id === crewId) ?? null
  const ledger = payload.crewDataById[crewId] ?? emptyCrewDataBundle()
  const resolvedCursor = cursor ?? await loadCrewCursor(crewId)

  return {
    crewId,
    crew,
    tonight: crew?.currentNight ?? null,
    ledger,
    notifications: payload.notifications ?? [],
    settlement: buildSettlementSummary(ledger.allTimeLedger),
    cursor: resolvedCursor,
    unreadCount: (payload.notifications ?? []).filter((notification) => !notification.read).length,
    viewerUser: payload.viewerUser ?? null,
  }
}

async function buildSessionResponseForActor(actor: RequestActor): Promise<SessionResponse> {
  const supabase = getServiceRoleClient()
  const context = await resolveActorContext(actor)

  if (context.crewIds.length === 0) {
    return {
      actor: context.viewerUser ?? null,
      crews: [],
      crewNetPositions: {},
      notifications: [],
      unreadCount: 0,
      defaultCrewId: null,
    }
  }

  const [
    crewResult,
    activeNightResult,
    pastNightResult,
    membershipResult,
    balanceResult,
    notificationRows,
  ] = await Promise.all([
    supabase
      .from('crews')
      .select('id, name, invite_code, drink_theme')
      .in('id', context.crewIds)
      .is('archived_at', null),
    supabase
      .from('nights')
      .select('id, crew_id, name, status, started_at, drink_theme_override')
      .in('crew_id', context.crewIds)
      .in('status', ['active', 'winding-down'])
      .order('started_at', { ascending: false }),
    supabase
      .from('nights')
      .select('id, crew_id, name, started_at, ended_at')
      .in('crew_id', context.crewIds)
      .eq('status', 'closed')
      .order('started_at', { ascending: false }),
    supabase
      .from('crew_memberships')
      .select(CREW_MEMBERSHIP_WITH_ACTOR_SELECT)
      .in('crew_id', context.crewIds)
      .eq('status', 'active'),
    supabase
      .from('crew_balances_v')
      .select('crew_id, from_membership_id, to_membership_id, outstanding')
      .in('crew_id', context.crewIds),
    loadNotificationsForActor(context),
  ])

  if (crewResult.error) throw crewResult.error
  if (activeNightResult.error) throw activeNightResult.error
  if (pastNightResult.error) throw pastNightResult.error
  if (membershipResult.error) throw membershipResult.error
  if (balanceResult.error) throw balanceResult.error

  const crewRows = crewResult.data ?? []
  const activeNights = activeNightResult.data ?? []
  const activeNightIds = activeNights.map((night: any) => night.id)
  const { data: openBetRows, error: openBetError } = activeNightIds.length
    ? await supabase
        .from('bets')
        .select('night_id')
        .in('night_id', activeNightIds)
        .eq('status', 'open')
    : { data: [], error: null }

  if (openBetError) {
    throw openBetError
  }

  const crewNameById = new Map<string, string>()
  crewRows.forEach((row: any) => {
    crewNameById.set(row.id, row.name)
  })

  const membersByCrewId = new Map<string, User[]>()
  ;(membershipResult.data ?? [])
    .sort(compareMemberships)
    .forEach((membership: any) => {
      const bucket = membersByCrewId.get(membership.crew_id) ?? []
      bucket.push(buildUserFromMembership(membership))
      membersByCrewId.set(membership.crew_id, bucket)
    })

  const activeNightByCrewId = new Map<string, any>()
  activeNights.forEach((night: any) => {
    if (!activeNightByCrewId.has(night.crew_id)) {
      activeNightByCrewId.set(night.crew_id, night)
    }
  })

  const openBetCountByNightId = new Map<string, number>()
  ;(openBetRows ?? []).forEach((row: any) => {
    openBetCountByNightId.set(row.night_id, (openBetCountByNightId.get(row.night_id) ?? 0) + 1)
  })

  const lastPastNightByCrewId = new Map<string, PastNight>()
  ;(pastNightResult.data ?? []).forEach((row: any) => {
    if (!lastPastNightByCrewId.has(row.crew_id)) {
      lastPastNightByCrewId.set(row.crew_id, buildPastNightSummary(row))
    }
  })

  const crewNetPositions: Record<string, number> = {}
  ;(balanceResult.data ?? []).forEach((row: any) => {
    const actorMembershipId = context.membershipIdByCrewId.get(row.crew_id)
    if (!actorMembershipId) {
      return
    }

    const amount = Number(row.outstanding ?? 0)
    crewNetPositions[row.crew_id] = crewNetPositions[row.crew_id] ?? 0

    if (row.from_membership_id === actorMembershipId) {
      crewNetPositions[row.crew_id] -= amount
    } else if (row.to_membership_id === actorMembershipId) {
      crewNetPositions[row.crew_id] += amount
    }
  })

  const notifications = notificationRows.map((row: any) => mapNotificationRow(row, crewNameById))

  const crews = crewRows
    .map((row: any) => {
      const activeNight = activeNightByCrewId.get(row.id)

      return {
        id: row.id,
        name: row.name,
        members: membersByCrewId.get(row.id) ?? [],
        currentNight: activeNight
          ? {
              id: activeNight.id,
              name: activeNight.name,
              status: activeNight.status,
              startedAt: asDate(activeNight.started_at),
              participants: [],
              bets: [],
              miniGameMatches: [],
              drinkThemeOverride: activeNight.drink_theme_override ?? undefined,
            }
          : undefined,
        currentNightOpenBetCount: activeNight ? (openBetCountByNightId.get(activeNight.id) ?? 0) : 0,
        pastNights: lastPastNightByCrewId.has(row.id) ? [lastPastNightByCrewId.get(row.id)!] : [],
        inviteCode: row.invite_code,
        drinkTheme: row.drink_theme ?? undefined,
      } satisfies Crew
    })
    .sort((a, b) => {
      if (a.currentNight && !b.currentNight) return -1
      if (!a.currentNight && b.currentNight) return 1
      return a.name.localeCompare(b.name)
    })

  crews.forEach((crew) => {
    crewNetPositions[crew.id] = Number((crewNetPositions[crew.id] ?? 0).toFixed(2))
  })

  return {
    actor: context.viewerUser ?? null,
    crews,
    crewNetPositions,
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read).length,
    defaultCrewId: crews.find((crew) => crew.currentNight)?.id ?? crews[0]?.id ?? null,
  }
}

async function buildCommandResponse(
  actor: RequestActor,
  payload: {
    crews: Crew[]
    crewDataById: Record<string, CrewDataBundle>
    notifications: Notification[]
    viewerUser?: User | null
    activeCrewId?: string | null
  },
  options: {
    crewId?: string | null
    eventType: string
    entityTable?: string
    entityId?: string | null
    eventPayload?: Record<string, unknown>
    session?: AppSession | null
  }
): Promise<CommandResponse> {
  const crewId = resolveCrewIdFromPayload(payload, options.crewId ?? null)
  const cursor = crewId
    ? await appendCrewEvent(
        crewId,
        options.eventType,
        options.eventPayload ?? {},
        options.entityTable,
        options.entityId ?? null
      )
    : null

  const sessionResponse = await buildSessionResponseForActor(actor)
  const snapshot = crewId
    ? await buildSnapshotFromBootstrapPayload(crewId, payload, cursor ?? undefined)
    : undefined

  return {
    ok: true,
    crewId,
    cursor,
    changed: {
      session: sessionResponse,
      ...(snapshot ? { snapshot } : {}),
    },
    ...(options.session !== undefined ? { session: options.session } : {}),
  }
}

export async function fetchSessionState(actor: RequestActor): Promise<SessionResponse> {
  return buildSessionResponseForActor(actor)
}

export async function fetchCrewSnapshotState(actor: RequestActor, crewId: string): Promise<CrewSnapshotResponse> {
  const payload = await loadAppState(actor, {
    mode: 'crew',
    activeCrewId: crewId,
  })

  return buildSnapshotFromBootstrapPayload(crewId, payload)
}

export async function fetchCrewFeedState(actor: RequestActor, crewId: string, after: number | null): Promise<CrewFeedResponse> {
  const supabase = getServiceRoleClient()
  const latestCursor = await loadCrewCursor(crewId)

  if (after != null && after > latestCursor) {
    return {
      crewId,
      cursor: latestCursor,
      needsSnapshot: true,
      changed: {},
      removed: {
        betIds: [],
        notificationIds: [],
        memberIds: [],
        matchIds: [],
      },
      unreadCount: 0,
    }
  }

  if (after != null && after === latestCursor) {
    const session = await buildSessionResponseForActor(actor)
    return {
      crewId,
      cursor: latestCursor,
      needsSnapshot: false,
      changed: {},
      removed: {
        betIds: [],
        notificationIds: [],
        memberIds: [],
        matchIds: [],
      },
      unreadCount: session.unreadCount,
    }
  }

  const { data: events, error } = await supabase
    .from('crew_event_log')
    .select('id, payload')
    .eq('crew_id', crewId)
    .gt('id', after ?? 0)
    .order('id', { ascending: true })
    .limit(100)

  if (error) {
    if (isCrewEventLogMissingError(error)) {
      const snapshot = await fetchCrewSnapshotState(actor, crewId)
      return {
        crewId,
        cursor: snapshot.cursor,
        needsSnapshot: true,
        changed: {},
        removed: {
          betIds: [],
          notificationIds: [],
          memberIds: [],
          matchIds: [],
        },
        unreadCount: snapshot.unreadCount,
      }
    }
    throw error
  }

  if (!events?.length) {
    const session = await buildSessionResponseForActor(actor)
    return {
      crewId,
      cursor: latestCursor,
      needsSnapshot: false,
      changed: {},
      removed: {
        betIds: [],
        notificationIds: [],
        memberIds: [],
        matchIds: [],
      },
      unreadCount: session.unreadCount,
    }
  }

  const removed = events.reduce<RemovedEntityIds>((acc, event: any) => {
    const next = normalizeRemovedIds(event.payload?.removed)
    acc.betIds.push(...next.betIds)
    acc.notificationIds.push(...next.notificationIds)
    acc.memberIds.push(...next.memberIds)
    acc.matchIds.push(...next.matchIds)
    return acc
  }, {
    betIds: [],
    notificationIds: [],
    memberIds: [],
    matchIds: [],
  })

  const snapshot = await fetchCrewSnapshotState(actor, crewId)
  return {
    crewId,
    cursor: snapshot.cursor,
    needsSnapshot: false,
    changed: {
      snapshot,
    },
    removed,
    unreadCount: snapshot.unreadCount,
  }
}

export async function runGuestJoinCommand(name: string, crewCode: string, options?: { matchId?: string }): Promise<CommandResponse> {
  const payload = await joinCrewAsGuest(name, crewCode, { mode: 'crew', matchId: options?.matchId })
  if (!payload.session) {
    throw new Error('Guest session could not be created.')
  }

  const guestActor: RequestActor = {
    kind: 'guest',
    session: payload.session,
  }
  const normalizedCode = normalizeInviteCode(crewCode)
  const crewId =
    payload.crews.find((crew: Crew) => normalizeInviteCode(crew.inviteCode) === normalizedCode)?.id ??
    payload.activeCrewId ??
    payload.crews[0]?.id ??
    null

  return buildCommandResponse(guestActor, payload, {
    crewId,
    eventType: 'guest.joined',
    entityTable: 'crew_memberships',
    eventPayload: {
      joinedAsGuest: true,
    },
    session: payload.session,
  })
}

export async function runMutationCommand(
  actor: RequestActor,
  action: string,
  payload: Record<string, any>,
  options: {
    crewId?: string | null
    eventType: string
    entityTable?: string
    entityId?: string | null
  }
): Promise<CommandResponse> {
  const mutationPayload = await mutateAppState(actor, action, payload)

  return buildCommandResponse(actor, mutationPayload, {
    crewId: options.crewId ?? payload.crewId ?? null,
    eventType: options.eventType,
    entityTable: options.entityTable,
    entityId: options.entityId ?? payload.betId ?? payload.nightId ?? null,
  })
}

export async function runMarkNotificationsReadCommand(actor: RequestActor): Promise<CommandResponse> {
  const supabase = getServiceRoleClient()
  const context = await resolveActorContext(actor)
  const nowIso = new Date().toISOString()

  if (context.profile) {
    const { error: profileError } = await supabase
      .from('notifications')
      .update({ read_at: nowIso })
      .eq('profile_id', context.profile.id)
      .is('read_at', null)

    if (profileError) {
      throw profileError
    }
  }

  if (context.membershipIds.length) {
    const { error: membershipError } = await supabase
      .from('notifications')
      .update({ read_at: nowIso })
      .in('membership_id', context.membershipIds)
      .is('read_at', null)

    if (membershipError) {
      throw membershipError
    }
  }

  return {
    ok: true,
    crewId: null,
    cursor: null,
    changed: {
      session: await buildSessionResponseForActor(actor),
    },
  }
}

export async function runUpdateProfileCommand(actor: RequestActor, name: string): Promise<CommandResponse> {
  if (actor.kind !== 'authenticated') {
    throw new Error('Only signed-in members can update their profile.')
  }

  const nextName = name.trim()
  if (!nextName) {
    throw new Error('Name is required.')
  }

  const supabase = getServiceRoleClient()
  const profile = await ensureActorProfile(actor.authUser)
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: nextName,
      initials: getInitials(nextName),
    })
    .eq('id', profile.id)

  if (error) {
    throw error
  }

  return {
    ok: true,
    crewId: null,
    cursor: null,
    changed: {
      session: await buildSessionResponseForActor(actor),
    },
  }
}

export async function runExpirationSweepCommand() {
  const result = await runExpirationSweep()

  await Promise.all(
    (result.processedCrewIds ?? []).map((crewId: string) =>
      appendCrewEvent(crewId, 'system.expiration_sweep', { processedBy: 'internal-route' })
    )
  )

  return result
}
