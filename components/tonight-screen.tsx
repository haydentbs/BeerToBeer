'use client'

import { useState } from 'react'
import { Bomb, Sparkles } from 'lucide-react'
import { BetCardCompact } from './bet-card-compact'
import { BetDetailModal } from './bet-detail-modal'
import {
  BeerBombMatchCard,
  BeerBombMatchModal,
  type BeerBombMatch,
} from './beer-bomb-match-modal'
import { useTheme } from './theme-provider'
import type { Bet, Night } from '@/lib/store'
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
  onWager: (betId: string, optionId: string, drinks: number) => void
  onBeerBombAccept: (matchId: string) => Promise<void> | void
  onBeerBombDecline: (matchId: string) => Promise<void> | void
  onBeerBombCancel: (matchId: string) => Promise<void> | void
  onBeerBombTurn: (matchId: string, slotIndex: number) => Promise<void> | void
}

export function TonightScreen({
  night,
  onWager,
  onBeerBombAccept,
  onBeerBombDecline,
  onBeerBombCancel,
  onBeerBombTurn,
}: TonightScreenProps) {
  const currentUser = useCurrentUser()
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null)
  const [selectedBeerBombMatch, setSelectedBeerBombMatch] = useState<BeerBombMatch | null>(null)
  const { drinkEmoji } = useTheme()

  const miniGameMatches = (night.miniGameMatches ?? []) as unknown as BeerBombMatch[]
  const betsById = new Map(night.bets.map((bet) => [bet.id, bet]))
  const activeBets = night.bets.filter((bet) => ['open', 'pending_result', 'disputed'].includes(bet.status))
  const resolvedBets = night.bets.filter((bet) => ['resolved', 'void', 'cancelled'].includes(bet.status))
  const totalPool = night.bets.reduce((acc, bet) => acc + bet.totalPool, 0)
  const liveSelectedBet = selectedBet ? betsById.get(selectedBet.id) ?? selectedBet : null
  const liveSelectedBeerBombMatch = selectedBeerBombMatch?.isDevSolo
    ? selectedBeerBombMatch
    : selectedBeerBombMatch
      ? miniGameMatches.find((match) => match.id === selectedBeerBombMatch.id) ?? selectedBeerBombMatch
      : null
  const selectedBeerBombLinkedBet =
    liveSelectedBeerBombMatch?.betId ? betsById.get(liveSelectedBeerBombMatch.betId) ?? null : null

  const handleStartSoloBeerBomb = () => {
    setSelectedBeerBombMatch(createSoloBeerBombMatch(currentUser))
  }

  const handleBeerBombTurnWithDevSupport = async (matchId: string, slotIndex: number) => {
    const activeMatch = selectedBeerBombMatch
    if (activeMatch?.id === matchId && activeMatch.isDevSolo) {
      const hitBomb = activeMatch.bombSlotIndex === slotIndex
      const membershipId = currentUser.membershipId ?? currentUser.id
      const nextUpdatedAt = new Date()

      setSelectedBeerBombMatch({
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
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border-2 border-border bg-card p-3 text-center">
            <div className="text-2xl font-bold text-primary">{activeBets.length}</div>
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

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-foreground">
              <Bomb className="h-4 w-4 text-primary" />
              Beer Bomb
            </h2>
            <div className="flex items-center gap-2">
              {DEV_SOLO_BEER_BOMB_ENABLED && (
                <button
                  onClick={handleStartSoloBeerBomb}
                  className="rounded-full border-2 border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary transition-colors hover:bg-primary/15"
                >
                  Solo test
                </button>
              )}
              <span className="text-xs text-muted-foreground">{miniGameMatches.length} challenges</span>
            </div>
          </div>

          {miniGameMatches.length > 0 ? (
            <div className="space-y-2">
              {miniGameMatches.map((match) => (
                <BeerBombMatchCard
                  key={match.id}
                  match={match}
                  linkedBet={match.betId ? betsById.get(match.betId) ?? null : null}
                  currentMembershipId={currentUser.membershipId ?? currentUser.id}
                  onOpen={setSelectedBeerBombMatch}
                />
              ))}
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-2xl border-3 border-border bg-surface p-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,207,111,0.15),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(89,212,255,0.12),transparent_30%)]" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    First mini-game
                  </div>
                  <h3 className="text-lg font-bold text-card-foreground">Beer Bomb challenge lane</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tap beers in a line until one turns out to be the bomb. Use the plus button to challenge someone and lock in the wager.
                  </p>
                </div>
                <div className="rounded-xl border-2 border-border bg-card px-3 py-2 text-center">
                  <div className="text-2xl">{drinkEmoji}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ready</div>
                </div>
              </div>
            </div>
          )}
        </section>

        {activeBets.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Active Bets</h2>
              <span className="text-xs text-muted-foreground">{activeBets.length} live</span>
            </div>
            <div className="space-y-2">
              {activeBets.map((bet) => (
                <BetCardCompact key={bet.id} bet={bet} onTap={setSelectedBet} />
              ))}
            </div>
          </section>
        )}

        {resolvedBets.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Settled</h2>
              <span className="text-xs text-muted-foreground">{resolvedBets.length} done</span>
            </div>
            <div className="space-y-2">
              {resolvedBets.map((bet) => (
                <BetCardCompact key={bet.id} bet={bet} onTap={setSelectedBet} />
              ))}
            </div>
          </section>
        )}

        {activeBets.length === 0 && resolvedBets.length === 0 && miniGameMatches.length === 0 && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-surface">
              <span className="text-2xl">{drinkEmoji}</span>
            </div>
            <h3 className="mb-2 font-bold text-foreground">No bets yet</h3>
            <p className="text-sm text-muted-foreground">Create the first bet or Beer Bomb challenge of the night.</p>
          </div>
        )}
      </div>

      <BetDetailModal
        bet={liveSelectedBet}
        isOpen={!!liveSelectedBet}
        onClose={() => setSelectedBet(null)}
        onWager={onWager}
      />

      <BeerBombMatchModal
        match={liveSelectedBeerBombMatch}
        linkedBet={selectedBeerBombLinkedBet}
        isOpen={!!liveSelectedBeerBombMatch}
        currentMembershipId={currentUser.membershipId ?? currentUser.id}
        onClose={() => setSelectedBeerBombMatch(null)}
        onAccept={onBeerBombAccept}
        onDecline={onBeerBombDecline}
        onCancel={onBeerBombCancel}
        onTakeTurn={handleBeerBombTurnWithDevSupport}
        onWager={onWager}
      />
    </>
  )
}
