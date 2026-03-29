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
  type LeaderboardEntry,
  type LedgerEntry,
  type Notification,
} from '@/lib/store'
import { useTheme } from '@/components/theme-provider'
import type { BeerBombMatch, BeerBombTurnResult } from '@/components/beer-bomb-match-modal'
import type { DrinkTheme } from '@/lib/themes'
import {
  cancelMiniGameChallenge,
  castDisputeVote,
  claimMiniGameInvite,
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
import type { ClaimableGuest } from '@/lib/server/domain'
import type { CommandResponse, CrewFeedResponse, CrewSnapshotResponse, SessionResponse } from '@/lib/server/v2/domain'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthSubmittingMode = 'guest' | 'google' | 'dev' | null

interface BeerBombMatchUpdate {
  matchId: string
  status?: BeerBombMatch['status']
  revealedSlotIndices?: number[]
  currentTurnMembershipId?: string | null
  winnerMembershipId?: string | null
  loserMembershipId?: string | null
  agreedWager?: number | null
  acceptedAt?: string | Date | null
  declinedAt?: string | Date | null
  cancelledAt?: string | Date | null
  completedAt?: string | Date | null
  updatedAt?: string | Date | null
  bombSlotIndex?: number
}

interface MiniGameMatchRealtimeRow {
  id: string
  status: BeerBombMatch['status']
  revealed_slots?: unknown
  current_turn_membership_id?: string | null
  winner_membership_id?: string | null
  loser_membership_id?: string | null
  agreed_wager?: number | string | null
  accepted_at?: string | null
  declined_at?: string | null
  cancelled_at?: string | null
  completed_at?: string | null
  updated_at?: string | null
  hidden_slot_index?: number | null
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
  opponent: { id?: string; name: string; isExternal?: boolean }
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
  handleGuestJoin: (name: string, crewCode: string, options?: { matchId?: string }) => Promise<AuthActionResult>
  handleDevAuth: (identityId: string) => Promise<AuthActionResult>
  handleSignOut: () => Promise<void>
  handleFinishAccount: () => Promise<void>
  handleClaimGuest: (guestMembershipId: string) => Promise<boolean>
  handleUpdateName: (name: string) => Promise<void>
  devAuthEnabled: boolean
  supabaseConfigured: boolean
  supabaseConfigError: string | null

  // Crews
  crews: Crew[]
  visibleCrews: Crew[]
  crewNetPositions: Record<string, number>
  crewDataById: Record<string, { tonightLedger: LedgerEntry[]; allTimeLedger: LedgerEntry[]; leaderboard: LeaderboardEntry[] }>
  notifications: Notification[]
  claimableGuests: ClaimableGuest[]

  // Active crew management
  activeCrewId: string | null
  setActiveCrewId: (id: string | null) => void

  // Crew actions
  handleCreateCrew: (name: string) => Promise<boolean>
  handleJoinCrew: (code: string, options?: { redirectToCrew?: boolean }) => Promise<boolean>
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
  handleBeerBombTurn: (matchId: string, slotIndex: number) => Promise<BeerBombTurnResult | void>
  handleClaimMiniGameInvite: (matchId: string, crewId: string) => Promise<boolean>

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
  claimingGuestMembershipId: string | null

  // Settle
  handleSettle: (entry: LedgerEntry, drinks: number) => void

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

const PENDING_GUEST_CLAIM_KEY = 'settleup_pending_guest_claim'

function normalizeRevealedSlotIndices(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry >= 0)
}

export function mapMiniGameMatchRowToUpdate(row: MiniGameMatchRealtimeRow): BeerBombMatchUpdate {
  return {
    matchId: row.id,
    status: row.status,
    revealedSlotIndices: normalizeRevealedSlotIndices(row.revealed_slots),
    currentTurnMembershipId: row.current_turn_membership_id ?? null,
    winnerMembershipId: row.winner_membership_id ?? null,
    loserMembershipId: row.loser_membership_id ?? null,
    agreedWager: row.agreed_wager != null ? Number(row.agreed_wager) : null,
    acceptedAt: row.accepted_at ?? null,
    declinedAt: row.declined_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
    completedAt: row.completed_at ?? null,
    updatedAt: row.updated_at ?? null,
    bombSlotIndex: row.hidden_slot_index ?? undefined,
  }
}

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
  const [crewDataById, setCrewDataById] = useState<Record<string, { tonightLedger: LedgerEntry[]; allTimeLedger: LedgerEntry[]; leaderboard: LeaderboardEntry[] }>>({})
  const [crewCursorById, setCrewCursorById] = useState<Record<string, number>>({})
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [claimableGuests, setClaimableGuests] = useState<ClaimableGuest[]>([])
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
  const [claimingGuestMembershipId, setClaimingGuestMembershipId] = useState<string | null>(null)
  const [isPendingGuestClaimInFlight, setIsPendingGuestClaimInFlight] = useState(false)

  // Modal state
  const [showCreateBet, setShowCreateBet] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [selectedBetId, setSelectedBetId] = useState<string | null>(null)
  const [selectedBeerBombMatchId, setSelectedBeerBombMatchId] = useState<string | null>(null)

  const isCrewPollInFlightRef = useRef(false)
  const isRealtimeSnapshotInFlightRef = useRef(false)
  const isForegroundRefreshInFlightRef = useRef(false)
  const lastForegroundRefreshAtRef = useRef(0)
  const pendingGuestClaimMembershipIdRef = useRef<string | null>(null)
  const applySessionPayloadRef = useRef<(payload: SessionResponse) => void>(() => {})
  const applyCrewSnapshotRef = useRef<(payload: CrewSnapshotResponse) => void>(() => {})
  const applyCommandPayloadRef = useRef<(payload: CommandResponse | CrewFeedResponse) => void>(() => {})
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
    setClaimableGuests(payload.claimableGuests ?? [])
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

  // Keep refs in sync so effects can use stable references
  applySessionPayloadRef.current = applySessionPayload
  applyCrewSnapshotRef.current = applyCrewSnapshot
  applyCommandPayloadRef.current = applyCommandPayload

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
      setClaimableGuests([])
      setPendingCrewThemeById({})
      setShowCreateBet(false)
      setShowProfile(false)
      setSelectedBetId(null)
      setSelectedBeerBombMatchId(null)
      setActiveCrewId(null)
      setClaimingGuestMembershipId(null)
      setIsPendingGuestClaimInFlight(false)
      pendingGuestClaimMembershipIdRef.current = null
      return
    }
    setSession(buildAppSession(authUser))
    setClaimableGuests([])
    setClaimingGuestMembershipId(null)
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

  useEffect(() => {
    if (!session || session.isGuest || !getPendingGuestClaimFlag()) {
      setIsPendingGuestClaimInFlight(false)
      return
    }

    const guestSession = readGuestSessionCookie()
    const guestMembershipId = guestSession?.membershipId ?? null
    const guestIdentityId = guestSession?.guestIdentityId ?? null

    if (!guestMembershipId || !guestIdentityId) {
      setPendingGuestClaimFlag(false)
      pendingGuestClaimMembershipIdRef.current = null
      return
    }

    if (pendingGuestClaimMembershipIdRef.current === guestMembershipId) {
      return
    }

    pendingGuestClaimMembershipIdRef.current = guestMembershipId

    let cancelled = false

    setIsPendingGuestClaimInFlight(true)
    setIsDataReady(false)
    setClaimingGuestMembershipId(guestMembershipId)
    setLoadingCopy({
      message: 'Claiming your guest history…',
      submessage: 'Keeping your crews and stats together',
    })

    void mutateApp('claimGuestMembership', {
      guestMembershipId,
      guestIdentityId,
      source: 'guest-upgrade',
    })
      .then((payload) => {
        if (cancelled) return
        applyCommandPayloadRef.current(payload)
        clearGuestSessionCookie()
        setPendingGuestClaimFlag(false)
        setAuthNotice(null)
      })
      .catch((error) => {
        if (cancelled) return
        setPendingGuestClaimFlag(false)
        setAuthNotice(error instanceof Error ? error.message : 'Could not claim your guest history yet.')
      })
      .finally(() => {
        if (cancelled) return
        setIsPendingGuestClaimInFlight(false)
        setClaimingGuestMembershipId((current) => current === guestMembershipId ? null : current)
        setLoadingCopy(null)
        pendingGuestClaimMembershipIdRef.current = null
      })

    return () => {
      cancelled = true
    }
  }, [sessionLoadKey])

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

    if (isPendingGuestClaimInFlight) {
      setIsDataReady(false)
      return
    }

    let cancelled = false

    const loadState = async () => {
      setIsDataReady(false)
      try {
        const payload = await fetchSessionState()
        if (!cancelled) {
          applySessionPayloadRef.current(payload)
          // If we're on a crew page, load that crew's data
          if (activeCrewId) {
            const snapshot = await fetchCrewSnapshotState(activeCrewId)
            if (!cancelled) applyCrewSnapshotRef.current(snapshot)
          }
        }
      } catch (error) {
        if (!cancelled) {
          setAuthNotice(error instanceof Error ? error.message : 'Could not load your SettleUp data.')
        }
      } finally {
        if (!cancelled) setIsDataReady(true)
      }
    }

    void loadState()
    return () => { cancelled = true }
  }, [isPendingGuestClaimInFlight, sessionLoadKey])

  // Load crew snapshot when active crew changes
  useEffect(() => {
    if (!session || !activeCrewId || !isDataReady || crewDataById[activeCrewId]) return

    let cancelled = false
    const loadSnapshot = async () => {
      try {
        const snapshot = await fetchCrewSnapshotState(activeCrewId)
        if (!cancelled) applyCrewSnapshotRef.current(snapshot)
      } catch {
        // Best-effort
      }
    }
    void loadSnapshot()
    return () => { cancelled = true }
  }, [activeCrewId, crewDataById, isDataReady, session])

  useEffect(() => {
    if (!session || !isDataReady) return

    let cancelled = false
    const minRefreshGapMs = 1500

    const refreshForegroundData = async () => {
      if (cancelled || isForegroundRefreshInFlightRef.current) return

      const now = Date.now()
      if (now - lastForegroundRefreshAtRef.current < minRefreshGapMs) return

      isForegroundRefreshInFlightRef.current = true
      lastForegroundRefreshAtRef.current = now

      try {
        const sessionPayload = await fetchSessionState()
        if (cancelled) return

        startTransition(() => {
          applySessionPayloadRef.current(sessionPayload)
        })

        if (activeCrewId) {
          const snapshot = await fetchCrewSnapshotState(activeCrewId)
          if (cancelled) return

          startTransition(() => {
            applyCrewSnapshotRef.current(snapshot)
          })
        }
      } catch {
        // Best-effort; keep cached data on screen.
      } finally {
        isForegroundRefreshInFlightRef.current = false
      }
    }

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void refreshForegroundData()
      }
    }

    const handleFocus = () => {
      void refreshForegroundData()
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus)
      window.addEventListener('pageshow', handleFocus)
    }

    return () => {
      cancelled = true
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus)
        window.removeEventListener('pageshow', handleFocus)
      }
    }
  }, [activeCrewId, isDataReady, session])

  // Polling for active crew
  const activeCrew = visibleCrews.find((crew) => crew.id === activeCrewId)
  const hasActiveNight = Boolean(activeCrew?.currentNight)
  const activeCrewCursor = activeCrewId ? crewCursorById[activeCrewId] ?? null : null

  // -------------------------------------------------------------------------
  // Beer Bomb broadcast channel — instant match updates via WebSocket
  // -------------------------------------------------------------------------
  const beerBombChannelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null)

  // Helper: merge match update fields into crews state
  const applyBeerBombMatchUpdate = useCallback((matchUpdate: BeerBombMatchUpdate) => {
    if (!matchUpdate?.matchId) return
    startTransition(() => {
      setCrews((current) =>
        current.map((crew) => {
          if (!crew.currentNight) return crew
          const matchIndex = (crew.currentNight.miniGameMatches ?? []).findIndex(
            (m: any) => m.id === matchUpdate.matchId
          )
          if (matchIndex === -1) return crew

          const existing = (crew.currentNight.miniGameMatches as any[])[matchIndex]
          const updated = {
            ...existing,
            status: matchUpdate.status ?? existing.status,
            revealedSlotIndices: matchUpdate.revealedSlotIndices ?? existing.revealedSlotIndices,
            currentTurnMembershipId: matchUpdate.currentTurnMembershipId ?? existing.currentTurnMembershipId,
            winnerMembershipId: matchUpdate.winnerMembershipId ?? existing.winnerMembershipId,
            loserMembershipId: matchUpdate.loserMembershipId ?? existing.loserMembershipId,
            agreedWager: matchUpdate.agreedWager != null ? Number(matchUpdate.agreedWager) : existing.agreedWager,
            acceptedAt: matchUpdate.acceptedAt ? new Date(matchUpdate.acceptedAt) : existing.acceptedAt,
            completedAt: matchUpdate.completedAt ? new Date(matchUpdate.completedAt) : existing.completedAt,
            declinedAt: matchUpdate.declinedAt ? new Date(matchUpdate.declinedAt) : existing.declinedAt,
            cancelledAt: matchUpdate.cancelledAt ? new Date(matchUpdate.cancelledAt) : existing.cancelledAt,
            updatedAt: matchUpdate.updatedAt ? new Date(matchUpdate.updatedAt) : new Date(),
            bombSlotIndex: matchUpdate.bombSlotIndex ?? existing.bombSlotIndex,
          }

          const nextMatches = [...crew.currentNight.miniGameMatches as any[]]
          nextMatches[matchIndex] = updated
          return {
            ...crew,
            currentNight: { ...crew.currentNight, miniGameMatches: nextMatches },
          }
        })
      )
    })
  }, [])

  // Subscribe to the selected beer bomb match via DB Realtime updates.
  useEffect(() => {
    const matchId = selectedBeerBombMatchId
    if (!matchId || !supabaseConfigured) {
      if (beerBombChannelRef.current) {
        const supabase = getSupabaseBrowserClient()
        void supabase.removeChannel(beerBombChannelRef.current)
        beerBombChannelRef.current = null
      }
      return
    }

    const supabase = getSupabaseBrowserClient()
    let cancelled = false

    const channel = supabase
      .channel(`beer-bomb-db:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mini_game_matches',
          filter: `id=eq.${matchId}`,
        },
        (payload: any) => {
          if (!cancelled && payload?.new) {
            applyBeerBombMatchUpdate(mapMiniGameMatchRowToUpdate(payload.new as MiniGameMatchRealtimeRow))
          }
        }
      )
      .subscribe()

    beerBombChannelRef.current = channel

    return () => {
      cancelled = true
      beerBombChannelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [selectedBeerBombMatchId, supabaseConfigured, applyBeerBombMatchUpdate])

  useEffect(() => {
    if (!session || !activeCrewId || !isDataReady || activeCrewCursor == null) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    // Poll faster when a beer bomb match is actively being played
    const hasActiveMiniGame = Boolean(
      activeCrew?.currentNight?.miniGameMatches?.some((m: any) => m.status === 'active')
    )
    const intervalMs = hasActiveMiniGame ? 3000 : hasActiveNight ? 8000 : 15000

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
                if (!cancelled) applyCrewSnapshotRef.current(snapshot)
              })
              return
            }
            applyCommandPayloadRef.current(payload)
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
      setAuthNotice((c) => c ?? 'SettleUp is taking longer than usual to load your crews. Showing what we have so far.')
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

  const handleGuestJoin = async (name: string, crewCode: string, options?: { matchId?: string }): Promise<AuthActionResult> => {
    setIsAuthSubmitting(true)
    setAuthSubmittingMode('guest')
    setAuthNotice(null)
    setLoadingCopy({ message: 'Joining your crew…', submessage: 'Setting up your guest tab' })
    try {
      clearDevAuthCookie()
      const payload = await joinGuest(name, crewCode, options?.matchId)
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

  const handleClaimGuest = async (guestMembershipId: string) => {
    const guest = claimableGuests.find((entry) => entry.guestMembershipId === guestMembershipId)
    setClaimingGuestMembershipId(guestMembershipId)
    const didClaim = await runMutation(async () => {
      const payload = await mutateApp('claimGuestMembership', {
        guestMembershipId,
        guestIdentityId: guest?.guestIdentityId,
        source: 'manual-claim',
      })
      applyCommandPayload(payload)
    }, 'Could not claim this guest history.')
    setClaimingGuestMembershipId((current) => current === guestMembershipId ? null : current)
    return didClaim
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
    if (!activeCrew?.currentNight) {
      return
    }
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

  const handleJoinCrew = async (code: string, options?: { redirectToCrew?: boolean }) => {
    setIsJoiningCrew(true)
    const existingCrewIds = new Set(crews.map((crew) => crew.id))
    const normalizedCode = normalizeInviteCode(code)
    const shouldRedirectToCrew = options?.redirectToCrew !== false
    const didJoinCrew = await runMutation(async () => {
      const payload = await mutateApp('joinCrew', { code })
      applyCommandPayload(payload)
      const joinedCrewId =
        payload.crewId ??
        payload.changed.session?.crews.find((crew) => !existingCrewIds.has(crew.id))?.id ??
        payload.changed.session?.crews.find((crew) => normalizeInviteCode(crew.inviteCode) === normalizedCode)?.id
      if (joinedCrewId) {
        setActiveCrewId(joinedCrewId)
        if (shouldRedirectToCrew) {
          router.push(`/crew/${joinedCrewId}/tonight`)
        }
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
    const isExternalOpponent = challengeInput.opponent.isExternal || !challengeInput.opponent.id
    const opponentMember = isExternalOpponent
      ? null
      : activeCrew.members.find((member) => member.id === challengeInput.opponent.id)
    const opponentMembershipId = opponentMember ? getCrewMemberMembershipId(opponentMember) : null

    if (!isExternalOpponent && !opponentMembershipId) return

    void runMutation(async () => {
      const payload = await createMiniGameChallenge({
        crewId: activeCrewId,
        nightId: activeCrew.currentNight!.id,
        title: challengeInput.title,
        ...(opponentMembershipId ? { opponentMembershipId } : {}),
        ...(isExternalOpponent ? { externalOpponentName: challengeInput.opponent.name } : {}),
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
          (
            (challengeInput.opponent.id && match.opponent.id === challengeInput.opponent.id) ||
            match.opponent.name === (opponentMember?.name ?? challengeInput.opponent.name)
          )
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
      if (createdMatch) setSelectedBeerBombMatchId(createdMatch.id)
    })
  }

  const handleClaimMiniGameInvite = async (matchId: string, crewId: string) => {
    return runMutation(async () => {
      const payload = await claimMiniGameInvite({ matchId, crewId })
      applyCommandPayload(payload)
      setActiveCrewId(crewId)
    }, 'Could not open this Beer Bomb invite.')
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
    const updatedMatch = payload.changed?.snapshot?.crew?.currentNight?.miniGameMatches?.find((m: any) => m.id === matchId) as BeerBombMatch | undefined
    if (!updatedMatch) return
    return {
      status: updatedMatch.status,
      revealedSlotIndices: updatedMatch.revealedSlotIndices,
      currentTurnMembershipId: updatedMatch.currentTurnMembershipId,
      winnerMembershipId: updatedMatch.winnerMembershipId,
      loserMembershipId: updatedMatch.loserMembershipId,
      bombSlotIndex: updatedMatch.bombSlotIndex,
    }
  }

  const handleSettle = (entry: LedgerEntry, drinks: number) => {
    if (!activeCrewId) return

    const fromMembershipId = getCrewMemberMembershipId(entry.fromUser)
    const toMembershipId = getCrewMemberMembershipId(entry.toUser)

    if (!fromMembershipId || !toMembershipId) return

    void runMutation(async () => {
      const payload = await mutateApp('recordSettlement', {
        crewId: activeCrewId,
        nightId: activeCrew?.currentNight?.id ?? null,
        fromMembershipId,
        toMembershipId,
        drinks,
      })
      applyCommandPayload(payload)
    }, 'Could not record the settlement.')
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
    handleClaimGuest,
    handleUpdateName,
    devAuthEnabled,
    supabaseConfigured,
    supabaseConfigError,
    crews,
    visibleCrews,
    crewNetPositions,
    crewDataById,
    notifications,
    claimableGuests,
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
    handleClaimMiniGameInvite,
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
    claimingGuestMembershipId,
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
    claimableGuests,
    activeCrewId,
    isCreatingCrew,
    isJoiningCrew,
    showCreateBet,
    showProfile,
    selectedBetId,
    selectedBeerBombMatchId,
    isMutating,
    mutationError,
    claimingGuestMembershipId,
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
