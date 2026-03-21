'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
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
  createMiniGameChallenge,
  fetchBootstrapState,
  joinGuest,
  mutateApp,
  respondToBetOffer,
  respondToMiniGameChallenge,
  takeMiniGameTurn,
} from '@/lib/client/app-api'
import type { AppMutationPayload, ClaimableGuest } from '@/lib/server/domain'

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
  closeTime: number
}

interface CreateMiniGameInput {
  title: string
  opponent: { id: string }
  wager: number
  closeTime: number
  boardSize?: number
}

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
  const [crewDataById, setCrewDataById] = useState<Record<string, { tonightLedger: any[]; allTimeLedger: any[]; leaderboard: any[] }>>({})
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [claimableGuests, setClaimableGuests] = useState<ClaimableGuest[]>([])
  const [pendingCrewThemeById, setPendingCrewThemeById] = useState<Record<string, DrinkTheme>>({})
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [isDataReady, setIsDataReady] = useState(false)
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [isRouteRestorePending, setIsRouteRestorePending] = useState(() => Boolean(getSavedRouteState().crewId))
  const [isCreatingCrew, setIsCreatingCrew] = useState(false)
  const [isJoiningCrew, setIsJoiningCrew] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [claimingGuestMembershipId, setClaimingGuestMembershipId] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const supabaseConfigured = isSupabaseConfigured()
  const supabaseConfigError = getSupabaseConfigError()
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
      setCrewDataById({})
      setNotifications([])
      setClaimableGuests([])
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

  const applyAppPayload = useCallback((payload: AppMutationPayload) => {
    setCrews(payload.crews)
    setCrewDataById(payload.crewDataById)
    setNotifications(payload.notifications)
    setClaimableGuests(payload.claimableGuests ?? [])
    setPendingCrewThemeById((current) => {
      if (!Object.keys(current).length) {
        return current
      }

      const next = { ...current }
      for (const crew of payload.crews) {
        if (next[crew.id] && next[crew.id] === (crew.drinkTheme ?? 'beer')) {
          delete next[crew.id]
        }
      }

      return next
    })
    if (payload.viewerUser) {
      setSession((current) => {
        if (!current) {
          return current
        }

        const nextUser = {
          ...current.user,
          ...payload.viewerUser,
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
    }
  }, [])

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

    if (!supabaseConfigured) {
      restoreGuestSession()
      setIsAuthReady(true)
      return
    }

    const supabase = getSupabaseBrowserClient()

    const restoreSession = async () => {
      setIsAuthReady(false)
      authFallbackTimer = setTimeout(() => {
        if (!isMounted) {
          return
        }

        if (!restoreGuestSession()) {
          applyAuthenticatedUser(null)
        }
        setAuthNotice('Supabase session check timed out. You can still continue with Google or join as a guest.')
        setIsAuthReady(true)
      }, 3000)

      const {
        data: { session: restoredSession },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      if (sessionError) {
        clearAuthFallback()
        setAuthNotice(sessionError.message)
        if (!restoreGuestSession()) {
          applyAuthenticatedUser(null)
        }
        setIsAuthReady(true)
        return
      }

      if (!restoredSession?.user) {
        clearAuthFallback()
        if (!restoreGuestSession()) {
          applyAuthenticatedUser(null)
        }
        setIsAuthReady(true)
        return
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (!isMounted) {
        return
      }

      if (userError || !user) {
        clearAuthFallback()
        setAuthNotice(userError?.message ?? 'Your session could not be verified. Please sign in again.')
        await supabase.auth.signOut()
        if (!restoreGuestSession()) {
          applyAuthenticatedUser(null)
        }
        setIsAuthReady(true)
        return
      }

      if (!getPendingGuestClaimFlag()) {
        clearGuestSessionCookie()
      }
      applyAuthenticatedUser(user)
      setAuthNotice(null)
      clearAuthFallback()
      setIsAuthReady(true)
    }

    void restoreSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return
      }

      if (nextSession?.user) {
        if (!getPendingGuestClaimFlag()) {
          clearGuestSessionCookie()
        }
        applyAuthenticatedUser(nextSession.user)
      } else if (!restoreGuestSession()) {
        applyAuthenticatedUser(null)
      }

      setIsAuthReady(true)
    })

    return () => {
      isMounted = false
      clearAuthFallback()
      subscription.unsubscribe()
    }
  }, [applyAuthenticatedUser, supabaseConfigured])

  useEffect(() => {
    if (!session) {
      setIsDataReady(true)
      return
    }

    let cancelled = false

    const loadState = async () => {
      setIsDataReady(false)

      try {
        const payload = await fetchBootstrapState()
        if (!cancelled) {
          applyAppPayload(payload)
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
  }, [applyAppPayload, sessionLoadKey])

  const activeCrew = visibleCrews.find((crew) => crew.id === activeCrewId)
  const hasLiveMiniGameMatch = Boolean(
    activeCrew?.currentNight?.miniGameMatches.some((match) => match.status === 'pending' || match.status === 'active')
  )

  useEffect(() => {
    if (!session || view !== 'crew' || !activeCrewId) {
      return
    }

    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    const poll = async () => {
      try {
        const payload = await fetchBootstrapState()
        if (!cancelled) {
          applyAppPayload(payload)
        }
      } catch {
        // Best-effort polling only; local Beer Bomb state stays live even if the refresh fails.
      }
    }

    const intervalMs = activeTab === 'tonight' && hasLiveMiniGameMatch ? 2500 : 8000

    intervalId = setInterval(() => {
      void poll()
    }, intervalMs)

    return () => {
      cancelled = true
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [activeCrewId, activeTab, applyAppPayload, hasLiveMiniGameMatch, session, view])

  useEffect(() => {
    if (!session || session.isGuest || !getPendingGuestClaimFlag()) {
      return
    }

    const guestSession = readGuestSessionCookie()
    if (!guestSession?.membershipId) {
      setPendingGuestClaimFlag(false)
      return
    }

    let cancelled = false

    const claimGuestHistory = async () => {
      setClaimingGuestMembershipId(guestSession.membershipId ?? null)

      try {
        const payload = await mutateApp('claimGuestMembership', {
          guestMembershipId: guestSession.membershipId,
          guestIdentityId: guestSession.guestIdentityId,
          source: 'guest-upgrade',
        })

        if (cancelled) {
          return
        }

        applyAppPayload(payload)
        const claimedCrew = payload.crews[0]
        if (claimedCrew) {
          setActiveCrewId((current) => current ?? claimedCrew.id)
        }
        setAuthNotice(`Claimed your guest stats from ${guestSession.user.name}.`)
        clearGuestSessionCookie()
      } catch (error) {
        if (!cancelled) {
          setAuthNotice(error instanceof Error ? error.message : 'We could not claim your guest stats automatically.')
        }
      } finally {
        if (!cancelled) {
          setPendingGuestClaimFlag(false)
          setClaimingGuestMembershipId(null)
        }
      }
    }

    void claimGuestHistory()

    return () => {
      cancelled = true
    }
  }, [applyAppPayload, session])

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

  const crewNetPositions = useMemo(() => {
    const positions: Record<string, number> = {}
    visibleCrews.forEach((crew) => {
      const data = crewDataById[crew.id]
      if (data) {
        positions[crew.id] = session ? getNetPosition(session.user.id, data.allTimeLedger) : 0
      } else {
        positions[crew.id] = 0
      }
    })
    return positions
  }, [crewDataById, session, visibleCrews])

  const activeCrewData = activeCrewId ? crewDataById[activeCrewId] : null
  const activeNightWithMiniGames = activeCrew?.currentNight ?? null

  const handleGoogleAuth = async ({ preserveGuestSession = false }: { preserveGuestSession?: boolean } = {}): Promise<AuthActionResult> => {
    if (!supabaseConfigured) {
      return { error: supabaseConfigError ?? 'Supabase is not configured.' }
    }

    setIsAuthSubmitting(true)
    setAuthNotice(null)
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
    }
  }

  const handleGuestJoin = async (name: string, crewCode: string): Promise<AuthActionResult> => {
    try {
      const payload = await joinGuest(name, crewCode)
      if (!payload.session) {
        return { error: 'Guest session could not be created.' }
      }

      setSession(payload.session)
      applyAppPayload(payload)
      const normalizedCrewCode = crewCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
      const joinedCrew =
        payload.crews.find((crew) => normalizeInviteCode(crew.inviteCode) === normalizedCrewCode) ?? payload.crews[0]
      if (joinedCrew) {
        handleSelectCrew(joinedCrew.id)
      }
      setAuthNotice(null)
      return { message: `Playing as ${payload.session.user.name}${joinedCrew ? ` in ${joinedCrew.name}` : ''}.` }
    } catch (error) {
      setView('home')
      return { error: error instanceof Error ? error.message : 'Crew code not found.' }
    }
  }

  const handleSignOut = async () => {
    setPendingGuestClaimFlag(false)
    clearGuestSessionCookie()

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
    applyAppPayload(payload)
  }

  const handleFinishAccount = async () => {
    await handleGoogleAuth({ preserveGuestSession: true })
  }

  const handleUpdateName = async (name: string) => {
    try {
      const payload = await mutateApp('updateProfile', { name })
      applyAppPayload(payload)
    } catch {
      // Best-effort name update
    }
  }

  const handleClaimGuest = async (guestMembershipId: string) => {
    setClaimingGuestMembershipId(guestMembershipId)

    try {
      const payload = await mutateApp('claimGuestMembership', {
        guestMembershipId,
        source: 'manual-claim',
      })
      applyAppPayload(payload)
      setAuthNotice('Guest stats claimed.')
    } catch (error) {
      setAuthNotice(error instanceof Error ? error.message : 'We could not claim that guest right now.')
    } finally {
      setClaimingGuestMembershipId(null)
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
      applyAppPayload(payload)

      const createdCrew =
        payload.crews.find((crew) => !existingCrewIds.has(crew.id)) ??
        payload.crews.find((crew) => crew.name === name.trim())

      if (createdCrew) {
        handleSelectCrew(createdCrew.id)
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
      applyAppPayload(payload)

      const joinedCrew =
        payload.crews.find((crew) => !existingCrewIds.has(crew.id)) ??
        payload.crews.find((crew) => normalizeInviteCode(crew.inviteCode) === normalizedCode)

      if (joinedCrew) {
        handleSelectCrew(joinedCrew.id)
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
      applyAppPayload(payload)
    })
  }

  const handleRenameCrew = (name: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await mutateApp('renameCrew', { crewId: activeCrewId, name })
      applyAppPayload(payload)
    })
  }

  const handleKickMember = (memberId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await mutateApp('kickMember', { crewId: activeCrewId, memberId })
      applyAppPayload(payload)
    })
  }

  const handleDeleteCrew = () => {
    if (!activeCrewId) return
    handleBackToHome()
    void runMutation(async () => {
      const payload = await mutateApp('deleteCrew', { crewId: activeCrewId })
      applyAppPayload(payload)
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
        applyAppPayload(payload)
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
      applyAppPayload(payload)
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
        closeTime: betInput.closeTime,
        wager: betInput.wager ?? 0,
        initialOptionIndex: betInput.initialOptionIndex ?? 0,
        challengerMembershipId,
      })
      applyAppPayload(payload)
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
      applyAppPayload(payload)
    })
  }

  const handleBeerBombAccept = (matchId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await respondToMiniGameChallenge({ crewId: activeCrewId, matchId, accepted: true })
      applyAppPayload(payload)
    })
  }

  const handleBeerBombDecline = (matchId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await respondToMiniGameChallenge({ crewId: activeCrewId, matchId, accepted: false })
      applyAppPayload(payload)
    })
  }

  const handleBeerBombCancel = (matchId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await cancelMiniGameChallenge({ crewId: activeCrewId, matchId })
      applyAppPayload(payload)
    })
  }

  const handleBetOfferAccept = (betId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await respondToBetOffer({ crewId: activeCrewId, betId, accepted: true })
      applyAppPayload(payload)
    })
  }

  const handleBetOfferDecline = (betId: string) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await respondToBetOffer({ crewId: activeCrewId, betId, accepted: false })
      applyAppPayload(payload)
    })
  }

  // Beer Bomb turns are intentionally not wrapped in runMutation — the game board
  // manages its own in-flight state and blocking the full UI would feel jarring mid-game.
  const handleBeerBombTurn = async (matchId: string, slotIndex: number) => {
    if (!activeCrewId) return
    const payload = await takeMiniGameTurn({ crewId: activeCrewId, matchId, slotIndex })
    applyAppPayload(payload)
  }

  const handleSettle = (_entry: unknown) => {
    // Mock UI only for now.
  }

  const handleStartNight = (nightName?: string, nightThemeOverride?: DrinkTheme) => {
    if (!activeCrewId) return
    void runMutation(async () => {
      const payload = await mutateApp('startNight', {
        crewId: activeCrewId,
        name: nightName?.trim() || (activeCrew ? `Tonight at ${activeCrew.name}` : 'Tonight'),
        drinkThemeOverride: nightThemeOverride,
      })
      applyAppPayload(payload)
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
      applyAppPayload(payload)
    })
  }

  // Rejoin an active night
  const handleRejoinNight = () => {
    if (!activeCrewId || !session || !activeCrew?.currentNight) return
    void runMutation(async () => {
      const payload = await mutateApp('rejoinNight', { crewId: activeCrewId, nightId: activeCrew.currentNight!.id })
      applyAppPayload(payload)
    })
  }

  if (!isAuthReady || (session && (!isDataReady || isRouteRestorePending)) || (session && (isCreatingCrew || isJoiningCrew))) {
    return (
      <main className="min-h-screen bg-background">
        <LoadingSpinner
          message={
            isCreatingCrew
              ? 'Creating your crew…'
              : isJoiningCrew
              ? 'Joining your crew…'
              : isRouteRestorePending
              ? 'Restoring your tab…'
              : 'Checking your tab…'
          }
          submessage={
            isCreatingCrew
              ? 'Getting things ready'
              : isJoiningCrew
              ? 'Finding the right crew'
              : isRouteRestorePending
              ? 'Opening the same crew view'
              : 'Restoring your session'
          }
          className="min-h-screen"
        />
      </main>
    )
  }

  if (!session) {
    return (
      <OnboardingScreen
        authNotice={authNotice}
        isSubmitting={isAuthSubmitting}
        isSupabaseConfigured={supabaseConfigured}
        configError={supabaseConfigError}
        onGuestJoin={handleGuestJoin}
        onGoogleAuth={() => handleGoogleAuth()}
      />
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
        isSigningOut={isSigningOut}
        isMutating={isMutating}
        mutationError={mutationError}
        onDismissError={() => setMutationError(null)}
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
          netPosition: getNetPosition(session.user.id, crewDataById[crew.id]?.allTimeLedger ?? []),
        }))}
        stats={{
          totalBetsPlaced: visibleCrews.reduce((sum, crew) => {
            const nights = crew.pastNights.length + (crew.currentNight ? 1 : 0)
            return sum + nights * 3 // mock estimate
          }, 0),
          totalWins: 12,
          winRate: 0.58,
          totalDrinksWon: visibleCrews.reduce((sum, crew) => {
            const net = getNetPosition(session.user.id, crewDataById[crew.id]?.allTimeLedger ?? [])
            return sum + Math.max(0, net)
          }, 0),
          totalDrinksLost: visibleCrews.reduce((sum, crew) => {
            const net = getNetPosition(session.user.id, crewDataById[crew.id]?.allTimeLedger ?? [])
            return sum + Math.abs(Math.min(0, net))
          }, 0),
          bestNight: 5.4,
          currentStreak: 2,
        }}
        claimableGuests={claimableGuests}
        claimingGuestMembershipId={claimingGuestMembershipId}
        onSignOut={handleSignOut}
        onFinishAccount={session.isGuest ? handleFinishAccount : undefined}
        onClaimGuest={!session.isGuest ? handleClaimGuest : undefined}
        onUpdateName={handleUpdateName}
        isSigningOut={isSigningOut}
      />

      {isMutating && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <LoadingSpinner message="One sec…" />
        </div>
      )}
    </main>
    </CurrentUserProvider>
  )
}
