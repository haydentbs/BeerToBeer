'use client'

import { useState, useEffect } from 'react'
import { LandingPage } from '@/components/landing-page'
import { AppHeader } from '@/components/app-header'
import { BottomNav } from '@/components/bottom-nav'
import { TonightScreen } from '@/components/tonight-screen'
import { LedgerScreen } from '@/components/ledger-screen'
import { LeaderboardScreen } from '@/components/leaderboard-screen'
import { CrewScreen } from '@/components/crew-screen'
import { CreateBetModal } from '@/components/create-bet-modal'
import { 
  mockCurrentNight, 
  mockTonightLedger, 
  mockAllTimeLedger, 
  mockLeaderboard, 
  mockCrew,
  mockUsers,
  getNetPosition,
  generateCrewCode,
  type User
} from '@/lib/store'

interface SessionData {
  user: User
  crewCode: string
}

export default function BeerScoreApp() {
  const [session, setSession] = useState<SessionData | null>(null)
  const [activeTab, setActiveTab] = useState<'tonight' | 'ledger' | 'leaderboard' | 'crew'>('tonight')
  const [showCreateBet, setShowCreateBet] = useState(false)
  const [night, setNight] = useState(mockCurrentNight)
  const [crew, setCrew] = useState(mockCrew)

  // Check for existing session on mount
  useEffect(() => {
    const stored = localStorage.getItem('beerscore_session')
    if (stored) {
      try {
        setSession(JSON.parse(stored))
      } catch {
        localStorage.removeItem('beerscore_session')
      }
    }
  }, [])

  const handleJoin = (name: string, crewCode: string) => {
    const newUser: User = {
      id: Date.now().toString(),
      name,
      avatar: '',
      initials: name.slice(0, 2).toUpperCase()
    }
    const sessionData = { user: newUser, crewCode }
    localStorage.setItem('beerscore_session', JSON.stringify(sessionData))
    setSession(sessionData)
  }

  const handleCreate = (name: string) => {
    const newUser: User = {
      id: Date.now().toString(),
      name,
      avatar: '',
      initials: name.slice(0, 2).toUpperCase()
    }
    const crewCode = generateCrewCode()
    const sessionData = { user: newUser, crewCode }
    localStorage.setItem('beerscore_session', JSON.stringify(sessionData))
    setSession(sessionData)
  }

  const handleLeave = () => {
    localStorage.removeItem('beerscore_session')
    setSession(null)
  }

  // Show landing page if not in session
  if (!session) {
    return <LandingPage onJoin={handleJoin} onCreate={handleCreate} />
  }

  const netPosition = getNetPosition(session.user.id, mockTonightLedger)

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

  return (
    <main className="min-h-screen bg-background">
      <AppHeader 
        nightName={night?.name}
        nightStatus={night?.status}
        netPosition={netPosition}
        userName={session.user.name}
        crewCode={session.crewCode}
        onLeave={handleLeave}
      />

      <div className="pt-4">
        {activeTab === 'tonight' && (
          <TonightScreen 
            night={night} 
            onWager={handleWager}
          />
        )}
        
        {activeTab === 'ledger' && (
          <LedgerScreen 
            tonightLedger={mockTonightLedger}
            allTimeLedger={mockAllTimeLedger}
            onSettle={handleSettle}
          />
        )}
        
        {activeTab === 'leaderboard' && (
          <LeaderboardScreen 
            leaderboard={mockLeaderboard}
          />
        )}
        
        {activeTab === 'crew' && (
          <CrewScreen 
            crew={crew}
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
