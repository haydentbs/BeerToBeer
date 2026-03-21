import type { User as SupabaseUser } from '@supabase/supabase-js'
import { buildGuestSession, type AppSession } from '@/lib/auth'
import {
  BEER_BOMB_BOARD_SIZE,
  deriveLedgerEntriesFromBets,
  generateCrewCode,
  formatDrinks,
  resolveBetWithParimutuel,
  type Bet,
  type Crew,
  type LeaderboardEntry,
  type LedgerEntry,
  type MiniGameMatch,
  type Night,
  type Notification,
  type PastNight,
  type User,
} from '@/lib/store'
import { getServiceRoleClient } from '@/lib/server/supabase'
import type { AppBootstrapMode, AppBootstrapOptions, AppBootstrapPayload, AppMutationPayload, ClaimableGuest, CrewDataBundle } from '@/lib/server/domain'
import type { RequestActor } from '@/lib/server/session'

type DrinkTheme = Crew['drinkTheme']
type Role = 'creator' | 'admin' | 'member' | 'guest'

const MAX_WAGER_DRINKS = 5
const RESULT_CONFIRMATION_WINDOW_MS = 60_000
const DISPUTE_VOTE_WINDOW_MS = 60_000
const H2H_RESPONSE_WINDOW_MINUTES = 5

const ROLE_ORDER: Record<Role, number> = {
  creator: 0,
  admin: 1,
  member: 2,
  guest: 3,
}

const PROFILE_SELECT = 'id, auth_user_id, email, display_name, avatar_url, initials, account_status, created_at, updated_at'
const PROFILE_VIEWER_SELECT = 'id, email, display_name, avatar_url, initials'
const GUEST_IDENTITY_SELECT = 'id, display_name, initials, created_by_profile_id, upgraded_to_profile_id, expires_at, created_at, updated_at'
const CREW_SELECT = 'id, name, slug, description, invite_code, visibility, drink_theme, created_by_profile_id, created_at, updated_at, archived_at'
const CREW_MEMBERSHIP_SELECT = 'id, crew_id, actor_type, profile_id, guest_identity_id, role, status, nickname, joined_at, left_at, created_at, updated_at'
const CREW_MEMBERSHIP_WITH_ACTOR_SELECT =
  `${CREW_MEMBERSHIP_SELECT}, profiles(${PROFILE_VIEWER_SELECT}), guest_identities(${GUEST_IDENTITY_SELECT})`
const NIGHT_SELECT = 'id, crew_id, name, status, created_by_membership_id, drink_theme_override, started_at, ended_at, created_at, updated_at'
const NIGHT_PARTICIPANT_SELECT = 'id, night_id, membership_id, joined_at, left_at, created_at, updated_at'
const BET_SELECT =
  'id, crew_id, night_id, type, subtype, title, description, status, created_by_membership_id, challenger_membership_id, closes_at, created_at, updated_at, resolved_at, winning_option_id, void_reason, line, pending_result_option_id, pending_result_at, challenge_wager, respond_by_at, accepted_at, declined_at, close_after_accept_minutes'
const BET_OPTION_SELECT = 'id, bet_id, label, sort_order, is_active, created_at, updated_at'
const WAGER_SELECT = 'id, bet_id, bet_option_id, membership_id, drinks, metadata, created_at, updated_at'
const OUTCOME_SELECT = 'id, bet_id, membership_id, option_id, stake, net_result, gross_return, reason, reversal_of, created_at'
const LEDGER_EVENT_SELECT =
  'id, crew_id, night_id, bet_id, from_membership_id, to_membership_id, event_type, status, drinks, metadata, created_at'
const NOTIFICATION_SELECT = 'id, crew_id, membership_id, profile_id, type, title, message, payload, read_at, created_at'
const NOTIFICATION_PREFERENCE_SELECT = 'id, profile_id, membership_id, bet_updates, night_updates, settlement_updates, crew_updates, created_at, updated_at'
const CREW_SETTINGS_SELECT =
  'crew_id, allow_guests, default_bet_close_minutes, default_drink_theme, auto_void_uncontested, settlement_threshold, created_at, updated_at'
const MINI_GAME_MATCH_SELECT =
  'id, crew_id, night_id, game_key, title, status, created_by_membership_id, opponent_membership_id, proposed_wager, agreed_wager, board_size, hidden_slot_index, current_turn_membership_id, starting_player_membership_id, winner_membership_id, loser_membership_id, revealed_slots, metadata, accepted_at, declined_at, cancelled_at, completed_at, created_at, updated_at, bet_id, respond_by_at'
const NOTIFICATION_BOOTSTRAP_LIMIT = 50

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
  return Number.isFinite(value) && value > 0 && value <= MAX_WAGER_DRINKS && Math.round(value * 2) === value * 2
}

function asDate(value: string | Date | null | undefined) {
  return value ? new Date(value) : new Date()
}

function normalizeIntegerArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as number[]
  }

  return value
    .map((entry) => Number(entry))
    .filter((entry, index, entries) => Number.isInteger(entry) && entry >= 0 && entries.indexOf(entry) === index)
}

function getMiniGameDefaultTitle(challenger: User, opponent: User) {
  return `Beer Bomb: ${challenger.name} vs ${opponent.name}`
}

function createMiniGameMatchFromRow(row: any, usersByMembershipId: Map<string, User>): MiniGameMatch | null {
  const challenger = usersByMembershipId.get(row.challenger_membership_id)
  const opponent = usersByMembershipId.get(row.opponent_membership_id)

  if (!challenger || !opponent) {
    return null
  }

  return {
    id: row.id,
    gameKey: row.game_key,
    title: row.title ?? getMiniGameDefaultTitle(challenger, opponent),
    status: row.status,
    challenger,
    opponent,
    proposedWager: Number(row.proposed_wager),
    agreedWager: row.agreed_wager == null ? undefined : Number(row.agreed_wager),
    boardSize: Number(row.board_size ?? BEER_BOMB_BOARD_SIZE),
    revealedSlots: normalizeIntegerArray(row.revealed_slots),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
    startingPlayer: row.starting_player_membership_id
      ? usersByMembershipId.get(row.starting_player_membership_id)
      : undefined,
    currentTurn: row.current_turn_membership_id
      ? usersByMembershipId.get(row.current_turn_membership_id)
      : undefined,
    winner: row.winner_membership_id ? usersByMembershipId.get(row.winner_membership_id) : undefined,
    loser: row.loser_membership_id ? usersByMembershipId.get(row.loser_membership_id) : undefined,
    completedAt: row.completed_at ? asDate(row.completed_at) : undefined,
    bombSlotIndex: row.status === 'completed' && row.losing_slot_index != null
      ? Number(row.losing_slot_index)
      : undefined,
  }
}

function deriveBetSubtype(bet: any, options: Array<{ label?: string }> = []): Bet['subtype'] {
  if (bet.type === 'h2h') {
    return null
  }

  if (bet.subtype === 'yesno' || bet.subtype === 'overunder' || bet.subtype === 'multi') {
    return bet.subtype
  }

  if (options.length > 2) {
    return 'multi'
  }

  return bet.line != null ? 'overunder' : 'yesno'
}

function canMembershipProposeBetResult(bet: any, membershipId: string) {
  if (bet.type === 'h2h') {
    return bet.created_by_membership_id === membershipId || bet.challenger_membership_id === membershipId
  }

  return bet.created_by_membership_id === membershipId
}

function compareMemberships(a: any, b: any) {
  const roleDelta = (ROLE_ORDER[a.role as Role] ?? 99) - (ROLE_ORDER[b.role as Role] ?? 99)
  if (roleDelta !== 0) return roleDelta
  return asDate(a.joined_at).getTime() - asDate(b.joined_at).getTime()
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value ?? undefined
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

async function mergeGuestWagers(fromMembershipId: string, toMembershipId: string) {
  const supabase = getServiceRoleClient()
  const { data: guestWagers, error: guestWagersError } = await supabase
    .from('wagers')
    .select('id, bet_id, bet_option_id, drinks')
    .eq('membership_id', fromMembershipId)

  if (guestWagersError) throw guestWagersError

  for (const guestWager of guestWagers ?? []) {
    const { data: targetWager, error: targetWagerError } = await supabase
      .from('wagers')
      .select('id, bet_option_id, drinks')
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
    .select('id, night_id, joined_at, left_at')
    .eq('membership_id', fromMembershipId)

  if (guestParticipantsError) throw guestParticipantsError

  for (const guestParticipant of guestParticipants ?? []) {
    const { data: targetParticipant, error: targetParticipantError } = await supabase
      .from('night_participants')
      .select('id, joined_at, left_at')
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
  const { data: rowsData, error: rowsError } = await supabase
    .from(table)
    .select(`id, ${uniqueColumn}`)
    .eq('membership_id', fromMembershipId)

  if (rowsError) throw rowsError
  const rows = (rowsData ?? []) as Array<Record<string, any>>

  for (const row of rows) {
    const { data: targetRow, error: targetRowError } = await supabase
      .from(table)
      .select('id')
      .eq('membership_id', toMembershipId)
      .eq(uniqueColumn, (row as Record<string, any>)[uniqueColumn])
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
    .select('id')
    .eq('membership_id', fromMembershipId)
    .maybeSingle()

  if (guestPreferenceError) throw guestPreferenceError
  if (!guestPreference) return

  const { data: targetPreference, error: targetPreferenceError } = await supabase
    .from('notification_preferences')
    .select('id')
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
  if (table === 'mini_game_matches' || table === 'mini_game_match_events') {
    if (miniGameMatchTableAvailable === false) {
      return
    }
  }

  const supabase = getServiceRoleClient()
  const { error } = await supabase
    .from(table)
    .update({ [column]: toMembershipId })
    .eq(column, fromMembershipId)

  if (error) {
    if (/mini_game_matches|mini_game_match_events|schema cache/i.test(error.message ?? '')) {
      return
    }

    throw error
  }
}

async function mergeGuestMembershipIntoProfile(profile: any, guestMembershipId: string) {
  const supabase = getServiceRoleClient()
  const { data: guestMembershipData, error: guestMembershipError } = await supabase
    .from('crew_memberships')
    .select(`${CREW_MEMBERSHIP_SELECT}, guest_identities(${GUEST_IDENTITY_SELECT})`)
    .eq('id', guestMembershipId)
    .single()

  if (guestMembershipError) throw guestMembershipError
  const guestMembership: any = guestMembershipData
  const guestIdentity = unwrapRelation(guestMembership.guest_identities)
  if (guestMembership.actor_type !== 'guest' || !guestMembership.guest_identity_id) {
    throw new Error('Only guest memberships can be claimed.')
  }

  if (
    guestIdentity?.upgraded_to_profile_id &&
    guestIdentity.upgraded_to_profile_id !== profile.id
  ) {
    throw new Error('This guest has already been claimed by another account.')
  }

  const { data: existingMembershipData, error: existingMembershipError } = await supabase
    .from('crew_memberships')
    .select('id, crew_id, role, status, left_at')
    .eq('crew_id', guestMembership.crew_id)
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (existingMembershipError) throw existingMembershipError
  const existingMembership: any = existingMembershipData

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
      ['mini_game_matches', 'created_by_membership_id'],
      ['mini_game_matches', 'opponent_membership_id'],
      ['mini_game_matches', 'starting_player_membership_id'],
      ['mini_game_matches', 'current_turn_membership_id'],
      ['mini_game_matches', 'winner_membership_id'],
      ['mini_game_matches', 'loser_membership_id'],
      ['mini_game_match_events', 'actor_membership_id'],
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
    guestName: guestIdentity?.display_name ?? 'Guest',
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
      .filter((bet) => bet.status === 'resolved' || bet.status === 'void' || bet.status === 'cancelled')
      .map((bet) => ({
        title: bet.title,
        type: bet.type,
        winner: bet.status === 'void' || bet.status === 'cancelled'
          ? 'Void'
          : (bet.options.find((option) => option.id === bet.result)?.label ?? 'Unknown'),
        pool: bet.totalPool,
      })),
    leaderboard,
  }
}

function normalizeMiniGameRevealedSlots(revealedSlots: any): number[] {
  if (!Array.isArray(revealedSlots)) {
    return []
  }

  return revealedSlots
    .map((slot) => Number(slot))
    .filter((slot) => Number.isInteger(slot) && slot >= 0)
}

function buildMiniGameMatch(match: any, usersByMembershipId: Map<string, User>): MiniGameMatch {
  const challenger = usersByMembershipId.get(match.created_by_membership_id) ?? {
    id: match.created_by_membership_id,
    membershipId: match.created_by_membership_id,
    name: 'Player',
    avatar: '',
    initials: 'PL',
  }

  const opponent = usersByMembershipId.get(match.opponent_membership_id) ?? {
    id: match.opponent_membership_id,
    membershipId: match.opponent_membership_id,
    name: 'Player',
    avatar: '',
    initials: 'PL',
  }

  const startingPlayer = match.starting_player_membership_id
    ? usersByMembershipId.get(match.starting_player_membership_id)
    : undefined
  const currentTurn = match.current_turn_membership_id
    ? usersByMembershipId.get(match.current_turn_membership_id)
    : undefined
  const winner = match.winner_membership_id
    ? usersByMembershipId.get(match.winner_membership_id)
    : undefined
  const loser = match.loser_membership_id
    ? usersByMembershipId.get(match.loser_membership_id)
    : undefined

  return {
    id: match.id,
    gameKey: match.game_key,
    betId: match.bet_id ?? undefined,
    title: match.title,
    status: match.status,
    challenger,
    opponent,
    proposedWager: Number(match.proposed_wager),
    agreedWager: match.agreed_wager == null ? undefined : Number(match.agreed_wager),
    boardSize: Number(match.board_size ?? BEER_BOMB_BOARD_SIZE),
    revealedSlots: normalizeMiniGameRevealedSlots(match.revealed_slots),
    createdAt: asDate(match.created_at),
    updatedAt: asDate(match.updated_at),
    respondByAt: match.respond_by_at ? asDate(match.respond_by_at) : undefined,
    acceptedAt: match.accepted_at ? asDate(match.accepted_at) : undefined,
    declinedAt: match.declined_at ? asDate(match.declined_at) : undefined,
    cancelledAt: match.cancelled_at ? asDate(match.cancelled_at) : undefined,
    startingPlayer,
    currentTurn,
    winner,
    loser,
    completedAt: match.completed_at ? asDate(match.completed_at) : undefined,
    bombSlotIndex: match.status === 'completed' && match.hidden_slot_index != null
      ? Number(match.hidden_slot_index)
      : undefined,
  }
}

function buildMiniGameOutcomeEntries(matches: any[]): Array<{ membershipId: string; nightId: string | null; netResult: number }> {
  return matches
    .filter((match) =>
      !match.bet_id &&
      match.status === 'completed' &&
      match.winner_membership_id &&
      match.loser_membership_id &&
      match.agreed_wager != null
    )
    .flatMap((match) => {
      const wager = Number(match.agreed_wager)
      if (!Number.isFinite(wager) || wager <= 0) {
        return []
      }

      return [
        {
          membershipId: match.winner_membership_id as string,
          nightId: match.night_id ?? null,
          netResult: wager,
        },
        {
          membershipId: match.loser_membership_id as string,
          nightId: match.night_id ?? null,
          netResult: -wager,
        },
      ]
    })
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
      matchId: row.metadata?.matchId ?? row.metadata?.match_id ?? undefined,
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
  } else {
    const profileNeedsUpdate =
      profile.email !== payload.email ||
      profile.display_name !== payload.display_name ||
      profile.avatar_url !== payload.avatar_url ||
      profile.initials !== payload.initials

    if (profileNeedsUpdate) {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          email: payload.email,
          display_name: payload.display_name,
          avatar_url: payload.avatar_url,
          initials: payload.initials,
        })
        .eq('id', profile.id)
        .select(PROFILE_SELECT)
        .single()

      if (error) {
        throw error
      }

      profile = data
    }
  }

  const { data: existingPreferences, error: existingPreferencesError } = await supabase
    .from('profile_preferences')
    .select('profile_id')
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (existingPreferencesError) {
    throw existingPreferencesError
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
    .select(CREW_SELECT)
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
    .select(CREW_SELECT)
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
  membershipIds?: string[]
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
    .filter((membership: any) => !input.membershipIds?.length || input.membershipIds.includes(membership.id))
    .map((membership: any) => ({
      crew_id: crewId,
      membership_id: membership.id,
      profile_id: null,
      type: input.type,
      title: input.title,
      message: input.message,
      payload: input.payload ?? {},
    }))

  if (rows.length) {
    const { error: notificationError } = await supabase.from('notifications').insert(rows)
    if (notificationError) throw notificationError
  }
}

function buildDomainBet(
  bet: any,
  usersByMembershipId: Map<string, User>,
  options: Bet['options'],
  memberOutcomes?: Bet['memberOutcomes']
): Bet {
  return {
    id: bet.id,
    type: bet.type,
    subtype: deriveBetSubtype(bet, options),
    title: bet.title,
    description: bet.description ?? undefined,
    line: bet.line == null ? undefined : Number(bet.line),
    creator: usersByMembershipId.get(bet.created_by_membership_id) ?? {
      id: bet.created_by_membership_id,
      membershipId: bet.created_by_membership_id,
      name: 'Player',
      avatar: '',
      initials: 'PL',
    },
    challenger: bet.challenger_membership_id ? usersByMembershipId.get(bet.challenger_membership_id) : undefined,
    status: bet.status,
    closesAt: bet.closes_at ? asDate(bet.closes_at) : null,
    createdAt: asDate(bet.created_at),
    challengeWager: bet.challenge_wager == null ? undefined : Number(bet.challenge_wager),
    respondByAt: bet.respond_by_at ? asDate(bet.respond_by_at) : undefined,
    acceptedAt: bet.accepted_at ? asDate(bet.accepted_at) : undefined,
    declinedAt: bet.declined_at ? asDate(bet.declined_at) : undefined,
    options,
    totalPool: Number(options.reduce((sum, option) => sum + option.totalDrinks, 0).toFixed(2)),
    result: bet.winning_option_id ?? undefined,
    pendingResultOptionId: bet.pending_result_option_id ?? undefined,
    pendingResultAt: bet.pending_result_at ? asDate(bet.pending_result_at) : undefined,
    voidReason: bet.void_reason ?? undefined,
    memberOutcomes,
  }
}

async function getActorMembershipForCrew(actor: RequestActor, crewId: string) {
  const supabase = getServiceRoleClient()

  if (actor.kind === 'authenticated') {
    const profile = await ensureProfile(actor.authUser)
    const { data, error } = await supabase
      .from('crew_memberships')
      .select(CREW_MEMBERSHIP_WITH_ACTOR_SELECT)
      .eq('crew_id', crewId)
      .eq('profile_id', profile.id)
      .maybeSingle()

    if (error) throw error
    return data
  }

  if (actor.kind === 'guest' && actor.session.guestIdentityId) {
    const { data, error } = await supabase
      .from('crew_memberships')
      .select(CREW_MEMBERSHIP_WITH_ACTOR_SELECT)
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
    .select('id')
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

async function requireActiveNightParticipant(nightId: string, membershipId: string) {
  const supabase = getServiceRoleClient()
  const { data: participant, error } = await supabase
    .from('night_participants')
    .select('id')
    .eq('night_id', nightId)
    .eq('membership_id', membershipId)
    .is('left_at', null)
    .maybeSingle()

  if (error) throw error
  if (!participant) {
    throw new Error('Only active night participants can use Beer Bomb.')
  }

  return participant
}

let miniGameMatchTableAvailable: boolean | null = null

async function loadBackendState(
  actor: RequestActor,
  options: AppBootstrapOptions = {}
): Promise<AppBootstrapPayload> {
  const supabase = getServiceRoleClient()
  const bootstrapMode = options.mode === 'crew' ? 'crew' : 'full'

  let profile: any = null
  let guestIdentityId: string | null = null

  if (actor.kind === 'authenticated') {
    profile = await ensureProfile(actor.authUser)
  } else if (actor.kind === 'guest') {
    guestIdentityId = actor.session.guestIdentityId ?? null
  } else {
    return {
      bootstrapMode,
      activeCrewId: options.activeCrewId ?? null,
      crews: [],
      crewDataById: {},
      notifications: [],
      viewerUser: null,
      claimableGuests: [],
    }
  }

  let actorMembershipsQuery = supabase
    .from('crew_memberships')
    .select(CREW_MEMBERSHIP_WITH_ACTOR_SELECT)

  if (profile) {
    actorMembershipsQuery = actorMembershipsQuery.eq('profile_id', profile.id)
  } else if (guestIdentityId) {
    actorMembershipsQuery = actorMembershipsQuery.eq('guest_identity_id', guestIdentityId)
  } else {
    return {
      bootstrapMode,
      activeCrewId: options.activeCrewId ?? null,
      crews: [],
      crewDataById: {},
      notifications: [],
      viewerUser: null,
      claimableGuests: [],
    }
  }

  const { data: actorMemberships, error: actorMembershipError } = await actorMembershipsQuery
  if (actorMembershipError) throw actorMembershipError

  const activeMemberships = (actorMemberships ?? []).filter((membership: any) => membership.status === 'active')
  const crewIds = [...new Set(activeMemberships.map((membership: any) => membership.crew_id))]
  const scopedCrewId =
    bootstrapMode === 'crew' && options.activeCrewId && crewIds.includes(options.activeCrewId)
      ? options.activeCrewId
      : null
  const requestedCrewIds =
    bootstrapMode === 'crew'
      ? scopedCrewId
        ? [scopedCrewId]
        : []
      : crewIds

  if (!crewIds.length) {
    return {
      bootstrapMode,
      activeCrewId: scopedCrewId,
      crews: [],
      crewDataById: {},
      notifications: [],
      viewerUser: profile ? buildViewerUser(profile, activeMemberships) : null,
      claimableGuests: [],
    }
  }

  if (bootstrapMode === 'crew' && !requestedCrewIds.length) {
    return {
      bootstrapMode,
      activeCrewId: options.activeCrewId ?? null,
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
    supabase.from('crews').select(CREW_SELECT).in('id', requestedCrewIds).is('archived_at', null),
    supabase.from('crew_memberships').select(CREW_MEMBERSHIP_WITH_ACTOR_SELECT).in('crew_id', requestedCrewIds),
    supabase.from('nights').select(NIGHT_SELECT).in('crew_id', requestedCrewIds).order('started_at', { ascending: false }),
  ])

  if (crewResult.error) throw crewResult.error
  if (membershipResult.error) throw membershipResult.error
  if (nightResult.error) throw nightResult.error

  const nights = nightResult.data ?? []
  const nightIds = nights.map((night: any) => night.id)

  const notificationQuery = profile
    ? supabase
        .from('notifications')
        .select(NOTIFICATION_SELECT)
        .or(`profile_id.eq.${profile.id},membership_id.in.(${activeMemberships.map((membership: any) => membership.id).join(',')})`)
        .order('created_at', { ascending: false })
        .limit(NOTIFICATION_BOOTSTRAP_LIMIT)
    : supabase
        .from('notifications')
        .select(NOTIFICATION_SELECT)
        .in('membership_id', activeMemberships.map((membership: any) => membership.id))
        .order('created_at', { ascending: false })
        .limit(NOTIFICATION_BOOTSTRAP_LIMIT)

  const canLoadMiniGameMatches = miniGameMatchTableAvailable !== false
  const [participantResult, betResult, notificationResult, ledgerResult, miniGameMatchResult] = await Promise.all([
    nightIds.length
      ? supabase.from('night_participants').select(NIGHT_PARTICIPANT_SELECT).in('night_id', nightIds)
      : Promise.resolve({ data: [], error: null } as any),
    nightIds.length
      ? supabase.from('bets').select(BET_SELECT).in('night_id', nightIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null } as any),
    notificationQuery,
    supabase.from('ledger_events').select(LEDGER_EVENT_SELECT).in('crew_id', crewIds).order('created_at', { ascending: false }),
    canLoadMiniGameMatches && nightIds.length
      ? supabase.from('mini_game_matches').select(MINI_GAME_MATCH_SELECT).in('night_id', nightIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null } as any),
  ])

  if (participantResult.error) throw participantResult.error
  if (betResult.error) throw betResult.error
  if (notificationResult.error) throw notificationResult.error
  if (ledgerResult.error) throw ledgerResult.error

  const miniGameMatchQueryFailed = Boolean(
    miniGameMatchResult.error &&
    /mini_game_matches|schema cache/i.test(miniGameMatchResult.error.message ?? '')
  )
  if (!miniGameMatchResult.error) {
    miniGameMatchTableAvailable = true
  } else if (miniGameMatchQueryFailed) {
    miniGameMatchTableAvailable = false
  }
  if (miniGameMatchResult.error && !miniGameMatchQueryFailed) throw miniGameMatchResult.error

  const bets = betResult.data ?? []
  const betIds = bets.map((bet: any) => bet.id)
  const miniGameMatches = miniGameMatchQueryFailed ? [] : (miniGameMatchResult.data ?? [])

  const [
    optionResult,
    wagerResult,
    outcomeResult,
  ] = await Promise.all([
    betIds.length
      ? supabase.from('bet_options').select(BET_OPTION_SELECT).in('bet_id', betIds).order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null } as any),
    betIds.length
      ? supabase.from('wagers').select(WAGER_SELECT).in('bet_id', betIds)
      : Promise.resolve({ data: [], error: null } as any),
    betIds.length
      ? supabase.from('bet_member_outcomes').select(OUTCOME_SELECT).in('bet_id', betIds)
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

  const miniGameMatchesByNightId = new Map<string, MiniGameMatch[]>()
  miniGameMatches.forEach((match: any) => {
    const bucket = miniGameMatchesByNightId.get(match.night_id) ?? []
    bucket.push(buildMiniGameMatch(match, usersByMembershipId))
    miniGameMatchesByNightId.set(match.night_id, bucket)
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
    bucket.push(buildDomainBet(bet, usersByMembershipId, options, memberOutcomes))
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
        miniGameMatches: miniGameMatchesByNightId.get(night.id) ?? [],
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
  }).concat(buildMiniGameOutcomeEntries(miniGameMatches))

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
    crewId: notification.crew_id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    crewName: crews.find((crew) => crew.id === notification.crew_id)?.name ?? 'BeerScore',
    timestamp: asDate(notification.created_at),
    read: Boolean(notification.read_at),
    payload: notification.payload ?? {},
  }))

  const viewerUser = profile
    ? buildViewerUser(profile, membershipRows.filter((membership: any) => membership.profile_id === profile.id))
    : activeMemberships[0]
      ? buildUserFromMembership(activeMemberships[0])
      : null

  const claimableGuests: ClaimableGuest[] = profile
    ? membershipRows
        .filter((membership: any) => {
          const guestIdentity = unwrapRelation(membership.guest_identities)
          return (
            membership.actor_type === 'guest' &&
            crewIds.includes(membership.crew_id) &&
            !guestIdentity?.upgraded_to_profile_id
          )
        })
        .map((membership: any) => {
          const guestIdentity = unwrapRelation(membership.guest_identities)
          return {
            guestMembershipId: membership.id,
            guestIdentityId: membership.guest_identity_id,
            guestName: guestIdentity?.display_name ?? 'Guest',
            crewId: membership.crew_id,
            crewName: (crewResult.data ?? []).find((crew: any) => crew.id === membership.crew_id)?.name ?? 'BeerScore',
            status: membership.status,
            joinedAt: asDate(membership.joined_at).toISOString(),
          }
        })
    : []

  return {
    bootstrapMode,
    activeCrewId: scopedCrewId,
    crews,
    crewDataById,
    notifications,
    viewerUser,
    claimableGuests,
  }
}

export async function loadAppState(actor: RequestActor, options?: AppBootstrapOptions): Promise<AppBootstrapPayload> {
  return loadBackendState(actor, options)
}

export async function joinCrewAsGuest(
  name: string,
  inviteCode: string,
  options?: { mode?: AppBootstrapMode }
): Promise<AppMutationPayload> {
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
    .select(CREW_SETTINGS_SELECT)
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
    .select(GUEST_IDENTITY_SELECT)
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
    .select(CREW_MEMBERSHIP_SELECT)
    .single()

  if (membershipError) throw membershipError

  await ensureNotificationPreference(membership.id)

  const { data: activeNight } = await supabase
    .from('nights')
    .select('id')
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

  const payload = await loadAppState(
    { kind: 'guest', session },
    {
      mode: options?.mode ?? 'full',
      activeCrewId: crew.id,
    }
  )
  return { ...payload, session }
}

async function loadBetResolutionContext(betId: string) {
  const supabase = getServiceRoleClient()
  const { data: bet, error: betError } = await supabase
    .from('bets')
    .select(BET_SELECT)
    .eq('id', betId)
    .single()

  if (betError) throw betError

  const [optionResult, wagerResult, membershipResult] = await Promise.all([
    supabase.from('bet_options').select(BET_OPTION_SELECT).eq('bet_id', betId).order('sort_order', { ascending: true }),
    supabase.from('wagers').select(WAGER_SELECT).eq('bet_id', betId),
    supabase.from('crew_memberships').select(CREW_MEMBERSHIP_WITH_ACTOR_SELECT).eq('crew_id', bet.crew_id),
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

  const wagerRows = wagerResult.data ?? []
  const options = (optionResult.data ?? []).map((option: any) => {
    const wagers = wagerRows
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

  const domainBet = buildDomainBet(bet, usersByMembershipId, options)

  return {
    bet,
    domainBet,
    actorIdToMembershipId,
    wagerRows,
  }
}

async function loadMiniGameMatchContext(matchId: string) {
  const supabase = getServiceRoleClient()
  const { data: match, error: matchError } = await supabase
    .from('mini_game_matches')
    .select(MINI_GAME_MATCH_SELECT)
    .eq('id', matchId)
    .single()

  if (matchError) throw matchError

  const { data: membershipRows, error: membershipError } = await supabase
    .from('crew_memberships')
    .select(CREW_MEMBERSHIP_WITH_ACTOR_SELECT)
    .eq('crew_id', match.crew_id)

  if (membershipError) throw membershipError

  const usersByMembershipId = new Map<string, User>()
  const actorIdToMembershipId = new Map<string, string>()

  ;(membershipRows ?? []).forEach((membership: any) => {
    const user = buildUserFromMembership(membership)
    usersByMembershipId.set(membership.id, user)
    actorIdToMembershipId.set(user.id, membership.id)
  })

  return {
    match,
    membershipRows: membershipRows ?? [],
    usersByMembershipId,
    actorIdToMembershipId,
    domainMatch: buildMiniGameMatch(match, usersByMembershipId),
  }
}

async function recordMiniGameMatchEvent(
  matchId: string,
  actorMembershipId: string | null,
  eventType: string,
  payload: Record<string, any>
) {
  const supabase = getServiceRoleClient()
  const { error } = await supabase.from('mini_game_match_events').insert({
    match_id: matchId,
    actor_membership_id: actorMembershipId,
    event_type: eventType,
    payload,
  })

  if (error) throw error
}

async function cancelMiniGameMatch(match: any, actorMembershipId: string | null, reason: string, eventType = 'cancelled') {
  const supabase = getServiceRoleClient()
  const nextStatus = eventType === 'declined' ? 'declined' : 'cancelled'
  const now = new Date().toISOString()
  const eventName = eventType === 'declined' ? 'challenge_declined' : 'challenge_cancelled'

  await supabase
    .from('mini_game_matches')
    .update({
      status: nextStatus,
      agreed_wager: null,
      current_turn_membership_id: null,
      starting_player_membership_id: null,
      respond_by_at: null,
      declined_at: eventType === 'declined' ? now : null,
      cancelled_at: eventType === 'declined' ? null : now,
      updated_at: now,
    })
    .eq('id', match.id)
    .eq('status', 'pending')

  await recordMiniGameMatchEvent(match.id, actorMembershipId, eventName, { reason, source: eventType })
}

async function processMiniGameExpirationsForCrews(crewIds: string[]) {
  if (!crewIds.length) {
    return
  }

  if (miniGameMatchTableAvailable === false) {
    return
  }

  const supabase = getServiceRoleClient()
  const nowIso = new Date().toISOString()
  const { data: staleMatches, error } = await supabase
    .from('mini_game_matches')
    .select('id, crew_id, status, created_by_membership_id, respond_by_at')
    .in('crew_id', crewIds)
    .eq('status', 'pending')
    .lt('respond_by_at', nowIso)

  if (error) {
    if (/mini_game_matches|schema cache/i.test(error.message ?? '')) {
      miniGameMatchTableAvailable = false
      return
    }

    throw error
  }

  miniGameMatchTableAvailable = true

  for (const match of staleMatches ?? []) {
    await cancelMiniGameMatch(match, match.created_by_membership_id ?? null, 'Challenge expired before it was accepted.')

    await notifyCrewMembers(match.crew_id, {
      type: 'challenge',
      title: 'Beer Bomb challenge expired',
      message: 'Your Beer Bomb invite expired before it was accepted.',
      payload: {
        matchId: match.id,
        status: 'cancelled',
        reason: 'expired',
      },
      membershipIds: match.created_by_membership_id ? [match.created_by_membership_id] : undefined,
    })
  }
}

async function persistVoidBet(
  actorMembershipId: string,
  bet: any,
  reason: string,
  source: string,
  note: string
) {
  const supabase = getServiceRoleClient()

  await supabase.from('bet_member_outcomes').delete().eq('bet_id', bet.id)
  await supabase.from('ledger_events').delete().eq('bet_id', bet.id)

  await supabase.from('bets').update({
    status: 'void',
    winning_option_id: null,
    pending_result_option_id: null,
    pending_result_at: null,
    resolved_at: new Date().toISOString(),
    void_reason: reason,
  }).eq('id', bet.id)

  await supabase.from('bet_status_events').insert({
    bet_id: bet.id,
    actor_membership_id: actorMembershipId,
    from_status: bet.status,
    to_status: 'void',
    note,
    metadata: { source, reason },
  })

  await notifyCrewMembers(bet.crew_id, {
    type: 'bet_resolved',
    title: `${bet.title} was voided`,
    message: reason,
    payload: { betId: bet.id, winningOptionId: null, voidReason: reason },
    excludeMembershipId: actorMembershipId,
  })
}

async function createLinkedMiniGameBet(
  match: any,
  title: string,
  stake: number,
  challengerLabel: string,
  opponentLabel: string
) {
  const supabase = getServiceRoleClient()
  const closesAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()

  const { data: bet, error: betError } = await supabase
    .from('bets')
    .insert({
      crew_id: match.crew_id,
      night_id: match.night_id,
      type: 'h2h',
      subtype: null,
      title,
      description: 'Beer Bomb challenge with side bets.',
      status: 'open',
      created_by_membership_id: match.created_by_membership_id,
      challenger_membership_id: match.opponent_membership_id,
      closes_at: closesAt,
    })
    .select('id, crew_id, night_id, title, status, created_by_membership_id, challenger_membership_id')
    .single()

  if (betError) throw betError

  const optionRows = [
    {
      bet_id: bet.id,
      label: challengerLabel,
      sort_order: 0,
    },
    {
      bet_id: bet.id,
      label: opponentLabel,
      sort_order: 1,
    },
  ]

  const { data: createdOptions, error: optionError } = await supabase
    .from('bet_options')
    .insert(optionRows)
    .select('id, sort_order')

  if (optionError) throw optionError

  const creatorOption = createdOptions?.find((option: any) => option.sort_order === 0)
  const challengerOption = createdOptions?.find((option: any) => option.sort_order === 1)

  if (!creatorOption || !challengerOption) {
    throw new Error('Could not create linked mini-game bet options.')
  }

  const { error: wagerError } = await supabase.from('wagers').upsert([
    {
      bet_id: bet.id,
      bet_option_id: creatorOption.id,
      membership_id: match.created_by_membership_id,
      drinks: stake,
    },
    {
      bet_id: bet.id,
      bet_option_id: challengerOption.id,
      membership_id: match.opponent_membership_id,
      drinks: stake,
    },
  ], { onConflict: 'bet_id,membership_id' })

  if (wagerError) throw wagerError

  await supabase.from('bet_status_events').insert({
    bet_id: bet.id,
    actor_membership_id: match.created_by_membership_id,
    from_status: null,
    to_status: 'open',
    note: 'Bet created from Beer Bomb challenge acceptance.',
    metadata: { source: 'mini_game_acceptance', matchId: match.id, gameKey: match.game_key },
  })

  const { error: matchUpdateError } = await supabase
    .from('mini_game_matches')
    .update({
      bet_id: bet.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', match.id)

  if (matchUpdateError) throw matchUpdateError

  return {
    bet,
    creatorOptionId: creatorOption.id as string,
    challengerOptionId: challengerOption.id as string,
  }
}

async function proposeMiniGameMatchResult(
  actorMembershipId: string,
  match: any,
  winnerMembershipId: string
) {
  if (!match.bet_id) {
    return false
  }

  const supabase = getServiceRoleClient()
  const [{ data: bet, error: betError }, { data: options, error: optionsError }] = await Promise.all([
    supabase.from('bets').select(BET_SELECT).eq('id', match.bet_id).single(),
    supabase.from('bet_options').select('id, sort_order').eq('bet_id', match.bet_id).order('sort_order', { ascending: true }),
  ])

  if (betError) throw betError
  if (optionsError) throw optionsError
  if (bet.status !== 'open') {
    return true
  }

  const winnerOptionId =
    winnerMembershipId === bet.created_by_membership_id
      ? options?.find((option: any) => option.sort_order === 0)?.id
      : options?.find((option: any) => option.sort_order === 1)?.id

  if (!winnerOptionId) {
    throw new Error('Could not determine the winning option for the linked mini-game bet.')
  }

  const { domainBet } = await loadBetResolutionContext(match.bet_id)
  const preview = resolveBetWithParimutuel(domainBet, winnerOptionId)

  if (preview.status === 'void') {
    await persistVoidBet(
      actorMembershipId,
      bet,
      preview.voidReason ?? 'No opposing action',
      'mini_game_auto',
      'Linked mini-game bet voided when Beer Bomb completed.'
    )
    return true
  }

  await resolveBetAndPersist(
    actorMembershipId,
    match.bet_id,
    winnerOptionId,
    'mini_game_auto',
    'Linked mini-game bet resolved automatically from Beer Bomb completion.'
  )

  await notifyCrewMembers(match.crew_id, {
    type: 'bet_created',
    title: `${match.title} settled`,
    message: `The Beer Bomb result automatically settled ${match.title}.`,
    payload: { betId: match.bet_id, matchId: match.id, winningOptionId: winnerOptionId },
    excludeMembershipId: actorMembershipId,
  })

  return true
}

async function resolveBetAndPersist(
  actorMembershipId: string,
  betId: string,
  winningOptionId: string,
  source = 'manual',
  note = 'Bet resolved.'
) {
  const supabase = getServiceRoleClient()
  const { bet, domainBet, actorIdToMembershipId } = await loadBetResolutionContext(betId)

  if (!['open', 'pending_result', 'disputed'].includes(bet.status)) {
    throw new Error('Only open, pending-result, or disputed bets can be resolved.')
  }

  const resolvedBet = resolveBetWithParimutuel(domainBet, winningOptionId)

  if (resolvedBet.status === 'void') {
    await persistVoidBet(
      actorMembershipId,
      bet,
      resolvedBet.voidReason ?? 'No opposing action',
      source,
      note
    )
    return resolvedBet
  }

  await supabase.from('bet_member_outcomes').delete().eq('bet_id', bet.id)
  await supabase.from('ledger_events').delete().eq('bet_id', bet.id)

  await supabase.from('bets').update({
    status: 'resolved',
    winning_option_id: winningOptionId,
    pending_result_option_id: null,
    pending_result_at: null,
    resolved_at: new Date().toISOString(),
    void_reason: null,
  }).eq('id', bet.id)

  await supabase.from('bet_status_events').insert({
    bet_id: bet.id,
    actor_membership_id: actorMembershipId,
    from_status: bet.status,
    to_status: 'resolved',
    note,
    metadata: { winningOptionId, source },
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

  await notifyCrewMembers(bet.crew_id, {
    type: 'bet_resolved',
    title: `${bet.title} settled`,
    message: `The result is in for ${bet.title}.`,
    payload: {
      betId: bet.id,
      winningOptionId,
    },
    excludeMembershipId: actorMembershipId,
  })

  return resolvedBet
}

async function finalizeDispute(disputeId: string, actorMembershipId: string) {
  const supabase = getServiceRoleClient()
  const { data: dispute, error: disputeError } = await supabase
    .from('disputes')
    .select('id, bet_id, status')
    .eq('id', disputeId)
    .single()

  if (disputeError) throw disputeError
  if (dispute.status !== 'open') {
    return
  }

  const { data: bet, error: betError } = await supabase
    .from('bets')
    .select(BET_SELECT)
    .eq('id', dispute.bet_id)
    .single()

  if (betError) throw betError
  if (bet.status !== 'disputed' || !bet.pending_result_option_id) {
    return
  }

  const [voteResult, wagerResult] = await Promise.all([
    supabase.from('dispute_votes').select('membership_id, option_id').eq('dispute_id', dispute.id),
    supabase.from('wagers').select('membership_id').eq('bet_id', bet.id),
  ])

  if (voteResult.error) throw voteResult.error
  if (wagerResult.error) throw wagerResult.error

  const eligibleMembershipIds = [...new Set((wagerResult.data ?? []).map((row: any) => row.membership_id))]
  const votes = voteResult.data ?? []
  const countedVoteMembershipIds = new Set(votes.map((vote: any) => vote.membership_id))
  const tally = new Map<string, number>()

  votes.forEach((vote: any) => {
    if (!vote.option_id) {
      return
    }

    tally.set(vote.option_id, (tally.get(vote.option_id) ?? 0) + 1)
  })

  eligibleMembershipIds
    .filter((membershipId) => !countedVoteMembershipIds.has(membershipId))
    .forEach(() => {
      tally.set(
        bet.pending_result_option_id,
        (tally.get(bet.pending_result_option_id) ?? 0) + 1
      )
    })

  const rankedOptions = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const winningEntry = rankedOptions[0]
  const tie = rankedOptions.length > 1 && winningEntry?.[1] === rankedOptions[1][1]

  if (!winningEntry || tie) {
    await persistVoidBet(
      actorMembershipId,
      bet,
      'Dispute vote tied',
      'dispute',
      'Bet voided after a tied dispute vote.'
    )

    await supabase.from('disputes').update({
      status: 'resolved',
      resolution_option_id: null,
      resolved_at: new Date().toISOString(),
    }).eq('id', dispute.id)
    return
  }

  await resolveBetAndPersist(
    actorMembershipId,
    bet.id,
    winningEntry[0],
    'dispute',
    'Bet resolved after a dispute vote.'
  )

  await supabase.from('disputes').update({
    status: 'resolved',
    resolution_option_id: winningEntry[0],
    resolved_at: new Date().toISOString(),
  }).eq('id', dispute.id)
}

async function processBetExpirationsForCrews(crewIds: string[]) {
  if (!crewIds.length) {
    return
  }

  const supabase = getServiceRoleClient()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const pendingResultCutoffIso = new Date(now - RESULT_CONFIRMATION_WINDOW_MS).toISOString()

  const { data: pendingOffers, error: pendingOffersError } = await supabase
    .from('bets')
    .select('id, crew_id, created_by_membership_id, challenger_membership_id, status, respond_by_at')
    .in('crew_id', crewIds)
    .eq('status', 'pending_accept')
    .lt('respond_by_at', nowIso)

  if (pendingOffersError) throw pendingOffersError

  for (const bet of pendingOffers ?? []) {
    const declinedAt = new Date().toISOString()
    await supabase
      .from('bets')
      .update({
        status: 'declined',
        closes_at: null,
        respond_by_at: null,
        accepted_at: null,
        declined_at: declinedAt,
        resolved_at: declinedAt,
        void_reason: 'Bet invite expired before it was accepted.',
      })
      .eq('id', bet.id)
      .eq('status', 'pending_accept')

    await supabase.from('bet_status_events').insert({
      bet_id: bet.id,
      actor_membership_id: bet.created_by_membership_id,
      from_status: 'pending_accept',
      to_status: 'declined',
      note: 'Bet invite expired before it was accepted.',
      metadata: { source: 'timeout' },
    })

    await notifyCrewMembers(bet.crew_id, {
      type: 'bet_created',
      title: 'Bet invite expired',
      message: 'Your 1v1 bet invite expired before the other player responded.',
      payload: {
        betId: bet.id,
        status: 'declined',
        reason: 'expired',
      },
      membershipIds: bet.created_by_membership_id ? [bet.created_by_membership_id] : undefined,
    })
  }

  const { data: pendingBets, error: pendingError } = await supabase
    .from('bets')
    .select('id, crew_id, status, created_by_membership_id, pending_result_option_id, pending_result_at')
    .in('crew_id', crewIds)
    .eq('status', 'pending_result')
    .lt('pending_result_at', pendingResultCutoffIso)

  if (pendingError) throw pendingError

  for (const bet of pendingBets ?? []) {
    if (!bet.pending_result_option_id || !bet.pending_result_at) {
      continue
    }

    await resolveBetAndPersist(
      bet.created_by_membership_id,
      bet.id,
      bet.pending_result_option_id,
      'timeout',
      'Pending result auto-confirmed after the dispute window elapsed.'
    )
  }

  const { data: openDisputes, error: disputeError } = await supabase
    .from('disputes')
    .select('id, opened_by_membership_id, expires_at, bet_id')
    .eq('status', 'open')
    .lt('expires_at', nowIso)

  if (disputeError) throw disputeError

  const relatedBetIds = [...new Set((openDisputes ?? []).map((dispute: any) => dispute.bet_id).filter(Boolean))]
  const { data: relatedBets, error: relatedBetsError } = relatedBetIds.length
    ? await supabase
        .from('bets')
        .select('id, crew_id')
        .in('id', relatedBetIds)
    : { data: [], error: null }

  if (relatedBetsError) throw relatedBetsError

  const crewIdByBetId = new Map((relatedBets ?? []).map((bet: any) => [bet.id, bet.crew_id]))

  for (const dispute of openDisputes ?? []) {
    const relatedCrewId = crewIdByBetId.get(dispute.bet_id)
    if (!relatedCrewId || !crewIds.includes(relatedCrewId)) {
      continue
    }

    await finalizeDispute(dispute.id, dispute.opened_by_membership_id)
  }
}

export async function runExpirationSweep() {
  const supabase = getServiceRoleClient()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const pendingResultCutoffIso = new Date(now - RESULT_CONFIRMATION_WINDOW_MS).toISOString()
  const crewIds = new Set<string>()

  const [
    pendingOffersResult,
    pendingBetsResult,
    expiredDisputesResult,
  ] = await Promise.all([
    supabase
      .from('bets')
      .select('crew_id')
      .eq('status', 'pending_accept')
      .lt('respond_by_at', nowIso),
    supabase
      .from('bets')
      .select('crew_id')
      .eq('status', 'pending_result')
      .lt('pending_result_at', pendingResultCutoffIso),
    supabase
      .from('disputes')
      .select('bet_id')
      .eq('status', 'open')
      .lt('expires_at', nowIso),
  ])

  if (pendingOffersResult.error) throw pendingOffersResult.error
  if (pendingBetsResult.error) throw pendingBetsResult.error
  if (expiredDisputesResult.error) throw expiredDisputesResult.error

  for (const row of pendingOffersResult.data ?? []) {
    if (row.crew_id) {
      crewIds.add(row.crew_id)
    }
  }

  for (const row of pendingBetsResult.data ?? []) {
    if (row.crew_id) {
      crewIds.add(row.crew_id)
    }
  }

  const disputedBetIds = [...new Set((expiredDisputesResult.data ?? []).map((row: any) => row.bet_id).filter(Boolean))]
  if (disputedBetIds.length) {
    const { data: disputedBets, error: disputedBetsError } = await supabase
      .from('bets')
      .select('crew_id')
      .in('id', disputedBetIds)

    if (disputedBetsError) throw disputedBetsError

    for (const row of disputedBets ?? []) {
      if (row.crew_id) {
        crewIds.add(row.crew_id)
      }
    }
  }

  if (miniGameMatchTableAvailable !== false) {
    const { data: expiredMatches, error: expiredMatchesError } = await supabase
      .from('mini_game_matches')
      .select('crew_id')
      .eq('status', 'pending')
      .lt('respond_by_at', nowIso)

    if (expiredMatchesError) {
      if (/mini_game_matches|schema cache/i.test(expiredMatchesError.message ?? '')) {
        miniGameMatchTableAvailable = false
      } else {
        throw expiredMatchesError
      }
    } else {
      miniGameMatchTableAvailable = true
      for (const row of expiredMatches ?? []) {
        if (row.crew_id) {
          crewIds.add(row.crew_id)
        }
      }
    }
  }

  const dueCrewIds = [...crewIds]
  if (!dueCrewIds.length) {
    return { processedCrewIds: [] as string[] }
  }

  await processBetExpirationsForCrews(dueCrewIds)
  await processMiniGameExpirationsForCrews(dueCrewIds)

  return { processedCrewIds: dueCrewIds }
}

export async function resetPublicAppData() {
  const supabase = getServiceRoleClient()
  const keyTables = ['profiles', 'crews', 'crew_memberships', 'nights', 'bets', 'mini_game_matches', 'notifications'] as const
  const tableResets = [
    ['bet_comments', 'id'],
    ['bet_member_outcomes', 'id'],
    ['bet_status_events', 'id'],
    ['wagers', 'id'],
    ['bet_options', 'id'],
    ['mini_game_match_events', 'id'],
    ['dispute_votes', 'id'],
    ['settlement_confirmations', 'id'],
    ['settlement_requests', 'id'],
    ['ledger_events', 'id'],
    ['notifications', 'id'],
    ['notification_preferences', 'id'],
    ['profile_preferences', 'id'],
    ['night_participants', 'id'],
    ['crew_invite_redemptions', 'id'],
    ['crew_join_requests', 'id'],
    ['crew_invites', 'id'],
    ['audit_log', 'id'],
    ['disputes', 'id'],
    ['mini_game_matches', 'id'],
    ['bets', 'id'],
    ['nights', 'id'],
    ['crew_settings', 'crew_id'],
    ['crew_memberships', 'id'],
    ['guest_identities', 'id'],
    ['crews', 'id'],
    ['profiles', 'id'],
  ] as const

  const before = Object.fromEntries(await Promise.all(
    keyTables.map(async (table) => {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
      if (error) throw error
      return [table, count ?? 0]
    })
  ))

  for (const [table, column] of tableResets) {
    const { error } = await supabase.from(table).delete().not(column, 'is', null)
    if (error) throw error
  }

  const after = Object.fromEntries(await Promise.all(
    keyTables.map(async (table) => {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
      if (error) throw error
      return [table, count ?? 0]
    })
  ))

  return { before, after }
}

async function findOpenDisputeForBet(supabase: ReturnType<typeof getServiceRoleClient>, betId: string) {
  const { data: dispute, error } = await supabase
    .from('disputes')
    .select('id, bet_id, status, expires_at')
    .eq('bet_id', betId)
    .eq('status', 'open')
    .maybeSingle()

  if (error) throw error
  return dispute
}

export async function mutateAppState(actor: RequestActor, action: string, payload: Record<string, any>): Promise<AppMutationPayload> {
  const supabase = getServiceRoleClient()
  let responseCrewId = typeof payload.crewId === 'string' && payload.crewId ? payload.crewId : null

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
        .select('id, drink_theme')
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
        .select('id')
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
      responseCrewId = crew.id
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
        .select('id, role')
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
          .select('id')
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
        .select('id')
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

      responseCrewId = crew.id
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
        .select(`${CREW_MEMBERSHIP_SELECT}, guest_identities(${GUEST_IDENTITY_SELECT})`)
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
        .select('id')
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

      responseCrewId = guestMembership.crew_id
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
        .select('id, name')
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
          .select('id,status,created_by_membership_id')
          .eq('night_id', payload.nightId)
          .in('status', ['open', 'pending_result', 'disputed', 'pending_accept'])

        if (openBets?.length) {
          const pendingAcceptIds = openBets.filter((bet: any) => bet.status === 'pending_accept').map((bet: any) => bet.id)
          const liveBetIds = openBets.filter((bet: any) => bet.status !== 'pending_accept').map((bet: any) => bet.id)

          if (liveBetIds.length) {
            await supabase
              .from('bets')
              .update({
                status: 'void',
                pending_result_option_id: null,
                pending_result_at: null,
                resolved_at: new Date().toISOString(),
                void_reason: 'Night ended without final resolution.',
              })
              .in('id', liveBetIds)
          }

          if (pendingAcceptIds.length) {
            await supabase
              .from('bets')
              .update({
                status: 'cancelled',
                closes_at: null,
                respond_by_at: null,
                resolved_at: new Date().toISOString(),
                void_reason: 'Night ended before the bet invite was accepted.',
              })
              .in('id', pendingAcceptIds)
          }

          await supabase.from('bet_status_events').insert(
            openBets.map((bet: any) => ({
              bet_id: bet.id,
              actor_membership_id: actorMembership.id,
              from_status: bet.status,
              to_status: bet.status === 'pending_accept' ? 'cancelled' : 'void',
              note: bet.status === 'pending_accept'
                ? 'Night ended before the bet invite was accepted.'
                : 'Night ended without final resolution.',
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
        .select('id, status')
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
      const closeTime = payload.closeTime == null ? null : Number(payload.closeTime)
      if (payload.type !== 'h2h' && (!Number.isFinite(closeTime) || (closeTime ?? 0) <= 0)) {
        throw new Error('Bet close time must be greater than zero.')
      }

      const subtype = payload.type === 'h2h'
        ? null
        : (
            payload.subtype ??
            (Array.isArray(payload.options) && payload.options.length > 2
              ? 'multi'
              : payload.line != null
                ? 'overunder'
                : 'yesno')
          )
      const line = payload.line == null ? null : Number(payload.line)

      if (!Array.isArray(payload.options) || payload.options.length < 2) {
        throw new Error('A bet needs at least two options.')
      }

      if (payload.type === 'prop' && subtype === 'multi' && payload.options.length < 3) {
        throw new Error('Prediction bets need at least three options.')
      }

      if (subtype === 'overunder') {
        if (line == null || !Number.isFinite(line) || line <= 0 || Math.round(line * 2) !== line * 2) {
          throw new Error('Over/under lines must be positive and use 0.5 increments.')
        }
      }

      const { data: participant } = await supabase
        .from('night_participants')
        .select('id')
        .eq('night_id', payload.nightId)
        .eq('membership_id', actorMembership.id)
        .is('left_at', null)
        .maybeSingle()

      if (!participant) {
        await ensureNightParticipant(payload.nightId, actorMembership.id)
      }

      if (payload.type === 'h2h') {
        if (!payload.challengerMembershipId || payload.challengerMembershipId === actorMembership.id) {
          throw new Error('Choose another active participant for a head-to-head challenge.')
        }

        const { data: challengerParticipant, error: challengerParticipantError } = await supabase
          .from('night_participants')
          .select('id')
          .eq('night_id', payload.nightId)
          .eq('membership_id', payload.challengerMembershipId)
          .is('left_at', null)
          .maybeSingle()

        if (challengerParticipantError) throw challengerParticipantError
        if (!challengerParticipant) {
          throw new Error('Your opponent has to be part of the current night.')
        }

      }

      const h2hStake = payload.type === 'h2h' ? Number(payload.wager) : null
      if (payload.type === 'h2h') {
        if (!isValidHalfDrinkAmount(Number(h2hStake))) {
          throw new Error(`Head-to-head stakes must be in 0.5 drink increments and at most ${MAX_WAGER_DRINKS} drinks.`)
        }
      }

      const { data: bet, error: betError } = await supabase
        .from('bets')
        .insert({
          crew_id: payload.crewId,
          night_id: payload.nightId,
          type: payload.type,
          subtype,
          title: payload.title?.trim() || 'Untitled bet',
          description: payload.description?.trim() || null,
          line,
          status: payload.type === 'h2h' ? 'pending_accept' : 'open',
          created_by_membership_id: actorMembership.id,
          challenger_membership_id: payload.challengerMembershipId ?? null,
          closes_at: payload.type === 'h2h' ? null : new Date(Date.now() + (closeTime ?? 0) * 60_000).toISOString(),
          challenge_wager: h2hStake,
          respond_by_at: payload.type === 'h2h'
            ? new Date(Date.now() + H2H_RESPONSE_WINDOW_MINUTES * 60_000).toISOString()
            : null,
          close_after_accept_minutes: payload.type === 'h2h' ? null : closeTime,
        })
        .select('id, title')
        .single()

      if (betError) throw betError

      const optionInputs = subtype === 'overunder' && line != null
        ? [{ label: `Over ${line}` }, { label: `Under ${line}` }]
        : payload.options

      const options = optionInputs.map((option: { label: string }, index: number) => ({
        bet_id: bet.id,
        label: option.label.trim(),
        sort_order: index,
      }))

      const { data: createdOptions, error: optionError } = await supabase
        .from('bet_options')
        .insert(options)
        .select('id, sort_order')

      if (optionError) throw optionError

      await supabase.from('bet_status_events').insert({
        bet_id: bet.id,
        actor_membership_id: actorMembership.id,
        from_status: null,
        to_status: payload.type === 'h2h' ? 'pending_accept' : 'open',
        note: payload.type === 'h2h' ? 'Bet invite created.' : 'Bet created.',
        metadata: payload.type === 'h2h' ? { challengeWager: h2hStake } : {},
      })

      if (payload.type !== 'h2h' && payload.wager && Number(payload.wager) > 0) {
        if (!isValidHalfDrinkAmount(Number(payload.wager))) {
          throw new Error(`Wagers must be in 0.5 drink increments and at most ${MAX_WAGER_DRINKS} drinks.`)
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
        title: payload.type === 'h2h' ? `${bet.title} needs a response` : bet.title,
        message: payload.type === 'h2h'
          ? `${buildUserFromMembership(actorMembership).name} offered you ${formatDrinks(h2hStake ?? 0)} drinks on ${bet.title}.`
          : `${bet.title} is now open.`,
        payload: {
          betId: bet.id,
          nightId: payload.nightId,
          status: payload.type === 'h2h' ? 'pending_accept' : 'open',
          challengeWager: h2hStake ?? undefined,
          createdByMembershipId: actorMembership.id,
          challengerMembershipId: payload.challengerMembershipId ?? undefined,
          targetMembershipId: payload.type === 'h2h' ? payload.challengerMembershipId ?? undefined : undefined,
        },
        excludeMembershipId: payload.type === 'h2h' ? null : actorMembership.id,
        membershipIds: payload.type === 'h2h' && payload.challengerMembershipId
          ? [payload.challengerMembershipId]
          : undefined,
      })
      break
    }

    case 'respondToBetOffer': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const { data: bet, error: betError } = await supabase
        .from('bets')
        .select(BET_SELECT)
        .eq('id', payload.betId)
        .single()

      if (betError) throw betError
      if (bet.crew_id !== payload.crewId) {
        throw new Error('That bet does not belong to this crew.')
      }
      if (bet.type !== 'h2h') {
        throw new Error('Only 1v1 bet invites can be responded to here.')
      }
      if (bet.status !== 'pending_accept') {
        throw new Error('That bet invite is no longer waiting for a response.')
      }
      if (bet.challenger_membership_id !== actorMembership.id) {
        throw new Error('Only the challenged player can respond to this bet offer.')
      }
      if (!bet.respond_by_at || asDate(bet.respond_by_at).getTime() <= Date.now()) {
        throw new Error('That bet invite has already expired.')
      }

      await Promise.all([
        requireActiveNightParticipant(bet.night_id, actorMembership.id),
        requireActiveNightParticipant(bet.night_id, bet.created_by_membership_id),
      ])

      const stake = Number(bet.challenge_wager)
      if (!isValidHalfDrinkAmount(stake)) {
        throw new Error('That bet invite is missing a valid stake.')
      }

      const [{ data: optionRows, error: optionError }, { data: membershipRows, error: membershipError }] = await Promise.all([
        supabase.from('bet_options').select('id, sort_order').eq('bet_id', bet.id).order('sort_order', { ascending: true }),
        supabase.from('crew_memberships').select(CREW_MEMBERSHIP_WITH_ACTOR_SELECT).in('id', [bet.created_by_membership_id, bet.challenger_membership_id]),
      ])

      if (optionError) throw optionError
      if (membershipError) throw membershipError

      const usersByMembershipId = new Map<string, User>()
      ;(membershipRows ?? []).forEach((membership: any) => {
        usersByMembershipId.set(membership.id, buildUserFromMembership(membership))
      })

      const creatorUser = usersByMembershipId.get(bet.created_by_membership_id) ?? {
        id: bet.created_by_membership_id,
        membershipId: bet.created_by_membership_id,
        name: 'Player',
        avatar: '',
        initials: 'PL',
      }
      const challengerUser = usersByMembershipId.get(bet.challenger_membership_id) ?? {
        id: bet.challenger_membership_id,
        membershipId: bet.challenger_membership_id,
        name: 'Player',
        avatar: '',
        initials: 'PL',
      }

      if (payload.accepted === false) {
        const declinedAt = new Date().toISOString()
        await supabase
          .from('bets')
          .update({
            status: 'declined',
            closes_at: null,
            respond_by_at: null,
            accepted_at: null,
            declined_at: declinedAt,
            resolved_at: declinedAt,
            void_reason: 'Declined by challenged player.',
          })
          .eq('id', bet.id)
          .eq('status', 'pending_accept')

        await supabase.from('bet_status_events').insert({
          bet_id: bet.id,
          actor_membership_id: actorMembership.id,
          from_status: 'pending_accept',
          to_status: 'declined',
          note: 'Bet invite declined.',
          metadata: {},
        })

        await notifyCrewMembers(payload.crewId, {
          type: 'bet_created',
          title: `${challengerUser.name} declined ${bet.title}`,
          message: `${challengerUser.name} passed on your 1v1 bet invite.`,
          payload: {
            betId: bet.id,
            nightId: bet.night_id,
            status: 'declined',
            challengeWager: stake,
            createdByMembershipId: bet.created_by_membership_id,
            challengerMembershipId: bet.challenger_membership_id,
            targetMembershipId: bet.created_by_membership_id,
          },
          membershipIds: [bet.created_by_membership_id],
        })
        break
      }

      const creatorOption = optionRows?.find((option: any) => option.sort_order === 0)
      const challengerOption = optionRows?.find((option: any) => option.sort_order === 1)
      if (!creatorOption || !challengerOption) {
        throw new Error('That bet invite is missing its wager options.')
      }

      const acceptedAt = new Date().toISOString()

      await supabase.from('wagers').upsert([
        {
          bet_id: bet.id,
          bet_option_id: creatorOption.id,
          membership_id: bet.created_by_membership_id,
          drinks: stake,
        },
        {
          bet_id: bet.id,
          bet_option_id: challengerOption.id,
          membership_id: bet.challenger_membership_id,
          drinks: stake,
        },
      ], { onConflict: 'bet_id,membership_id' })

      await supabase
        .from('bets')
        .update({
          status: 'open',
          closes_at: null,
          respond_by_at: null,
          accepted_at: acceptedAt,
          declined_at: null,
          resolved_at: null,
          void_reason: null,
        })
        .eq('id', bet.id)
        .eq('status', 'pending_accept')

      await supabase.from('bet_status_events').insert({
        bet_id: bet.id,
        actor_membership_id: actorMembership.id,
        from_status: 'pending_accept',
        to_status: 'open',
        note: 'Bet invite accepted.',
        metadata: { challengeWager: stake },
      })

      await notifyCrewMembers(payload.crewId, {
        type: 'bet_created',
        title: `${bet.title} is live`,
        message: `${challengerUser.name} accepted ${creatorUser.name}'s 1v1 bet for ${formatDrinks(stake)} drinks.`,
        payload: {
          betId: bet.id,
          nightId: bet.night_id,
          status: 'open',
          challengeWager: stake,
          createdByMembershipId: bet.created_by_membership_id,
          challengerMembershipId: bet.challenger_membership_id,
        },
        excludeMembershipId: actorMembership.id,
      })
      break
    }

    case 'placeWager': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const drinks = Number(payload.drinks)

      if (!isValidHalfDrinkAmount(drinks)) {
        throw new Error(`Wagers must be in 0.5 drink increments and at most ${MAX_WAGER_DRINKS} drinks.`)
      }

      const { data: bet, error: betError } = await supabase
        .from('bets')
        .select('id, night_id, status, closes_at')
        .eq('id', payload.betId)
        .single()

      if (betError) throw betError
      if (bet.status !== 'open') {
        throw new Error('That bet is no longer open.')
      }
      if (!bet.closes_at) {
        throw new Error('That bet is not ready for wagers yet.')
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
        .select('id')
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

    case 'proposeResult': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const { data: bet, error: betError } = await supabase
        .from('bets')
        .select(BET_SELECT)
        .eq('id', payload.betId)
        .single()

      if (betError) throw betError
      if (bet.status !== 'open') {
        throw new Error('Only open bets can accept a proposed result.')
      }
      if (!canMembershipProposeBetResult(bet, actorMembership.id)) {
        throw new Error('You are not allowed to propose the result for this bet.')
      }

      const { data: winningOption, error: optionError } = await supabase
        .from('bet_options')
        .select('id')
        .eq('id', payload.optionId)
        .eq('bet_id', payload.betId)
        .single()

      if (optionError || !winningOption) {
        throw new Error('That option does not belong to this bet.')
      }

      const { domainBet } = await loadBetResolutionContext(payload.betId)
      const preview = resolveBetWithParimutuel(domainBet, payload.optionId)

      if (preview.status === 'void') {
        await persistVoidBet(
          actorMembership.id,
          bet,
          preview.voidReason ?? 'No opposing action',
          'proposal',
          'Bet voided when the result was proposed.'
        )
        break
      }

      await supabase.from('bets').update({
        status: 'pending_result',
        pending_result_option_id: payload.optionId,
        pending_result_at: new Date().toISOString(),
        winning_option_id: null,
        resolved_at: null,
        void_reason: null,
      }).eq('id', payload.betId)

      await supabase.from('bet_status_events').insert({
        bet_id: payload.betId,
        actor_membership_id: actorMembership.id,
        from_status: bet.status,
        to_status: 'pending_result',
        note: 'Result proposed.',
        metadata: { optionId: payload.optionId },
      })

      await notifyCrewMembers(payload.crewId, {
        type: 'bet_created',
        title: `${bet.title} result proposed`,
        message: `A result is pending confirmation for ${bet.title}.`,
        payload: { betId: payload.betId, pendingResultOptionId: payload.optionId },
        excludeMembershipId: actorMembership.id,
      })
      break
    }

    case 'confirmResult': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const { data: bet, error: betError } = await supabase
        .from('bets')
        .select('id, status, pending_result_option_id, pending_result_at')
        .eq('id', payload.betId)
        .single()

      if (betError) throw betError
      if (bet.status === 'disputed') {
        const { data: openDispute, error: disputeError } = await supabase
          .from('disputes')
          .select('id, expires_at')
          .eq('bet_id', payload.betId)
          .eq('status', 'open')
          .maybeSingle()

        if (disputeError) throw disputeError
        if (!openDispute) {
          throw new Error('That dispute is no longer active.')
        }
        if (openDispute.expires_at && asDate(openDispute.expires_at).getTime() > Date.now()) {
          throw new Error('The dispute vote is still active.')
        }

        await finalizeDispute(openDispute.id, actorMembership.id)
        break
      }

      if (bet.status !== 'pending_result' || !bet.pending_result_option_id || !bet.pending_result_at) {
        throw new Error('That bet does not have a pending result to confirm.')
      }
      if (asDate(bet.pending_result_at).getTime() + RESULT_CONFIRMATION_WINDOW_MS > Date.now()) {
        throw new Error('The confirmation window has not finished yet.')
      }

      await resolveBetAndPersist(
        actorMembership.id,
        payload.betId,
        bet.pending_result_option_id,
        'confirm',
        'Bet confirmed after the dispute window elapsed.'
      )
      break
    }

    case 'disputeResult': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const { data: bet, error: betError } = await supabase
        .from('bets')
        .select('id, title, status, pending_result_option_id, pending_result_at')
        .eq('id', payload.betId)
        .single()

      if (betError) throw betError
      if (bet.status !== 'pending_result' || !bet.pending_result_option_id || !bet.pending_result_at) {
        throw new Error('Only pending results can be disputed.')
      }
      if (asDate(bet.pending_result_at).getTime() + RESULT_CONFIRMATION_WINDOW_MS <= Date.now()) {
        throw new Error('The dispute window has already expired.')
      }

      const { data: existingDispute, error: existingDisputeError } = await supabase
        .from('disputes')
        .select('id')
        .eq('bet_id', payload.betId)
        .eq('status', 'open')
        .maybeSingle()

      if (existingDisputeError) throw existingDisputeError
      if (existingDispute) {
        throw new Error('That result is already under dispute.')
      }

      await supabase.from('disputes').insert({
        bet_id: payload.betId,
        opened_by_membership_id: actorMembership.id,
        reason: payload.reason?.trim() || null,
        status: 'open',
        expires_at: new Date(Date.now() + DISPUTE_VOTE_WINDOW_MS).toISOString(),
      })

      await supabase.from('bets').update({
        status: 'disputed',
      }).eq('id', payload.betId)

      await supabase.from('bet_status_events').insert({
        bet_id: payload.betId,
        actor_membership_id: actorMembership.id,
        from_status: 'pending_result',
        to_status: 'disputed',
        note: 'Result disputed.',
        metadata: { pendingResultOptionId: bet.pending_result_option_id },
      })

      await notifyCrewMembers(payload.crewId, {
        type: 'bet_created',
        title: `${bet.title} disputed`,
        message: `Crew voting has opened for ${bet.title}.`,
        payload: { betId: payload.betId },
        excludeMembershipId: actorMembership.id,
      })
      break
    }

    case 'castDisputeVote': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const dispute = payload.disputeId
        ? await (async () => {
            const { data, error } = await supabase
              .from('disputes')
              .select('id, bet_id, status, expires_at')
              .eq('id', payload.disputeId)
              .single()

            if (error) throw error
            return data
          })()
        : payload.betId
          ? await findOpenDisputeForBet(supabase, payload.betId)
          : null

      if (!dispute) {
        throw new Error('That dispute is no longer open.')
      }
      if (dispute.status !== 'open') {
        throw new Error('That dispute is no longer open.')
      }
      if (dispute.expires_at && asDate(dispute.expires_at).getTime() <= Date.now()) {
        await finalizeDispute(dispute.id, actorMembership.id)
        break
      }

      const [{ data: bet, error: betError }, { data: option, error: optionError }, { data: wagers, error: wagersError }] = await Promise.all([
        supabase.from('bets').select('id').eq('id', dispute.bet_id).single(),
        supabase.from('bet_options').select('id').eq('id', payload.optionId).eq('bet_id', dispute.bet_id).single(),
        supabase.from('wagers').select('membership_id').eq('bet_id', dispute.bet_id),
      ])

      if (betError) throw betError
      if (optionError || !option) throw new Error('That vote option does not belong to this bet.')
      if (wagersError) throw wagersError

      const eligibleMembershipIds = new Set((wagers ?? []).map((wager: any) => wager.membership_id))
      if (!eligibleMembershipIds.has(actorMembership.id)) {
        throw new Error('Only members who wagered on this bet can vote in the dispute.')
      }

      await supabase.from('dispute_votes').upsert({
        dispute_id: dispute.id,
        membership_id: actorMembership.id,
        option_id: payload.optionId,
        deferred: false,
      }, { onConflict: 'dispute_id,membership_id' })

      const { data: votes, error: votesError } = await supabase
        .from('dispute_votes')
        .select('membership_id')
        .eq('dispute_id', dispute.id)

      if (votesError) throw votesError

      if ((votes ?? []).length >= eligibleMembershipIds.size) {
        await finalizeDispute(dispute.id, actorMembership.id)
      }
      break
    }

    case 'legacyCreateMiniGameChallenge': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const opponentMembershipId = payload.opponentMembershipId as string | undefined
      const proposedWager = Number(payload.wager ?? payload.proposedWager)
      const closeTime = Number(payload.closeTime ?? 5)
      const boardSize = Number(payload.boardSize ?? BEER_BOMB_BOARD_SIZE)

      if (!payload.nightId) {
        throw new Error('Mini-game challenges require an active night.')
      }
      if (!opponentMembershipId || opponentMembershipId === actorMembership.id) {
        throw new Error('Choose another player for Beer Bomb.')
      }
      if (!isValidHalfDrinkAmount(proposedWager)) {
        throw new Error(`Beer Bomb wagers must be in 0.5 drink increments and at most ${MAX_WAGER_DRINKS} drinks.`)
      }
      if (!Number.isFinite(closeTime) || closeTime <= 0) {
        throw new Error('Challenge response time must be greater than zero.')
      }
      if (!Number.isInteger(boardSize) || boardSize < 4 || boardSize > 12) {
        throw new Error('Beer Bomb board size must be between 4 and 12 beers.')
      }

      const [nightResult, opponentResult] = await Promise.all([
        supabase.from('nights').select('id, crew_id, status').eq('id', payload.nightId).single(),
        supabase
          .from('crew_memberships')
          .select(CREW_MEMBERSHIP_WITH_ACTOR_SELECT)
          .eq('id', opponentMembershipId)
          .single(),
      ])

      if (nightResult.error) throw nightResult.error
      if (opponentResult.error) throw opponentResult.error

      if (nightResult.data.crew_id !== payload.crewId) {
        throw new Error('That night does not belong to this crew.')
      }
      if (!['active', 'winding-down'].includes(nightResult.data.status)) {
        throw new Error('Beer Bomb challenges can only be created during an active night.')
      }
      if (opponentResult.data.crew_id !== payload.crewId || opponentResult.data.status !== 'active') {
        throw new Error('Your opponent must be an active crew member.')
      }

      await Promise.all([
        requireActiveNightParticipant(payload.nightId, actorMembership.id),
        requireActiveNightParticipant(payload.nightId, opponentMembershipId),
      ])

      const challengerUser = buildUserFromMembership(actorMembership)
      const opponentUser = buildUserFromMembership(opponentResult.data)
      const title = payload.title?.trim() || getMiniGameDefaultTitle(challengerUser, opponentUser)

      const { data: match, error: matchError } = await supabase
        .from('mini_game_matches')
        .insert({
          crew_id: payload.crewId,
          night_id: payload.nightId,
          game_key: 'beer_bomb',
          title,
          status: 'pending',
          created_by_membership_id: actorMembership.id,
          opponent_membership_id: opponentMembershipId,
          proposed_wager: proposedWager,
          board_size: boardSize,
          revealed_slots: [],
          respond_by_at: new Date(Date.now() + closeTime * 60_000).toISOString(),
        })
        .select('id')
        .single()

      if (matchError) throw matchError

      await recordMiniGameMatchEvent(match.id, actorMembership.id, 'created', {
        proposedWager,
        boardSize,
        opponentMembershipId,
      })

      await recordAuditLog(payload.crewId, actorMembership.id, 'mini_game_challenge_created', 'mini_game_match', match.id, {
        gameKey: 'beer_bomb',
        proposedWager,
        opponentMembershipId,
      })

      await notifyCrewMembers(payload.crewId, {
        type: 'challenge',
        title,
        message: `${challengerUser.name} challenged ${opponentUser.name} to Beer Bomb for ${proposedWager.toFixed(1)} drinks.`,
        payload: { matchId: match.id, nightId: payload.nightId, gameKey: 'beer_bomb' },
        excludeMembershipId: actorMembership.id,
      })
      break
    }

    case 'legacyRespondToMiniGameChallenge': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const decision =
        payload.decision === 'decline' || payload.accepted === false
          ? 'decline'
          : 'accept'
      const { match, usersByMembershipId } = await loadMiniGameMatchContext(payload.matchId)

      if (match.crew_id !== payload.crewId) {
        throw new Error('That match does not belong to this crew.')
      }
      if (match.status !== 'pending') {
        throw new Error('That challenge is no longer waiting for a response.')
      }
      if (actorMembership.id !== match.opponent_membership_id) {
        throw new Error('Only the challenged player can respond.')
      }

      await Promise.all([
        requireActiveNightParticipant(match.night_id, actorMembership.id),
        requireActiveNightParticipant(match.night_id, match.created_by_membership_id),
      ])

      const challengerUser = usersByMembershipId.get(match.created_by_membership_id) ?? buildUserFromMembership(actorMembership)
      const opponentUser = usersByMembershipId.get(match.opponent_membership_id) ?? buildUserFromMembership(actorMembership)

      if (decision === 'decline') {
        const declineReason = payload.reason?.trim() || 'Declined by opponent.'
        await cancelMiniGameMatch(match, actorMembership.id, declineReason, 'declined')

        await recordAuditLog(payload.crewId, actorMembership.id, 'mini_game_challenge_declined', 'mini_game_match', match.id, {
          gameKey: match.game_key,
        })

        await notifyCrewMembers(payload.crewId, {
          type: 'challenge',
          title: `${match.title} declined`,
          message: `${opponentUser.name} passed on the Beer Bomb challenge.`,
          payload: { matchId: match.id, nightId: match.night_id, gameKey: match.game_key },
          excludeMembershipId: actorMembership.id,
        })
        break
      }

      const startingPlayerMembershipId = Math.random() < 0.5
        ? match.created_by_membership_id
        : match.opponent_membership_id
      const hiddenSlotIndex = Math.floor(Math.random() * Number(match.board_size ?? BEER_BOMB_BOARD_SIZE))
      const acceptedAt = new Date().toISOString()

      await supabase
        .from('mini_game_matches')
        .update({
          status: 'active',
          agreed_wager: match.proposed_wager,
          hidden_slot_index: hiddenSlotIndex,
          accepted_at: acceptedAt,
          starting_player_membership_id: startingPlayerMembershipId,
          current_turn_membership_id: startingPlayerMembershipId,
          updated_at: acceptedAt,
        })
        .eq('id', match.id)

      await recordMiniGameMatchEvent(match.id, actorMembership.id, 'accepted', {
        startingPlayerMembershipId,
      })

      await recordAuditLog(payload.crewId, actorMembership.id, 'mini_game_challenge_accepted', 'mini_game_match', match.id, {
        gameKey: match.game_key,
        startingPlayerMembershipId,
      })

      await notifyCrewMembers(payload.crewId, {
        type: 'challenge',
        title: `${match.title} is live`,
        message: `${opponentUser.name} accepted ${challengerUser.name}'s Beer Bomb challenge.`,
        payload: { matchId: match.id, nightId: match.night_id, gameKey: match.game_key },
        excludeMembershipId: actorMembership.id,
      })
      break
    }

    case 'legacyCancelMiniGameChallenge': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const { match } = await loadMiniGameMatchContext(payload.matchId)

      if (match.crew_id !== payload.crewId) {
        throw new Error('That match does not belong to this crew.')
      }
      if (match.status !== 'pending') {
        throw new Error('Only pending Beer Bomb challenges can be cancelled.')
      }
      if (actorMembership.id !== match.created_by_membership_id) {
        throw new Error('Only the challenger can cancel this match.')
      }

      await cancelMiniGameMatch(match, actorMembership.id, 'Cancelled by challenger.', 'cancelled')

      await recordAuditLog(payload.crewId, actorMembership.id, 'mini_game_challenge_cancelled', 'mini_game_match', match.id, {
        gameKey: match.game_key,
      })

      await notifyCrewMembers(payload.crewId, {
        type: 'challenge',
        title: `${match.title} cancelled`,
        message: 'The Beer Bomb challenge was cancelled before it started.',
        payload: { matchId: match.id, nightId: match.night_id, gameKey: match.game_key },
        excludeMembershipId: actorMembership.id,
      })
      break
    }

    case 'legacyTakeMiniGameTurn': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const slotIndex = Number(payload.slotIndex)
      const { match, usersByMembershipId } = await loadMiniGameMatchContext(payload.matchId)
      const revealedSlots = normalizeMiniGameRevealedSlots(match.revealed_slots)

      if (match.crew_id !== payload.crewId) {
        throw new Error('That match does not belong to this crew.')
      }
      if (match.status !== 'active') {
        throw new Error('That Beer Bomb match is not active.')
      }
      if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= Number(match.board_size ?? BEER_BOMB_BOARD_SIZE)) {
        throw new Error('Choose a valid beer slot.')
      }
      if (revealedSlots.includes(slotIndex)) {
        throw new Error('That beer has already been tapped.')
      }
      if (actorMembership.id !== match.current_turn_membership_id) {
        throw new Error('It is not your turn.')
      }

      await Promise.all([
        requireActiveNightParticipant(match.night_id, actorMembership.id),
        requireActiveNightParticipant(
          match.night_id,
          actorMembership.id === match.created_by_membership_id ? match.opponent_membership_id : match.created_by_membership_id
        ),
      ])

      const nextRevealedSlots = [...revealedSlots, slotIndex]
      const hitBomb = slotIndex === Number(match.hidden_slot_index)
      const winnerMembershipId = actorMembership.id === match.created_by_membership_id
        ? match.opponent_membership_id
        : match.created_by_membership_id
      const completedAt = new Date().toISOString()

      if (hitBomb) {
        await supabase
          .from('mini_game_matches')
          .update({
            status: 'completed',
            revealed_slots: nextRevealedSlots,
            winner_membership_id: winnerMembershipId,
            loser_membership_id: actorMembership.id,
            current_turn_membership_id: null,
            completed_at: completedAt,
            updated_at: completedAt,
          })
          .eq('id', match.id)

        await supabase.from('ledger_events').insert({
          crew_id: match.crew_id,
          night_id: match.night_id,
          bet_id: null,
          from_membership_id: actorMembership.id,
          to_membership_id: winnerMembershipId,
          event_type: 'mini_game_result',
          drinks: Number(match.agreed_wager ?? match.proposed_wager),
          metadata: {
            matchId: match.id,
            gameKey: match.game_key,
            losingSlotIndex: slotIndex,
          },
        })

        const winnerUser = usersByMembershipId.get(winnerMembershipId)
        const loserUser = usersByMembershipId.get(actorMembership.id)

        await recordMiniGameMatchEvent(match.id, actorMembership.id, 'completed', {
          slotIndex,
          winnerMembershipId,
          loserMembershipId: actorMembership.id,
        })

        await recordAuditLog(payload.crewId, actorMembership.id, 'mini_game_match_completed', 'mini_game_match', match.id, {
          gameKey: match.game_key,
          winnerMembershipId,
          loserMembershipId: actorMembership.id,
          wager: Number(match.agreed_wager ?? match.proposed_wager),
        })

        await notifyCrewMembers(payload.crewId, {
          type: 'challenge',
          title: `${match.title} settled`,
          message: `${winnerUser?.name ?? 'A player'} beat ${loserUser?.name ?? 'their opponent'} in Beer Bomb.`,
          payload: { matchId: match.id, nightId: match.night_id, gameKey: match.game_key },
          excludeMembershipId: actorMembership.id,
        })
      } else {
        const nextTurnMembershipId = winnerMembershipId

        await supabase
          .from('mini_game_matches')
          .update({
            revealed_slots: nextRevealedSlots,
            current_turn_membership_id: nextTurnMembershipId,
            updated_at: completedAt,
          })
          .eq('id', match.id)

        await recordMiniGameMatchEvent(match.id, actorMembership.id, 'turn_taken', {
          slotIndex,
          nextTurnMembershipId,
        })
      }

      break
    }

    case 'resolveBet': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const optionId = payload.winningOptionId ?? payload.optionId
      if (!optionId) {
        throw new Error('A winning option is required.')
      }

      const { data: bet, error: betError } = await supabase
        .from('bets')
        .select('status')
        .eq('id', payload.betId)
        .single()

      if (betError) throw betError

      if (bet.status === 'pending_result') {
        throw new Error('Use confirmResult after the dispute window elapses.')
      }

      if (bet.status !== 'open') {
        throw new Error('Only open bets can accept a proposed result.')
      }

      const { data: fullBet, error: fullBetError } = await supabase
        .from('bets')
        .select(BET_SELECT)
        .eq('id', payload.betId)
        .single()

      if (fullBetError) throw fullBetError
      if (!canMembershipProposeBetResult(fullBet, actorMembership.id)) {
        throw new Error('You are not allowed to propose the result for this bet.')
      }

      const { domainBet } = await loadBetResolutionContext(payload.betId)
      const preview = resolveBetWithParimutuel(domainBet, optionId)

      if (preview.status === 'void') {
        await persistVoidBet(
          actorMembership.id,
          fullBet,
          preview.voidReason ?? 'No opposing action',
          'proposal',
          'Bet voided when the result was proposed.'
        )
        break
      }

      await supabase.from('bets').update({
        status: 'pending_result',
        pending_result_option_id: optionId,
        pending_result_at: new Date().toISOString(),
        winning_option_id: null,
        resolved_at: null,
        void_reason: null,
      }).eq('id', payload.betId)

      await supabase.from('bet_status_events').insert({
        bet_id: payload.betId,
        actor_membership_id: actorMembership.id,
        from_status: 'open',
        to_status: 'pending_result',
        note: 'Result proposed via resolveBet compatibility route.',
        metadata: { optionId },
      })
      break
    }

    case 'createMiniGameChallenge': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      await requireActiveNightParticipant(payload.nightId, actorMembership.id)

      if ((payload.gameKey ?? 'beer_bomb') !== 'beer_bomb') {
        throw new Error('Unsupported mini game.')
      }

      const proposedWager = Number(payload.proposedWager ?? payload.wager)
      const closeTime = Number(payload.closeTime ?? 5)
      if (!isValidHalfDrinkAmount(proposedWager)) {
        throw new Error('Beer Bomb wagers must be in 0.5 drink increments and at most 5 drinks.')
      }
      if (!Number.isFinite(closeTime) || closeTime <= 0) {
        throw new Error('Challenge response time must be greater than zero.')
      }

      if (!payload.opponentMembershipId || payload.opponentMembershipId === actorMembership.id) {
        throw new Error('Choose another active participant for the challenge.')
      }

      const { data: opponentMembership, error: opponentMembershipError } = await supabase
        .from('crew_memberships')
        .select('*, profiles(*), guest_identities(*)')
        .eq('id', payload.opponentMembershipId)
        .eq('crew_id', payload.crewId)
        .single()

      if (opponentMembershipError) throw opponentMembershipError
      if (opponentMembership.status !== 'active') {
        throw new Error('Your opponent must be an active crew member.')
      }

      await requireActiveNightParticipant(payload.nightId, opponentMembership.id)

      const title = payload.title?.trim() || 'Beer Bomb'
      const { data: match, error: matchError } = await supabase
        .from('mini_game_matches')
        .insert({
          crew_id: payload.crewId,
          night_id: payload.nightId,
          game_key: 'beer_bomb',
          title,
          status: 'pending',
          created_by_membership_id: actorMembership.id,
          opponent_membership_id: opponentMembership.id,
          proposed_wager: proposedWager,
          board_size: BEER_BOMB_BOARD_SIZE,
          hidden_slot_index: Math.floor(Math.random() * BEER_BOMB_BOARD_SIZE),
          revealed_slots: [],
          respond_by_at: new Date(Date.now() + closeTime * 60_000).toISOString(),
          metadata: payload.metadata ?? {},
        })
        .select('id')
        .single()

      if (matchError) throw matchError

      await recordMiniGameMatchEvent(match.id, actorMembership.id, 'challenge_created', {
        gameKey: 'beer_bomb',
        proposedWager,
      })

      const challengerUser = buildUserFromMembership(actorMembership)
      const opponentUser = buildUserFromMembership(opponentMembership)

      await recordAuditLog(payload.crewId, actorMembership.id, 'mini_game_challenge_created', 'mini_game_match', match.id, {
        gameKey: 'beer_bomb',
        proposedWager,
        opponentMembershipId: opponentMembership.id,
      })

      await notifyCrewMembers(payload.crewId, {
        type: 'challenge',
        title: `${challengerUser.name} challenged ${opponentUser.name}`,
        message: `${title} for ${formatDrinks(proposedWager)} drinks.`,
        payload: {
          matchId: match.id,
          gameKey: 'beer_bomb',
          nightId: payload.nightId,
          proposedWager,
          status: 'pending',
          targetMembershipId: opponentMembership.id,
        },
        membershipIds: [opponentMembership.id],
      })
      break
    }

    case 'respondToMiniGameChallenge': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const { match, usersByMembershipId } = await loadMiniGameMatchContext(payload.matchId)

      if (match.crew_id !== payload.crewId) {
        throw new Error('That challenge does not belong to this crew.')
      }

      await requireActiveNightParticipant(match.night_id, actorMembership.id)

      if (match.status !== 'pending') {
        throw new Error('That challenge is no longer pending.')
      }

      if (match.opponent_membership_id !== actorMembership.id) {
        throw new Error('Only the challenged player can respond.')
      }

      const challengerUser = usersByMembershipId.get(match.created_by_membership_id) ?? buildUserFromMembership(actorMembership)
      const opponentUser = usersByMembershipId.get(match.opponent_membership_id) ?? buildUserFromMembership(actorMembership)

      if (payload.accepted === false) {
        const { error: declineError } = await supabase
          .from('mini_game_matches')
          .update({
            status: 'declined',
            current_turn_membership_id: null,
            starting_player_membership_id: null,
            agreed_wager: null,
            respond_by_at: null,
            accepted_at: null,
            declined_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', match.id)
          .eq('status', 'pending')

        if (declineError) throw declineError

        await recordMiniGameMatchEvent(match.id, actorMembership.id, 'challenge_declined', {})
        await recordAuditLog(payload.crewId, actorMembership.id, 'mini_game_challenge_declined', 'mini_game_match', match.id, {})

        await notifyCrewMembers(payload.crewId, {
          type: 'challenge',
          title: `${opponentUser.name} declined Beer Bomb`,
          message: `${match.title} was declined.`,
          payload: {
            matchId: match.id,
            gameKey: match.game_key,
            status: 'declined',
          },
          excludeMembershipId: actorMembership.id,
        })
        break
      }

      const startingPlayerMembershipId =
        Math.random() < 0.5 ? match.created_by_membership_id : match.opponent_membership_id
      const acceptedAt = new Date().toISOString()

      const { error: acceptError } = await supabase
        .from('mini_game_matches')
        .update({
          status: 'active',
          agreed_wager: match.proposed_wager,
          respond_by_at: null,
          accepted_at: acceptedAt,
          starting_player_membership_id: startingPlayerMembershipId,
          current_turn_membership_id: startingPlayerMembershipId,
          declined_at: null,
          cancelled_at: null,
          completed_at: null,
          updated_at: acceptedAt,
        })
        .eq('id', match.id)
        .eq('status', 'pending')

      if (acceptError) throw acceptError

      const linkedBet = await createLinkedMiniGameBet(
        match,
        match.title,
        Number(match.proposed_wager),
        `${challengerUser.name} wins`,
        `${opponentUser.name} wins`
      )

      await recordMiniGameMatchEvent(match.id, actorMembership.id, 'challenge_accepted', {
        startingPlayerMembershipId,
        agreedWager: match.proposed_wager,
        betId: linkedBet.bet.id,
      })
      await recordAuditLog(payload.crewId, actorMembership.id, 'mini_game_challenge_accepted', 'mini_game_match', match.id, {
        startingPlayerMembershipId,
        agreedWager: match.proposed_wager,
      })

      const startingPlayerUser = usersByMembershipId.get(startingPlayerMembershipId) ?? challengerUser

      await notifyCrewMembers(payload.crewId, {
        type: 'challenge',
        title: `${opponentUser.name} accepted Beer Bomb`,
        message: `${startingPlayerUser.name} goes first for ${formatDrinks(match.proposed_wager)} drinks.`,
        payload: {
          matchId: match.id,
          betId: linkedBet.bet.id,
          gameKey: match.game_key,
          status: 'active',
          agreedWager: Number(match.proposed_wager),
          startingPlayerMembershipId,
        },
        excludeMembershipId: actorMembership.id,
      })
      break
    }

    case 'takeMiniGameTurn': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const { match, usersByMembershipId } = await loadMiniGameMatchContext(payload.matchId)

      if (match.crew_id !== payload.crewId) {
        throw new Error('That challenge does not belong to this crew.')
      }

      await requireActiveNightParticipant(match.night_id, actorMembership.id)

      if (match.status !== 'active') {
        throw new Error('That match is not active.')
      }

      if (match.current_turn_membership_id !== actorMembership.id) {
        throw new Error('It is not your turn.')
      }

      const slotIndex = Number(payload.slotIndex)
      const boardSize = Number(match.board_size ?? BEER_BOMB_BOARD_SIZE)
      if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= boardSize) {
        throw new Error('Choose a valid beer.')
      }

      const revealedSlots = normalizeMiniGameRevealedSlots(match.revealed_slots)
      if (revealedSlots.includes(slotIndex)) {
        throw new Error('That beer has already been tapped.')
      }

      const nextTurnMembershipId =
        actorMembership.id === match.created_by_membership_id
          ? match.opponent_membership_id
          : match.created_by_membership_id

      const now = new Date().toISOString()
      const nextRevealedSlots = [...revealedSlots, slotIndex]

      if (Number(match.hidden_slot_index) === slotIndex) {
        const winnerMembershipId = nextTurnMembershipId
        const loserMembershipId = actorMembership.id
        const winnerUser = usersByMembershipId.get(winnerMembershipId) ?? buildUserFromMembership(actorMembership)
        const loserUser = usersByMembershipId.get(loserMembershipId) ?? buildUserFromMembership(actorMembership)
        const drinks = Number(match.agreed_wager ?? match.proposed_wager)

        const { error: completeError } = await supabase
          .from('mini_game_matches')
          .update({
            status: 'completed',
            current_turn_membership_id: null,
            winner_membership_id: winnerMembershipId,
            loser_membership_id: loserMembershipId,
            completed_at: now,
            revealed_slots: nextRevealedSlots,
            updated_at: now,
          })
          .eq('id', match.id)
          .eq('status', 'active')

        if (completeError) throw completeError

        await recordMiniGameMatchEvent(match.id, actorMembership.id, 'turn_taken', {
          slotIndex,
          result: 'bomb',
        })
        await recordMiniGameMatchEvent(match.id, actorMembership.id, 'match_completed', {
          winnerMembershipId,
          loserMembershipId,
          slotIndex,
          drinks,
          betId: match.bet_id ?? null,
        })

        if (match.bet_id) {
          await proposeMiniGameMatchResult(actorMembership.id, match, winnerMembershipId)
        } else {
          await supabase.from('ledger_events').insert({
            crew_id: payload.crewId,
            night_id: match.night_id,
            bet_id: null,
            from_membership_id: loserMembershipId,
            to_membership_id: winnerMembershipId,
            event_type: 'mini_game_result',
            drinks,
            metadata: {
              matchId: match.id,
              gameKey: match.game_key,
              slotIndex,
            },
          })
        }

        await recordAuditLog(payload.crewId, actorMembership.id, 'mini_game_completed', 'mini_game_match', match.id, {
          slotIndex,
          winnerMembershipId,
          loserMembershipId,
          drinks,
        })

        await notifyCrewMembers(payload.crewId, {
          type: 'challenge',
          title: `${winnerUser.name} won Beer Bomb`,
          message: match.bet_id
            ? `${loserUser.name} hit the bomb. Side-bet settlement is pending confirmation.`
            : `${loserUser.name} hit the bomb for ${formatDrinks(drinks)} drinks.`,
          payload: {
            matchId: match.id,
            betId: match.bet_id ?? undefined,
            gameKey: match.game_key,
            status: 'completed',
            slotIndex,
            winnerMembershipId,
            loserMembershipId,
            drinks,
          },
        })
        break
      }

      const { error: turnError } = await supabase
        .from('mini_game_matches')
        .update({
          current_turn_membership_id: nextTurnMembershipId,
          revealed_slots: nextRevealedSlots,
          updated_at: now,
        })
        .eq('id', match.id)
        .eq('status', 'active')
        .eq('current_turn_membership_id', actorMembership.id)

      if (turnError) throw turnError

      await recordMiniGameMatchEvent(match.id, actorMembership.id, 'turn_taken', {
        slotIndex,
        result: 'safe',
        nextTurnMembershipId,
      })
      await recordAuditLog(payload.crewId, actorMembership.id, 'mini_game_turn_taken', 'mini_game_match', match.id, {
        slotIndex,
        nextTurnMembershipId,
      })
      break
    }

    case 'cancelMiniGameChallenge': {
      const actorMembership = await requireActorMembership(actor, payload.crewId)
      const { match } = await loadMiniGameMatchContext(payload.matchId)

      if (match.crew_id !== payload.crewId) {
        throw new Error('That challenge does not belong to this crew.')
      }

      await requireActiveNightParticipant(match.night_id, actorMembership.id)

      if (match.status !== 'pending') {
        throw new Error('Only pending challenges can be cancelled.')
      }

      if (match.created_by_membership_id !== actorMembership.id) {
        throw new Error('Only the challenger can cancel this challenge.')
      }

      const { error: cancelError } = await supabase
        .from('mini_game_matches')
        .update({
          status: 'cancelled',
          current_turn_membership_id: null,
          starting_player_membership_id: null,
          agreed_wager: null,
          respond_by_at: null,
          accepted_at: null,
          declined_at: null,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.id)
        .eq('status', 'pending')

      if (cancelError) throw cancelError

      await recordMiniGameMatchEvent(match.id, actorMembership.id, 'challenge_cancelled', {})
      await recordAuditLog(payload.crewId, actorMembership.id, 'mini_game_challenge_cancelled', 'mini_game_match', match.id, {})
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
        const { data: memberships, error: membershipsError } = await supabase
          .from('crew_memberships')
          .select('id')
          .eq('profile_id', profile.id)
          .eq('status', 'active')

        if (membershipsError) throw membershipsError

        await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('profile_id', profile.id)
          .is('read_at', null)

        const membershipIds = (memberships ?? []).map((membership: any) => membership.id)
        if (membershipIds.length) {
          await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .in('membership_id', membershipIds)
            .is('read_at', null)
        }
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

  return loadAppState(
    actor,
    responseCrewId
      ? { mode: 'crew', activeCrewId: responseCrewId }
      : undefined
  )
}
