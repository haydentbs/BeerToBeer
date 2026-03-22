'use client'

import { useEffect, use } from 'react'
import { useRouter, useSelectedLayoutSegment } from 'next/navigation'
import { AppHeader } from '@/components/app-header'
import { BottomNav } from '@/components/bottom-nav'
import { PendingInviteBanners } from '@/components/pending-invite-banners'
import { CreateBetModal } from '@/components/create-bet-modal'
import { ProfileModal } from '@/components/profile-modal'
import { LoadingSpinner } from '@/components/loading-spinner'
import { CurrentUserProvider } from '@/lib/current-user'
import { getNetPosition } from '@/lib/store'
import { useAppState } from '@/lib/app-state'
import type { ReactNode } from 'react'

type CrewTab = 'tonight' | 'ledger' | 'leaderboard' | 'crew'

function segmentToTab(segment: string | null): CrewTab {
  switch (segment) {
    case 'tonight': return 'tonight'
    case 'ledger': return 'ledger'
    case 'leaderboard': return 'leaderboard'
    case 'manage': return 'crew'
    default: return 'tonight'
  }
}

function tabToSegment(tab: CrewTab): string {
  return tab === 'crew' ? 'manage' : tab
}

export default function CrewLayout({
  params,
  children,
}: {
  params: Promise<{ crewId: string }>
  children: ReactNode
}) {
  const { crewId } = use(params)
  const router = useRouter()
  const segment = useSelectedLayoutSegment()
  const activeTab = segmentToTab(segment)

  const {
    session,
    isAuthReady,
    isDataReady,
    isSigningOut,
    loadingCopy,
    visibleCrews,
    crewDataById,
    crewNetPositions,
    notifications,
    setActiveCrewId,
    handleLeaveCrew,
    handleSignOut,
    handleFinishAccount,
    handleOpenProfile,
    handleUpdateName,
    handleMarkNotificationsRead,
    handleOpenNotification,
    handleOpenCreateBet,
    handleSelectBet,
    handleSelectBeerBombMatch,
    handleBetOfferAccept,
    handleBetOfferDecline,
    handleBeerBombAccept,
    handleBeerBombDecline,
    handleCreateBet,
    handleCreateMiniGameChallenge,
    showCreateBet,
    setShowCreateBet,
    showProfile,
    setShowProfile,
    selectedBetId,
    selectedBeerBombMatchId,
    isMutating,
    isCreatingCrew,
    isJoiningCrew,
  } = useAppState()

  // Tell the provider which crew is active
  useEffect(() => {
    setActiveCrewId(crewId)
    return () => setActiveCrewId(null)
  }, [crewId, setActiveCrewId])

  // If not authenticated, redirect to home
  useEffect(() => {
    if (isAuthReady && !session) {
      router.push('/')
    }
  }, [isAuthReady, session, router])

  if (!isAuthReady || !session || !isDataReady) {
    return (
      <main className="min-h-screen bg-background">
        <LoadingSpinner
          message={loadingCopy?.message ?? 'Checking your tab\u2026'}
          submessage={loadingCopy?.submessage ?? 'Restoring your session'}
          className="min-h-screen"
        />
      </main>
    )
  }

  const activeCrew = visibleCrews.find((crew) => crew.id === crewId)

  if (!activeCrew) {
    return (
      <main className="min-h-screen bg-background">
        <LoadingSpinner
          message="Restoring your tab\u2026"
          submessage="Opening the same crew view"
          className="min-h-screen"
        />
      </main>
    )
  }

  const activeCrewData = crewDataById[crewId]
  const tonightNet = activeCrewData ? getNetPosition(session.user.id, activeCrewData.tonightLedger) : 0

  const handleBack = () => {
    router.push('/')
  }

  const handleTabChange = (tab: CrewTab) => {
    router.push(`/crew/${crewId}/${tabToSegment(tab)}`)
  }

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
          onBack={handleBack}
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
          {children}
        </div>

        <BottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onCreateBet={handleOpenCreateBet}
          createBetDisabled={!activeCrew.currentNight}
        />

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
              return sum + nights * 3
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
                  ? 'Creating your crew\u2026'
                  : isJoiningCrew
                  ? 'Joining your crew\u2026'
                  : 'One sec\u2026'
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
