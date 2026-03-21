'use client'

import { startTransition, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { Session as SupabaseSession, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js'
import { OnboardingScreen } from '@/components/onboarding-screen'
import { HomeScreen } from '@/components/home-screen'
import { AppHeader } from '@/components/app-header'
import { BottomNav } from '@/components/bottom-nav'
import { TonightScreen } from '@/components/tonight-screen'
import { LedgerScreen } from '@/components/ledger-screen'
import { LeaderboardScreen } from '@/components/leaderboard-screen'
import { CrewScreen } from '@/components/crew-screen'
import { PendingInviteBanners } from '@/components/pending-invite-banners'
import { CreateBetModal } from '@/components/create-bet-modal'
import { ProfileModal } from '@/components/profile-modal'
import { LoadingSpinner } from '@/components/loading-spinner'
import {
  buildAppSession,
  clearGuestSessionCookie,
  readGuestSessionCookie,
  type AppSession,
} from '@/lib/auth'
import {
  buildDevAuthenticatedSession,
  clearDevAuthCookie,
  DEV_AUTH_IDENTITIES,
  getDevAuthIdentity,
  isDevAuthEnabled,
  readDevAuthCookie,
  writeDevAuthCookie,
} from '@/lib/dev-auth'
import {
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  isSupabaseConfigured,
} from '@/lib/supabase-client'
import {
  getNetPosition,
  getCrewMemberMembershipId,
  type Crew,
  type Bet,
  type Notification,
} from '@/lib/store'
import { useTheme } from '@/components/theme-provider'
import type { DrinkTheme } from '@/lib/themes'
import { CurrentUserProvider } from '@/lib/current-user'
import {
  cancelMiniGameChallenge,
  castDisputeVote,
  confirmResult,
  createMiniGameChallenge,
  disputeResult,
  fetchCrewFeedState,
  fetchCrewSnapshotState,
  fetchSessionState,
  joinGuest,
  mutateApp,
  proposeResult,
  respondToBetOffer,
  respondToMiniGameChallenge,
  takeMiniGameTurn,
} from '@/lib/client/app-api-v2'
import type { CommandResponse, CrewFeedResponse, CrewSnapshotResponse, SessionResponse } from '@/lib/server/v2/domain'

type AppView = 'home' | 'crew'
type CrewTab = 'tonight' | 'ledger' | 'leaderboard' | 'crew'
type RouteModal = 'none' | 'create-bet' | 'profile' | 'bet-detail' | 'beer-bomb-detail'

interface AppRouteState {
  crewId: string | null
  tab: CrewTab
  modal: RouteModal
  betId?: string
  matchId?: string
}

const PENDING_GUEST_CLAIM_KEY = 'beerscore_pending_guest_claim'
const ROUTE_STATE_KEY = 'beerscore_route_state'
const LEGACY_ACTIVE_CREW_KEY = 'beerscore_active_crew'
const LEGACY_ACTIVE_TAB_KEY = 'beerscore_active_tab'

function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function hasOAuthCallbackParams() {
  if (typeof window === 'undefined') {
    return false
  }

  const hash = window.location.hash
  const search = window.location.search

  return (
    hash.includes('access_token=') ||
    hash.includes('refresh_token=') ||
    search.includes('code=') ||
    search.includes('error=')
  )
}

function readOAuthCallbackCode() {
  if (typeof window === 'undefined') {
    return null
  }

  return new URL(window.location.href).searchParams.get('code')
}

async function waitForAdoptedSession(
  supabase: SupabaseClient,
  attempts = 20,
  delayMs = 250
): Promise<SupabaseSession | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.user) {
      return session
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return null
}

function getDefaultRouteState(): AppRouteState {
  return {
    crewId: null,
    tab: 'tonight',
    modal: 'none',
  }
}

function isCrewTab(tab: string): tab is CrewTab {
  return tab === 'tonight' || tab === 'ledger' || tab === 'leaderboard' || tab === 'crew'
}

function isRouteModal(modal: string): modal is RouteModal {
  return modal === 'none' || modal === 'create-bet' || modal === 'profile' || modal === 'bet-detail' || modal === 'beer-bomb-detail'
}

function getSavedRouteState(): AppRouteState {
  if (typeof window === 'undefined') {
    return getDefaultRouteState()
  }

  try {
    const rawValue = window.localStorage.getItem(ROUTE_STATE_KEY)
    if (rawValue) {
      const parsed = JSON.parse(rawValue) as Partial<AppRouteState>
      const tab = typeof parsed.tab === 'string' && isCrewTab(parsed.tab) ? parsed.tab : 'tonight'
      const modal = typeof parsed.modal === 'string' && isRouteModal(parsed.modal) ? parsed.modal : 'none'
      const crewId = typeof parsed.crewId === 'string' && parsed.crewId ? parsed.crewId : null
      const betId = typeof parsed.betId === 'string' && parsed.betId ? parsed.betId : undefined
      const matchId = typeof parsed.matchId === 'string' && parsed.matchId ? parsed.matchId : undefined

      if (modal === 'bet-detail' && !betId) {
        return { crewId, tab, modal: 'none' }
      }

      if (modal === 'beer-bomb-detail' && !matchId) {
        return { crewId, tab, modal: 'none' }
      }

      return {
        crewId,
        tab,
        modal,
        betId,
        matchId,
      }
    }
  } catch {
    // Fall back to legacy storage.
  }

  const legacyCrewId = window.localStorage.getItem(LEGACY_ACTIVE_CREW_KEY)
  const legacyTabValue = window.localStorage.getItem(LEGACY_ACTIVE_TAB_KEY)

  return {
    crewId: legacyCrewId || null,
    tab: legacyTabValue && isCrewTab(legacyTabValue) ? legacyTabValue : 'tonight',
    modal: 'none',
  }
}

function setSavedRouteState(routeState: AppRouteState) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(ROUTE_STATE_KEY, JSON.stringify(routeState))
}

function clearSavedRouteState() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(ROUTE_STATE_KEY)
  window.localStorage.removeItem(LEGACY_ACTIVE_CREW_KEY)
  window.localStorage.removeItem(LEGACY_ACTIVE_TAB_KEY)
}

function sanitizeSavedRouteState(routeState: AppRouteState, crews: Crew[]): AppRouteState {
  if (!routeState.crewId) {
    return getDefaultRouteState()
  }

  const restoredCrew = crews.find((crew) => crew.id === routeState.crewId)
  if (!restoredCrew) {
    return getDefaultRouteState()
  }

  if (routeState.modal === 'bet-detail' && !routeState.betId) {
    return {
      crewId: routeState.crewId,
      tab: routeState.tab,
      modal: 'none',
    }
  }

  if (routeState.modal === 'beer-bomb-detail' && !routeState.matchId) {
    return {
      crewId: routeState.crewId,
      tab: routeState.tab,
      modal: 'none',
    }
  }

  return {
    crewId: routeState.crewId,
    tab: routeState.tab,
    modal: routeState.modal,
    betId: routeState.betId,
    matchId: routeState.matchId,
  }
}

function getPendingGuestClaimFlag() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(PENDING_GUEST_CLAIM_KEY) === '1'
}

function setPendingGuestClaimFlag(value: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  if (value) {
    window.localStorage.setItem(PENDING_GUEST_CLAIM_KEY, '1')
    return
  }

  window.localStorage.removeItem(PENDING_GUEST_CLAIM_KEY)
}

interface AuthActionResult {
  error?: string
  message?: string
}

interface CreateBetInput {
  type: Bet['type']
  subtype: Bet['subtype']
  title: string
  options: Array<{ label: string }>
  line?: number
  challenger?: { id: string } | undefined
  wager?: number
  initialOptionIndex?: number
  closeTime?: number
}

interface CreateMiniGameInput {
  title: string
  opponent: { id: string }
  wager: number
  closeTime: number
  boardSize?: number
}

type AuthSubmittingMode = 'guest' | 'google' | 'dev' | null

export default function BeerScoreApp() {
  const [session, setSession] = useState<AppSession | null>(null)
  const [view, setView] = useState<AppView>(() => getSavedRouteState().crewId ? 'crew' : 'home')
  const [activeCrewId, setActiveCrewId] = useState<string | null>(() => getSavedRouteState().crewId)
  const [activeTab, setActiveTab] = useState<CrewTab>(() => getSavedRouteState().tab)
  const [showCreateBet, setShowCreateBet] = useState(() => getSavedRouteState().modal === 'create-bet')
  const [showProfile, setShowProfile] = useState(() => getSavedRouteState().modal === 'profile')
  const [selectedBetId, setSelectedBetId] = useState<string | null>(() => getSavedRouteState().modal === 'bet-detail' ? getSavedRouteState().betId ?? null : null)
  const [selectedBeerBombMatchId, setSelectedBeerBombMatchId] = useState<string | null>(() => getSavedRouteState().modal === 'beer-bomb-detail' ? getSavedRouteState().matchId ?? null : null)
  const [crews, setCrews] = useState<Crew[]>([])
  const [crewNetPositions, setCrewNetPositions] = useState<Record<string, number>>({})
  const [crewDataById, setCrewDataById] = useState<Record<string, { tonightLedger: any[]; allTimeLedger: any[]; leaderboard: any[] }>>({})
  const [crewCursorById, setCrewCursorById] = useState<Record<string, number>>({})
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [pendingCrewThemeById, setPendingCrewThemeById] = useState<Record<string, DrinkTheme>>({})
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [isDataReady, setIsDataReady] = useState(false)
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
  const [authSubmittingMode, setAuthSubmittingMode] = useState<AuthSubmittingMode>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [loadingCopy, setLoadingCopy] = useState<{ message: string; submessage?: string } | null>(null)
  const [isRouteRestorePending, setIsRouteRestorePending] = useState(() => Boolean(getSavedRouteState().crewId))
  const [isCreatingCrew, setIsCreatingCrew] = useState(false)
  const [isJoiningCrew, setIsJoiningCrew] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const isCrewPollInFlightRef = useRef(false)
  const supabaseConfigured = isSupabaseConfigured()
  const supabaseConfigError = getSupabaseConfigError()
  const devAuthEnabled = isDevAuthEnabled()
  const { setActiveDrinkTheme } = useTheme()
  const sessionLoadKey = session
    ? [
        session.isGuest ? 'guest' : 'auth',
        session.authUserId ?? session.guestIdentityId ?? session.user.id,
        session.membershipId ?? '',
      ].join(':')
    : null

  const applyAuthenticatedUser = useCallback((authUser: SupabaseUser | null) => {
    if (!authUser) {
      setSession(null)
      setCrews([])
      setCrewNetPositions({})
      setCrewDataById({})
      setCrewCursorById({})
      setNotifications([])
      setPendingCrewThemeById({})
      setShowCreateBet(false)
      setShowProfile(false)
      setSelectedBetId(null)
      setSelectedBeerBombMatchId(null)
      setView('home')
      setActiveCrewId(null)
      setActiveTab('tonight')
      setIsRouteRestorePending(false)
      clearSavedRouteState()
      return
    }

    const savedRouteState = getSavedRouteState()

    setSession(buildAppSession(authUser))
    setPendingCrewThemeById({})
    setView(savedRouteState.crewId ? 'crew' : 'home')
    setActiveCrewId(savedRouteState.crewId)
    setActiveTab(savedRouteState.tab)
    setShowCreateBet(savedRouteState.modal === 'create-bet')
    setShowProfile(savedRouteState.modal === 'profile')
    setSelectedBetId(savedRouteState.modal === 'bet-detail' ? savedRouteState.betId ?? null : null)
    setSelectedBeerBombMatchId(savedRouteState.modal === 'beer-bomb-detail' ? savedRouteState.matchId ?? null : null)
    setIsRouteRestorePending(Boolean(savedRouteState.crewId))
  }, [])

  const applyViewerUser = useCallback((viewerUser?: SessionResponse['actor'] | CrewSnapshotResponse['viewerUser'] | null) => {
    if (!viewerUser) {
      return
    }

    setSession((current) => {
      if (!current) {
        return current
      }

      const nextUser = {
        ...current.user,
        ...viewerUser,
      }

      const userUnchanged =
        current.user.id === nextUser.id &&
        current.user.membershipId === nextUser.membershipId &&
        current.user.role === nextUser.role &&
        current.user.name === nextUser.name &&
        current.user.avatar === nextUser.avatar &&
        current.user.initials === nextUser.initials

      if (userUnchanged) {
        return current
      }

      return {
        ...current,
        user: nextUser,
      }
    })
  }, [])

  const applySessionPayload = useCallback((payload: SessionResponse) => {
    setCrews((current) => {
      const currentById = new Map(current.map((crew) => [crew.id, crew]))

      return payload.crews.map((summaryCrew) => {
        const existing = currentById.get(summaryCrew.id)
        if (!existing) {
          return summaryCrew
        }

        const sameCurrentNight =
          existing.currentNight &&
          summaryCrew.currentNight &&
          existing.currentNight.id === summaryCrew.currentNight.id

        const mergedCrew: Crew = {
          ...summaryCrew,
          currentNight: sameCurrentNight
            ? {
                ...existing.currentNight,
                ...summaryCrew.currentNight,
              } as Crew['currentNight']
            : summaryCrew.currentNight,
          pastNights: existing.pastNights.length > 0 ? existing.pastNights : summaryCrew.pastNights,
          currentNightOpenBetCount: summaryCrew.currentNightOpenBetCount ?? existing.currentNightOpenBetCount,
        }

        return mergedCrew
      })
    })
    setCrewNetPositions(payload.crewNetPositions ?? {})
    setNotifications(payload.notifications ?? [])
    applyViewerUser(payload.actor ?? null)
  }, [applyViewerUser])

  const applyCrewSnapshot = useCallback((payload: CrewSnapshotResponse) => {
    setCrews((current) => {
      const existingIndex = current.findIndex((crew) => crew.id === payload.crewId)

      if (!payload.crew) {
        if (existingIndex === -1) {
          return current
        }

        return current.filter((crew) => crew.id !== payload.crewId)
      }

      const nextCrew = {
        ...payload.crew,
        currentNightOpenBetCount: payload.crew.currentNight?.bets.filter((bet) => bet.status === 'open').length ?? payload.crew.currentNightOpenBetCount ?? 0,
      }

      if (existingIndex === -1) {
        return [...current, nextCrew]
      }

      const next = current.slice()
      next[existingIndex] = nextCrew
      return next
    })

    setCrewDataById((current) => {
      if (!payload.crew) {
        if (!(payload.crewId in current)) {
          return current
        }

        const next = { ...current }
        delete next[payload.crewId]
        return next
      }

      return {
        ...current,
        [payload.crewId]: payload.ledger,
      }
    })

    setCrewCursorById((current) => ({
      ...current,
      [payload.crewId]: payload.cursor,
    }))
    setNotifications(payload.notifications ?? [])
    applyViewerUser(payload.viewerUser ?? null)
    setPendingCrewThemeById((current) => {
      if (!Object.keys(current).length || !payload.crew) {
        return current
      }

      const next = { ...current }
      if (next[payload.crewId] && next[payload.crewId] === (payload.crew.drinkTheme ?? 'beer')) {
        delete next[payload.crewId]
      }
      return next
    })
    setCrewNetPositions((current) => ({
      ...current,
      [payload.crewId]: session ? getNetPosition(session.user.id, payload.ledger.allTimeLedger) : current[payload.crewId] ?? 0,
    }))
  }, [applyViewerUser, session])

  const applyCommandPayload = useCallback((payload: CommandResponse | CrewFeedResponse) => {
    if (payload.changed.session) {
      applySessionPayload(payload.changed.session)
    }

    if (payload.changed.snapshot) {
      applyCrewSnapshot(payload.changed.snapshot)
    }
  }, [applyCrewSnapshot, applySessionPayload])

  const visibleCrews = useMemo(() => {
    if (!Object.keys(pendingCrewThemeById).length) {
      return crews
    }

    return crews.map((crew) => {
      const pendingTheme = pendingCrewThemeById[crew.id]
      if (!pendingTheme) {
        return crew
      }

      return {
        ...crew,
        drinkTheme: pendingTheme,
      }
    })
  }, [crews, pendingCrewThemeById])

  useEffect(() => {
    let isMounted = true
    let authFallbackTimer: ReturnType<typeof setTimeout> | null = null

    const clearAuthFallback = () => {
      if (authFallbackTimer) {
        clearTimeout(authFallbackTimer)
        authFallbackTimer = null
      }
    }

    const restoreGuestSession = () => {
      const guestSession = readGuestSessionCookie()

      if (!guestSession) {
        return false
      }

      const savedRouteState = getSavedRouteState()

      setSession(guestSession)
      setIsDataReady(false)
      setView(savedRouteState.crewId ? 'crew' : 'home')
      setActiveCrewId(savedRouteState.crewId)
      setActiveTab(savedRouteState.tab)
      setShowCreateBet(savedRouteState.modal === 'create-bet')
      setShowProfile(savedRouteState.modal === 'profile')
      setSelectedBetId(savedRouteState.modal === 'bet-detail' ? savedRouteState.betId ?? null : null)
      setSelectedBeerBombMatchId(savedRouteState.modal === 'beer-bomb-detail' ? savedRouteState.matchId ?? null : null)
      setIsRouteRestorePending(Boolean(savedRouteState.crewId))
      setAuthNotice(null)
      return true
    }

    const restoreDevSession = () => {
      const identity = readDevAuthCookie()
      if (!identity) {
        return false
      }

      const savedRouteState = getSavedRouteState()

      setSession(buildDevAuthenticatedSession(identity))
      setIsDataReady(false)
      setView(savedRouteState.crewId ? 'crew' : 'home')
      setActiveCrewId(savedRouteState.crewId)
      setActiveTab(savedRouteState.tab)
      setShowCreateBet(savedRouteState.modal === 'create-bet')
      setShowProfile(savedRouteState.modal === 'profile')
      setSelectedBetId(savedRouteState.modal === 'bet-detail' ? savedRouteState.betId ?? null : null)
      setSelectedBeerBombMatchId(savedRouteState.modal === 'beer-bomb-detail' ? savedRouteState.matchId ?? null : null)
      setIsRouteRestorePending(Boolean(savedRouteState.crewId))
      setAuthNotice(null)
      return true
    }

    if (devAuthEnabled && restoreDevSession()) {
      setIsAuthReady(true)
      return
    }

    if (!supabaseConfigured) {
      restoreGuestSession()
      setIsAuthReady(true)
      return
    }

    const supabase = getSupabaseBrowserClient()

    const restoreSession = async () => {
      setIsAuthReady(false)
      const isOAuthCallback = hasOAuthCallbackParams()
      const callbackCode = readOAuthCallbackCode()

      authFallbackTimer = setTimeout(() => {
        if (!isMounted) {
          return
        }

        setAuthNotice(
          isOAuthCallback
            ? 'Google sign-in is taking longer than expected. If this does not finish, try signing in again.'
            : 'Supabase session check timed out. You can still continue with Google or join as a guest.'
        )
        setIsAuthReady(true)
      }, isOAuthCallback ? 20000 : 10000)

      const {
        data: { session: restoredSession },
        error: sessionError,
      } = callbackCode
        ? await supabase.auth.exchangeCodeForSession(callbackCode)
        : await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      if (sessionError) {
        clearAuthFallback()
        setAuthNotice(sessionError.message)
        if (!restoreDevSession() && !restoreGuestSession()) {
          applyAuthenticatedUser(null)
        }
        setIsAuthReady(true)
        return
      }

      const adoptedSession =
        restoredSession?.user
          ? restoredSession
          : isOAuthCallback
          ? await waitForAdoptedSession(supabase)
          : null

      if (!isMounted) {
        return
      }

      if (!adoptedSession?.user) {
        clearAuthFallback()
        if (!restoreDevSession() && !restoreGuestSession()) {
          applyAuthenticatedUser(null)
        }
        setIsAuthReady(true)
        return
      }

      if (!getPendingGuestClaimFlag()) {
        clearGuestSessionCookie()
      }
      applyAuthenticatedUser(adoptedSession.user)
      setAuthNotice(null)
      clearAuthFallback()
      setIsAuthReady(true)
    }

    void restoreSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) {
        return
      }

      if (nextSession?.user) {
        if (!getPendingGuestClaimFlag()) {
          clearGuestSessionCookie()
        }
        applyAuthenticatedUser(nextSession.user)
        setAuthNotice(null)
      } else if (!(event === 'INITIAL_SESSION' && hasOAuthCallbackParams()) && !restoreDevSession() && !restoreGuestSession()) {
        applyAuthenticatedUser(null)
      }

      setIsAuthReady(true)
    })

    return () => {
      isMounted = false
      clearAuthFallback()
      subscription.unsubscribe()
    }
  }, [applyAuthenticatedUser, devAuthEnabled, supabaseConfigured])

  useEffect(() => {
    if (!session || isDataReady) {
      setLoadingCopy(null)
    }
  }, [isDataReady, session])

  useEffect(() => {
    if (!session) {
      setIsDataReady(true)
      return
    }

    let cancelled = false

    const loadState = async () => {
      setIsDataReady(false)

      try {
        const payload = await fetchSessionState()
        if (!cancelled) {
          applySessionPayload(payload)

          const initialCrewId = activeCrewId ?? payload.defaultCrewId
          if (view === 'crew' && initialCrewId) {
            const snapshot = await fetchCrewSnapshotState(initialCrewId)
            if (!cancelled) {
              applyCrewSnapshot(snapshot)
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          setAuthNotice(error instanceof Error ? error.message : 'Could not load your BeerScore data.')
        }
      } finally {
        if (!cancelled) {
          setIsDataReady(true)
        }
      }
    }

    void loadState()

    return () => {
      cancelled = true
    }
  }, [applyCrewSnapshot, applySessionPayload, sessionLoadKey])

  const activeCrew = visibleCrews.find((crew) => crew.id === activeCrewId)
  const hasActiveNight = Boolean(activeCrew?.currentNight)
  const activeCrewCursor = activeCrewId ? crewCursorById[activeCrewId] ?? null : null

  useEffect(() => {
    if (!session || view !== 'crew' || !activeCrewId || !isDataReady || isRouteRestorePending || crewDataById[activeCrewId]) {
      return
    }

    let cancelled = false

    const loadSnapshot = async () => {
      try {
        const snapshot = await fetchCrewSnapshotState(activeCrewId)
        if (!cancelled) {
          applyCrewSnapshot(snapshot)
        }
      } catch {
        // Crew hydration is best-effort here; the page still has summary data.
      }
    }

    void loadSnapshot()

    return () => {
      cancelled = true
    }
  }, [activeCrewId, applyCrewSnapshot, crewDataById, isDataReady, isRouteRestorePending, session, view])

  useEffect(() => {
    if (!session || view !== 'crew' || !activeCrewId || !isDataReady || isRouteRestorePending || activeCrewCursor == null) {
      return
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const intervalMs = hasActiveNight ? 8000 : 15000

    const scheduleNextPoll = (delay: number) => {
      if (cancelled) {
        return
      }

      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(() => {
        void poll()
      }, delay)
    }

    const poll = async () => {
      if (cancelled) {
        return
      }

      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        scheduleNextPoll(15000)
        return
      }

      if (isCrewPollInFlightRef.current) {
        scheduleNextPoll(intervalMs)
        return
      }

      isCrewPollInFlightRef.current = true

      try {
        const payload = await fetchCrewFeedState(activeCrewId, crewCursorById[activeCrewId] ?? activeCrewCursor)
        if (!cancelled) {
          startTransition(() => {
            if (payload.needsSnapshot) {
              void fetchCrewSnapshotState(activeCrewId).then((snapshot) => {
                if (!cancelled) {
                  applyCrewSnapshot(snapshot)
                }
              })
              return
            }

            applyCommandPayload(payload)
          })
        }
      } catch {
        // Best-effort polling only.
      } finally {
        isCrewPollInFlightRef.current = false
        scheduleNextPoll(intervalMs)
      }
    }

    const handleVisibilityChange = () => {
      if (cancelled || typeof document === 'undefined' || document.visibilityState !== 'visible') {
        return
      }

      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      if (!isCrewPollInFlightRef.current) {
        void poll()
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    void poll()

    return () => {
      cancelled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [
    activeCrew?.currentNight?.status,
    activeCrewCursor,
    activeCrewId,
    activeTab,
    applyCommandPayload,
    applyCrewSnapshot,
    crewCursorById,
    hasActiveNight,
    isDataReady,
    isRouteRestorePending,
    session,
    view,
  ])

  useEffect(() => {
    if (isAuthReady) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setAuthNotice((current) => current ?? 'Supabase session check timed out. You can still continue with Google or join as a guest.')
      setIsAuthReady(true)
    }, 5000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isAuthReady])

  useEffect(() => {
    if (!session || isDataReady) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setAuthNotice((current) => current ?? 'BeerScore is taking longer than usual to load your crews. Showing what we have so far.')
      setIsDataReady(true)
    }, 5000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isDataReady, session])

  useEffect(() => {
    if (!isAuthReady) {
      return
    }

    if (!session) {
      clearSavedRouteState()
      return
    }

    if (view !== 'crew' || !activeCrewId) {
      setSavedRouteState(getDefaultRouteState())
      return
    }

    const modal: RouteModal = showCreateBet
      ? 'create-bet'
      : showProfile
      ? 'profile'
      : selectedBetId
      ? 'bet-detail'
      : selectedBeerBombMatchId
      ? 'beer-bomb-detail'
      : 'none'

    setSavedRouteState({
      crewId: activeCrewId,
      tab: activeTab,
      modal,
      betId: modal === 'bet-detail' ? selectedBetId ?? undefined : undefined,
      matchId: modal === 'beer-bomb-detail' ? selectedBeerBombMatchId ?? undefined : undefined,
    })
  }, [
    activeCrewId,
    activeTab,
    isAuthReady,
    selectedBeerBombMatchId,
    selectedBetId,
    session,
    showCreateBet,
    showProfile,
    view,
  ])

  useEffect(() => {
    if (!session || !isDataReady || !isRouteRestorePending) {
      return
    }

    const savedRouteState = sanitizeSavedRouteState(getSavedRouteState(), visibleCrews)

    if (!savedRouteState.crewId) {
      setShowCreateBet(false)
      setShowProfile(false)
      setSelectedBetId(null)
      setSelectedBeerBombMatchId(null)
      setActiveCrewId(null)
      setActiveTab('tonight')
      setView('home')
      setActiveDrinkTheme('beer')
      clearSavedRouteState()
      setIsRouteRestorePending(false)
      return
    }

    const restoredCrew = visibleCrews.find((crew) => crew.id === savedRouteState.crewId)
    if (!restoredCrew) {
      return
    }

    const hasSavedBet =
      savedRouteState.modal === 'bet-detail' &&
      savedRouteState.betId &&
      Boolean(restoredCrew.currentNight?.bets.some((bet) => bet.id === savedRouteState.betId))

    const hasSavedBeerBombMatch =
      savedRouteState.modal === 'beer-bomb-detail' &&
      savedRouteState.matchId &&
      Boolean(restoredCrew.currentNight?.miniGameMatches.some((match) => match.id === savedRouteState.matchId))

    setView('crew')
    setActiveCrewId(savedRouteState.crewId)
    setActiveTab(savedRouteState.tab)
    setShowCreateBet(savedRouteState.modal === 'create-bet')
    setShowProfile(savedRouteState.modal === 'profile')
    setSelectedBetId(hasSavedBet ? savedRouteState.betId ?? null : null)
    setSelectedBeerBombMatchId(hasSavedBeerBombMatch ? savedRouteState.matchId ?? null : null)
    setActiveDrinkTheme(restoredCrew.currentNight?.drinkThemeOverride ?? restoredCrew.drinkTheme ?? 'beer')
    setIsRouteRestorePending(false)
  }, [isDataReady, isRouteRestorePending, session, setActiveDrinkTheme, visibleCrews])

  useEffect(() => {
    if (isRouteRestorePending || !isDataReady || !activeCrewId) {
      return
    }

    const activeCrewStillExists = visibleCrews.some((crew) => crew.id === activeCrewId)
    if (activeCrewStillExists) {
      return
    }

    setShowCreateBet(false)
    setShowProfile(false)
    setSelectedBetId(null)
    setSelectedBeerBombMatchId(null)
    setActiveCrewId(null)
    setActiveTab('tonight')
    setView('home')
    setActiveDrinkTheme('beer')
    clearSavedRouteState()
  }, [activeCrewId, isDataReady, isRouteRestorePending, setActiveDrinkTheme, visibleCrews])

  useEffect(() => {
    if (view !== 'crew' || !activeCrew) {
      return
    }

    setActiveDrinkTheme(activeCrew.currentNight?.drinkThemeOverride ?? activeCrew.drinkTheme ?? 'beer')
  }, [activeCrew, setActiveDrinkTheme, view])

  useEffect(() => {
    if (!activeCrewId || !selectedBetId) {
      return
    }

    const betStillExists = Boolean(
      visibleCrews
        .find((crew) => crew.id === activeCrewId)
        ?.currentNight?.bets.some((bet) => bet.id === selectedBetId)
    )

    if (!betStillExists) {
      setSelectedBetId(null)
    }
  }, [activeCrewId, selectedBetId, visibleCrews])

  useEffect(() => {
    if (!activeCrewId || !selectedBeerBombMatchId) {
      return
    }

    const matchStillExists = Boolean(
      visibleCrews
        .find((crew) => crew.id === activeCrewId)
        ?.currentNight?.miniGameMatches.some((match) => match.id === selectedBeerBombMatchId)
    )

    if (!matchStillExists) {
      setSelectedBeerBombMatchId(null)
    }
  }, [activeCrewId, selectedBeerBombMatchId, visibleCrews])

  const activeCrewData = activeCrewId ? crewDataById[activeCrewId] : null
  const activeNightWithMiniGames = activeCrew?.currentNight ?? null

  const handleGoogleAuth = async ({ preserveGuestSession = false }: { preserveGuestSession?: boolean } = {}): Promise<AuthActionResult> => {
    if (!supabaseConfigured) {
      return { error: supabaseConfigError ?? 'Supabase is not configured.' }
    }

    setIsAuthSubmitting(true)
    setAuthSubmittingMode('google')
    setAuthNotice(null)
    clearDevAuthCookie()
    if (preserveGuestSession) {
      setPendingGuestClaimFlag(true)
    } else {
      setPendingGuestClaimFlag(false)
      clearGuestSessionCookie()
    }

    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window === 'undefined' ? undefined : window.location.origin,
        },
      })

      if (error) {
        return { error: error.message }
      }

      return { message: 'Redirecting to Google…' }
    } finally {
      setIsAuthSubmitting(false)
      setAuthSubmittingMode(null)
    }
  }

  const handleGuestJoin = async (name: string, crewCode: string): Promise<AuthActionResult> => {
    setIsAuthSubmitting(true)
    setAuthSubmittingMode('guest')
    setAuthNotice(null)
    setLoadingCopy({
      message: 'Joining your crew…',
      submessage: 'Setting up your guest tab',
    })

    try {
      clearDevAuthCookie()
      const payload = await joinGuest(name, crewCode)
      if (!payload.session) {
        return { error: 'Guest session could not be created.' }
      }

      setSession(payload.session)
      applyCommandPayload(payload)
      const joinedCrewId = payload.crewId ?? payload.changed.snapshot?.crewId ?? null
      clearSavedRouteState()
      setIsRouteRestorePending(false)
      setIsDataReady(true)
      setLoadingCopy(null)
      if (joinedCrewId) {
        handleSelectCrew(joinedCrewId)
      }
      setAuthNotice(null)
      return { message: `Playing as ${payload.session.user.name}.` }
    } catch (error) {
      setLoadingCopy(null)
      setView('home')
      return { error: error instanceof Error ? error.message : 'Crew code not found.' }
    } finally {
      setIsAuthSubmitting(false)
      setAuthSubmittingMode(null)
    }
  }

  const handleDevAuth = async (identityId: string): Promise<AuthActionResult> => {
    if (!devAuthEnabled) {
      return { error: 'Dev auth is only available in local development.' }
    }

    const identity = getDevAuthIdentity(identityId)
    if (!identity) {
      return { error: 'That dev identity is no longer available.' }
    }

    setIsAuthSubmitting(true)
    setAuthSubmittingMode('dev')
    setAuthNotice(null)
    setPendingGuestClaimFlag(false)
    clearGuestSessionCookie()
    clearDevAuthCookie()

    try {
      writeDevAuthCookie(identity)
      const nextSession = buildDevAuthenticatedSession(identity)
      setSession(nextSession)
      const payload = await fetchSessionState()
      applySessionPayload(payload)
      setView('home')
      setActiveCrewId(null)
      setActiveTab('tonight')
      return { message: `Playing as ${identity.label}.` }
    } catch (error) {
      clearDevAuthCookie()
      setSession(null)
      return { error: error instanceof Error ? error.message : 'Could not start the dev session.' }
    } finally {
      setIsAuthSubmitting(false)
      setAuthSubmittingMode(null)
      setIsAuthReady(true)
    }
  }

  const handleSignOut = async () => {
    setPendingGuestClaimFlag(false)
    clearGuestSessionCookie()
    clearDevAuthCookie()

    if (session?.provider === 'dev') {
      applyAuthenticatedUser(null)
      return
    }

    if (!supabaseConfigured) {
      applyAuthenticatedUser(null)
      return
    }

    setIsSigningOut(true)
    setAuthNotice(null)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signOut()

      if (error) {
        setAuthNotice(error.message)
      }
    } finally {
      setIsSigningOut(false)
    }
  }

  const handleMarkNotificationsRead = async () => {
    const payload = await mutateApp('markNotificationsRead', {})
    applyCommandPayload(payload)
  }

  const handleFinishAccount = async () => {
    await handleGoogleAuth({ preserveGuestSession: true })
  }

  const handleCreateDevBattleSandbox = async () => {
    if (!session || session.isGuest || session.provider !== 'dev') {
      setMutationError('Sign in with a dev user to create a battle sandbox.')
      return false
    }

    const crewName = `${session?.user.name ?? 'Dev'} Battle Sandbox`
    const nightName = `${session?.user.name ?? 'Dev'} Battle Night`
    const existingCrewIds = new Set(crews.map((crew) => crew.id))

    return runMutation(async () => {
      const createPayload = await mutateApp('createCrew', { name: crewName })
      applyCommandPayload(createPayload)
      const createdCrewId =
        createPayload.crewId ??
        createPayload.changed.session?.crews.find((crew) => !existingCrewIds.has(crew.id))?.id ??
        createPayload.changed.session?.crews.find((crew) => crew.name === crewName)?.id

      if (!createdCrewId) {
        throw new Error('Could not find the sandbox crew after creating it.')
      }

      const startPayload = await mutateApp('startNight', {
        crewId: createdCrewId,
        name: nightName,
      })
      applyCommandPayload(startPayload)
      handleSelectCrew(createdCrewId)
      setActiveTab('crew')
    }, 'Could not create the dev battle sandbox.')
  }

  const handleUpdateName = async (name: string) => {
    try {
      const payload = await mutateApp('updateProfile', { name })
      applyCommandPayload(payload)
    } catch {
      // Best-effort name update
    }
  }

  const clearRestorableModalState = useCallback(() => {
    setShowCreateBet(false)
    setShowProfile(false)
    setSelectedBetId(null)
    setSelectedBeerBombMatchId(null)
  }, [])

  const handleSelectCrew = (crewId: string) => {
    clearRestorableModalState()
    setActiveCrewId(crewId)
    setActiveTab('tonight')
    setView('crew')
    // Apply night theme override if active, otherwise crew's drink theme
    const crew = visibleCrews.find((c) => c.id === crewId)
    const effectiveTheme = crew?.currentNight?.drinkThemeOverride ?? crew?.drinkTheme ?? 'beer'
    setActiveDrinkTheme(effectiveTheme)
  }

  const handleBackToHome = () => {
    clearRestorableModalState()
    setActiveCrewId(null)
    setActiveTab('tonight')
    setView('home')
    setActiveDrinkTheme('beer')
  }

  const handleTabChange = (tab: CrewTab) => {
    setActiveTab(tab)
    setSelectedBetId(null)
    setSelectedBeerBombMatchId(null)
  }

  const handleOpenCreateBet = () => {
    setShowProfile(false)
    setSelectedBetId(null)
    setSelectedBeerBombMatchId(null)
    setShowCreateBet(true)
  }

  const handleOpenProfile = () => {
    setShowCreateBet(false)
    setSelectedBetId(null)
    setSelectedBeerBombMatchId(null)
    setShowProfile(true)
  }

  const handleSelectBet = (betId: string | null) => {
    setShowCreateBet(false)
    setShowProfile(false)
    setSelectedBeerBombMatchId(null)
    setSelectedBetId(betId)
  }

  const handleSelectBeerBombMatch = (matchId: string | null) => {
    setShowCreateBet(false)
    setShowProfile(false)
    setSelectedBetId(null)
    setSelectedBeerBombMatchId(matchId)
  }

  const handleOpenNotification = useCallback((notification: Notification) => {
    const targetCrewId =
      notification.crewId ??
      visibleCrews.find((crew) => crew.name === notification.crewName)?.id ??
      null

    if (!targetCrewId) {
      return
    }

    const targetCrew = visibleCrews.find((crew) => crew.id === targetCrewId)
    const targetTab: CrewTab =
      notification.payload.betId || notification.payload.matchId || notification.payload.nightId
        ? 'tonight'
        : 'crew'

    clearRestorableModalState()
    setView('crew')
    setActiveCrewId(targetCrewId)
    setActiveTab(targetTab)
    setActiveDrinkTheme(targetCrew?.currentNight?.drinkThemeOverride ?? targetCrew?.drinkTheme ?? 'beer')

    if (notification.payload.matchId) {
      setSelectedBeerBombMatchId(notification.payload.matchId)
      return
    }

    if (notification.payload.betId) {
      setSelectedBetId(notification.payload.betId)
    }
  }, [clearRestorableModalState, setActiveDrinkTheme, visibleCrews])

  // Shared wrapper: sets isMutating for any async mutation, surfaces errors to mutationError
  const runMutation = useCallback(async (fn: () => Promise<void>, errorFallback?: string) => {
    setIsMutating(true)
    setMutationError(null)
    try {
      await fn()
      return true
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : (errorFallback ?? 'Something went wrong.'))
      return false
    } finally {
      setIsMutating(false)
    }
  }, [])

  const handleCreateCrew = async (name: string) => {
    if (!session || session.isGuest) {
      setMutationError('Please create an account to create a crew.')
      return false
    }

    setIsCreatingCrew(true)

    const existingCrewIds = new Set(crews.map((crew) => crew.id))
    const didCreateCrew = await runMutation(async () => {
      const payload = await mutateApp('createCrew', { name })
      applyCommandPayload(payload)

      const createdCrewId =
        payload.crewId ??
        payload.changed.session?.crews.find((crew) => !existingCrewIds.has(crew.id))?.id ??
        payload.changed.session?.crews.find((crew) => crew.name === name.trim())?.id

      if (createdCrewId) {
        handleSelectCrew(createdCrewId)
      }
    }, 'Could not create crew.')

    if (!didCreateCrew) {
      setIsCreatingCrew(false)
      return false
    }

    setIsCreatingCrew(false)
    return true
  }

  const handleJoinCrew = async (code: string) => {
    setIsJoiningCrew(true)

    const existingCrewIds = new Set(crews.map((crew) => crew.id))
    const normalizedCode = normalizeInviteCode(code)
    const didJoinCrew = await runMutation(async () => {
      const payload = await mutateApp('joinCrew', { code })
      applyCommandPayload(payload)

      const joinedCrewId =
        payload.crewId ??
        payload.changed.session?.crews.find((crew) => !existingCrewIds.has(crew.id))?.id ??
        payload.changed.session?.crews.find((crew) => normalizeInviteCode(crew.inviteCode) === normalizedCode)?.id

      if (joinedCrewId) {
        handleSelectCrew(joinedCrewId)
      }
    }, 'Crew code not found.')

    if (!didJoinCrew) {
      setIsJoiningCrew(false)
      return false
    }

    setIsJoiningCrew(false)
    return true
  }

  const handleLeaveCrew = () => {
    if (!activeCrewId) return
    handleBackToHome()
    void runMutation(async () => {
      const payload = await mutateApp('leaveCrew', { crewId: activeCrewId })
      applyCommandPayload(payload)
    })
  }

  const handleRenameCrew = (name: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await mutateApp('renameCrew', { crewId: activeCrewId, name })
      applyCommandPayload(payload)
    })
  }

  const handleKickMember = (memberId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await mutateApp('kickMember', { crewId: activeCrewId, memberId })
      applyCommandPayload(payload)
    })
  }

  const handleDeleteCrew = () => {
    if (!activeCrewId) return
    handleBackToHome()
    void runMutation(async () => {
      const payload = await mutateApp('deleteCrew', { crewId: activeCrewId })
      applyCommandPayload(payload)
    })
  }

  // Theme change is optimistic — apply locally immediately, sync in background without blocking UI
  const handleChangeDrinkTheme = (theme: DrinkTheme) => {
    if (!activeCrewId) return
    const crewId = activeCrewId
    const previousTheme = activeCrew?.currentNight?.drinkThemeOverride ?? activeCrew?.drinkTheme ?? 'beer'

    setPendingCrewThemeById((current) => ({
      ...current,
      [crewId]: theme,
    }))
    setActiveDrinkTheme(theme)

    void runMutation(async () => {
      try {
        const payload = await mutateApp('changeDrinkTheme', { crewId, theme })
        applyCommandPayload(payload)
      } catch (error) {
        setPendingCrewThemeById((current) => {
          const next = { ...current }
          delete next[crewId]
          return next
        })
        setActiveDrinkTheme(previousTheme)
        throw error
      }
    }, 'Could not update the crew theme.')
  }

  const handleWager = (betId: string, optionId: string, drinks: number) => {
    if (!activeCrewId || !session) return
    void runMutation(async () => {
      const payload = await mutateApp('placeWager', { crewId: activeCrewId, betId, optionId, drinks })
      applyCommandPayload(payload)
    })
  }

  const handleCreateBet = (betInput: CreateBetInput) => {
    if (!activeCrewId || !session || !activeCrew?.currentNight) return

    const challengerMembershipId =
      betInput.challenger && activeCrew
        ? getCrewMemberMembershipId(activeCrew.members.find((member) => member.id === betInput.challenger?.id)) ?? undefined
        : undefined

    void runMutation(async () => {
      const payload = await mutateApp('createBet', {
        crewId: activeCrewId,
        nightId: activeCrew.currentNight!.id,
        type: betInput.type,
        subtype: betInput.subtype,
        title: betInput.title,
        options: betInput.options,
        line: betInput.line,
        wager: betInput.wager ?? 0,
        initialOptionIndex: betInput.initialOptionIndex ?? 0,
        challengerMembershipId,
        ...(betInput.closeTime != null ? { closeTime: betInput.closeTime } : {}),
      })
      applyCommandPayload(payload)
    })
  }

  const handleCreateMiniGameChallenge = (challengeInput: CreateMiniGameInput) => {
    if (!activeCrewId || !session || !activeCrew?.currentNight) return

    const opponentMember = activeCrew.members.find((member) => member.id === challengeInput.opponent.id)
    if (!opponentMember) return

    const opponentMembershipId = getCrewMemberMembershipId(opponentMember)
    if (!opponentMembershipId) return

    void runMutation(async () => {
      const payload = await createMiniGameChallenge({
        crewId: activeCrewId,
        nightId: activeCrew.currentNight!.id,
        title: challengeInput.title,
        opponentMembershipId,
        wager: challengeInput.wager,
        closeTime: challengeInput.closeTime,
        boardSize: challengeInput.boardSize ?? 8,
      })
      applyCommandPayload(payload)

      const createdCrew = payload.changed.snapshot?.crew
      const createdMatch = [...(createdCrew?.currentNight?.miniGameMatches ?? [])]
        .filter((match) =>
          match.status === 'pending' &&
          (match.challenger.id === session.user.id || match.challenger.name === session.user.name) &&
          (match.opponent.id === challengeInput.opponent.id || match.opponent.name === opponentMember.name)
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]

      if (createdMatch) {
        setSelectedBeerBombMatchId(createdMatch.id)
      }
    })
  }

  const handleBeerBombAccept = (matchId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await respondToMiniGameChallenge({ crewId: activeCrewId, matchId, accepted: true })
      applyCommandPayload(payload)
    })
  }

  const handleBeerBombDecline = (matchId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await respondToMiniGameChallenge({ crewId: activeCrewId, matchId, accepted: false })
      applyCommandPayload(payload)
    })
  }

  const handleBeerBombCancel = (matchId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await cancelMiniGameChallenge({ crewId: activeCrewId, matchId })
      applyCommandPayload(payload)
    })
  }

  const handleBetOfferAccept = (betId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await respondToBetOffer({ crewId: activeCrewId, betId, accepted: true })
      applyCommandPayload(payload)
    })
  }

  const handleBetOfferDecline = (betId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await respondToBetOffer({ crewId: activeCrewId, betId, accepted: false })
      applyCommandPayload(payload)
    })
  }

  // Beer Bomb turns are intentionally not wrapped in runMutation — the game board
  // manages its own in-flight state and blocking the full UI would feel jarring mid-game.
  const handleBeerBombTurn = async (matchId: string, slotIndex: number) => {
    if (!activeCrewId) return
    const payload = await takeMiniGameTurn({ crewId: activeCrewId, matchId, slotIndex })
    applyCommandPayload(payload)
  }

  const handleProposeResult = (betId: string, optionId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await proposeResult({ crewId: activeCrewId, betId, optionId })
      applyCommandPayload(payload)
    })
  }

  const handleConfirmResult = (betId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await confirmResult({ crewId: activeCrewId, betId })
      applyCommandPayload(payload)
    })
  }

  const handleDisputeResult = (betId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await disputeResult({ crewId: activeCrewId, betId })
      applyCommandPayload(payload)
    })
  }

  const handleCastDisputeVote = (betId: string, optionId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await castDisputeVote({ crewId: activeCrewId, betId, optionId })
      applyCommandPayload(payload)
    })
  }

  const handleSettle = (_entry: unknown) => {
    // Settlement confirmation UI is planned — for now this is a placeholder.
  }

  const handleStartNight = (nightName?: string, nightThemeOverride?: DrinkTheme) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await mutateApp('startNight', {
        crewId: activeCrewId,
        name: nightName?.trim() || (activeCrew ? `Tonight at ${activeCrew.name}` : 'Tonight'),
        drinkThemeOverride: nightThemeOverride,
      })
      applyCommandPayload(payload)
      if (nightThemeOverride) {
        setActiveDrinkTheme(nightThemeOverride)
      }
    })
  }

  // Remove current user from night participants. If they're the last one, close the night.
  const handleLeaveNight = () => {
    if (!activeCrewId || !session || !activeCrew?.currentNight) return
    void runMutation(async () => {
      const payload = await mutateApp('leaveNight', { crewId: activeCrewId, nightId: activeCrew.currentNight!.id })
      applyCommandPayload(payload)
    })
  }

  // Rejoin an active night
  const handleRejoinNight = () => {
    if (!activeCrewId || !session || !activeCrew?.currentNight) return
    void runMutation(async () => {
      const payload = await mutateApp('rejoinNight', { crewId: activeCrewId, nightId: activeCrew.currentNight!.id })
      applyCommandPayload(payload)
    })
  }

  if (!isAuthReady || (session && (!isDataReady || isRouteRestorePending))) {
    return (
      <main className="min-h-screen bg-background">
        <LoadingSpinner
          message={loadingCopy?.message ?? 'Checking your tab…'}
          submessage={loadingCopy?.submessage ?? 'Restoring your session'}
          className="min-h-screen"
        />
      </main>
    )
  }

  if (!session) {
    return (
      <>
        <OnboardingScreen
          authNotice={authNotice}
          isSubmitting={isAuthSubmitting}
          submittingMode={authSubmittingMode}
          isSupabaseConfigured={supabaseConfigured}
          configError={supabaseConfigError}
          onGuestJoin={handleGuestJoin}
          onGoogleAuth={() => handleGoogleAuth()}
          devAuthIdentities={devAuthEnabled ? DEV_AUTH_IDENTITIES : []}
          onDevAuth={devAuthEnabled ? handleDevAuth : undefined}
        />
        {isAuthSubmitting && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <LoadingSpinner
              message={
                authSubmittingMode === 'guest'
                  ? 'Joining your crew…'
                  : authSubmittingMode === 'dev'
                  ? 'Signing you in…'
                  : 'Opening Google…'
              }
              submessage={
                authSubmittingMode === 'guest'
                  ? 'Setting up your guest tab'
                  : authSubmittingMode === 'dev'
                  ? 'Starting your local test session'
                  : 'Handing off to Google sign-in'
              }
            />
          </div>
        )}
      </>
    )
  }

  if (view === 'home') {
    return (
      <HomeScreen
        user={session.user}
        userEmail={session.email}
        isGuest={session.isGuest}
        crews={visibleCrews}
        crewNetPositions={crewNetPositions}
        onSelectCrew={handleSelectCrew}
        onCreateCrew={handleCreateCrew}
        onJoinCrew={handleJoinCrew}
        notifications={notifications}
        onMarkRead={() => { void handleMarkNotificationsRead() }}
        onOpenNotification={handleOpenNotification}
        onSignOut={handleSignOut}
        showDevBattleSandbox={devAuthEnabled && session.provider === 'dev'}
        onCreateDevBattleSandbox={handleCreateDevBattleSandbox}
        isSigningOut={isSigningOut}
        isMutating={isMutating}
        mutationError={mutationError}
        onDismissError={() => setMutationError(null)}
        onFinishAccount={session.isGuest ? handleFinishAccount : undefined}
      />
    )
  }

  if (!activeCrew) {
    return (
      <main className="min-h-screen bg-background">
        <LoadingSpinner
          message="Restoring your tab…"
          submessage="Opening the same crew view"
          className="min-h-screen"
        />
      </main>
    )
  }

  const tonightNet = activeCrewData ? getNetPosition(session.user.id, activeCrewData.tonightLedger) : 0

  return (
    <CurrentUserProvider user={session.user}>
    <main className="min-h-screen bg-background">
      <AppHeader
        crewName={activeCrew.name}
        nightName={activeCrew.currentNight?.name}
        nightStatus={activeCrew.currentNight?.status}
        netPosition={tonightNet}
        userName={session.user.name}
        userEmail={session.email}
        isGuest={session.isGuest}
        notifications={notifications}
        onBack={handleBackToHome}
        onLeave={handleLeaveCrew}
        onSignOut={handleSignOut}
        onFinishAccount={session.isGuest ? handleFinishAccount : undefined}
        onOpenProfile={handleOpenProfile}
        onMarkNotificationsRead={() => { void handleMarkNotificationsRead() }}
        onOpenNotification={handleOpenNotification}
        isSigningOut={isSigningOut}
      />

      {activeCrew.currentNight && (
        <div className="pt-4">
          <PendingInviteBanners
            night={activeCrew.currentNight}
            onSelectBet={handleSelectBet}
            onSelectBeerBombMatch={handleSelectBeerBombMatch}
            onBetOfferAccept={handleBetOfferAccept}
            onBetOfferDecline={handleBetOfferDecline}
            onBeerBombAccept={handleBeerBombAccept}
            onBeerBombDecline={handleBeerBombDecline}
          />
        </div>
      )}

      <div className={activeCrew.currentNight ? 'pt-3' : 'pt-4'}>
        {activeTab === 'tonight' && activeNightWithMiniGames && (
          <TonightScreen
            night={activeNightWithMiniGames}
            selectedBetId={selectedBetId}
            selectedBeerBombMatchId={selectedBeerBombMatchId}
            onSelectBet={handleSelectBet}
            onSelectBeerBombMatch={handleSelectBeerBombMatch}
            onWager={handleWager}
            onBetOfferAccept={handleBetOfferAccept}
            onBetOfferDecline={handleBetOfferDecline}
            onBeerBombAccept={handleBeerBombAccept}
            onBeerBombDecline={handleBeerBombDecline}
            onBeerBombCancel={handleBeerBombCancel}
            onBeerBombTurn={handleBeerBombTurn}
            onProposeResult={handleProposeResult}
            onConfirmResult={handleConfirmResult}
            onDisputeResult={handleDisputeResult}
            onCastDisputeVote={handleCastDisputeVote}
            showPendingInviteBanners={false}
          />
        )}

        {activeTab === 'tonight' && !activeCrew.currentNight && (
          <div className="pb-24 px-4">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-surface border-2 border-border flex items-center justify-center mb-4">
                <span className="text-2xl">🌙</span>
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">No active night</h2>
              <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
                Start a night to begin creating bets and tracking the drinks ledger.
              </p>
              <button
                onClick={() => handleTabChange('crew')}
                className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-display font-normal border-2 border-border shadow-brutal-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
              >
                Start tonight's tab
              </button>
            </div>
          </div>
        )}

        {activeTab === 'ledger' && activeCrewData && (
          <LedgerScreen
            tonightLedger={activeCrewData.tonightLedger}
            allTimeLedger={activeCrewData.allTimeLedger}
            onSettle={handleSettle}
          />
        )}

        {activeTab === 'leaderboard' && activeCrewData && (
          <LeaderboardScreen leaderboard={activeCrewData.leaderboard} />
        )}

        {activeTab === 'crew' && (
          <CrewScreen
                crew={activeCrew}
                currentUserId={session.user.id}
                currentMembershipId={session.user.membershipId ?? null}
                isThemeSaving={Boolean(activeCrewId && pendingCrewThemeById[activeCrewId])}
                onStartNight={handleStartNight}
                onLeaveNight={handleLeaveNight}
                onRejoinNight={handleRejoinNight}
                onRenameCrew={handleRenameCrew}
                onKickMember={handleKickMember}
                onDeleteCrew={handleDeleteCrew}
                onLeaveCrew={handleLeaveCrew}
                onChangeDrinkTheme={handleChangeDrinkTheme}
              />
        )}
      </div>

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} onCreateBet={handleOpenCreateBet} />


      <CreateBetModal
        isOpen={showCreateBet}
        onClose={() => setShowCreateBet(false)}
        onCreate={handleCreateBet}
        onCreateMiniGame={handleCreateMiniGameChallenge}
        members={activeCrew?.members ?? visibleCrews[0]?.members ?? [session.user]}
      />

      <ProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        userName={session.user.name}
        userEmail={session.email}
        userInitials={session.user.initials || session.user.name.slice(0, 2).toUpperCase()}
        isGuest={session.isGuest}
        crews={visibleCrews.map((crew) => ({
          name: crew.name,
          netPosition: crewNetPositions[crew.id] ?? 0,
        }))}
        stats={{
          totalBetsPlaced: visibleCrews.reduce((sum, crew) => {
            const nights = crew.pastNights.length + (crew.currentNight ? 1 : 0)
            return sum + nights * 3 // mock estimate
          }, 0),
          totalWins: 12,
          winRate: 0.58,
          totalDrinksWon: Object.values(crewNetPositions).reduce((sum, net) => sum + Math.max(0, net), 0),
          totalDrinksLost: Object.values(crewNetPositions).reduce((sum, net) => sum + Math.abs(Math.min(0, net)), 0),
          bestNight: 5.4,
          currentStreak: 2,
        }}
        onSignOut={handleSignOut}
        onFinishAccount={session.isGuest ? handleFinishAccount : undefined}
        onUpdateName={handleUpdateName}
        isSigningOut={isSigningOut}
      />

      {isMutating && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <LoadingSpinner
            message={
              isCreatingCrew
                ? 'Creating your crew…'
                : isJoiningCrew
                ? 'Joining your crew…'
                : 'One sec…'
            }
            submessage={
              isCreatingCrew
                ? 'Getting things ready'
                : isJoiningCrew
                ? 'Finding the right crew'
                : undefined
            }
          />
        </div>
      )}
    </main>
    </CurrentUserProvider>
  )
}
