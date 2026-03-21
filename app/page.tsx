'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { fetchBootstrapState, joinGuest, mutateApp } from '@/lib/client/app-api'
import type { AppMutationPayload, ClaimableGuest } from '@/lib/server/domain'

type AppView = 'home' | 'crew'
const PENDING_GUEST_CLAIM_KEY = 'beerscore_pending_guest_claim'

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
  title: string
  options: Array<{ label: string }>
  challenger?: { id: string } | undefined
  wager?: number
  closeTime: number
}

export default function BeerScoreApp() {
  const [session, setSession] = useState<AppSession | null>(null)
  const [view, setView] = useState<AppView>('home')
  const [activeCrewId, setActiveCrewId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'tonight' | 'ledger' | 'leaderboard' | 'crew'>('tonight')
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

  const activeCrew = crews.find((crew) => crew.id === activeCrewId)
  const activeCrewData = activeCrewId ? crewDataById[activeCrewId] : null

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

  const handleCreateCrew = (name: string) => {
    void mutateApp('createCrew', { name }).then(applyAppPayload)
  }

  const handleJoinCrew = (code: string) => {
    void mutateApp('joinCrew', { code }).then((payload) => {
      applyAppPayload(payload)
      const normalizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
      const joinedCrew = payload.crews.find((crew) => crew.inviteCode === normalizedCode)
      if (joinedCrew) {
        handleSelectCrew(joinedCrew.id)
      }
    })
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

    const initialOptionIndex = betInput.type === 'h2h'
      ? 0
      : 0

    void mutateApp('createBet', {
      crewId: activeCrewId,
      nightId: activeCrew.currentNight.id,
      type: betInput.type,
      title: betInput.title,
      options: betInput.options,
      closeTime: betInput.closeTime,
      wager: betInput.wager ?? 0,
      initialOptionIndex,
      challengerMembershipId,
    }).then(applyAppPayload)
  }

  const handleSettle = (_entry: unknown) => {
    // Mock UI only for now.
  }

  const handleStartNight = (nightThemeOverride?: DrinkTheme) => {
    if (!activeCrewId) {
      return
    }

    void mutateApp('startNight', {
      crewId: activeCrewId,
      name: activeCrew ? `Tonight at ${activeCrew.name}` : 'Tonight',
      drinkThemeOverride: nightThemeOverride,
    }).then(applyAppPayload)

    // Apply night theme override if set
    if (nightThemeOverride) {
      setActiveDrinkTheme(nightThemeOverride)
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
      <main className="min-h-screen bg-background px-6 py-12">
        <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center text-center">
          <div className="mb-4 h-14 w-14 animate-pulse rounded-2xl border-3 border-border bg-primary/20" />
          <h1 className="text-2xl text-foreground">Checking your tab</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Restoring your BeerScore session and verifying it with Supabase.
          </p>
        </div>
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
        {activeTab === 'tonight' && activeCrew.currentNight && (
          <TonightScreen night={activeCrew.currentNight} onWager={handleWager} />
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
                onClick={() => handleStartNight()}
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
        isSigningOut={isSigningOut}
      />
    </main>
    </CurrentUserProvider>
  )
}
