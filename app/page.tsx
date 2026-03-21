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
import {
  buildAppSession,
  buildGuestSession,
  clearGuestSessionCookie,
  readGuestSessionCookie,
  type AppSession,
  writeGuestSessionCookie,
} from '@/lib/auth'
import {
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  isSupabaseConfigured,
} from '@/lib/supabase-client'
import {
  mockCrews,
  mockCrewData,
  mockNotifications,
  currentUser,
  getNetPosition,
  generateCrewCode,
  type Crew,
  type Notification,
} from '@/lib/store'

type AppView = 'home' | 'crew'

interface AuthActionResult {
  error?: string
  message?: string
}

export default function BeerScoreApp() {
  const [session, setSession] = useState<AppSession | null>(null)
  const [view, setView] = useState<AppView>('home')
  const [activeCrewId, setActiveCrewId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'tonight' | 'ledger' | 'leaderboard' | 'crew'>('tonight')
  const [showCreateBet, setShowCreateBet] = useState(false)
  const [crews, setCrews] = useState<Crew[]>(mockCrews)
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const supabaseConfigured = isSupabaseConfigured()
  const supabaseConfigError = getSupabaseConfigError()

  const applyAuthenticatedUser = useCallback((authUser: SupabaseUser | null) => {
    if (!authUser) {
      setSession(null)
      setView('home')
      setActiveCrewId(null)
      return
    }

    setSession(buildAppSession(authUser))
    setView('home')
  }, [])

  useEffect(() => {
    let isMounted = true

    const restoreGuestSession = () => {
      const guestSession = readGuestSessionCookie()

      if (!guestSession) {
        return false
      }

      setSession(guestSession)
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

      const {
        data: { session: restoredSession },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      if (sessionError) {
        setAuthNotice(sessionError.message)
        if (!restoreGuestSession()) {
          applyAuthenticatedUser(null)
        }
        setIsAuthReady(true)
        return
      }

      if (!restoredSession?.user) {
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
        setAuthNotice(userError?.message ?? 'Your session could not be verified. Please sign in again.')
        await supabase.auth.signOut()
        if (!restoreGuestSession()) {
          applyAuthenticatedUser(null)
        }
        setIsAuthReady(true)
        return
      }

      clearGuestSessionCookie()
      applyAuthenticatedUser(user)
      setAuthNotice(null)
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
        clearGuestSessionCookie()
        applyAuthenticatedUser(nextSession.user)
      } else if (!restoreGuestSession()) {
        applyAuthenticatedUser(null)
      }

      setIsAuthReady(true)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [applyAuthenticatedUser, supabaseConfigured])

  const crewNetPositions = useMemo(() => {
    const positions: Record<string, number> = {}
    crews.forEach((crew) => {
      const data = mockCrewData[crew.id]
      if (data) {
        positions[crew.id] = getNetPosition(currentUser.id, data.allTimeLedger)
      } else {
        positions[crew.id] = 0
      }
    })
    return positions
  }, [crews])

  const activeCrew = crews.find((crew) => crew.id === activeCrewId)
  const activeCrewData = activeCrewId ? mockCrewData[activeCrewId] : null

  const handleGoogleAuth = async (): Promise<AuthActionResult> => {
    if (!supabaseConfigured) {
      return { error: supabaseConfigError ?? 'Supabase is not configured.' }
    }

    setIsAuthSubmitting(true)
    setAuthNotice(null)
    clearGuestSessionCookie()

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
    const normalizedCode = crewCode.trim().toUpperCase()
    const matchingCrew = crews.find((crew) => crew.inviteCode === normalizedCode)

    if (!matchingCrew) {
      setView('home')
      return { error: 'Crew code not found.' }
    }

    const guestSession = buildGuestSession(name)
    writeGuestSessionCookie(guestSession)
    setSession(guestSession)
    setAuthNotice(null)
    setActiveCrewId(matchingCrew.id)
    setActiveTab('tonight')
    setView('crew')

    return { message: `Playing as ${guestSession.user.name} in ${matchingCrew.name}.` }
  }

  const handleSignOut = async () => {
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

  const handleMarkNotificationsRead = () => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
  }

  const handleSelectCrew = (crewId: string) => {
    setActiveCrewId(crewId)
    setActiveTab('tonight')
    setView('crew')
  }

  const handleBackToHome = () => {
    setActiveCrewId(null)
    setView('home')
  }

  const handleCreateCrew = (name: string) => {
    const newCrew: Crew = {
      id: `crew-${Date.now()}`,
      name,
      members: [session?.user ?? currentUser],
      currentNight: undefined,
      inviteCode: generateCrewCode(),
      pastNights: [],
    }
    setCrews((prev) => [...prev, newCrew])
    mockCrewData[newCrew.id] = {
      tonightLedger: [],
      allTimeLedger: [],
      leaderboard: [{ user: session?.user ?? currentUser, totalWon: 0, winRate: 0, bestNight: 0, streak: 0 }],
    }
  }

  const handleJoinCrew = (code: string) => {
    const existingCrew = crews.find((crew) => crew.inviteCode === code)
    if (existingCrew) {
      handleSelectCrew(existingCrew.id)
    }
  }

  const handleLeaveCrew = () => {
    if (activeCrewId) {
      setCrews((prev) => prev.filter((crew) => crew.id !== activeCrewId))
      handleBackToHome()
    }
  }

  const handleRenameCrew = (name: string) => {
    if (activeCrewId) {
      setCrews((prev) => prev.map((crew) =>
        crew.id === activeCrewId ? { ...crew, name } : crew
      ))
    }
  }

  const handleKickMember = (memberId: string) => {
    if (activeCrewId) {
      setCrews((prev) => prev.map((crew) =>
        crew.id === activeCrewId
          ? { ...crew, members: crew.members.filter((m) => m.id !== memberId) }
          : crew
      ))
    }
  }

  const handleDeleteCrew = () => {
    if (activeCrewId) {
      setCrews((prev) => prev.filter((crew) => crew.id !== activeCrewId))
      handleBackToHome()
    }
  }

  const handleWager = (_betId: string, _optionId: string, _drinks: number) => {
    // Mock UI only for now.
  }

  const handleCreateBet = (_bet: unknown) => {
    // Mock UI only for now.
  }

  const handleSettle = (_entry: unknown) => {
    // Mock UI only for now.
  }

  const handleStartNight = () => {
    // Mock UI only for now.
  }

  const handleLeaveNight = () => {
    // Mock UI only for now — user leaves the active night
  }

  if (!isAuthReady) {
    return (
      <main className="min-h-screen bg-background px-6 py-12">
        <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center text-center">
          <div className="mb-4 h-14 w-14 animate-pulse rounded-2xl border-3 border-border bg-primary/20" />
          <h1 className="text-2xl font-bold text-foreground">Checking your tab</h1>
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
        onGoogleAuth={handleGoogleAuth}
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

  const tonightNet = activeCrewData ? getNetPosition(currentUser.id, activeCrewData.tonightLedger) : 0

  return (
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
        onMarkNotificationsRead={handleMarkNotificationsRead}
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
                onClick={handleStartNight}
                className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold border-2 border-border shadow-brutal-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
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
                onStartNight={handleStartNight}
                onLeaveNight={handleLeaveNight}
                onRenameCrew={handleRenameCrew}
                onKickMember={handleKickMember}
                onDeleteCrew={handleDeleteCrew}
                onLeaveCrew={handleLeaveCrew}
              />
        )}
      </div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} onCreateBet={() => setShowCreateBet(true)} />


<CreateBetModal
        isOpen={showCreateBet}
        onClose={() => setShowCreateBet(false)}
        onCreate={handleCreateBet}
      />
    </main>
  )
}
