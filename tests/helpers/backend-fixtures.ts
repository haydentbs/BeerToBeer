import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { AuthenticatedActor, RequestActor } from '@/lib/server/session'
import { getServiceRoleClient } from '@/lib/server/supabase'
import { joinCrewAsGuest, mutateAppState } from '@/lib/server/repository'

function loadDotEnv() {
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) {
    return
  }

  const contents = fs.readFileSync(envPath, 'utf8')
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line
      .slice(separatorIndex + 1)
      .split(' #')[0]
      .trim()

    if (key && process.env[key] == null) {
      process.env[key] = value
    }
  }
}

loadDotEnv()

const DELETE_PLANS: Array<{ table: string; column?: string }> = [
  { table: 'bet_status_events' },
  { table: 'settlement_confirmations' },
  { table: 'settlement_requests' },
  { table: 'ledger_events' },
  { table: 'bet_member_outcomes' },
  { table: 'dispute_votes' },
  { table: 'disputes' },
  { table: 'bet_comments' },
  { table: 'wagers' },
  { table: 'bet_options' },
  { table: 'bets' },
  { table: 'night_participants' },
  { table: 'nights' },
  { table: 'notifications' },
  { table: 'notification_preferences' },
  { table: 'crew_invite_redemptions' },
  { table: 'crew_invites' },
  { table: 'crew_join_requests' },
  { table: 'crew_settings', column: 'crew_id' },
  { table: 'audit_log' },
  { table: 'crew_memberships' },
  { table: 'guest_identities' },
  { table: 'profile_preferences', column: 'profile_id' },
  { table: 'crews' },
  { table: 'profiles' },
]

export async function resetDatabase() {
  const supabase = getServiceRoleClient()

  for (const plan of DELETE_PLANS) {
    const column = plan.column ?? 'id'
    const { error } = await supabase.from(plan.table).delete().not(column, 'is', null)
    if (error) {
      throw error
    }
  }
}

export function makeAuthenticatedActor(label: string): AuthenticatedActor {
  const id = randomUUID()
  return {
    kind: 'authenticated',
    accessToken: `test-${id}`,
    authUser: {
      id,
      email: `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${id.slice(0, 8)}@example.com`,
      app_metadata: { provider: 'google' },
      user_metadata: {
        full_name: label,
        avatar_url: '',
      },
    } as any,
  }
}

export async function createCrewWithNight(label: string) {
  const supabase = getServiceRoleClient()
  const creator = makeAuthenticatedActor(`${label} Creator`)
  const displayName = creator.authUser.user_metadata.full_name as string
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TC'

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .upsert({
      auth_user_id: creator.authUser.id,
      email: creator.authUser.email,
      display_name: displayName,
      avatar_url: '',
      initials,
    }, { onConflict: 'auth_user_id' })
    .select()
    .single()

  if (profileError) {
    throw profileError
  }

  await supabase.from('profile_preferences').upsert({
    profile_id: profile.id,
  }, { onConflict: 'profile_id' })

  const inviteCode = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()

  const { data: crew, error: crewError } = await supabase
    .from('crews')
    .insert({
      name: `${label} Crew`,
      invite_code: inviteCode,
      drink_theme: 'beer',
      created_by_profile_id: profile.id,
    })
    .select()
    .single()

  if (crewError) {
    throw crewError
  }

  const { data: creatorMembership, error: membershipError } = await supabase
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

  if (membershipError) {
    throw membershipError
  }

  await Promise.all([
    supabase.from('crew_settings').upsert({
      crew_id: crew.id,
      default_drink_theme: 'beer',
    }, { onConflict: 'crew_id' }),
    supabase.from('crew_invites').insert({
      crew_id: crew.id,
      code: inviteCode,
      created_by_membership_id: creatorMembership.id,
    }),
    supabase.from('notification_preferences').insert({
      profile_id: profile.id,
    }),
  ])

  const { data: night, error: nightError } = await supabase
    .from('nights')
    .insert({
      crew_id: crew.id,
      name: `${label} Night`,
      status: 'active',
      created_by_membership_id: creatorMembership.id,
    })
    .select()
    .single()

  if (nightError) {
    throw nightError
  }

  const { data: members, error: membersError } = await supabase
    .from('crew_memberships')
    .select('id')
    .eq('crew_id', crew.id)
    .eq('status', 'active')

  if (membersError) {
    throw membersError
  }

  if (members?.length) {
    const { error: participantError } = await supabase.from('night_participants').insert(
      members.map((member: any) => ({
        night_id: night.id,
        membership_id: member.id,
      }))
    )

    if (participantError) {
      throw participantError
    }
  }

  return {
    creator,
    crew: {
      ...crew,
      inviteCode,
      currentNight: {
        id: night.id,
        name: night.name,
        status: night.status,
      },
    },
    night,
  }
}

export async function joinGuestFixture(name: string, inviteCode: string) {
  return joinCrewAsGuest(name, inviteCode)
}
