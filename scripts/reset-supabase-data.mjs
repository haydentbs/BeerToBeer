import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile() {
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

loadEnvFile()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const summaryTables = [
  'profiles',
  'crews',
  'crew_memberships',
  'nights',
  'bets',
  'mini_game_matches',
  'notifications',
]

const tableResets = [
  ['crew_event_log', 'id'],
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
]

async function getCounts() {
  const counts = {}

  for (const table of summaryTables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) {
      throw error
    }
    counts[table] = count ?? 0
  }

  return counts
}

const before = await getCounts()

for (const [table, column] of tableResets) {
  const { error } = await supabase.from(table).delete().not(column, 'is', null)
  if (error) {
    if (/Could not find the table/i.test(error.message ?? '')) {
      continue
    }

    throw new Error(`${table}: ${error.message}`)
  }
}

const after = await getCounts()

console.log(JSON.stringify({ before, after }, null, 2))
