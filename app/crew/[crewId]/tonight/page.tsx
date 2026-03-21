'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { TonightScreen } from '@/components/tonight-screen'
import { useAppState } from '@/lib/app-state'

export default function TonightPage({ params }: { params: Promise<{ crewId: string }> }) {
  const { crewId } = use(params)
  const router = useRouter()
  const {
    visibleCrews,
    selectedBetId,
    selectedBeerBombMatchId,
    handleSelectBet,
    handleSelectBeerBombMatch,
    handleWager,
    handleBetOfferAccept,
    handleBetOfferDecline,
    handleBeerBombAccept,
    handleBeerBombDecline,
    handleBeerBombCancel,
    handleBeerBombTurn,
    handleProposeResult,
    handleConfirmResult,
    handleDisputeResult,
    handleCastDisputeVote,
  } = useAppState()

  const activeCrew = visibleCrews.find((crew) => crew.id === crewId)
  const activeNight = activeCrew?.currentNight ?? null

  if (!activeNight) {
    return (
      <div className="pb-24 px-4">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-surface border-2 border-border flex items-center justify-center mb-4">
            <span className="text-2xl">&#127769;</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">No active night</h2>
          <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
            Start a night to begin creating bets and tracking the drinks ledger.
          </p>
          <button
            onClick={() => router.push(`/crew/${crewId}/manage`)}
            className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-display font-normal border-2 border-border shadow-brutal-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
          >
            Start tonight&apos;s tab
          </button>
        </div>
      </div>
    )
  }

  return (
    <TonightScreen
      night={activeNight}
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
  )
}
