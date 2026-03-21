'use client'

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import type { Session as SupabaseSession, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js'
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthSubmittingMode = 'guest' | 'google' | 'dev' | null

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

export interface AppStateValue {
  // Auth & session
  session: AppSession | null
  isAuthReady: boolean
  isDataReady: boolean
  isAuthSubmitting: boolean
  authSubmittingMode: AuthSubmittingMode
  isSigningOut: boolean
  authNotice: string | null
  loadingCopy: { message: string; submessage?: string } | null

  // Auth actions
  handleGoogleAuth: (opts?: { preserveGuestSession?: boolean }) => Promise<AuthActionResult>
  handleGuestJoin: (name: string, crewCode: string) => Promise<AuthActionResult>
  handleDevAuth: (identityId: string) => Promise<AuthActionResult>
  handleSignOut: () => Promise<void>
  handleFinishAccount: () => Promise<void>
  handleUpdateName: (name: string) => Promise<void>
  devAuthEnabled: boolean
  supabaseConfigured: boolean
  supabaseConfigError: string | null

  // Crews
  crews: Crew[]
  visibleCrews: Crew[]
  crewNetPositions: Record<string, number>
  crewDataById: Record<string, { tonightLedger: any[]; allTimeLedger: any[]; leaderboard: any[] }>
  notifications: Notification[]

  // Active crew management
  activeCrewId: string | null
  setActiveCrewId: (id: string | null) => void

  // Crew actions
  handleCreateCrew: (name: string) => Promise<boolean>
  handleJoinCrew: (code: string) => Promise<boolean>
  handleLeaveCrew: () => void
  handleRenameCrew: (name: string) => void
  handleKickMember: (memberId: string) => void
  handleDeleteCrew: () => void
  handleChangeDrinkTheme: (theme: DrinkTheme) => void
  isCreatingCrew: boolean
  isJoiningCrew: boolean

  // Night actions
  handleStartNight: (nightName?: string, nightThemeOverride?: DrinkTheme) => void
  handleLeaveNight: () => void
  handleRejoinNight: () => void

  // Bet actions
  handleCreateBet: (betInput: CreateBetInput) => void
  handleWager: (betId: string, optionId: string, drinks: number) => void
  handleProposeResult: (betId: string, optionId: string) => void
  handleConfirmResult: (betId: string) => void
  handleDisputeResult: (betId: string) => void
  handleCastDisputeVote: (betId: string, optionId: string) => void
  handleBetOfferAccept: (betId: string) => void
  handleBetOfferDecline: (betId: string) => void

  // Mini game actions
  handleCreateMiniGameChallenge: (input: CreateMiniGameInput) => void
  handleBeerBombAccept: (matchId: string) => void
  handleBeerBombDecline: (matchId: string) => void
  handleBeerBombCancel: (matchId: string) => void
  handleBeerBombTurn: (matchId: string, slotIndex: number) => Promise<void>

  // Modal state
  showCreateBet: boolean
  setShowCreateBet: (v: boolean) => void
  showProfile: boolean
  setShowProfile: (v: boolean) => void
  selectedBetId: string | null
  setSelectedBetId: (id: string | null) => void
  selectedBeerBombMatchId: string | null
  setSelectedBeerBombMatchId: (id: string | null) => void
  handleOpenCreateBet: () => void
  handleOpenProfile: () => void
  handleSelectBet: (betId: string | null) => void
  handleSelectBeerBombMatch: (matchId: string | null) => void

  // Notifications
  handleMarkNotificationsRead: () => Promise<void>
  handleOpenNotification: (notification: Notification) => void

  // Mutation state
  isMutating: boolean
  mutationError: string | null
  setMutationError: (error: string | null) => void

  // Settle
  handleSettle: (entry: unknown) => void

  // Dev
  showDevBattleSandbox: boolean
  handleCreateDevBattleSandbox: () => Promise<boolean>
}

const AppStateContext = createContext<AppStateValue | null>(null)

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext)
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider')
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PENDING_GUEST_CLAIM_KEY = 'beerscore_pending_guest_claim'

function hasOAuthCallbackParams() {
  if (typeof window === 'undefined') return false
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
  if (typeof window === 'undefined') return null
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
    if (session?.user) return session
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  return null
}

function getPendingGuestClaimFlag() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(PENDING_GUEST_CLAIM_KEY) === '1'
}

function setPendingGuestClaimFlag(value: boolean) {
  if (typeof window === 'undefined') return
  if (value) {
    window.localStorage.setItem(PENDING_GUEST_CLAIM_KEY, '1')
    return
  }
  window.localStorage.removeItem(PENDING_GUEST_CLAIM_KEY)
}

function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppStateProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  const [session, setSession] = useState<AppSession | null>(null)
  const [activeCrewId, setActiveCrewId] = useState<string | null>(null)
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
  const [isCreatingCrew, setIsCreatingCrew] = useState(false)
  const [isJoiningCrew, setIsJoiningCrew] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)

  // Modal state
  const [showCreateBet, setShowCreateBet] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [selectedBetId, setSelectedBetId] = useState<string | null>(null)
  const [selectedBeerBombMatchId, setSelectedBeerBombMatchId] = useState<string | null>(null)

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

  // -------------------------------------------------------------------------
  // Payload application helpers
  // -------------------------------------------------------------------------

  const applyViewerUser = useCallback((viewerUser?: SessionResponse['actor'] | CrewSnapshotResponse['viewerUser'] | null) => {
    if (!viewerUser) return
    setSession((current) => {
      if (!current) return current
      const nextUser = { ...current.user, ...viewerUser }
      const userUnchanged =
        current.user.id === nextUser.id &&
        current.user.membershipId === nextUser.membershipId &&
        current.user.role === nextUser.role &&
        current.user.name === nextUser.name &&
        current.user.avatar === nextUser.avatar &&
        current.user.initials === nextUser.initials
      if (userUnchanged) return current
      return { ...current, user: nextUser }
    })
  }, [])

  const applySessionPayload = useCallback((payload: SessionResponse) => {
    setCrews((current) => {
      const currentById = new Map(current.map((crew) => [crew.id, crew]))
      return payload.crews.map((summaryCrew) => {
        const existing = currentById.get(summaryCrew.id)
        if (!existing) return summaryCrew
        const sameCurrentNight =
          existing.currentNight &&
          summaryCrew.currentNight &&
          existing.currentNight.id === summaryCrew.currentNight.id
        const mergedCrew: Crew = {
          ...summaryCrew,
          currentNight: sameCurrentNight
            ? { ...existing.currentNight, ...summaryCrew.currentNight } as Crew['currentNight']
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
        if (existingIndex === -1) return current
        return current.filter((crew) => crew.id !== payload.crewId)
      }
      const nextCrew = {
        ...payload.crew,
        currentNightOpenBetCount: payload.crew.currentNight?.bets.filter((bet) => bet.status === 'open').length ?? payload.crew.currentNightOpenBetCount ?? 0,
      }
      if (existingIndex === -1) return [...current, nextCrew]
      const next = current.slice()
      next[existingIndex] = nextCrew
      return next
    })
    setCrewDataById((current) => {
      if (!payload.crew) {
        if (!(payload.crewId in current)) return current
        const next = { ...current }
        delete next[payload.crewId]
        return next
      }
      return { ...current, [payload.crewId]: payload.ledger }
    })
    setCrewCursorById((current) => ({ ...current, [payload.crewId]: payload.cursor }))
    setNotifications(payload.notifications ?? [])
    applyViewerUser(payload.viewerUser ?? null)
    setPendingCrewThemeById((current) => {
      if (!Object.keys(current).length || !payload.crew) return current
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
    if (payload.changed.session) applySessionPayload(payload.changed.session)
    if (payload.changed.snapshot) applyCrewSnapshot(payload.changed.snapshot)
  }, [applyCrewSnapshot, applySessionPayload])

  const visibleCrews = useMemo(() => {
    if (!Object.keys(pendingCrewThemeById).length) return crews
    return crews.map((crew) => {
      const pendingTheme = pendingCrewThemeById[crew.id]
      if (!pendingTheme) return crew
      return { ...crew, drinkTheme: pendingTheme }
    })
  }, [crews, pendingCrewThemeById])

  // -------------------------------------------------------------------------
  // Auth initialization
  // -------------------------------------------------------------------------

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
      setActiveCrewId(null)
      return
    }
    setSession(buildAppSession(authUser))
    setPendingCrewThemeById({})
  }, [])

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
      if (!guestSession) return false
      setSession(guestSession)
      setIsDataReady(false)
      setAuthNotice(null)
      return true
    }

    const restoreDevSession = () => {
      const identity = readDevAuthCookie()
      if (!identity) return false
      setSession(buildDevAuthenticatedSession(identity))
      setIsDataReady(false)
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
        if (!isMounted) return
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

      if (!isMounted) return

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

      if (!isMounted) return

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
      if (!isMounted) return
      if (nextSession?.user) {
        if (!getPendingGuestClaimFlag()) clearGuestSessionCookie()
        applyAuthenticatedUser(nextSession.user)
        setAuthNotice(null)
      } else if (
        !(event === 'INITIAL_SESSION' && hasOAuthCallbackParams()) &&
        !restoreDevSession() &&
        !restoreGuestSession()
      ) {
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

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!session || isDataReady) setLoadingCopy(null)
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
          // If we're on a crew page, load that crew's data
          if (activeCrewId) {
            const snapshot = await fetchCrewSnapshotState(activeCrewId)
            if (!cancelled) applyCrewSnapshot(snapshot)
          }
        }
      } catch (error) {
        if (!cancelled) {
          setAuthNotice(error instanceof Error ? error.message : 'Could not load your BeerScore data.')
        }
      } finally {
        if (!cancelled) setIsDataReady(true)
      }
    }

    void loadState()
    return () => { cancelled = true }
  }, [applyCrewSnapshot, applySessionPayload, sessionLoadKey])

  // Load crew snapshot when active crew changes
  useEffect(() => {
    if (!session || !activeCrewId || !isDataReady || crewDataById[activeCrewId]) return

    let cancelled = false
    const loadSnapshot = async () => {
      try {
        const snapshot = await fetchCrewSnapshotState(activeCrewId)
        if (!cancelled) applyCrewSnapshot(snapshot)
      } catch {
        // Best-effort
      }
    }
    void loadSnapshot()
    return () => { cancelled = true }
  }, [activeCrewId, applyCrewSnapshot, crewDataById, isDataReady, session])

  // Polling for active crew
  const activeCrew = visibleCrews.find((crew) => crew.id === activeCrewId)
  const hasActiveNight = Boolean(activeCrew?.currentNight)
  const activeCrewCursor = activeCrewId ? crewCursorById[activeCrewId] ?? null : null

  useEffect(() => {
    if (!session || !activeCrewId || !isDataReady || activeCrewCursor == null) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const intervalMs = hasActiveNight ? 8000 : 15000

    const scheduleNextPoll = (delay: number) => {
      if (cancelled) return
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => { void poll() }, delay)
    }

    const poll = async () => {
      if (cancelled) return
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
                if (!cancelled) applyCrewSnapshot(snapshot)
              })
              return
            }
            applyCommandPayload(payload)
          })
        }
      } catch {
        // Best-effort
      } finally {
        isCrewPollInFlightRef.current = false
        scheduleNextPoll(intervalMs)
      }
    }

    const handleVisibilityChange = () => {
      if (cancelled || typeof document === 'undefined' || document.visibilityState !== 'visible') return
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }
      if (!isCrewPollInFlightRef.current) void poll()
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
    void poll()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [
    activeCrew?.currentNight?.status,
    activeCrewCursor,
    activeCrewId,
    applyCommandPayload,
    applyCrewSnapshot,
    crewCursorById,
    hasActiveNight,
    isDataReady,
    session,
  ])

  // Auth ready timeout
  useEffect(() => {
    if (isAuthReady) return
    const timeoutId = window.setTimeout(() => {
      setAuthNotice((c) => c ?? 'Supabase session check timed out. You can still continue with Google or join as a guest.')
      setIsAuthReady(true)
    }, 5000)
    return () => window.clearTimeout(timeoutId)
  }, [isAuthReady])

  // Data ready timeout
  useEffect(() => {
    if (!session || isDataReady) return
    const timeoutId = window.setTimeout(() => {
      setAuthNotice((c) => c ?? 'BeerScore is taking longer than usual to load your crews. Showing what we have so far.')
      setIsDataReady(true)
    }, 5000)
    return () => window.clearTimeout(timeoutId)
  }, [isDataReady, session])

  // Apply drink theme when active crew changes
  useEffect(() => {
    if (!activeCrew) return
    setActiveDrinkTheme(activeCrew.currentNight?.drinkThemeOverride ?? activeCrew.drinkTheme ?? 'beer')
  }, [activeCrew, setActiveDrinkTheme])

  // Clean up stale selected bet/match
  useEffect(() => {
    if (!activeCrewId || !selectedBetId) return
    const betStillExists = Boolean(
      visibleCrews.find((c) => c.id === activeCrewId)?.currentNight?.bets.some((b) => b.id === selectedBetId)
    )
    if (!betStillExists) setSelectedBetId(null)
  }, [activeCrewId, selectedBetId, visibleCrews])

  useEffect(() => {
    if (!activeCrewId || !selectedBeerBombMatchId) return
    const matchStillExists = Boolean(
      visibleCrews.find((c) => c.id === activeCrewId)?.currentNight?.miniGameMatches.some((m) => m.id === selectedBeerBombMatchId)
    )
    if (!matchStillExists) setSelectedBeerBombMatchId(null)
  }, [activeCrewId, selectedBeerBombMatchId, visibleCrews])

  // -------------------------------------------------------------------------
  // Mutation wrapper
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Auth handlers
  // -------------------------------------------------------------------------

  const handleGoogleAuth = async ({ preserveGuestSession = false }: { preserveGuestSession?: boolean } = {}): Promise<AuthActionResult> => {
    if (!supabaseConfigured) return { error: supabaseConfigError ?? 'Supabase is not configured.' }
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
      if (error) return { error: error.message }
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
    setLoadingCopy({ message: 'Joining your crew…', submessage: 'Setting up your guest tab' })
    try {
      clearDevAuthCookie()
      const payload = await joinGuest(name, crewCode)
      if (!payload.session) return { error: 'Guest session could not be created.' }
      setSession(payload.session)
      applyCommandPayload(payload)
      const joinedCrewId = payload.crewId ?? payload.changed.snapshot?.crewId ?? null
      setIsDataReady(true)
      setLoadingCopy(null)
      if (joinedCrewId) {
        setActiveCrewId(joinedCrewId)
        router.push(`/crew/${joinedCrewId}/tonight`)
      }
      setAuthNotice(null)
      return { message: `Playing as ${payload.session.user.name}.` }
    } catch (error) {
      setLoadingCopy(null)
      return { error: error instanceof Error ? error.message : 'Crew code not found.' }
    } finally {
      setIsAuthSubmitting(false)
      setAuthSubmittingMode(null)
    }
  }

  const handleDevAuth = async (identityId: string): Promise<AuthActionResult> => {
    if (!devAuthEnabled) return { error: 'Dev auth is only available in local development.' }
    const identity = getDevAuthIdentity(identityId)
    if (!identity) return { error: 'That dev identity is no longer available.' }
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
      setActiveCrewId(null)
      router.push('/')
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
      router.push('/')
      return
    }
    if (!supabaseConfigured) {
      applyAuthenticatedUser(null)
      router.push('/')
      return
    }
    setIsSigningOut(true)
    setAuthNotice(null)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signOut()
      if (error) setAuthNotice(error.message)
      router.push('/')
    } finally {
      setIsSigningOut(false)
    }
  }

  const handleFinishAccount = async () => {
    await handleGoogleAuth({ preserveGuestSession: true })
  }

  const handleUpdateName = async (name: string) => {
    try {
      const payload = await mutateApp('updateProfile', { name })
      applyCommandPayload(payload)
    } catch {
      // Best-effort
    }
  }

  const handleMarkNotificationsRead = async () => {
    const payload = await mutateApp('markNotificationsRead', {})
    applyCommandPayload(payload)
  }

  // -------------------------------------------------------------------------
  // Modal handlers
  // -------------------------------------------------------------------------

  const clearRestorableModalState = useCallback(() => {
    setShowCreateBet(false)
    setShowProfile(false)
    setSelectedBetId(null)
    setSelectedBeerBombMatchId(null)
  }, [])

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
    if (!targetCrewId) return

    const targetCrew = visibleCrews.find((crew) => crew.id === targetCrewId)
    clearRestorableModalState()
    setActiveCrewId(targetCrewId)
    setActiveDrinkTheme(targetCrew?.currentNight?.drinkThemeOverride ?? targetCrew?.drinkTheme ?? 'beer')

    if (notification.payload.matchId) {
      setSelectedBeerBombMatchId(notification.payload.matchId)
      router.push(`/crew/${targetCrewId}/tonight`)
      return
    }
    if (notification.payload.betId) {
      setSelectedBetId(notification.payload.betId)
    }
    router.push(`/crew/${targetCrewId}/tonight`)
  }, [clearRestorableModalState, router, setActiveDrinkTheme, visibleCrews])

  // -------------------------------------------------------------------------
  // Crew handlers
  // -------------------------------------------------------------------------

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
        setActiveCrewId(createdCrewId)
        router.push(`/crew/${createdCrewId}/tonight`)
      }
    }, 'Could not create crew.')
    setIsCreatingCrew(false)
    return didCreateCrew
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
        setActiveCrewId(joinedCrewId)
        router.push(`/crew/${joinedCrewId}/tonight`)
      }
    }, 'Crew code not found.')
    setIsJoiningCrew(false)
    return didJoinCrew
  }

  const handleLeaveCrew = () => {
    if (!activeCrewId) return
    const crewId = activeCrewId
    setActiveCrewId(null)
    setActiveDrinkTheme('beer')
    clearRestorableModalState()
    router.push('/')
    void runMutation(async () => {
      const payload = await mutateApp('leaveCrew', { crewId })
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
    const crewId = activeCrewId
    setActiveCrewId(null)
    setActiveDrinkTheme('beer')
    clearRestorableModalState()
    router.push('/')
    void runMutation(async () => {
      const payload = await mutateApp('deleteCrew', { crewId })
      applyCommandPayload(payload)
    })
  }

  const handleChangeDrinkTheme = (theme: DrinkTheme) => {
    if (!activeCrewId) return
    const crewId = activeCrewId
    const previousTheme = activeCrew?.currentNight?.drinkThemeOverride ?? activeCrew?.drinkTheme ?? 'beer'
    setPendingCrewThemeById((current) => ({ ...current, [crewId]: theme }))
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

  // -------------------------------------------------------------------------
  // Night handlers
  // -------------------------------------------------------------------------

  const handleStartNight = (nightName?: string, nightThemeOverride?: DrinkTheme) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await mutateApp('startNight', {
        crewId: activeCrewId,
        name: nightName?.trim() || (activeCrew ? `Tonight at ${activeCrew.name}` : 'Tonight'),
        drinkThemeOverride: nightThemeOverride,
      })
      applyCommandPayload(payload)
      if (nightThemeOverride) setActiveDrinkTheme(nightThemeOverride)
    })
  }

  const handleLeaveNight = () => {
    if (!activeCrewId || !session || !activeCrew?.currentNight) return
    void runMutation(async () => {
      const payload = await mutateApp('leaveNight', { crewId: activeCrewId, nightId: activeCrew.currentNight!.id })
      applyCommandPayload(payload)
    })
  }

  const handleRejoinNight = () => {
    if (!activeCrewId || !session || !activeCrew?.currentNight) return
    void runMutation(async () => {
      const payload = await mutateApp('rejoinNight', { crewId: activeCrewId, nightId: activeCrew.currentNight!.id })
      applyCommandPayload(payload)
    })
  }

  // -------------------------------------------------------------------------
  // Bet handlers
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Mini game handlers
  // -------------------------------------------------------------------------

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
      if (createdMatch) setSelectedBeerBombMatchId(createdMatch.id)
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

  const handleBeerBombTurn = async (matchId: string, slotIndex: number) => {
    if (!activeCrewId) return
    const payload = await takeMiniGameTurn({ crewId: activeCrewId, matchId, slotIndex })
    applyCommandPayload(payload)
  }

  const handleSettle = (_entry: unknown) => {
    // Settlement confirmation UI is planned — placeholder
  }

  // -------------------------------------------------------------------------
  // Dev sandbox
  // -------------------------------------------------------------------------

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
      if (!createdCrewId) throw new Error('Could not find the sandbox crew after creating it.')

      const startPayload = await mutateApp('startNight', { crewId: createdCrewId, name: nightName })
      applyCommandPayload(startPayload)
      setActiveCrewId(createdCrewId)
      router.push(`/crew/${createdCrewId}/manage`)
    }, 'Could not create the dev battle sandbox.')
  }

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------

  const value: AppStateValue = useMemo(() => ({
    session,
    isAuthReady,
    isDataReady,
    isAuthSubmitting,
    authSubmittingMode,
    isSigningOut,
    authNotice,
    loadingCopy,
    handleGoogleAuth,
    handleGuestJoin,
    handleDevAuth,
    handleSignOut,
    handleFinishAccount,
    handleUpdateName,
    devAuthEnabled,
    supabaseConfigured,
    supabaseConfigError,
    crews,
    visibleCrews,
    crewNetPositions,
    crewDataById,
    notifications,
    activeCrewId,
    setActiveCrewId,
    handleCreateCrew,
    handleJoinCrew,
    handleLeaveCrew,
    handleRenameCrew,
    handleKickMember,
    handleDeleteCrew,
    handleChangeDrinkTheme,
    isCreatingCrew,
    isJoiningCrew,
    handleStartNight,
    handleLeaveNight,
    handleRejoinNight,
    handleCreateBet,
    handleWager,
    handleProposeResult,
    handleConfirmResult,
    handleDisputeResult,
    handleCastDisputeVote,
    handleBetOfferAccept,
    handleBetOfferDecline,
    handleCreateMiniGameChallenge,
    handleBeerBombAccept,
    handleBeerBombDecline,
    handleBeerBombCancel,
    handleBeerBombTurn,
    showCreateBet,
    setShowCreateBet,
    showProfile,
    setShowProfile,
    selectedBetId,
    setSelectedBetId,
    selectedBeerBombMatchId,
    setSelectedBeerBombMatchId,
    handleOpenCreateBet,
    handleOpenProfile,
    handleSelectBet,
    handleSelectBeerBombMatch,
    handleMarkNotificationsRead,
    handleOpenNotification,
    isMutating,
    mutationError,
    setMutationError,
    handleSettle,
    showDevBattleSandbox: devAuthEnabled && session?.provider === 'dev',
    handleCreateDevBattleSandbox,
  }), [
    session,
    isAuthReady,
    isDataReady,
    isAuthSubmitting,
    authSubmittingMode,
    isSigningOut,
    authNotice,
    loadingCopy,
    devAuthEnabled,
    supabaseConfigured,
    supabaseConfigError,
    crews,
    visibleCrews,
    crewNetPositions,
    crewDataById,
    notifications,
    activeCrewId,
    isCreatingCrew,
    isJoiningCrew,
    showCreateBet,
    showProfile,
    selectedBetId,
    selectedBeerBombMatchId,
    isMutating,
    mutationError,
    handleOpenNotification,
    clearRestorableModalState,
    applyCommandPayload,
    runMutation,
  ])

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  )
}
