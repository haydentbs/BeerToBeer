'use client'

import type { AppSession } from '@/lib/auth'
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase-client'
import type { Bet, Crew, Notification } from '@/lib/store'
import type { CommandResponse, CrewFeedResponse, CrewSnapshotResponse, SessionResponse } from '@/lib/server/v2/domain'

function reviveBet(bet: any): Bet {
  return {
    ...bet,
    createdAt: new Date(bet.createdAt),
    closesAt: bet.closesAt ? new Date(bet.closesAt) : null,
    respondByAt: bet.respondByAt ? new Date(bet.respondByAt) : undefined,
    acceptedAt: bet.acceptedAt ? new Date(bet.acceptedAt) : undefined,
    declinedAt: bet.declinedAt ? new Date(bet.declinedAt) : undefined,
    pendingResultAt: bet.pendingResultAt ? new Date(bet.pendingResultAt) : undefined,
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
          miniGameMatches: (crew.currentNight.miniGameMatches ?? []).map((match: any) => ({
            ...match,
            betId: match.betId ?? undefined,
            createdAt: new Date(match.createdAt),
            updatedAt: new Date(match.updatedAt),
            respondByAt: match.respondByAt ? new Date(match.respondByAt) : undefined,
            acceptedAt: match.acceptedAt ? new Date(match.acceptedAt) : null,
            declinedAt: match.declinedAt ? new Date(match.declinedAt) : null,
            cancelledAt: match.cancelledAt ? new Date(match.cancelledAt) : null,
            completedAt: match.completedAt ? new Date(match.completedAt) : null,
            revealedSlotIndices: match.revealedSlotIndices ?? match.revealedSlots ?? [],
            currentTurnMembershipId: match.currentTurnMembershipId ?? match.currentTurn?.membershipId ?? null,
            winnerMembershipId: match.winnerMembershipId ?? match.winner?.membershipId ?? null,
            loserMembershipId: match.loserMembershipId ?? match.loser?.membershipId ?? null,
          })),
        }
      : undefined,
    pastNights: crew.pastNights ?? [],
  }
}

function reviveNotification(notification: any): Notification {
  return {
    ...notification,
    timestamp: new Date(notification.timestamp),
    payload: notification.payload ?? {},
  }
}

function reviveSessionResponse(payload: SessionResponse): SessionResponse {
  return {
    ...payload,
    crews: (payload.crews ?? []).map(reviveCrew),
    notifications: (payload.notifications ?? []).map(reviveNotification),
  }
}

function reviveSnapshotResponse(payload: CrewSnapshotResponse): CrewSnapshotResponse {
  return {
    ...payload,
    crew: payload.crew ? reviveCrew(payload.crew) : null,
    tonight: payload.tonight
      ? {
          ...payload.tonight,
          startedAt: new Date(payload.tonight.startedAt),
          bets: (payload.tonight.bets ?? []).map(reviveBet),
          miniGameMatches: payload.tonight.miniGameMatches ?? [],
        }
      : null,
    ledger: payload.ledger ?? {
      tonightLedger: [],
      allTimeLedger: [],
      leaderboard: [],
    },
    notifications: (payload.notifications ?? []).map(reviveNotification),
  }
}

function reviveCommandResponse(payload: CommandResponse): CommandResponse {
  return {
    ...payload,
    changed: {
      ...(payload.changed.session ? { session: reviveSessionResponse(payload.changed.session) } : {}),
      ...(payload.changed.snapshot ? { snapshot: reviveSnapshotResponse(payload.changed.snapshot) } : {}),
    },
  }
}

function reviveFeedResponse(payload: CrewFeedResponse): CrewFeedResponse {
  return {
    ...payload,
    changed: {
      ...(payload.changed.session ? { session: reviveSessionResponse(payload.changed.session) } : {}),
      ...(payload.changed.snapshot ? { snapshot: reviveSnapshotResponse(payload.changed.snapshot) } : {}),
    },
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

export async function fetchSessionState() {
  const payload = await apiFetch<SessionResponse>('/api/v2/session')
  return reviveSessionResponse(payload)
}

export async function fetchCrewSnapshotState(crewId: string) {
  const payload = await apiFetch<CrewSnapshotResponse>(`/api/v2/crews/${crewId}/snapshot`)
  return reviveSnapshotResponse(payload)
}

export async function fetchCrewFeedState(crewId: string, after: number | null) {
  const searchParams = new URLSearchParams()
  if (after != null) {
    searchParams.set('after', String(after))
  }

  const payload = await apiFetch<CrewFeedResponse>(`/api/v2/crews/${crewId}/feed${searchParams.toString() ? `?${searchParams}` : ''}`)
  return reviveFeedResponse(payload)
}

export async function joinGuest(name: string, crewCode: string) {
  const payload = await apiFetch<CommandResponse>('/api/v2/guest/join', {
    method: 'POST',
    body: JSON.stringify({
      name,
      crewCode,
    }),
  })

  return reviveCommandResponse(payload)
}

export async function mutateApp(action: string, payload: Record<string, any>) {
  switch (action) {
    case 'createCrew':
      return reviveCommandResponse(await apiFetch<CommandResponse>('/api/v2/crews', {
        method: 'POST',
        body: JSON.stringify({ name: payload.name }),
      }))
    case 'joinCrew':
      return reviveCommandResponse(await apiFetch<CommandResponse>('/api/v2/invites/join', {
        method: 'POST',
        body: JSON.stringify({ code: payload.code }),
      }))
    case 'renameCrew':
    case 'changeDrinkTheme':
      return reviveCommandResponse(await apiFetch<CommandResponse>(`/api/v2/crews/${payload.crewId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(action === 'renameCrew' ? { name: payload.name } : {}),
          ...(action === 'changeDrinkTheme' ? { drinkTheme: payload.theme } : {}),
        }),
      }))
    case 'deleteCrew':
      return reviveCommandResponse(await apiFetch<CommandResponse>(`/api/v2/crews/${payload.crewId}`, {
        method: 'DELETE',
      }))
    case 'leaveCrew':
      return reviveCommandResponse(await apiFetch<CommandResponse>(`/api/v2/crews/${payload.crewId}/leave`, {
        method: 'POST',
      }))
    case 'kickMember':
      return reviveCommandResponse(await apiFetch<CommandResponse>(`/api/v2/crews/${payload.crewId}/members/${payload.memberId}/remove`, {
        method: 'POST',
      }))
    case 'startNight':
      return reviveCommandResponse(await apiFetch<CommandResponse>(`/api/v2/crews/${payload.crewId}/nights/start`, {
        method: 'POST',
        body: JSON.stringify({
          name: payload.name,
          drinkThemeOverride: payload.drinkThemeOverride,
        }),
      }))
    case 'leaveNight':
      return reviveCommandResponse(await apiFetch<CommandResponse>(`/api/v2/crews/${payload.crewId}/nights/${payload.nightId}/leave`, {
        method: 'POST',
      }))
    case 'rejoinNight':
      return reviveCommandResponse(await apiFetch<CommandResponse>(`/api/v2/crews/${payload.crewId}/nights/${payload.nightId}/rejoin`, {
        method: 'POST',
      }))
    case 'createBet':
      return reviveCommandResponse(await apiFetch<CommandResponse>(`/api/v2/crews/${payload.crewId}/bets`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }))
    case 'placeWager':
      return reviveCommandResponse(await apiFetch<CommandResponse>(`/api/v2/bets/${payload.betId}/wager`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }))
    case 'respondToBetOffer':
      return reviveCommandResponse(await apiFetch<CommandResponse>(`/api/v2/bets/${payload.betId}/invite/respond`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }))
    case 'proposeResult':
      return reviveCommandResponse(await apiFetch<CommandResponse>(`/api/v2/bets/${payload.betId}/result/propose`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }))
    case 'confirmResult':
      return reviveCommandResponse(await apiFetch<CommandResponse>(`/api/v2/bets/${payload.betId}/result/confirm`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }))
    case 'disputeResult':
      return reviveCommandResponse(await apiFetch<CommandResponse>(`/api/v2/bets/${payload.betId}/result/dispute`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }))
    case 'castDisputeVote':
      return reviveCommandResponse(await apiFetch<CommandResponse>(payload.disputeId
        ? `/api/v2/disputes/${payload.disputeId}/votes`
        : '/api/v2/disputes/votes', {
        method: 'POST',
        body: JSON.stringify(payload),
      }))
    case 'recordSettlement':
      return reviveCommandResponse(await apiFetch<CommandResponse>('/api/v2/settlements', {
        method: 'POST',
        body: JSON.stringify(payload),
      }))
    case 'markNotificationsRead':
      return reviveCommandResponse(await apiFetch<CommandResponse>('/api/v2/notifications/read', {
        method: 'POST',
      }))
    case 'updateProfile':
      return reviveCommandResponse(await apiFetch<CommandResponse>('/api/v2/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: payload.name }),
      }))
    default:
      throw new Error(`Unsupported V2 action: ${action}`)
  }
}

export async function createMiniGameChallenge(_payload: Record<string, any>): Promise<CommandResponse> {
  throw new Error('Beer Bomb is disabled in Backend V2.')
}

export async function respondToMiniGameChallenge(_payload: Record<string, any>): Promise<CommandResponse> {
  throw new Error('Beer Bomb is disabled in Backend V2.')
}

export async function takeMiniGameTurn(_payload: Record<string, any>): Promise<CommandResponse> {
  throw new Error('Beer Bomb is disabled in Backend V2.')
}

export async function cancelMiniGameChallenge(_payload: Record<string, any>): Promise<CommandResponse> {
  throw new Error('Beer Bomb is disabled in Backend V2.')
}

export async function respondToBetOffer(payload: Record<string, any>) {
  return mutateApp('respondToBetOffer', payload)
}

export async function proposeResult(payload: Record<string, any>) {
  return mutateApp('proposeResult', payload)
}

export async function confirmResult(payload: Record<string, any>) {
  return mutateApp('confirmResult', payload)
}

export async function disputeResult(payload: Record<string, any>) {
  return mutateApp('disputeResult', payload)
}

export async function castDisputeVote(payload: Record<string, any>) {
  return mutateApp('castDisputeVote', payload)
}
