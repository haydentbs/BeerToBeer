'use client'

import type { AppSession } from '@/lib/auth'
import type { AppBootstrapPayload, AppMutationPayload } from '@/lib/server/domain'
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase-client'
import type { Bet, Crew, Notification } from '@/lib/store'

function reviveBet(bet: any): Bet {
  return {
    ...bet,
    createdAt: new Date(bet.createdAt),
    closesAt: new Date(bet.closesAt),
    options: (bet.options ?? []).map((option: any) => ({
      ...option,
      wagers: (option.wagers ?? []).map((wager: any) => ({
        ...wager,
        createdAt: new Date(wager.createdAt),
      })),
    })),
  }
}

function reviveCrew(crew: any): Crew {
  return {
    ...crew,
    currentNight: crew.currentNight
      ? {
          ...crew.currentNight,
          startedAt: new Date(crew.currentNight.startedAt),
          bets: (crew.currentNight.bets ?? []).map(reviveBet),
        }
      : undefined,
    pastNights: crew.pastNights ?? [],
  }
}

function reviveNotification(notification: any): Notification {
  return {
    ...notification,
    timestamp: new Date(notification.timestamp),
  }
}

function revivePayload<T extends AppBootstrapPayload | AppMutationPayload>(payload: T): T {
  return {
    ...payload,
    crews: (payload.crews ?? []).map(reviveCrew),
    notifications: (payload.notifications ?? []).map(reviveNotification),
  }
}

async function getAccessToken() {
  if (!isSupabaseConfigured()) {
    return null
  }

  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const accessToken = await getAccessToken()
  const headers = new Headers(init?.headers)
  headers.set('content-type', 'application/json')
  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function fetchBootstrapState() {
  const payload = await apiFetch<AppBootstrapPayload>('/api/app/bootstrap')
  return revivePayload(payload)
}

export async function joinGuest(name: string, crewCode: string) {
  const payload = await apiFetch<AppMutationPayload>('/api/app/mutate', {
    method: 'POST',
    body: JSON.stringify({
      action: 'guestJoin',
      payload: {
        name,
        crewCode,
      },
    }),
  })

  return revivePayload(payload)
}

export async function mutateApp(action: string, payload: Record<string, any>) {
  const response = await apiFetch<AppMutationPayload>('/api/app/mutate', {
    method: 'POST',
    body: JSON.stringify({
      action,
      payload,
    }),
  })

  return revivePayload(response)
}
