import type { User as SupabaseUser } from '@supabase/supabase-js'
import { buildGuestSession, type AppSession } from '@/lib/auth'
import {
  deriveLedgerEntriesFromBets,
  generateCrewCode,
  resolveBetWithParimutuel,
  type Bet,
  type Crew,
  type LeaderboardEntry,
  type LedgerEntry,
  type Night,
  type Notification,
  type PastNight,
  type User,
} from '@/lib/store'
import { getServiceRoleClient } from '@/lib/server/supabase'
import type { AppBootstrapPayload, AppMutationPayload, ClaimableGuest, CrewDataBundle } from '@/lib/server/domain'
import type { RequestActor } from '@/lib/server/session'

type DrinkTheme = Crew['drinkTheme']
type Role = 'creator' | 'admin' | 'member' | 'guest'

const ROLE_ORDER: Record<Role, number> = {
  creator: 0,
  admin: 1,
  member: 2,
  guest: 3,
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'BS'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function isValidHalfDrinkAmount(value: number) {
  return Number.isFinite(value) && value > 0 && Math.round(value * 2) === value * 2
}

function asDate(value: string | Date | null | undefined) {
  return value ? new Date(value) : new Date()
}

function compareMemberships(a: any, b: any) {
  const roleDelta = (ROLE_ORDER[a.role as Role] ?? 99) - (ROLE_ORDER[b.role as Role] ?? 99)
  if (roleDelta !== 0) return roleDelta
  return asDate(a.joined_at).getTime() - asDate(b.joined_at).getTime()
}

function buildUserFromMembership(membership: any): User {
  const profile = membership.profiles
  const guest = membership.guest_identities
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

async function mergeGuestWagers(fromMembershipId: string, toMembershipId: string) {
  const supabase = getServiceRoleClient()
  const { data: guestWagers, error: guestWagersError } = await supabase
    .from('wagers')
    .select('*')
    .eq('membership_id', fromMembershipId)

  if (guestWagersError) throw guestWagersError

  for (const guestWager of guestWagers ?? []) {
    const { data: targetWager, error: targetWagerError } = await supabase
      .from('wagers')
      .select('*')
      .eq('membership_id', toMembershipId)
      .eq('bet_id', guestWager.bet_id)
      .maybeSingle()

    if (targetWagerError) throw targetWagerError

    if (!targetWager) {
      const { error: updateError } = await supabase
        .from('wagers')
        .update({ membership_id: toMembershipId })
        .eq('id', guestWager.id)

      if (updateError) throw updateError
      continue
    }

    if (targetWager.bet_option_id !== guestWager.bet_option_id) {
      throw new Error('This guest cannot be claimed yet because both identities placed conflicting wagers on the same bet.')
    }

    const { error: mergeError } = await supabase
      .from('wagers')
      .update({
        drinks: Number(targetWager.drinks) + Number(guestWager.drinks),
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetWager.id)

    if (mergeError) throw mergeError

    const { error: deleteError } = await supabase
      .from('wagers')
      .delete()
      .eq('id', guestWager.id)

    if (deleteError) throw deleteError
  }
}

async function mergeNightParticipants(fromMembershipId: string, toMembershipId: string) {
  const supabase = getServiceRoleClient()
  const { data: guestParticipants, error: guestParticipantsError } = await supabase
    .from('night_participants')
    .select('*')
    .eq('membership_id', fromMembershipId)

  if (guestParticipantsError) throw guestParticipantsError

  for (const guestParticipant of guestParticipants ?? []) {
    const { data: targetParticipant, error: targetParticipantError } = await supabase
      .from('night_participants')
      .select('*')
      .eq('membership_id', toMembershipId)
      .eq('night_id', guestParticipant.night_id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (targetParticipantError) throw targetParticipantError

    if (!targetParticipant) {
      const { error: updateError } = await supabase
        .from('night_participants')
        .update({ membership_id: toMembershipId })
        .eq('id', guestParticipant.id)

      if (updateError) throw updateError
      continue
    }

    const mergedJoinedAt = new Date(
      Math.min(new Date(targetParticipant.joined_at).getTime(), new Date(guestParticipant.joined_at).getTime())
    ).toISOString()
    const mergedLeftAt =
      targetParticipant.left_at == null || guestParticipant.left_at == null
        ? null
        : new Date(
            Math.max(new Date(targetParticipant.left_at).getTime(), new Date(guestParticipant.left_at).getTime())
          ).toISOString()

    const { error: preserveError } = await supabase
      .from('night_participants')
      .update({
        joined_at: mergedJoinedAt,
        left_at: mergedLeftAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetParticipant.id)

    if (preserveError) throw preserveError

    const { error: deleteError } = await supabase
      .from('night_participants')
      .delete()
      .eq('id', guestParticipant.id)

    if (deleteError) throw deleteError
  }
}

async function mergeDuplicateMembershipRows(table: string, uniqueColumn: string, fromMembershipId: string, toMembershipId: string) {
  const supabase = getServiceRoleClient()
  const { data: rows, error: rowsError } = await supabase
    .from(table)
    .select('*')
    .eq('membership_id', fromMembershipId)

  if (rowsError) throw rowsError

  for (const row of rows ?? []) {
    const { data: targetRow, error: targetRowError } = await supabase
      .from(table)
      .select('*')
      .eq('membership_id', toMembershipId)
      .eq(uniqueColumn, row[uniqueColumn])
      .maybeSingle()

    if (targetRowError) throw targetRowError

    if (targetRow) {
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq('id', row.id)

      if (deleteError) throw deleteError
      continue
    }

    const { error: updateError } = await supabase
      .from(table)
      .update({ membership_id: toMembershipId })
      .eq('id', row.id)

    if (updateError) throw updateError
  }
}

async function mergeGuestNotificationPreference(fromMembershipId: string, toMembershipId: string) {
  const supabase = getServiceRoleClient()
  const { data: guestPreference, error: guestPreferenceError } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('membership_id', fromMembershipId)
    .maybeSingle()

  if (guestPreferenceError) throw guestPreferenceError
  if (!guestPreference) return

  const { data: targetPreference, error: targetPreferenceError } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('membership_id', toMembershipId)
    .maybeSingle()

  if (targetPreferenceError) throw targetPreferenceError

  if (targetPreference) {
    const { error: deleteError } = await supabase
      .from('notification_preferences')
      .delete()
      .eq('id', guestPreference.id)

    if (deleteError) throw deleteError
    return
  }

  const { error: updateError } = await supabase
    .from('notification_preferences')
    .update({ membership_id: toMembershipId })
    .eq('id', guestPreference.id)

  if (updateError) throw updateError
}

async function updateMembershipReference(table: string, column: string, fromMembershipId: string, toMembershipId: string) {
  const supabase = getServiceRoleClient()
  const { error } = await supabase
    .from(table)
    .update({ [column]: toMembershipId })
    .eq(column, fromMembershipId)

  if (error) throw error
}

async function mergeGuestMembershipIntoProfile(profile: any, guestMembershipId: string) {
  const supabase = getServiceRoleClient()
  const { data: guestMembership, error: guestMembershipError } = await supabase
    .from('crew_memberships')
    .select('*, guest_identities(*)')
    .eq('id', guestMembershipId)
    .single()

  if (guestMembershipError) throw guestMembershipError
  if (guestMembership.actor_type !== 'guest' || !guestMembership.guest_identity_id) {
    throw new Error('Only guest memberships can be claimed.')
  }

  if (
    guestMembership.guest_identities?.upgraded_to_profile_id &&
    guestMembership.guest_identities.upgraded_to_profile_id !== profile.id
  ) {
    throw new Error('This guest has already been claimed by another account.')
  }

  const { data: existingMembership, error: existingMembershipError } = await supabase
    .from('crew_memberships')
    .select('*')
    .eq('crew_id', guestMembership.crew_id)
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (existingMembershipError) throw existingMembershipError

  let targetMembershipId = guestMembership.id

  if (existingMembership && existingMembership.id !== guestMembership.id) {
    await mergeGuestWagers(guestMembership.id, existingMembership.id)
    await mergeNightParticipants(guestMembership.id, existingMembership.id)
    await mergeDuplicateMembershipRows('dispute_votes', 'dispute_id', guestMembership.id, existingMembership.id)
    await mergeDuplicateMembershipRows('settlement_confirmations', 'settlement_request_id', guestMembership.id, existingMembership.id)
    await mergeGuestNotificationPreference(guestMembership.id, existingMembership.id)

    const referenceUpdates: Array<[string, string]> = [
      ['crew_invites', 'created_by_membership_id'],
      ['crew_invite_redemptions', 'membership_id'],
      ['nights', 'created_by_membership_id'],
      ['bets', 'created_by_membership_id'],
      ['bets', 'challenger_membership_id'],
      ['bet_comments', 'membership_id'],
      ['disputes', 'opened_by_membership_id'],
      ['bet_status_events', 'actor_membership_id'],
      ['bet_member_outcomes', 'membership_id'],
      ['ledger_events', 'from_membership_id'],
      ['ledger_events', 'to_membership_id'],
      ['settlement_requests', 'initiated_by_membership_id'],
      ['settlement_requests', 'counterparty_membership_id'],
      ['notifications', 'membership_id'],
      ['audit_log', 'actor_membership_id'],
    ]

    for (const [table, column] of referenceUpdates) {
      await updateMembershipReference(table, column, guestMembership.id, existingMembership.id)
    }

    const nextStatus =
      existingMembership.status === 'active' || guestMembership.status === 'active'
        ? 'active'
        : existingMembership.status ?? guestMembership.status

    const { error: promoteExistingError } = await supabase
      .from('crew_memberships')
      .update({
        status: nextStatus,
        left_at: nextStatus === 'active' ? null : existingMembership.left_at ?? guestMembership.left_at ?? null,
        role: existingMembership.role === 'creator' || existingMembership.role === 'admin' ? existingMembership.role : 'member',
      })
      .eq('id', existingMembership.id)

    if (promoteExistingError) throw promoteExistingError

    const { error: archiveGuestError } = await supabase
      .from('crew_memberships')
      .update({
        status: 'removed',
        left_at: guestMembership.left_at ?? new Date().toISOString(),
      })
      .eq('id', guestMembership.id)

    if (archiveGuestError) throw archiveGuestError

    targetMembershipId = existingMembership.id
  } else {
    const { error: upgradeError } = await supabase
      .from('crew_memberships')
      .update({
        actor_type: 'profile',
        profile_id: profile.id,
        guest_identity_id: null,
        role: guestMembership.role === 'guest' ? 'member' : guestMembership.role,
      })
      .eq('id', guestMembership.id)

    if (upgradeError) throw upgradeError
    await ensureNotificationPreference(guestMembership.id)
  }

  const { error: markGuestError } = await supabase
    .from('guest_identities')
    .update({
      upgraded_to_profile_id: profile.id,
    })
    .eq('id', guestMembership.guest_identity_id)

  if (markGuestError) throw markGuestError

  return {
    crewId: guestMembership.crew_id as string,
    guestName: guestMembership.guest_identities?.display_name ?? 'Guest',
    guestIdentityId: guestMembership.guest_identity_id as string,
    targetMembershipId,
  }
}

function buildLeaderboard(entries: Array<{ membershipId: string; nightId: string | null; netResult: number }>, usersByMembershipId: Map<string, User>) {
  const byMembership = new Map<string, {
    user: User
    totalWon: number
    wins: number
    losses: number
    nightly: Map<string, number>
  }>()

  entries.forEach((entry) => {
    const user = usersByMembershipId.get(entry.membershipId)
    if (!user) return

    const bucket = byMembership.get(entry.membershipId) ?? {
      user,
      totalWon: 0,
      wins: 0,
      losses: 0,
      nightly: new Map<string, number>(),
    }

    if (entry.netResult > 0) {
      bucket.totalWon += entry.netResult
      bucket.wins += 1
    } else if (entry.netResult < 0) {
      bucket.losses += 1
    }

    const nightKey = entry.nightId ?? 'unknown'
    bucket.nightly.set(nightKey, (bucket.nightly.get(nightKey) ?? 0) + entry.netResult)
    byMembership.set(entry.membershipId, bucket)
  })

  return [...byMembership.values()]
    .map((entry) => {
      const nightScores = [...entry.nightly.values()]
      return {
        user: entry.user,
        totalWon: Number(entry.totalWon.toFixed(2)),
        winRate: entry.wins + entry.losses > 0 ? entry.wins / (entry.wins + entry.losses) : 0,
        bestNight: nightScores.length ? Math.max(...nightScores, 0) : 0,
        streak: 0,
      } satisfies LeaderboardEntry
    })
    .sort((a, b) => b.totalWon - a.totalWon)
}

function buildPastNightLeaderboard(bets: Bet[]) {
  const totals = new Map<string, { user: User; net: number }>()

  bets.forEach((bet) => {
    bet.memberOutcomes?.forEach((outcome) => {
      const bucket = totals.get(outcome.user.id) ?? { user: outcome.user, net: 0 }
      bucket.net += outcome.netResult
      totals.set(outcome.user.id, bucket)
    })
  })

  return [...totals.values()].sort((a, b) => b.net - a.net)
}

function buildPastNight(night: any, bets: Bet[]): PastNight {
  const leaderboard = buildPastNightLeaderboard(bets)
  const startedAt = asDate(night.started_at)
  const endedAt = night.ended_at ? asDate(night.ended_at) : null
  const durationHours = endedAt ? Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 3600000)) : 0

  return {
    id: night.id,
    name: night.name,
    date: startedAt.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
    bets: bets.length,
    winner: leaderboard[0]?.user.name ?? 'TBD',
    duration: endedAt ? `${durationHours}h` : '—',
    betDetails: bets
      .filter((bet) => bet.status === 'resolved' || bet.status === 'void')
      .map((bet) => ({
        title: bet.title,
        type: bet.type,
        winner: bet.status === 'void'
          ? 'Void'
          : (bet.options.find((option) => option.id === bet.result)?.label ?? 'Unknown'),
        pool: bet.totalPool,
      })),
    leaderboard,
  }
}

function buildLedgerEntriesFromEvents(rows: any[], usersByMembershipId: Map<string, User>) {
  const aggregated = new Map<string, LedgerEntry>()

  rows.forEach((row) => {
    if (!row.from_membership_id || !row.to_membership_id) return

    const fromUser = usersByMembershipId.get(row.from_membership_id)
    const toUser = usersByMembershipId.get(row.to_membership_id)
    if (!fromUser || !toUser) return

    const key = `${row.from_membership_id}:${row.to_membership_id}`
    const bucket = aggregated.get(key) ?? {
      fromUser,
      toUser,
      drinks: 0,
      settled: 0,
      betId: row.bet_id ?? undefined,
    }

    const amount = Number(row.drinks)
    if (row.event_type === 'manual_settlement') {
      bucket.settled += amount
    } else {
      bucket.drinks += amount
    }

    aggregated.set(key, bucket)
  })

  return [...aggregated.values()]
    .map((entry) => ({
      ...entry,
      drinks: Number(entry.drinks.toFixed(2)),
      settled: Number(entry.settled.toFixed(2)),
    }))
    .filter((entry) => entry.drinks !== 0 || entry.settled !== 0)
}

async function ensureProfile(authUser: SupabaseUser) {
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

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'auth_user_id' })
    .select()
    .single()

  if (error) {
    throw error
  }

  await supabase.from('profile_preferences').upsert({ profile_id: data.id }, { onConflict: 'profile_id' })
  return data
}

async function ensureNotificationPreference(membershipId: string) {
  const supabase = getServiceRoleClient()
  await supabase.from('notification_preferences').upsert({
    membership_id: membershipId,
  }, { onConflict: 'membership_id' })
}

async function recordAuditLog(crewId: string | null, actorMembershipId: string | null, action: string, targetType: string, targetId: string | null, payload: Record<string, any> = {}) {
  const supabase = getServiceRoleClient()
  await supabase.from('audit_log').insert({
    crew_id: crewId,
    actor_membership_id: actorMembershipId,
    action,
    target_type: targetType,
    target_id: targetId,
    payload,
  })
}

async function findCrewByInviteCode(code: string) {
  const supabase = getServiceRoleClient()
  const normalizedCode = normalizeInviteCode(code)

  const { data: crew } = await supabase
    .from('crews')
    .select('*')
    .eq('invite_code', normalizedCode)
    .is('archived_at', null)
    .maybeSingle()

  if (crew) {
    return crew
  }

  const { data: invite } = await supabase
    .from('crew_invites')
    .select('crew_id')
    .eq('code', normalizedCode)
    .maybeSingle()

  if (!invite) {
    return null
  }

  const { data: invitedCrew } = await supabase
    .from('crews')
    .select('*')
    .eq('id', invite.crew_id)
    .is('archived_at', null)
    .maybeSingle()

  return invitedCrew ?? null
}

async function notifyCrewMembers(crewId: string, input: {
  type: Notification['type']
  title: string
  message: string
  payload?: Record<string, any>
  excludeMembershipId?: string | null
}) {
  const supabase = getServiceRoleClient()
  const { data: memberships, error } = await supabase
    .from('crew_memberships')
    .select('id, profile_id, actor_type, status')
    .eq('crew_id', crewId)
    .eq('status', 'active')

  if (error || !memberships?.length) {
    return
  }

  const rows = memberships
    .filter((membership: any) => membership.id !== input.excludeMembershipId)
    .map((membership: any) => ({
      crew_id: crewId,
      membership_id: membership.id,
      profile_id: membership.profile_id ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      payload: input.payload ?? {},
    }))

  if (rows.length) {
    await supabase.from('notifications').insert(rows)
  }
}

async function getActorMembershipForCrew(actor: RequestActor, crewId: string) {
  const supabase = getServiceRoleClient()

  if (actor.kind === 'authenticated') {
    const profile = await ensureProfile(actor.authUser)
    const { data, error } = await supabase
      .from('crew_memberships')
      .select('*, profiles(*), guest_identities(*)')
      .eq('crew_id', crewId)
      .eq('profile_id', profile.id)
      .maybeSingle()

    if (error) throw error
    return data
  }

  if (actor.kind === 'guest' && actor.session.guestIdentityId) {
    const { data, error } = await supabase
      .from('crew_memberships')
      .select('*, profiles(*), guest_identities(*)')
      .eq('crew_id', crewId)
      .eq('guest_identity_id', actor.session.guestIdentityId)
      .maybeSingle()

    if (error) throw error
    return data
  }

  return null
}

async function requireActorMembership(actor: RequestActor, crewId: string) {
  const membership = await getActorMembershipForCrew(actor, crewId)
  if (!membership || membership.status !== 'active') {
    throw new Error('Active crew membership required.')
  }

  return membership
}

async function requireCrewManagerMembership(actor: RequestActor, crewId: string) {
  const membership = await requireActorMembership(actor, crewId)

  if (membership.role !== 'creator' && membership.role !== 'admin') {
    throw new Error('Creator or admin permissions are required for that crew action.')
  }

  return membership
}

async function ensureNightParticipant(nightId: string, membershipId: string) {
  const supabase = getServiceRoleClient()
  const { data: existing, error } = await supabase
    .from('night_participants')
    .select('*')
    .eq('night_id', nightId)
    .eq('membership_id', membershipId)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  if (existing) {
    await supabase.from('night_participants').update({ left_at: null }).eq('id', existing.id)
  } else {
    await supabase.from('night_participants').insert({
      night_id: nightId,
      membership_id: membershipId,
    })
  }
}

async function loadBackendState(actor: RequestActor): Promise<AppBootstrapPayload> {
  const supabase = getServiceRoleClient()

  let profile: any = null
  let guestIdentityId: string | null = null

  if (actor.kind === 'authenticated') {
    profile = await ensureProfile(actor.authUser)
  } else if (actor.kind === 'guest') {
    guestIdentityId = actor.session.guestIdentityId ?? null
  } else {
    return { crews: [], crewDataById: {}, notifications: [], viewerUser: null, claimableGuests: [] }
  }

  let actorMembershipsQuery = supabase
    .from('crew_memberships')
    .select('*, profiles(*), guest_identities(*)')

  if (profile) {
    actorMembershipsQuery = actorMembershipsQuery.eq('profile_id', profile.id)
  } else if (guestIdentityId) {
    actorMembershipsQuery = actorMembershipsQuery.eq('guest_identity_id', guestIdentityId)
  } else {
    return { crews: [], crewDataById: {}, notifications: [], viewerUser: null, claimableGuests: [] }
  }

  const { data: actorMemberships, error: actorMembershipError } = await actorMembershipsQuery
  if (actorMembershipError) throw actorMembershipError

  const activeMemberships = (actorMemberships ?? []).filter((membership: any) => membership.status === 'active')
  const crewIds = [...new Set(activeMemberships.map((membership: any) => membership.crew_id))]

  if (!crewIds.length) {
    return {
      crews: [],
      crewDataById: {},
      notifications: [],
      viewerUser: profile ? buildViewerUser(profile, activeMemberships) : null,
      claimableGuests: [],
    }
  }

  const [
    crewResult,
    membershipResult,
    nightResult,
  ] = await Promise.all([
    supabase.from('crews').select('*').in('id', crewIds).is('archived_at', null),
    supabase.from('crew_memberships').select('*, profiles(*), guest_identities(*)').in('crew_id', crewIds),
    supabase.from('nights').select('*').in('crew_id', crewIds).order('started_at', { ascending: false }),
  ])

  if (crewResult.error) throw crewResult.error
  if (membershipResult.error) throw membershipResult.error
  if (nightResult.error) throw nightResult.error

  const nights = nightResult.data ?? []
  const nightIds = nights.map((night: any) => night.id)

  const notificationQuery = profile
    ? supabase
        .from('notifications')
        .select('*')
        .or(`profile_id.eq.${profile.id},membership_id.in.(${activeMemberships.map((membership: any) => membership.id).join(',')})`)
        .order('created_at', { ascending: false })
    : supabase
        .from('notifications')
        .select('*')
        .in('membership_id', activeMemberships.map((membership: any) => membership.id))
        .order('created_at', { ascending: false })

  const [participantResult, betResult, notificationResult, ledgerResult] = await Promise.all([
    nightIds.length
      ? supabase.from('night_participants').select('*').in('night_id', nightIds)
      : Promise.resolve({ data: [], error: null } as any),
    nightIds.length
      ? supabase.from('bets').select('*').in('night_id', nightIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null } as any),
    notificationQuery,
    supabase.from('ledger_events').select('*').in('crew_id', crewIds).order('created_at', { ascending: false }),
  ])

  if (participantResult.error) throw participantResult.error
  if (betResult.error) throw betResult.error
  if (notificationResult.error) throw notificationResult.error
  if (ledgerResult.error) throw ledgerResult.error

  const bets = betResult.data ?? []
  const betIds = bets.map((bet: any) => bet.id)

  const [
    optionResult,
    wagerResult,
    outcomeResult,
  ] = await Promise.all([
    betIds.length
      ? supabase.from('bet_options').select('*').in('bet_id', betIds).order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null } as any),
    betIds.length
      ? supabase.from('wagers').select('*').in('bet_id', betIds)
      : Promise.resolve({ data: [], error: null } as any),
    betIds.length
      ? supabase.from('bet_member_outcomes').select('*').in('bet_id', betIds)
      : Promise.resolve({ data: [], error: null } as any),
  ])

  if (optionResult.error) throw optionResult.error
  if (wagerResult.error) throw wagerResult.error
  if (outcomeResult.error) throw outcomeResult.error

  const membershipRows = (membershipResult.data ?? []).sort(compareMemberships)
  const membershipById = new Map<string, any>()
  const usersByMembershipId = new Map<string, User>()
  const actorIdToMembershipId = new Map<string, string>()

  membershipRows.forEach((membership: any) => {
    membershipById.set(membership.id, membership)
    const user = buildUserFromMembership(membership)
    usersByMembershipId.set(membership.id, user)
    actorIdToMembershipId.set(user.id, membership.id)
  })

  const optionsByBetId = new Map<string, any[]>()
  ;(optionResult.data ?? []).forEach((option: any) => {
    const bucket = optionsByBetId.get(option.bet_id) ?? []
    bucket.push(option)
    optionsByBetId.set(option.bet_id, bucket)
  })

  const wagersByBetId = new Map<string, any[]>()
  ;(wagerResult.data ?? []).forEach((wager: any) => {
    const bucket = wagersByBetId.get(wager.bet_id) ?? []
    bucket.push(wager)
    wagersByBetId.set(wager.bet_id, bucket)
  })

  const outcomesByBetId = new Map<string, any[]>()
  ;(outcomeResult.data ?? []).forEach((outcome: any) => {
    const bucket = outcomesByBetId.get(outcome.bet_id) ?? []
    bucket.push(outcome)
    outcomesByBetId.set(outcome.bet_id, bucket)
  })

  const participantsByNightId = new Map<string, string[]>()
  ;(participantResult.data ?? [])
    .filter((participant: any) => !participant.left_at)
    .forEach((participant: any) => {
      const bucket = participantsByNightId.get(participant.night_id) ?? []
      bucket.push(participant.membership_id)
      participantsByNightId.set(participant.night_id, bucket)
    })

  const betsByNightId = new Map<string, Bet[]>()
  bets.forEach((bet: any) => {
    const options = (optionsByBetId.get(bet.id) ?? []).map((option: any) => {
      const wagers = (wagersByBetId.get(bet.id) ?? [])
        .filter((wager: any) => wager.bet_option_id === option.id)
        .map((wager: any) => {
          const user = usersByMembershipId.get(wager.membership_id)
          if (!user) {
            return null
          }

          return {
            id: wager.id,
            user,
            drinks: Number(wager.drinks),
            createdAt: asDate(wager.created_at),
          }
        })
        .filter((wager): wager is { id: string; user: User; drinks: number; createdAt: Date } => Boolean(wager))

      return {
        id: option.id,
        label: option.label,
        wagers,
        totalDrinks: Number(wagers.reduce((sum: number, wager: any) => sum + wager.drinks, 0).toFixed(2)),
      }
    })

    const memberOutcomes = (outcomesByBetId.get(bet.id) ?? [])
      .map((outcome: any) => {
        const user = usersByMembershipId.get(outcome.membership_id)
        if (!user) return null
        return {
          user,
          optionId: outcome.option_id,
          stake: Number(outcome.stake),
          netResult: Number(outcome.net_result),
        }
      })
      .filter(Boolean) as NonNullable<Bet['memberOutcomes']>

    const bucket = betsByNightId.get(bet.night_id) ?? []
    bucket.push({
      id: bet.id,
      type: bet.type,
      title: bet.title,
      description: bet.description ?? undefined,
      creator: usersByMembershipId.get(bet.created_by_membership_id) ?? {
        id: bet.created_by_membership_id,
        membershipId: bet.created_by_membership_id,
        name: 'Player',
        avatar: '',
        initials: 'PL',
      },
      challenger: bet.challenger_membership_id ? usersByMembershipId.get(bet.challenger_membership_id) : undefined,
      status: bet.status,
      closesAt: asDate(bet.closes_at),
      createdAt: asDate(bet.created_at),
      options,
      totalPool: Number(options.reduce((sum, option) => sum + option.totalDrinks, 0).toFixed(2)),
      result: bet.winning_option_id ?? undefined,
      memberOutcomes,
    })
    betsByNightId.set(bet.night_id, bucket)
  })

  const nightsByCrewId = new Map<string, { currentNight?: Night; pastNights: PastNight[] }>()
  nights.forEach((night: any) => {
    const bucket = nightsByCrewId.get(night.crew_id) ?? { pastNights: [] }
    const participants = (participantsByNightId.get(night.id) ?? [])
      .map((membershipId) => usersByMembershipId.get(membershipId))
      .filter(Boolean) as User[]
    const nightBets = betsByNightId.get(night.id) ?? []

    if (night.status === 'active' || night.status === 'winding-down') {
      bucket.currentNight = {
        id: night.id,
        name: night.name,
        status: night.status,
        startedAt: asDate(night.started_at),
        participants,
        bets: nightBets,
        drinkThemeOverride: night.drink_theme_override ?? undefined,
      }
    } else {
      bucket.pastNights.push(buildPastNight(night, nightBets))
    }

    nightsByCrewId.set(night.crew_id, bucket)
  })

  const outcomeEntries = (outcomeResult.data ?? []).map((outcome: any) => {
    const bet = bets.find((candidate: any) => candidate.id === outcome.bet_id)
    return {
      membershipId: outcome.membership_id,
      nightId: bet?.night_id ?? null,
      netResult: Number(outcome.net_result),
    }
  })

  const crews: Crew[] = (crewResult.data ?? []).map((crewRow: any) => {
    const members = membershipRows
      .filter((membership: any) => membership.crew_id === crewRow.id && membership.status === 'active')
      .map((membership: any) => buildUserFromMembership(membership))

    const nightBucket = nightsByCrewId.get(crewRow.id) ?? { pastNights: [] }

    return {
      id: crewRow.id,
      name: crewRow.name,
      members,
      currentNight: nightBucket.currentNight,
      pastNights: nightBucket.pastNights,
      inviteCode: crewRow.invite_code,
      drinkTheme: crewRow.drink_theme ?? undefined,
    }
  })

  const ledgerRows = ledgerResult.data ?? []
  const crewDataById: Record<string, CrewDataBundle> = {}

  crews.forEach((crew) => {
    const currentNightId = crew.currentNight?.id ?? null
    crewDataById[crew.id] = {
      tonightLedger: currentNightId
        ? buildLedgerEntriesFromEvents(ledgerRows.filter((row: any) => row.crew_id === crew.id && row.night_id === currentNightId), usersByMembershipId)
        : [],
      allTimeLedger: buildLedgerEntriesFromEvents(ledgerRows.filter((row: any) => row.crew_id === crew.id), usersByMembershipId),
      leaderboard: buildLeaderboard(
        outcomeEntries.filter((entry: { membershipId: string; nightId: string | null; netResult: number }) => {
          const membership = membershipById.get(entry.membershipId)
          return membership?.crew_id === crew.id
        }),
        usersByMembershipId
      ),
    }
  })

  const notifications: Notification[] = (notificationResult.data ?? []).map((notification: any) => ({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    crewName: crews.find((crew) => crew.id === notification.crew_id)?.name ?? 'BeerScore',
    timestamp: asDate(notification.created_at),
    read: Boolean(notification.read_at),
  }))

  const viewerUser = profile
    ? buildViewerUser(profile, membershipRows.filter((membership: any) => membership.profile_id === profile.id))
    : activeMemberships[0]
      ? buildUserFromMembership(activeMemberships[0])
      : null

  const claimableGuests: ClaimableGuest[] = profile
    ? membershipRows
        .filter((membership: any) =>
          membership.actor_type === 'guest' &&
          crewIds.includes(membership.crew_id) &&
          !membership.guest_identities?.upgraded_to_profile_id
        )
        .map((membership: any) => ({
          guestMembershipId: membership.id,
          guestIdentityId: membership.guest_identity_id,
          guestName: membership.guest_identities?.display_name ?? 'Guest',
          crewId: membership.crew_id,
          crewName: (crewResult.data ?? []).find((crew: any) => crew.id === membership.crew_id)?.name ?? 'BeerScore',
          status: membership.status,
          joinedAt: asDate(membership.joined_at).toISOString(),
        }))
    : []

  return {
    crews,
    crewDataById,
    notifications,
    viewerUser,
    claimableGuests,
  }
}

export async function loadAppState(actor: RequestActor): Promise<AppBootstrapPayload> {
  return loadBackendState(actor)
}

export async function joinCrewAsGuest(name: string, inviteCode: string): Promise<AppMutationPayload> {
  const supabase = getServiceRoleClient()
  const cleanName = name.trim()

  if (!cleanName) {
    throw new Error('Guest name is required.')
  }

  const crew = await findCrewByInviteCode(inviteCode)
  if (!crew) {
    throw new Error('Crew code not found.')
  }

  const { data: settings } = await supabase
    .from('crew_settings')
    .select('*')
    .eq('crew_id', crew.id)
    .maybeSingle()

  if (settings && settings.allow_guests === false) {
    throw new Error('Guests are disabled for this crew.')
  }

  const { data: guest, error: guestError } = await supabase
    .from('guest_identities')
    .insert({
      display_name: cleanName,
      initials: getInitials(cleanName),
    })
    .select()
    .single()

  if (guestError) throw guestError

  const { data: membership, error: membershipError } = await supabase
    .from('crew_memberships')
    .insert({
      crew_id: crew.id,
      actor_type: 'guest',
      guest_identity_id: guest.id,
      role: 'guest',
      status: 'active',
    })
    .select()
    .single()

  if (membershipError) throw membershipError

  await ensureNotificationPreference(membership.id)

  const { data: activeNight } = await supabase
    .from('nights')
    .select('*')
    .eq('crew_id', crew.id)
    .in('status', ['active', 'winding-down'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeNight) {
    await ensureNightParticipant(activeNight.id, membership.id)
  }

  await recordAuditLog(crew.id, membership.id, 'guest_joined', 'crew_membership', membership.id, {
    inviteCode: normalizeInviteCode(inviteCode),
  })

  await notifyCrewMembers(crew.id, {
    type: 'member_joined',
    title: `${cleanName} joined ${crew.name}`,
    message: `${cleanName} joined as a guest.`,
    payload: { membershipId: membership.id },
    excludeMembershipId: membership.id,
  })

  const session = buildGuestSession(cleanName)
  session.user.id = guest.id
  session.guestIdentityId = guest.id
  session.membershipId = membership.id

  const payload = await loadAppState({ kind: 'guest', session })
  return { ...payload, session }
}

async function resolveBetAndPersist(actorMembership: any, betId: string, winningOptionId: string) {
  const supabase = getServiceRoleClient()
  const { data: bet, error: betError } = await supabase
    .from('bets')
    .select('*')
    .eq('id', betId)
    .single()

  if (betError) throw betError
  if (bet.status !== 'open' && bet.status !== 'locked') {
    throw new Error('Only open or locked bets can be resolved.')
  }

  const [optionResult, wagerResult, membershipResult] = await Promise.all([
    supabase.from('bet_options').select('*').eq('bet_id', betId).order('sort_order', { ascending: true }),
    supabase.from('wagers').select('*').eq('bet_id', betId),
    supabase.from('crew_memberships').select('*, profiles(*), guest_identities(*)').eq('crew_id', bet.crew_id),
  ])

  if (optionResult.error) throw optionResult.error
  if (wagerResult.error) throw wagerResult.error
  if (membershipResult.error) throw membershipResult.error

  const membershipRows = membershipResult.data ?? []
  const usersByMembershipId = new Map<string, User>()
  const actorIdToMembershipId = new Map<string, string>()
  membershipRows.forEach((membership: any) => {
    const user = buildUserFromMembership(membership)
    usersByMembershipId.set(membership.id, user)
    actorIdToMembershipId.set(user.id, membership.id)
  })

    const options = (optionResult.data ?? []).map((option: any) => {
      const wagers = (wagerResult.data ?? [])
        .filter((wager: any) => wager.bet_option_id === option.id)
        .map((wager: any) => {
          const user = usersByMembershipId.get(wager.membership_id)
          if (!user) {
            return null
          }

          return {
            id: wager.id,
            user,
            drinks: Number(wager.drinks),
            createdAt: asDate(wager.created_at),
          }
        })
        .filter((wager): wager is { id: string; user: User; drinks: number; createdAt: Date } => Boolean(wager))

    return {
      id: option.id,
      label: option.label,
      wagers,
      totalDrinks: Number(wagers.reduce((sum, wager) => sum + wager.drinks, 0).toFixed(2)),
    }
  })

  const domainBet: Bet = {
    id: bet.id,
    type: bet.type,
    title: bet.title,
    description: bet.description ?? undefined,
    creator: usersByMembershipId.get(bet.created_by_membership_id)!,
    challenger: bet.challenger_membership_id ? usersByMembershipId.get(bet.challenger_membership_id) : undefined,
    status: bet.status,
    closesAt: asDate(bet.closes_at),
    createdAt: asDate(bet.created_at),
    options,
    totalPool: Number(options.reduce((sum, option) => sum + option.totalDrinks, 0).toFixed(2)),
  }

  const resolvedBet = resolveBetWithParimutuel(domainBet, winningOptionId)

  await supabase.from('bet_member_outcomes').delete().eq('bet_id', bet.id)
  await supabase.from('ledger_events').delete().eq('bet_id', bet.id)

  await supabase.from('bets').update({
    status: resolvedBet.status,
    winning_option_id: resolvedBet.status === 'resolved' ? winningOptionId : null,
    resolved_at: new Date().toISOString(),
    void_reason: resolvedBet.status === 'void' ? 'No opposing action in the pool.' : null,
  }).eq('id', bet.id)

  await supabase.from('bet_status_events').insert({
    bet_id: bet.id,
    actor_membership_id: actorMembership.id,
    from_status: bet.status,
    to_status: resolvedBet.status,
    note: resolvedBet.status === 'void' ? 'Bet voided during resolution.' : 'Bet resolved.',
    metadata: { winningOptionId },
  })

  if (resolvedBet.memberOutcomes?.length) {
    const outcomeRows = resolvedBet.memberOutcomes
      .map((outcome) => {
        const membershipId = actorIdToMembershipId.get(outcome.user.id)
        if (!membershipId) return null
        return {
          bet_id: bet.id,
          membership_id: membershipId,
          option_id: outcome.optionId,
          stake: outcome.stake,
          net_result: outcome.netResult,
        }
      })
      .filter(Boolean)

    if (outcomeRows.length) {
      await supabase.from('bet_member_outcomes').insert(outcomeRows as any)
    }
  }

  if (resolvedBet.status === 'resolved') {
    const ledgerRows = deriveLedgerEntriesFromBets([resolvedBet])
      .map((entry: LedgerEntry) => {
        const fromMembershipId = actorIdToMembershipId.get(entry.fromUser.id)
        const toMembershipId = actorIdToMembershipId.get(entry.toUser.id)
        if (!fromMembershipId || !toMembershipId) return null
        return {
          crew_id: bet.crew_id,
          night_id: bet.night_id,
          bet_id: bet.id,
          from_membership_id: fromMembershipId,
          to_membership_id: toMembershipId,
          event_type: 'bet_result',
          drinks: entry.drinks,
          metadata: {},
        }
      })
      .filter(Boolean)

    if (ledgerRows.length) {
      await supabase.from('ledger_events').insert(ledgerRows as any)
    }
  }

  await notifyCrewMembers(bet.crew_id, {
    type: 'bet_resolved',
    title: resolvedBet.status === 'void' ? `${bet.title} was voided` : `${bet.title} settled`,
    message: resolvedBet.status === 'void'
      ? 'The bet was voided because there was no opposing action.'
      : `The result is in for ${bet.title}.`,
    payload: {
      betId: bet.id,
      winningOptionId: resolvedBet.status === 'resolved' ? winningOptionId : null,
    },
    excludeMembershipId: actorMembership.id,
  })
}

export async function mutateAppState(actor: RequestActor, action: string, payload: Record<string, any>): Promise<AppMutationPayload> {
  const supabase = getServiceRoleClient()

  switch (action) {
    case 'createCrew': {
      if (actor.kind !== 'authenticated') {
        throw new Error('Only authenticated users can create a crew.')
      }

      const profile = await ensureProfile(actor.authUser)
      let inviteCode = generateCrewCode()

      for (let attempts = 0; attempts < 5; attempts += 1) {
        const { data: existing } = await supabase
          .from('crews')
          .select('id')
          .eq('invite_code', inviteCode)
          .maybeSingle()

        if (!existing) break
        inviteCode = generateCrewCode()
      }

      const { data: crew, error: crewError } = await supabase
        .from('crews')
        .insert({
          name: payload.name?.trim() || 'New Crew',
          invite_code: inviteCode,
          created_by_profile_id: profile.id,
        })
        .select()
        .single()

      if (crewError) throw crewError

      const { data: membership, error: membershipError } = await supabase
        .from('crew_memberships')
        .insert({
          crew_id: crew.id,
          actor_type: 'profile',
          profile_id: profile.id,
          role: 'creator',
          status: 'active',
        })
        .select()
        .single()

      if (membershipError) throw membershipError

      await Promise.all([
        supabase.from('crew_settings').upsert({
          crew_id: crew.id,
          default_drink_theme: crew.drink_theme ?? null,
        }, { onConflict: 'crew_id' }),
        supabase.from('crew_invites').upsert({
          crew_id: crew.id,
          code: inviteCode,
          created_by_membership_id: membership.id,
        }, { onConflict: 'code' }),
      ])

      await ensureNotificationPreference(membership.id)
      await recordAuditLog(crew.id, membership.id, 'crew_created', 'crew', crew.id, { inviteCode })
      break
    }

    case 'joinCrew': {
      if (actor.kind !== 'authenticated') {
        throw new Error('Only authenticated users can join a crew.')
      }

      const profile = await ensureProfile(actor.authUser)
      const crew = await findCrewByInviteCode(payload.code)
      if (!crew) {
        throw new Error('Crew code not found.')
      }

      const { data: existing, error: existingError } = await supabase
        .from('crew_memberships')
        .select('*')
        .eq('crew_id', crew.id)
        .eq('profile_id', profile.id)
        .maybeSingle()

      if (existingError) throw existingError

      let membershipId = existing?.id as string | undefined

      if (existing) {
        const { error } = await supabase
          .from('crew_memberships')
          .update({
            actor_type: 'profile',
            role: existing.role === 'creator' ? 'creator' : existing.role === 'admin' ? 'admin' : 'member',
            status: 'active',
            left_at: null,
          })
          .eq('id', existing.id)

        if (error) throw error
      } else {
        const { data: membership, error } = await supabase
          .from('crew_memberships')
          .insert({
            crew_id: crew.id,
            actor_type: 'profile',
            profile_id: profile.id,
            role: 'member',
            status: 'active',
          })
          .select()
          .single()

        if (error) throw error
        membershipId = membership.id
      }

      if (!membershipId) {
        throw new Error('Could not join crew.')
      }

      await ensureNotificationPreference(membershipId)

      const { data: activeNight } = await supabase
        .from('nights')
        .select('*')
        .eq('crew_id', crew.id)
        .in('status', ['active', 'winding-down'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (activeNight) {
        await ensureNightParticipant(activeNight.id, membershipId)
      }

      await recordAuditLog(crew.id, membershipId, 'member_joined', 'crew_membership', membershipId, {
        inviteCode: normalizeInviteCode(payload.code),
      })

      await notifyCrewMembers(crew.id, {
        type: 'member_joined',
        title: `${profile.display_name} joined ${crew.name}`,
        message: `${profile.display_name} joined the crew.`,
        payload: { membershipId },
        excludeMembershipId: membershipId,
      })

      break
    }

    case 'claimGuestMembership': {
      if (actor.kind !== 'authenticated') {
        throw new Error('Only authenticated users can claim guest stats.')
      }

      if (!payload.guestMembershipId) {
        throw new Error('Select a guest to claim.')
      }

      const profile = await ensureProfile(actor.authUser)

      const { data: guestMembership, error: guestMembershipError } = await supabase
        .from('crew_memberships')
        .select('*, guest_identities(*)')
        .eq('id', payload.guestMembershipId)
        .single()

      if (guestMembershipError) throw guestMembershipError
      if (guestMembership.actor_type !== 'guest' || !guestMembership.guest_identity_id) {
        throw new Error('That guest can no longer be claimed.')
      }

      if (payload.guestIdentityId && guestMembership.guest_identity_id !== payload.guestIdentityId) {
        throw new Error('That guest session no longer matches this claim.')
      }

      const { data: existingMembership } = await supabase
        .from('crew_memberships')
        .select('*')
        .eq('crew_id', guestMembership.crew_id)
        .eq('profile_id', profile.id)
        .maybeSingle()

      if (!existingMembership && payload.source === 'manual-claim') {
        throw new Error('Join this crew with your account before claiming a past guest.')
      }

      const claimResult = await mergeGuestMembershipIntoProfile(profile, payload.guestMembershipId)

      const actorMembershipId = existingMembership?.id ?? claimResult.targetMembershipId
      await recordAuditLog(guestMembership.crew_id, actorMembershipId, 'guest_claimed', 'crew_membership', payload.guestMembershipId, {
        guestIdentityId: claimResult.guestIdentityId,
        targetMembershipId: claimResult.targetMembershipId,
        source: payload.source ?? 'manual-claim',
      })

      await notifyCrewMembers(guestMembership.crew_id, {
        type: 'member_joined',
        title: `${profile.display_name} claimed guest stats`,
        message: `${profile.display_name} claimed ${claimResult.guestName}'s guest history.`,
        payload: { membershipId: claimResult.targetMembershipId },
        excludeMembershipId: claimResult.targetMembershipId,
      })

      break
    }

    case 'renameCrew': {
      const actorMembership = await requireCrewManagerMembership(actor, payload.crewId)
      await supabase.from('crews').update({ name: payload.name?.trim() || 'Crew' }).eq('id', payload.crewId)
      await recordAuditLog(payload.crewId, actorMembership.id, 'crew_renamed', 'crew', payload.crewId, { name: payload.name })
      break
    }

    case 'changeDrinkTheme': {
      const actorMembership = await requireCrewManagerMembership(actor, payload.crewId)
      await Promise.all([
        supabase.from('crews').update({ drink_theme: payload.theme }).eq('id', payload.crewId),
        supabase.from('crew_settings').upsert({
          crew_id: payload.crewId,
          default_drink_theme: payload.theme,
        }, { onConflict: 'crew_id' }),
      ])
      await recordAuditLog(payload.crewId, actorMembership.id, 'crew_theme_changed', 'crew', payload.crewId, { theme: payload.theme })
      break
    }

    case 'deleteCrew': {
      const actorMembership = await requireCrewManagerMembership(actor, payload.crewId)
      await supabase.from('crews').update({ archived_at: new Date().toISOString() }).eq('id', payload.crewId)
      await recordAuditLog(payload.crewId, actorMembership.id, 'crew_archived', 'crew', payload.crewId)
      break
    }

    case 'leaveCrew': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      await supabase
        .from('crew_memberships')
        .update({ status: 'left', left_at: new Date().toISOString() })
        .eq('id', actorMembership.id)
      await recordAuditLog(payload.crewId, actorMembership.id, 'member_left', 'crew_membership', actorMembership.id)
      break
    }

    case 'kickMember': {
      const actorMembership = await requireCrewManagerMembership(actor, payload.crewId)
      if (!payload.memberId || payload.memberId === actorMembership.id) {
        throw new Error('Select a valid member to remove.')
      }

      await supabase
        .from('crew_memberships')
        .update({ status: 'removed', left_at: new Date().toISOString() })
        .eq('crew_id', payload.crewId)
        .eq('id', payload.memberId)

      await recordAuditLog(payload.crewId, actorMembership.id, 'member_kicked', 'crew_membership', payload.memberId)
      break
    }

    case 'startNight': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const { data: existingNight } = await supabase
        .from('nights')
        .select('id')
        .eq('crew_id', payload.crewId)
        .in('status', ['active', 'winding-down'])
        .maybeSingle()

      if (existingNight) {
        throw new Error('This crew already has an active night.')
      }

      const { data: night, error: nightError } = await supabase
        .from('nights')
        .insert({
          crew_id: payload.crewId,
          name: payload.name?.trim() || 'Tonight',
          status: 'active',
          created_by_membership_id: actorMembership.id,
          drink_theme_override: payload.drinkThemeOverride ?? null,
        })
        .select()
        .single()

      if (nightError) throw nightError

      const { data: members, error: membersError } = await supabase
        .from('crew_memberships')
        .select('id')
        .eq('crew_id', payload.crewId)
        .eq('status', 'active')

      if (membersError) throw membersError

      if (members?.length) {
        await supabase.from('night_participants').insert(
          members.map((member: any) => ({
            night_id: night.id,
            membership_id: member.id,
          }))
        )
      }

      await recordAuditLog(payload.crewId, actorMembership.id, 'night_started', 'night', night.id, {
        name: night.name,
      })

      await notifyCrewMembers(payload.crewId, {
        type: 'night_started',
        title: night.name,
        message: `${night.name} is live.`,
        payload: { nightId: night.id },
        excludeMembershipId: actorMembership.id,
      })
      break
    }

    case 'leaveNight': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      await supabase
        .from('night_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('night_id', payload.nightId)
        .eq('membership_id', actorMembership.id)
        .is('left_at', null)

      const { data: remaining } = await supabase
        .from('night_participants')
        .select('id')
        .eq('night_id', payload.nightId)
        .is('left_at', null)

      if (!remaining?.length) {
        await supabase
          .from('nights')
          .update({
            status: 'closed',
            ended_at: new Date().toISOString(),
          })
          .eq('id', payload.nightId)

        const { data: openBets } = await supabase
          .from('bets')
          .select('id,status')
          .eq('night_id', payload.nightId)
          .in('status', ['open', 'locked', 'disputed'])

        if (openBets?.length) {
          await supabase
            .from('bets')
            .update({
              status: 'void',
              resolved_at: new Date().toISOString(),
              void_reason: 'Night ended without final resolution.',
            })
            .in('id', openBets.map((bet: any) => bet.id))

          await supabase.from('bet_status_events').insert(
            openBets.map((bet: any) => ({
              bet_id: bet.id,
              actor_membership_id: actorMembership.id,
              from_status: bet.status,
              to_status: 'void',
              note: 'Night ended without final resolution.',
              metadata: {},
            }))
          )
        }
      }

      await recordAuditLog(payload.crewId, actorMembership.id, 'night_left', 'night', payload.nightId)
      break
    }

    case 'rejoinNight': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)

      const { data: night, error: nightError } = await supabase
        .from('nights')
        .select('*')
        .eq('id', payload.nightId)
        .single()

      if (nightError) throw nightError
      if (night.status !== 'active' && night.status !== 'winding-down') {
        throw new Error('That night is no longer active.')
      }

      await ensureNightParticipant(payload.nightId, actorMembership.id)
      await recordAuditLog(payload.crewId, actorMembership.id, 'night_rejoined', 'night', payload.nightId)
      break
    }

    case 'createBet': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const closeTime = Number(payload.closeTime)

      if (!Array.isArray(payload.options) || payload.options.length < 2) {
        throw new Error('A bet needs at least two options.')
      }

      const { data: participant } = await supabase
        .from('night_participants')
        .select('id')
        .eq('night_id', payload.nightId)
        .eq('membership_id', actorMembership.id)
        .is('left_at', null)
        .maybeSingle()

      if (!participant) {
        throw new Error('Only active night participants can create bets.')
      }

      const { data: bet, error: betError } = await supabase
        .from('bets')
        .insert({
          crew_id: payload.crewId,
          night_id: payload.nightId,
          type: payload.type,
          title: payload.title?.trim() || 'Untitled bet',
          description: payload.description?.trim() || null,
          status: 'open',
          created_by_membership_id: actorMembership.id,
          challenger_membership_id: payload.challengerMembershipId ?? null,
          closes_at: new Date(Date.now() + closeTime * 60_000).toISOString(),
        })
        .select()
        .single()

      if (betError) throw betError

      const options = payload.options.map((option: { label: string }, index: number) => ({
        bet_id: bet.id,
        label: option.label.trim(),
        sort_order: index,
      }))

      const { data: createdOptions, error: optionError } = await supabase
        .from('bet_options')
        .insert(options)
        .select()

      if (optionError) throw optionError

      await supabase.from('bet_status_events').insert({
        bet_id: bet.id,
        actor_membership_id: actorMembership.id,
        from_status: null,
        to_status: 'open',
        note: 'Bet created.',
        metadata: {},
      })

      if (payload.wager && Number(payload.wager) > 0) {
        if (!isValidHalfDrinkAmount(Number(payload.wager))) {
          throw new Error('Wagers must be in 0.5 drink increments.')
        }

        const option = createdOptions?.[Number(payload.initialOptionIndex) || 0]
        if (option) {
          await supabase.from('wagers').upsert({
            bet_id: bet.id,
            bet_option_id: option.id,
            membership_id: actorMembership.id,
            drinks: Number(payload.wager),
          }, { onConflict: 'bet_id,membership_id' })
        }
      }

      await recordAuditLog(payload.crewId, actorMembership.id, 'bet_created', 'bet', bet.id, {
        title: bet.title,
      })

      await notifyCrewMembers(payload.crewId, {
        type: 'bet_created',
        title: bet.title,
        message: `${bet.title} is now open.`,
        payload: { betId: bet.id, nightId: payload.nightId },
        excludeMembershipId: actorMembership.id,
      })
      break
    }

    case 'placeWager': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const drinks = Number(payload.drinks)

      if (!isValidHalfDrinkAmount(drinks)) {
        throw new Error('Wagers must be in 0.5 drink increments.')
      }

      const { data: bet, error: betError } = await supabase
        .from('bets')
        .select('*')
        .eq('id', payload.betId)
        .single()

      if (betError) throw betError
      if (bet.status !== 'open') {
        throw new Error('That bet is no longer open.')
      }
      if (new Date(bet.closes_at).getTime() <= Date.now()) {
        throw new Error('That bet has already closed.')
      }

      const { data: participant } = await supabase
        .from('night_participants')
        .select('id')
        .eq('night_id', bet.night_id)
        .eq('membership_id', actorMembership.id)
        .is('left_at', null)
        .maybeSingle()

      if (!participant) {
        throw new Error('Only active night participants can place wagers.')
      }

      const { data: option, error: optionError } = await supabase
        .from('bet_options')
        .select('*')
        .eq('id', payload.optionId)
        .eq('bet_id', payload.betId)
        .single()

      if (optionError || !option) {
        throw new Error('That option does not belong to this bet.')
      }

      await supabase.from('wagers').upsert({
        bet_id: payload.betId,
        bet_option_id: payload.optionId,
        membership_id: actorMembership.id,
        drinks,
      }, { onConflict: 'bet_id,membership_id' })

      await recordAuditLog(payload.crewId, actorMembership.id, 'wager_placed', 'bet', payload.betId, {
        optionId: payload.optionId,
        drinks,
      })
      break
    }

    case 'resolveBet': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      await resolveBetAndPersist(actorMembership, payload.betId, payload.winningOptionId)
      break
    }

    case 'recordSettlement': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const drinks = Number(payload.drinks)
      if (!Number.isFinite(drinks) || drinks <= 0) {
        throw new Error('Settlement amount must be greater than zero.')
      }

      await supabase.from('ledger_events').insert({
        crew_id: payload.crewId,
        night_id: payload.nightId ?? null,
        bet_id: payload.betId ?? null,
        from_membership_id: payload.fromMembershipId ?? actorMembership.id,
        to_membership_id: payload.toMembershipId,
        event_type: 'manual_settlement',
        drinks,
        metadata: payload.metadata ?? {},
      })

      await recordAuditLog(payload.crewId, actorMembership.id, 'settlement_recorded', 'ledger_event', null, {
        drinks,
        toMembershipId: payload.toMembershipId,
      })
      break
    }

    case 'markNotificationsRead': {
      if (actor.kind === 'authenticated') {
        const profile = await ensureProfile(actor.authUser)
        await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('profile_id', profile.id)
          .is('read_at', null)
      } else if (actor.kind === 'guest' && actor.session.membershipId) {
        await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('membership_id', actor.session.membershipId)
          .is('read_at', null)
      }
      break
    }

    default:
      throw new Error(`Unsupported action: ${action}`)
  }

  return loadAppState(actor)
}
