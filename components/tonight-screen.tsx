'use client'

import { useState } from 'react'
import { AlertTriangle, Bomb, Clock } from 'lucide-react'
import { BetCardCompact } from './bet-card-compact'
import { BetDetailModal } from './bet-detail-modal'
import { PendingInviteBanners } from './pending-invite-banners'
import {
  BeerBombMatchCard,
  BeerBombMatchModal,
  type BeerBombMatch,
} from './beer-bomb-match-modal'
import { useTheme } from './theme-provider'
import { type Bet, type Night } from '@/lib/store'
import { useCurrentUser } from '@/lib/current-user'

const DEV_SOLO_BEER_BOMB_ENABLED = process.env.NODE_ENV !== 'production'

function createSoloBeerBombMatch(currentUser: ReturnType<typeof useCurrentUser>): BeerBombMatch {
  const now = new Date()
  const membershipId = currentUser.membershipId ?? currentUser.id

  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `solo-beer-bomb-${Date.now()}`,
    gameKey: 'beer_bomb',
    isDevSolo: true,
    title: 'Beer Bomb Solo Test',
    status: 'active',
    proposedWager: 1,
    agreedWager: 1,
    boardSize: 8,
    bombSlotIndex: Math.floor(Math.random() * 8),
    revealedSlotIndices: [],
    currentTurnMembershipId: membershipId,
    challenger: {
      id: currentUser.id,
      membershipId,
      name: currentUser.name,
      initials: currentUser.initials,
      avatar: currentUser.avatar,
    },
    opponent: {
      id: 'beer-bomb-house',
      membershipId: 'beer-bomb-house',
      name: 'The House',
      initials: 'TH',
      avatar: '',
    },
    winnerMembershipId: null,
    loserMembershipId: null,
    createdAt: now,
    updatedAt: now,
    acceptedAt: now,
    completedAt: null,
  }
}

interface TonightScreenProps {
  night: Night
  selectedBetId: string | null
  selectedBeerBombMatchId: string | null
  onSelectBet: (betId: string | null) => void
  onSelectBeerBombMatch: (matchId: string | null) => void
  onWager: (betId: string, optionId: string, drinks: number) => void
  onBetOfferAccept: (betId: string) => Promise<void> | void
  onBetOfferDecline: (betId: string) => Promise<void> | void
  onBeerBombAccept: (matchId: string) => Promise<void> | void
  onBeerBombDecline: (matchId: string) => Promise<void> | void
  onBeerBombCancel: (matchId: string) => Promise<void> | void
  onBeerBombTurn: (matchId: string, slotIndex: number) => Promise<void> | void
  onProposeResult?: (betId: string, optionId: string) => void
  onConfirmResult?: (betId: string) => void
  onDisputeResult?: (betId: string) => void
  onCastDisputeVote?: (betId: string, optionId: string) => void
  showPendingInviteBanners?: boolean
}

export function TonightScreen({
  night,
  selectedBetId,
  selectedBeerBombMatchId,
  onSelectBet,
  onSelectBeerBombMatch,
  onWager,
  onBetOfferAccept,
  onBetOfferDecline,
  onBeerBombAccept,
  onBeerBombDecline,
  onBeerBombCancel,
  onBeerBombTurn,
  onProposeResult,
  onConfirmResult,
  onDisputeResult,
  onCastDisputeVote,
  showPendingInviteBanners = true,
}: TonightScreenProps) {
  const currentUser = useCurrentUser()
  const [devSoloBeerBombMatch, setDevSoloBeerBombMatch] = useState<BeerBombMatch | null>(null)
  const { drinkEmoji } = useTheme()

  const miniGameMatches = (night.miniGameMatches ?? []) as unknown as BeerBombMatch[]
  const betsById = new Map(night.bets.map((bet) => [bet.id, bet]))

  // Unified bet categories
  const activeBets = night.bets.filter((bet) => bet.status === 'open')
  const awaitingBets = night.bets.filter((bet) => ['pending_result', 'disputed'].includes(bet.status))
  const settledBets = night.bets.filter((bet) => ['resolved', 'void', 'cancelled'].includes(bet.status))

  // Mini-game categories
  const activeMiniGames = miniGameMatches.filter((m) => m.status === 'active')
  const settledMiniGames = miniGameMatches.filter((m) => m.status === 'completed')

  // Counts for stats (exclude pending_accept and declined)
  const activeCount = activeBets.length + activeMiniGames.length
  const totalPool = night.bets.reduce((acc, bet) => acc + bet.totalPool, 0)

  const liveSelectedBet = selectedBetId ? betsById.get(selectedBetId) ?? null : null
  const liveSelectedBeerBombMatch = devSoloBeerBombMatch?.id === selectedBeerBombMatchId
    ? devSoloBeerBombMatch
    : selectedBeerBombMatchId
      ? miniGameMatches.find((match) => match.id === selectedBeerBombMatchId) ?? null
      : null
  const selectedBeerBombLinkedBet =
    liveSelectedBeerBombMatch?.betId ? betsById.get(liveSelectedBeerBombMatch.betId) ?? null : null

  const hasAnything = activeCount > 0 || awaitingBets.length > 0 || settledBets.length > 0 || settledMiniGames.length > 0
  const pendingInviteCount = night.bets.filter((bet) => bet.status === 'pending_accept').length
  const pendingChallengeCount = miniGameMatches.filter((match) => match.status === 'pending').length

  const handleStartSoloBeerBomb = () => {
    const soloMatch = createSoloBeerBombMatch(currentUser)
    setDevSoloBeerBombMatch(soloMatch)
    onSelectBeerBombMatch(soloMatch.id)
  }

  const handleBeerBombTurnWithDevSupport = async (matchId: string, slotIndex: number) => {
    const activeMatch = devSoloBeerBombMatch
    if (activeMatch?.id === matchId && activeMatch.isDevSolo) {
      const hitBomb = activeMatch.bombSlotIndex === slotIndex
      const membershipId = currentUser.membershipId ?? currentUser.id
      const nextUpdatedAt = new Date()

      setDevSoloBeerBombMatch({
        ...activeMatch,
        revealedSlotIndices: [...activeMatch.revealedSlotIndices, slotIndex],
        status: hitBomb ? 'completed' : 'active',
        currentTurnMembershipId: hitBomb ? null : membershipId,
        winnerMembershipId: hitBomb ? activeMatch.opponent.membershipId : null,
        loserMembershipId: hitBomb ? membershipId : null,
        completedAt: hitBomb ? nextUpdatedAt : null,
        updatedAt: nextUpdatedAt,
      })
      return
    }

    await onBeerBombTurn(matchId, slotIndex)
  }

  return (
    <>
      <div className="space-y-5 px-4 pb-24">
        {showPendingInviteBanners && (
          <PendingInviteBanners
            night={night}
            onSelectBet={(betId) => onSelectBet(betId)}
            onSelectBeerBombMatch={(matchId) => onSelectBeerBombMatch(matchId)}
            onBetOfferAccept={onBetOfferAccept}
            onBetOfferDecline={onBetOfferDecline}
            onBeerBombAccept={onBeerBombAccept}
            onBeerBombDecline={onBeerBombDecline}
          />
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border-2 border-border bg-card p-3 text-center">
            <div className="text-2xl font-bold text-primary">{activeCount}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active</div>
          </div>
          <div className="rounded-xl border-2 border-border bg-card p-3 text-center">
            <div className="text-2xl font-bold text-card-foreground">{night.participants.length}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Players</div>
          </div>
          <div className="rounded-xl border-2 border-border bg-card p-3 text-center">
            <div className="text-2xl font-bold text-win">{totalPool.toFixed(1)}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pool</div>
          </div>
        </div>

        {/* Active — open bets + active mini-games */}
        {(activeBets.length > 0 || activeMiniGames.length > 0 || DEV_SOLO_BEER_BOMB_ENABLED) && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Active</h2>
              <div className="flex items-center gap-2">
                {DEV_SOLO_BEER_BOMB_ENABLED && (
                  <button
                    onClick={handleStartSoloBeerBomb}
                    className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary transition-colors hover:bg-primary/15"
                  >
                    Solo bomb
                  </button>
                )}
                <span className="text-xs text-muted-foreground">{activeCount} live</span>
              </div>
            </div>
            {(activeBets.length > 0 || activeMiniGames.length > 0) && (
              <div className="space-y-2">
                {activeMiniGames.map((match) => (
                  <BeerBombMatchCard
                    key={match.id}
                    match={match}
                    linkedBet={match.betId ? betsById.get(match.betId) ?? null : null}
                    currentMembershipId={currentUser.membershipId ?? currentUser.id}
                    onOpen={(selectedMatch) => onSelectBeerBombMatch(selectedMatch.id)}
                  />
                ))}
                {activeBets.map((bet) => (
                  <BetCardCompact key={bet.id} bet={bet} onTap={(selectedBet) => onSelectBet(selectedBet.id)} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Awaiting Result — pending_result + disputed */}
        {awaitingBets.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-foreground">
                <Clock className="h-4 w-4 text-amber-400" />
                Awaiting Result
              </h2>
              <span className="text-xs text-muted-foreground">{awaitingBets.length} pending</span>
            </div>
            <div className="space-y-2">
              {awaitingBets.map((bet) => (
                <div key={bet.id}>
                  {bet.status === 'disputed' && (
                    <div className="mb-1 flex items-center gap-2 rounded-lg border border-loss/30 bg-loss/10 px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-loss" />
                      <span className="text-xs font-semibold text-loss">Disputed — tap to vote</span>
                    </div>
                  )}
                  <BetCardCompact bet={bet} onTap={(selectedBet) => onSelectBet(selectedBet.id)} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Settled — resolved, void, cancelled (NOT declined) */}
        {(settledBets.length > 0 || settledMiniGames.length > 0) && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Settled</h2>
              <span className="text-xs text-muted-foreground">{settledBets.length + settledMiniGames.length} done</span>
            </div>
            <div className="space-y-2">
              {settledMiniGames.map((match) => (
                <BeerBombMatchCard
                  key={match.id}
                  match={match}
                  linkedBet={match.betId ? betsById.get(match.betId) ?? null : null}
                  currentMembershipId={currentUser.membershipId ?? currentUser.id}
                  onOpen={(selectedMatch) => onSelectBeerBombMatch(selectedMatch.id)}
                />
              ))}
              {settledBets.map((bet) => (
                <BetCardCompact key={bet.id} bet={bet} onTap={(selectedBet) => onSelectBet(selectedBet.id)} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!hasAnything && pendingInviteCount === 0 && pendingChallengeCount === 0 && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-surface">
              <span className="text-2xl">{drinkEmoji}</span>
            </div>
            <h3 className="mb-2 font-bold text-foreground">No bets yet</h3>
            <p className="text-sm text-muted-foreground">Create the first bet or challenge of the night.</p>
          </div>
        )}
      </div>

      <BetDetailModal
        bet={liveSelectedBet}
        isOpen={!!liveSelectedBet}
        onClose={() => onSelectBet(null)}
        onWager={onWager}
        onProposeResult={onProposeResult}
        onConfirmResult={onConfirmResult}
        onDisputeResult={onDisputeResult}
        onCastDisputeVote={onCastDisputeVote}
      />

      <BeerBombMatchModal
        match={liveSelectedBeerBombMatch}
        linkedBet={selectedBeerBombLinkedBet}
        isOpen={!!liveSelectedBeerBombMatch}
        currentMembershipId={currentUser.membershipId ?? currentUser.id}
        onClose={() => onSelectBeerBombMatch(null)}
        onAccept={onBeerBombAccept}
        onDecline={onBeerBombDecline}
        onCancel={onBeerBombCancel}
        onTakeTurn={handleBeerBombTurnWithDevSupport}
        onWager={onWager}
      />
    </>
  )
}
