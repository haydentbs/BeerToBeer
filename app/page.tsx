'use client'

import { useState, useEffect, useMemo } from 'react'
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
  mockCrews,
  mockCrewData,
  mockNotifications,
  currentUser,
  getNetPosition,
  generateCrewCode,
  type User,
  type Crew,
  type Notification,
} from '@/lib/store'

type AppView = 'onboarding' | 'home' | 'crew'

interface AppSession {
  user: User
  crewIds: string[]
  isGuest?: boolean
}

export default function BeerScoreApp() {
  const [session, setSession] = useState<AppSession | null>(null)
  const [view, setView] = useState<AppView>('onboarding')
  const [activeCrewId, setActiveCrewId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'tonight' | 'ledger' | 'leaderboard' | 'crew'>('tonight')
  const [showCreateBet, setShowCreateBet] = useState(false)
  const [crews, setCrews] = useState<Crew[]>(mockCrews)
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)

  // Check for existing session on mount
  useEffect(() => {
    const stored = localStorage.getItem('beerscore_session_v2')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setSession(parsed)
        setView('home')
      } catch {
        localStorage.removeItem('beerscore_session_v2')
      }
    }
  }, [])

  // Compute net positions per crew
  const crewNetPositions = useMemo(() => {
    const positions: Record<string, number> = {}
    crews.forEach((crew) => {
      const data = mockCrewData[crew.id]
      if (data) {
        // Use all-time ledger for home screen, tonight ledger for inside crew
        positions[crew.id] = getNetPosition(currentUser.id, data.allTimeLedger)
      } else {
        positions[crew.id] = 0
      }
    })
    return positions
  }, [crews])

  // Get active crew data
  const activeCrew = crews.find(c => c.id === activeCrewId)
  const activeCrewData = activeCrewId ? mockCrewData[activeCrewId] : null

  // --- Handlers ---

  const createSession = (name: string, isGuest: boolean = true) => {
    const user: User = {
      id: currentUser.id,
      name,
      avatar: '',
      initials: name.slice(0, 2).toUpperCase(),
    }
    const sessionData: AppSession = {
      user,
      crewIds: crews.map(c => c.id), // For demo, auto-join all mock crews
      isGuest,
    }
    localStorage.setItem('beerscore_session_v2', JSON.stringify(sessionData))
    setSession(sessionData)
    return sessionData
  }

  const handleGuestJoin = (name: string, crewCode?: string) => {
    createSession(name, true)
    if (crewCode) {
      const existingCrew = crews.find(c => c.inviteCode === crewCode)
      if (existingCrew) {
        handleSelectCrew(existingCrew.id)
        return
      }
    }
    setView('home')
  }

  const handleSignIn = (email: string, password: string) => {
    // In a real app, authenticate against backend
    // For demo, just create a session with the email prefix as name
    const name = email.split('@')[0]
    createSession(name, false)
    setView('home')
  }

  const handleSignUp = (name: string, email: string, password: string) => {
    // In a real app, create account on backend
    createSession(name, false)
    setView('home')
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
    setCrews(prev => [...prev, newCrew])
    // Also add empty crew data
    mockCrewData[newCrew.id] = {
      tonightLedger: [],
      allTimeLedger: [],
      leaderboard: [{ user: session?.user ?? currentUser, totalWon: 0, winRate: 0, bestNight: 0, streak: 0 }],
    }
  }

  const handleJoinCrew = (code: string) => {
    // In a real app this would validate the code server-side
    // For demo, just show that it works
    const existingCrew = crews.find(c => c.inviteCode === code)
    if (existingCrew) {
      // Already in this crew
      handleSelectCrew(existingCrew.id)
    }
  }

  const handleLeaveCrew = () => {
    if (activeCrewId) {
      setCrews(prev => prev.filter(c => c.id !== activeCrewId))
      handleBackToHome()
    }
  }

  const handleWager = (betId: string, optionId: string, drinks: number) => {
    // In a real app, this would update the bet state
  }

  const handleCreateBet = (bet: unknown) => {
    // In a real app, this would add the bet to the night
  }

  const handleSettle = (entry: unknown) => {
    // In a real app, this would trigger the settlement flow
  }

  const handleStartNight = () => {
    // In a real app, this would create a new night
  }

  const handleEndNight = () => {
    // In a real app, this would close the current night
  }

  const handleSignOut = () => {
    localStorage.removeItem('beerscore_session_v2')
    setSession(null)
    setView('onboarding')
    setActiveCrewId(null)
  }

  const handleMarkNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  // --- Render ---

  // Onboarding
  if (!session || view === 'onboarding') {
    return (
      <OnboardingScreen
        onGuestJoin={handleGuestJoin}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
      />
    )
  }

  // Home
  if (view === 'home' || !activeCrew) {
    return (
      <HomeScreen
        user={session.user}
        crews={crews}
        crewNetPositions={crewNetPositions}
        onSelectCrew={handleSelectCrew}
        onCreateCrew={handleCreateCrew}
        onJoinCrew={handleJoinCrew}
      />
    )
  }

  // Inside a Crew
  const tonightNet = activeCrewData
    ? getNetPosition(currentUser.id, activeCrewData.tonightLedger)
    : 0

  return (
    <main className="min-h-screen bg-background">
      <AppHeader
        crewName={activeCrew.name}
        nightName={activeCrew.currentNight?.name}
        nightStatus={activeCrew.currentNight?.status}
        netPosition={tonightNet}
        userName={session.user.name}
        isGuest={session.isGuest}
        notifications={notifications}
        onBack={handleBackToHome}
        onLeave={handleLeaveCrew}
        onSignOut={handleSignOut}
        onMarkNotificationsRead={handleMarkNotificationsRead}
      />

      <div className="pt-4">
        {activeTab === 'tonight' && activeCrew.currentNight && (
          <TonightScreen
            night={activeCrew.currentNight}
            onWager={handleWager}
          />
        )}

        {activeTab === 'tonight' && !activeCrew.currentNight && (
          <div className="pb-24 px-4">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-surface border-2 border-border flex items-center justify-center mb-4">
                <span className="text-2xl">🌙</span>
              </div>
              <h3 className="font-bold text-foreground mb-2">No night active</h3>
              <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
                Start a night to create bets and track drinks with your crew.
              </p>
              <button
                onClick={handleStartNight}
                className="py-3 px-8 rounded-xl bg-primary text-primary-foreground font-bold border-3 border-border shadow-brutal active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
              >
                Start a Night
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
          <LeaderboardScreen
            leaderboard={activeCrewData.leaderboard}
          />
        )}

        {activeTab === 'crew' && (
          <CrewScreen
            crew={activeCrew}
            onStartNight={handleStartNight}
            onEndNight={handleEndNight}
          />
        )}
      </div>

      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCreateBet={() => setShowCreateBet(true)}
      />

      <CreateBetModal
        isOpen={showCreateBet}
        onClose={() => setShowCreateBet(false)}
        onCreate={handleCreateBet}
      />
    </main>
  )
}
