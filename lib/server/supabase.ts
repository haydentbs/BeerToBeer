import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  getSupabaseProjectUrl,
  getSupabaseServiceRoleKey,
} from '@/lib/server/env'

let serviceRoleClient: SupabaseClient | null = null

export function getServiceRoleClient() {
  if (!serviceRoleClient) {
    serviceRoleClient = createClient(getSupabaseProjectUrl(), getSupabaseServiceRoleKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }

  return serviceRoleClient
}
