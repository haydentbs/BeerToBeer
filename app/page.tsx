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
  respondToMiniGameChallenge,
  takeMiniGameTurn,
} from '@/lib/client/app-api'
import type { AppMutationPayload, ClaimableGuest } from '@/lib/server/domain'

type AppView = 'home' | 'crew'
const PENDING_GUEST_CLAIM_KEY = 'beerscore_pending_guest_claim'
const ACTIVE_CREW_KEY = 'beerscore_active_crew'
const ACTIVE_TAB_KEY = 'beerscore_active_tab'

function getSavedCrewId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ACTIVE_CREW_KEY)
}

function getSavedTab(): 'tonight' | 'ledger' | 'leaderboard' | 'crew' {
  if (typeof window === 'undefined') return 'tonight'
  const tab = window.localStorage.getItem(ACTIVE_TAB_KEY)
  if (tab === 'tonight' || tab === 'ledger' || tab === 'leaderboard' || tab === 'crew') return tab
  return 'tonight'
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
  const [view, setView] = useState<AppView>(() => getSavedCrewId() ? 'crew' : 'home')
  const [activeCrewId, setActiveCrewId] = useState<string | null>(() => getSavedCrewId())
  const [activeTab, setActiveTab] = useState<'tonight' | 'ledger' | 'leaderboard' | 'crew'>(() => getSavedTab())
  const [showCreateBet, setShowCreateBet] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [crews, setCrews] = useState<Crew[]>([])
  const [crewDataById, setCrewDataById] = useState<Record<string, { tonightLedger: any[]; allTimeLedger: any[]; leaderboard: any[] }>>({})
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [claimableGuests, setClaimableGuests] = useState<ClaimableGuest[]>([])
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [isDataReady, setIsDataReady] = useState(false)
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
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
      setView('home')
      setActiveCrewId(null)
      return
    }

    setSession(buildAppSession(authUser))
    setView('home')
  }, [])

  const applyAppPayload = useCallback((payload: AppMutationPayload) => {
    setCrews(payload.crews)
    setCrewDataById(payload.crewDataById)
    setNotifications(payload.notifications)
    setClaimableGuests(payload.claimableGuests ?? [])
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

      setSession(guestSession)
      setIsDataReady(false)
      setView('home')
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

  const activeCrew = crews.find((crew) => crew.id === activeCrewId)
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

  // Persist active crew and tab to localStorage so refreshes restore the view
  useEffect(() => {
    if (activeCrewId) {
      window.localStorage.setItem(ACTIVE_CREW_KEY, activeCrewId)
    } else {
      window.localStorage.removeItem(ACTIVE_CREW_KEY)
    }
    window.localStorage.setItem(ACTIVE_TAB_KEY, activeTab)
  }, [activeCrewId, activeTab])

  // If we restored a crew from localStorage but it's not in the user's crew list, reset to home
  useEffect(() => {
    if (isDataReady && activeCrewId && !crews.find((c) => c.id === activeCrewId)) {
      setActiveCrewId(null)
      setView('home')
      setActiveDrinkTheme('beer')
    }
  }, [isDataReady, activeCrewId, crews, setActiveDrinkTheme])

  const crewNetPositions = useMemo(() => {
    const positions: Record<string, number> = {}
    crews.forEach((crew) => {
      const data = crewDataById[crew.id]
      if (data) {
        positions[crew.id] = session ? getNetPosition(session.user.id, data.allTimeLedger) : 0
      } else {
        positions[crew.id] = 0
      }
    })
    return positions
  }, [crewDataById, crews, session])

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
      const joinedCrew = payload.crews.find((crew) => crew.inviteCode === normalizedCrewCode) ?? payload.crews[0]
      if (joinedCrew) {
        setActiveCrewId(joinedCrew.id)
        setActiveTab('tonight')
        setView('crew')
        setActiveDrinkTheme(joinedCrew.currentNight?.drinkThemeOverride ?? joinedCrew.drinkTheme ?? 'beer')
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

  const handleSelectCrew = (crewId: string) => {
    setActiveCrewId(crewId)
    setActiveTab('tonight')
    setView('crew')
    // Apply night theme override if active, otherwise crew's drink theme
    const crew = crews.find((c) => c.id === crewId)
    const effectiveTheme = crew?.currentNight?.drinkThemeOverride ?? crew?.drinkTheme ?? 'beer'
    setActiveDrinkTheme(effectiveTheme)
  }

  const handleBackToHome = () => {
    setActiveCrewId(null)
    setView('home')
    setActiveDrinkTheme('beer')
  }

  const handleCreateCrew = async (name: string) => {
    setIsMutating(true)
    setMutationError(null)
    try {
      const payload = await mutateApp('createCrew', { name })
      applyAppPayload(payload)
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Could not create crew.')
    } finally {
      setIsMutating(false)
    }
  }

  const handleJoinCrew = async (code: string) => {
    setIsMutating(true)
    setMutationError(null)
    try {
      const payload = await mutateApp('joinCrew', { code })
      applyAppPayload(payload)
      const normalizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
      const joinedCrew = payload.crews.find((crew) => crew.inviteCode === normalizedCode)
      if (joinedCrew) {
        handleSelectCrew(joinedCrew.id)
      }
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Crew code not found.')
    } finally {
      setIsMutating(false)
    }
  }

  const handleLeaveCrew = () => {
    if (activeCrewId) {
      void mutateApp('leaveCrew', { crewId: activeCrewId }).then((payload) => {
        applyAppPayload(payload)
      })
      handleBackToHome()
    }
  }

  const handleRenameCrew = (name: string) => {
    if (activeCrewId) {
      void mutateApp('renameCrew', { crewId: activeCrewId, name }).then(applyAppPayload)
    }
  }

  const handleKickMember = (memberId: string) => {
    if (activeCrewId) {
      void mutateApp('kickMember', { crewId: activeCrewId, memberId }).then(applyAppPayload)
    }
  }

  const handleDeleteCrew = () => {
    if (activeCrewId) {
      void mutateApp('deleteCrew', { crewId: activeCrewId }).then(applyAppPayload)
      handleBackToHome()
    }
  }

  const handleChangeDrinkTheme = (theme: DrinkTheme) => {
    if (activeCrewId) {
      void mutateApp('changeDrinkTheme', { crewId: activeCrewId, theme }).then(applyAppPayload)
      setActiveDrinkTheme(theme)
    }
  }

  const handleWager = (betId: string, optionId: string, drinks: number) => {
    if (!activeCrewId || !session) {
      return
    }

    void mutateApp('placeWager', { crewId: activeCrewId, betId, optionId, drinks }).then(applyAppPayload)
  }

  const handleCreateBet = (betInput: CreateBetInput) => {
    if (!activeCrewId || !session) {
      return
    }

    if (!activeCrew?.currentNight) {
      return
    }

    const challengerMembershipId =
      betInput.challenger && activeCrew
        ? getCrewMemberMembershipId(activeCrew.members.find((member) => member.id === betInput.challenger?.id)) ?? undefined
        : undefined

    void mutateApp('createBet', {
      crewId: activeCrewId,
      nightId: activeCrew.currentNight.id,
      type: betInput.type,
      subtype: betInput.subtype,
      title: betInput.title,
      options: betInput.options,
      line: betInput.line,
      closeTime: betInput.closeTime,
      wager: betInput.wager ?? 0,
      initialOptionIndex: betInput.initialOptionIndex ?? 0,
      challengerMembershipId,
    }).then(applyAppPayload)
  }

  const handleCreateMiniGameChallenge = async (challengeInput: CreateMiniGameInput) => {
    if (!activeCrewId || !session || !activeCrew?.currentNight) {
      return
    }

    const opponentMember = activeCrew.members.find((member) => member.id === challengeInput.opponent.id)
    if (!opponentMember) {
      return
    }

    const opponentMembershipId = getCrewMemberMembershipId(opponentMember)
    if (!opponentMembershipId) {
      return
    }

    const payload = await createMiniGameChallenge({
      crewId: activeCrewId,
      nightId: activeCrew.currentNight.id,
      title: challengeInput.title,
      opponentMembershipId,
      wager: challengeInput.wager,
      closeTime: challengeInput.closeTime,
      boardSize: challengeInput.boardSize ?? 8,
    })
    applyAppPayload(payload)
  }

  const handleBeerBombAccept = async (matchId: string) => {
    if (!activeCrewId) return

    const payload = await respondToMiniGameChallenge({
      crewId: activeCrewId,
      matchId,
      accepted: true,
    })
    applyAppPayload(payload)
  }

  const handleBeerBombDecline = async (matchId: string) => {
    if (!activeCrewId) return

    const payload = await respondToMiniGameChallenge({
      crewId: activeCrewId,
      matchId,
      accepted: false,
    })
    applyAppPayload(payload)
  }

  const handleBeerBombCancel = async (matchId: string) => {
    if (!activeCrewId) return

    const payload = await cancelMiniGameChallenge({
      crewId: activeCrewId,
      matchId,
    })
    applyAppPayload(payload)
  }

  const handleBeerBombTurn = async (matchId: string, slotIndex: number) => {
    if (!activeCrewId) return

    const payload = await takeMiniGameTurn({
      crewId: activeCrewId,
      matchId,
      slotIndex,
    })
    applyAppPayload(payload)
  }

  const handleSettle = (_entry: unknown) => {
    // Mock UI only for now.
  }

  const handleStartNight = async (nightName?: string, nightThemeOverride?: DrinkTheme) => {
    if (!activeCrewId) {
      return
    }

    setIsMutating(true)
    try {
      const payload = await mutateApp('startNight', {
        crewId: activeCrewId,
        name: nightName?.trim() || (activeCrew ? `Tonight at ${activeCrew.name}` : 'Tonight'),
        drinkThemeOverride: nightThemeOverride,
      })
      applyAppPayload(payload)

      if (nightThemeOverride) {
        setActiveDrinkTheme(nightThemeOverride)
      }
    } finally {
      setIsMutating(false)
    }
  }

  // Remove current user from night participants. If they're the last one, close the night.
  const handleLeaveNight = () => {
    if (!activeCrewId || !session || !activeCrew?.currentNight) return
    void mutateApp('leaveNight', { crewId: activeCrewId, nightId: activeCrew.currentNight.id }).then(applyAppPayload)
  }

  // Rejoin an active night
  const handleRejoinNight = () => {
    if (!activeCrewId || !session || !activeCrew?.currentNight) return
    void mutateApp('rejoinNight', { crewId: activeCrewId, nightId: activeCrew.currentNight.id }).then(applyAppPayload)
  }

  if (!isAuthReady || (session && !isDataReady)) {
    return (
      <main className="min-h-screen bg-background">
        <LoadingSpinner
          message="Checking your tab…"
          submessage="Restoring your session"
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

  if (view === 'home' || !activeCrew) {
    return (
      <HomeScreen
        user={session.user}
        userEmail={session.email}
        crews={crews}
        crewNetPositions={crewNetPositions}
        onSelectCrew={handleSelectCrew}
        onCreateCrew={handleCreateCrew}
        onJoinCrew={handleJoinCrew}
        onSignOut={handleSignOut}
        isSigningOut={isSigningOut}
        isMutating={isMutating}
        mutationError={mutationError}
        onDismissError={() => setMutationError(null)}
      />
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
        onOpenProfile={() => setShowProfile(true)}
        onMarkNotificationsRead={() => { void handleMarkNotificationsRead() }}
        isSigningOut={isSigningOut}
      />

      <div className="pt-4">
        {activeTab === 'tonight' && activeNightWithMiniGames && (
          <TonightScreen
            night={activeNightWithMiniGames}
            onWager={handleWager}
            onBeerBombAccept={handleBeerBombAccept}
            onBeerBombDecline={handleBeerBombDecline}
            onBeerBombCancel={handleBeerBombCancel}
            onBeerBombTurn={handleBeerBombTurn}
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
                onClick={() => setActiveTab('crew')}
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

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} onCreateBet={() => setShowCreateBet(true)} />


      <CreateBetModal
        isOpen={showCreateBet}
        onClose={() => setShowCreateBet(false)}
        onCreate={handleCreateBet}
        onCreateMiniGame={handleCreateMiniGameChallenge}
        members={activeCrew?.members ?? crews[0]?.members ?? [session.user]}
      />

      <ProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        userName={session.user.name}
        userEmail={session.email}
        userInitials={session.user.initials || session.user.name.slice(0, 2).toUpperCase()}
        isGuest={session.isGuest}
        crews={crews.map((crew) => ({
          name: crew.name,
          netPosition: getNetPosition(session.user.id, crewDataById[crew.id]?.allTimeLedger ?? []),
        }))}
        stats={{
          totalBetsPlaced: crews.reduce((sum, crew) => {
            const nights = crew.pastNights.length + (crew.currentNight ? 1 : 0)
            return sum + nights * 3 // mock estimate
          }, 0),
          totalWins: 12,
          winRate: 0.58,
          totalDrinksWon: crews.reduce((sum, crew) => {
            const net = getNetPosition(session.user.id, crewDataById[crew.id]?.allTimeLedger ?? [])
            return sum + Math.max(0, net)
          }, 0),
          totalDrinksLost: crews.reduce((sum, crew) => {
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
