'use client'

import { useEffect, useState } from 'react'
import { Bomb, ChevronRight, Clock, Flame, Swords, Trophy, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatDrinks,
  formatRelativeTime,
  getMemberOutcomeForBet,
  getUserWagerForBet,
  projectBetPayout,
  type Bet,
} from '@/lib/store'
import { useCurrentUser } from '@/lib/current-user'

export type BeerBombMatchStatus = 'pending' | 'active' | 'completed' | 'declined' | 'cancelled'

export interface BeerBombPlayer {
  id: string
  membershipId: string | null
  name: string
  initials: string
  avatar?: string
}

export interface BeerBombMatch {
  id: string
  gameKey: 'beer_bomb'
  betId?: string | null
  title: string
  isDevSolo?: boolean
  status: BeerBombMatchStatus
  proposedWager: number
  agreedWager: number | null
  boardSize: number
  bombSlotIndex?: number
  revealedSlotIndices: number[]
  currentTurnMembershipId: string | null
  challenger: BeerBombPlayer
  opponent: BeerBombPlayer
  winnerMembershipId: string | null
  loserMembershipId: string | null
  createdAt: Date
  updatedAt: Date
  respondByAt?: Date | null
  acceptedAt?: Date | null
  declinedAt?: Date | null
  cancelledAt?: Date | null
  completedAt?: Date | null
  declineReason?: string | null
}

interface BeerBombMatchCardProps {
  match: BeerBombMatch
  linkedBet?: Bet | null
  currentMembershipId: string | null
  onOpen: (match: BeerBombMatch) => void
}

interface BeerBombMatchModalProps {
  match: BeerBombMatch | null
  linkedBet?: Bet | null
  isOpen: boolean
  currentMembershipId: string | null
  onClose: () => void
  onAccept: (matchId: string) => Promise<void> | void
  onDecline: (matchId: string) => Promise<void> | void
  onCancel: (matchId: string) => Promise<void> | void
  onTakeTurn: (matchId: string, slotIndex: number) => Promise<void> | void
  onWager: (betId: string, optionId: string, drinks: number) => Promise<void> | void
}

const BG_CANDIDATES = [
  '/mini-games/beer-bomb/background.svg',
  '/mini-games/beer-bomb/background.webp',
  '/mini-games/beer-bomb/background.png',
  '/mini-games/beer-bomb/beer-bomb-background.webp',
  '/mini-games/beer-bomb/beer-bomb-background.png',
]

const BEER_IDLE_CANDIDATES = [
  '/mini-games/beer-bomb/beer-idle.svg',
  '/mini-games/beer-bomb/beer-idle.png',
  '/mini-games/beer-bomb/beer-idle.webp',
  '/mini-games/beer-bomb/beer.png',
  '/mini-games/beer-bomb/beer.webp',
]

const BEER_DRAINED_CANDIDATES = [
  '/mini-games/beer-bomb/beer-drained.svg',
  '/mini-games/beer-bomb/beer-drained.png',
  '/mini-games/beer-bomb/beer-empty.png',
  '/mini-games/beer-bomb/beer-drained.webp',
]

const BEER_BOMB_CANDIDATES = [
  '/mini-games/beer-bomb/beer-bomb.svg',
  '/mini-games/beer-bomb/beer-bomb.png',
  '/mini-games/beer-bomb/beer-bomb-hit.png',
  '/mini-games/beer-bomb/bomb.png',
]

function useResolvedAsset(candidates: string[]) {
  const [resolvedAsset, setResolvedAsset] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setResolvedAsset(null)

    const tryCandidate = (index: number) => {
      if (cancelled) return
      const source = candidates[index]
      if (!source) return

      const image = new Image()
      image.onload = () => {
        if (!cancelled) {
          setResolvedAsset(source)
        }
      }
      image.onerror = () => {
        tryCandidate(index + 1)
      }
      image.src = source
    }

    tryCandidate(0)

    return () => {
      cancelled = true
    }
  }, [candidates])

  return resolvedAsset
}

function getMatchPhase(match: BeerBombMatch, currentMembershipId: string | null) {
  if (match.status === 'completed') return 'completed'
  if (match.status === 'declined') return 'declined'
  if (match.status === 'cancelled') return 'cancelled'
  if (match.status === 'pending') {
    if (currentMembershipId && currentMembershipId === match.opponent.membershipId) {
      return 'your-decision'
    }
    if (currentMembershipId && currentMembershipId === match.challenger.membershipId) {
      return 'waiting-for-opponent'
    }
    return 'pending'
  }
  if (match.currentTurnMembershipId && currentMembershipId === match.currentTurnMembershipId) {
    return 'your-turn'
  }
  return 'waiting-turn'
}

function getOutcomeLabel(match: BeerBombMatch, currentMembershipId: string | null) {
  if (match.status === 'completed') {
    if (currentMembershipId && currentMembershipId === match.winnerMembershipId) {
      return 'You won'
    }
    if (currentMembershipId && currentMembershipId === match.loserMembershipId) {
      return 'You lost'
    }
    return `${match.challenger.name} won`
  }

  if (match.status === 'declined') return 'Declined'
  if (match.status === 'cancelled') return 'Cancelled'
  if (match.status === 'pending') return 'Waiting'
  return 'Live'
}

function getMemberLabel(match: BeerBombMatch, membershipId: string | null) {
  if (membershipId && membershipId === match.challenger.membershipId) {
    return match.challenger.name
  }
  if (membershipId && membershipId === match.opponent.membershipId) {
    return match.opponent.name
  }
  return 'Spectator'
}

function MiniGameStatusBadge({
  phase,
  currentMembershipId,
  match,
}: {
  phase: string
  currentMembershipId: string | null
  match: BeerBombMatch
}) {
  const tone =
    phase === 'completed'
      ? 'bg-win/15 text-win border-win/40'
      : phase === 'your-turn' || phase === 'your-decision'
      ? 'bg-primary/15 text-primary border-primary/40'
      : phase === 'declined' || phase === 'cancelled'
      ? 'bg-loss/15 text-loss border-loss/30'
      : 'bg-surface text-muted-foreground border-border'

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide', tone)}>
      {phase === 'completed' ? <Trophy className="h-3 w-3" /> : phase === 'your-turn' ? <Flame className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {getOutcomeLabel(match, currentMembershipId)}
    </span>
  )
}

export function BeerBombMatchCard({ match, linkedBet, currentMembershipId, onOpen }: BeerBombMatchCardProps) {
  const phase = getMatchPhase(match, currentMembershipId)
  const wager = match.agreedWager ?? match.proposedWager
  const slots = Array.from({ length: match.boardSize }, (_, index) => {
    const isRevealed = match.revealedSlotIndices.includes(index)
    const isBomb = index === match.bombSlotIndex
    return { index, isRevealed, isBomb }
  })

  return (
    <button
      onClick={() => onOpen(match)}
      className="w-full rounded-2xl border-3 border-border bg-card p-4 text-left shadow-brutal-sm transition-all active:translate-x-[2px] active:translate-y-[2px]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Bomb className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Beer Bomb</p>
              <h3 className="truncate text-base font-bold text-card-foreground">{match.title}</h3>
            </div>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {match.challenger.name} vs {match.opponent.name}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MiniGameStatusBadge phase={phase} currentMembershipId={currentMembershipId} match={match} />
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-card-foreground">
              {wager.toFixed(1)} drinks
            </span>
            {linkedBet && (
              <span className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-card-foreground">
                Pool {formatDrinks(linkedBet.totalPool)}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{formatRelativeTime(match.updatedAt)}</span>
          </div>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
      </div>

      <div className="mt-4 grid grid-cols-8 gap-1">
        {slots.map((slot) => (
          <div
            key={slot.index}
            className={cn(
              'aspect-square rounded-lg border transition-all',
              slot.isRevealed
                ? slot.isBomb
                  ? 'border-loss/60 bg-loss/15'
                  : 'border-win/40 bg-win/15'
                : 'border-border bg-surface/80'
            )}
          >
            <div className="flex h-full items-center justify-center">
              {slot.isRevealed ? (
                slot.isBomb ? (
                  <Bomb className="h-3.5 w-3.5 text-loss" />
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-wide text-win">Safe</span>
                )
              ) : (
                <span className="text-[9px] font-black uppercase tracking-wide text-muted-foreground">{slot.index + 1}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </button>
  )
}

export function BeerBombMatchModal({
  match,
  linkedBet,
  isOpen,
  currentMembershipId,
  onClose,
  onAccept,
  onDecline,
  onCancel,
  onTakeTurn,
  onWager,
}: BeerBombMatchModalProps) {
  const currentUser = useCurrentUser()
  const [busyAction, setBusyAction] = useState<null | 'accept' | 'decline' | 'cancel' | 'turn' | 'wager'>(null)
  const [animatingSlotIndex, setAnimatingSlotIndex] = useState<number | null>(null)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [wagerAmount, setWagerAmount] = useState(1)

  const resolvedBackground = useResolvedAsset(BG_CANDIDATES)
  const resolvedBeerIdle = useResolvedAsset(BEER_IDLE_CANDIDATES)
  const resolvedBeerDrained = useResolvedAsset(BEER_DRAINED_CANDIDATES)
  const resolvedBeerBomb = useResolvedAsset(BEER_BOMB_CANDIDATES)

  useEffect(() => {
    setAnimatingSlotIndex(null)
    setBusyAction(null)
  }, [match?.id, match?.updatedAt?.getTime(), match?.status, match?.revealedSlotIndices.join(','), match?.currentTurnMembershipId])

  useEffect(() => {
    setSelectedOption(null)
    setWagerAmount(1)
  }, [match?.id, linkedBet?.id, linkedBet?.status])

  if (!isOpen || !match) return null

  const phase = getMatchPhase(match, currentMembershipId)
  const wager = match.agreedWager ?? match.proposedWager
  const isMyTurn = phase === 'your-turn'
  const isMyDecision = phase === 'your-decision'
  const amChallenger = currentMembershipId && currentMembershipId === match.challenger.membershipId
  const canActOnBoard = match.status === 'active' && isMyTurn && busyAction == null
  const canCancel = match.status === 'pending' && amChallenger && busyAction == null
  const canPlaceSideBet = linkedBet?.status === 'open' && busyAction == null
  const userWager = linkedBet ? getUserWagerForBet(linkedBet, currentUser.id) : null
  const userOutcome = linkedBet ? getMemberOutcomeForBet(linkedBet, currentUser.id) : null
  const selectedProjection =
    linkedBet && selectedOption ? projectBetPayout(linkedBet, selectedOption, wagerAmount, currentUser.id) : 0

  const otherPlayer =
    currentMembershipId && currentMembershipId === match.challenger.membershipId
      ? match.opponent
      : match.challenger

  const playerSummaries = linkedBet?.options.map((option, index) => {
    const player = index === 0 ? match.challenger : match.opponent
    const playerMembershipId = player.membershipId
    const playerStake = option.wagers.find((entry) => entry.user.membershipId === playerMembershipId)?.drinks ?? 0
    const sideWagers = option.wagers.filter((entry) => entry.user.membershipId !== playerMembershipId)

    return {
      option,
      player,
      playerStake,
      sidePool: sideWagers.reduce((sum, entry) => sum + entry.drinks, 0),
      sideBettorCount: sideWagers.length,
    }
  }) ?? []

  const boardSlots = Array.from({ length: match.boardSize }, (_, index) => {
    const revealed = match.revealedSlotIndices.includes(index)
    const isBomb = match.status === 'completed' && match.bombSlotIndex === index
    const isAnimating = animatingSlotIndex === index && busyAction === 'turn'
    let state: 'idle' | 'draining' | 'safe-empty' | 'bomb-hit' = 'idle'

    if (isAnimating) {
      state = 'draining'
    } else if (revealed && isBomb) {
      state = 'bomb-hit'
    } else if (revealed) {
      state = 'safe-empty'
    }

    return { index, state, isBomb }
  })

  const handleAccept = async () => {
    setBusyAction('accept')
    try {
      await onAccept(match.id)
    } finally {
      setBusyAction(null)
    }
  }

  const handleDecline = async () => {
    setBusyAction('decline')
    try {
      await onDecline(match.id)
    } finally {
      setBusyAction(null)
    }
  }

  const handleCancel = async () => {
    setBusyAction('cancel')
    try {
      await onCancel(match.id)
    } finally {
      setBusyAction(null)
    }
  }

  const handleSlotTap = async (index: number) => {
    if (!canActOnBoard || match.revealedSlotIndices.includes(index)) {
      return
    }

    setBusyAction('turn')
    setAnimatingSlotIndex(index)
    await new Promise((resolve) => window.setTimeout(resolve, 420))

    try {
      await onTakeTurn(match.id, index)
    } finally {
      setAnimatingSlotIndex(null)
      setBusyAction(null)
    }
  }

  const handleWager = async () => {
    if (!linkedBet || !selectedOption) {
      return
    }

    setBusyAction('wager')
    try {
      await onWager(linkedBet.id, selectedOption, wagerAmount)
      setSelectedOption(null)
    } finally {
      setBusyAction(null)
    }
  }

  const resultLabel =
    match.status === 'completed'
      ? currentMembershipId && currentMembershipId === match.winnerMembershipId
        ? 'You won the beer line'
        : `${getMemberLabel(match, match.winnerMembershipId)} won the beer line`
      : match.status === 'declined'
      ? 'Challenge declined'
      : match.status === 'cancelled'
      ? 'Challenge cancelled'
      : phase === 'your-turn'
      ? 'Your turn'
      : phase === 'your-decision'
      ? 'Accept the challenge'
      : `Waiting on ${otherPlayer.name}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={match.title}
      className="fixed inset-0 z-50 flex items-end justify-center"
    >
      <div className="absolute inset-0 bg-background/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative mb-0 w-full max-w-3xl overflow-hidden rounded-t-[2rem] border-t-3 border-x-3 border-border bg-card shadow-[0_24px_0_0_var(--border)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-win" />

        <div className="flex items-center justify-between px-5 pt-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Beer Bomb</p>
            <h2 className="text-xl font-bold text-card-foreground">{match.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-surface text-foreground transition-colors hover:bg-surface/80"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pb-5 pt-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {match.isDevSolo && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                Solo test
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold text-card-foreground">
              <Bomb className="h-3.5 w-3.5 text-primary" />
              {wager.toFixed(1)} drinks
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold text-card-foreground">
              <Swords className="h-3.5 w-3.5 text-primary" />
              {match.challenger.name} vs {match.opponent.name}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {formatRelativeTime(match.createdAt)}
            </span>
          </div>

          <div className="mb-4 rounded-2xl border-3 border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Match State</p>
                <p className="text-lg font-bold text-card-foreground">{resultLabel}</p>
              </div>
              <span
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide',
                  match.status === 'completed'
                    ? 'border-win/40 bg-win/15 text-win'
                    : match.status === 'pending'
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : match.status === 'declined' || match.status === 'cancelled'
                    ? 'border-loss/40 bg-loss/15 text-loss'
                    : 'border-border bg-card text-card-foreground'
                )}
              >
                {match.status}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{match.challenger.name}</span>
              <span>•</span>
              <span>{match.opponent.name}</span>
              <span>•</span>
              <span>
                {match.status === 'active'
                  ? isMyTurn
                    ? 'Your move'
                    : `Waiting on ${otherPlayer.name}`
                  : match.status === 'pending'
                  ? isMyDecision
                    ? 'You can accept or decline'
                    : 'Waiting for acceptance'
                  : 'Match complete'}
              </span>
            </div>
          </div>

          {linkedBet && (
            <div className="mb-4 rounded-2xl border-3 border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Linked Bet</p>
                  <p className="text-lg font-bold text-card-foreground">
                    {linkedBet.status === 'open'
                      ? 'Side bets are live'
                      : linkedBet.status === 'pending_result'
                      ? 'Result pending confirmation'
                      : linkedBet.status === 'disputed'
                      ? 'Crew dispute in progress'
                      : linkedBet.status === 'resolved'
                      ? 'Bet settled'
                      : 'Bet voided'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pool</p>
                  <p className="text-lg font-black text-primary">{formatDrinks(linkedBet.totalPool)} drinks</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {playerSummaries.map(({ option, player, playerStake, sidePool, sideBettorCount }) => {
                  const isSelected = selectedOption === option.id
                  return (
                    <button
                      key={option.id}
                      onClick={() => {
                        if (!canPlaceSideBet) return
                        setSelectedOption(isSelected ? null : option.id)
                      }}
                      disabled={!canPlaceSideBet}
                      className={cn(
                        'rounded-2xl border-2 p-4 text-left transition-all',
                        isSelected ? 'border-primary bg-primary/10' : 'border-border bg-card',
                        canPlaceSideBet && 'hover:border-primary/50'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Main event</p>
                          <p className="text-base font-bold text-card-foreground">{player.name}</p>
                        </div>
                        <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold text-card-foreground">
                          {formatDrinks(playerStake)} on self
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Side pool</span>
                        <span className="font-semibold text-card-foreground">
                          {formatDrinks(sidePool)} from {sideBettorCount} bettors
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total on side</span>
                        <span className="font-semibold text-primary">{formatDrinks(option.totalDrinks)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {canPlaceSideBet && (
                <div className="mt-4 rounded-2xl border-2 border-border bg-card p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Place Side Bet</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[0.5, 1, 2, 3].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setWagerAmount(amount)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-sm font-bold transition-all',
                          wagerAmount === amount
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-surface text-card-foreground'
                        )}
                      >
                        {formatDrinks(amount)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    {selectedOption
                      ? `If ${linkedBet.options.find((option) => option.id === selectedOption)?.label ?? 'that side'} wins, projected profit is +${formatDrinks(selectedProjection)} drinks.`
                      : 'Pick a side to preview your projected profit.'}
                  </div>
                  {userWager && (
                    <div className="mt-2 text-sm text-card-foreground">
                      Your current wager: {formatDrinks(userWager.wager.drinks)} on {linkedBet.options.find((option) => option.id === userWager.optionId)?.label ?? 'Unknown'}
                    </div>
                  )}
                  <button
                    onClick={() => void handleWager()}
                    disabled={!selectedOption || busyAction != null}
                    className="mt-4 rounded-xl border-2 border-border bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-brutal-sm transition-all hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-60"
                  >
                    {userWager ? 'Update wager' : 'Place wager'}
                  </button>
                </div>
              )}

              {!canPlaceSideBet && (
                <div className="mt-4 rounded-2xl border-2 border-border bg-card p-4 text-sm text-card-foreground">
                  {linkedBet.status === 'pending_result' && (
                    <>Proposed winner: {linkedBet.options.find((option) => option.id === linkedBet.pendingResultOptionId)?.label ?? 'Unknown'}.</>
                  )}
                  {linkedBet.status === 'disputed' && <>Crew voting is active for this result.</>}
                  {linkedBet.status === 'resolved' && (
                    <>Winning side: {linkedBet.options.find((option) => option.id === linkedBet.result)?.label ?? 'Unknown'}. Your net: {formatDrinks(userOutcome?.netResult ?? 0)}.</>
                  )}
                  {(linkedBet.status === 'void' || linkedBet.status === 'cancelled') && (
                    <>{linkedBet.voidReason ?? 'This linked bet was voided.'}</>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="relative overflow-hidden rounded-[1.75rem] border-3 border-border bg-[#2d1a10] shadow-[0_16px_0_0_var(--border)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,214,153,0.2),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.2))]" />
            {resolvedBackground ? (
              <img
                src={resolvedBackground}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-90"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#27130d_0%,#4a2c14_48%,#7c4b1c_100%)]" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-[#130a06]/90 via-[#130a06]/55 to-transparent" />
            <div className="relative flex min-h-[420px] flex-col justify-between p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="max-w-[70%] rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/85">
                  {phase === 'your-turn'
                    ? 'Tap one beer. If the bomb is hiding there, the line explodes.'
                    : phase === 'your-decision'
                    ? 'Accept the challenge, then the beers get lined up and the turn order is set.'
                    : match.status === 'completed'
                    ? 'The bomb has already been revealed.'
                    : `Waiting for ${otherPlayer.name} to move.`}
                </div>
                <MiniGameStatusBadge phase={phase} currentMembershipId={currentMembershipId} match={match} />
              </div>

              <div className="mt-10 flex justify-center">
                <div className="grid w-full max-w-4xl grid-cols-8 gap-1.5 sm:gap-3">
                  {boardSlots.map((slot, index) => {
                    const locked = !canActOnBoard || slot.state !== 'idle'
                    const revealed = slot.state === 'safe-empty' || slot.state === 'bomb-hit'
                    const shouldShake = slot.state === 'bomb-hit'

                    return (
                      <button
                        key={slot.index}
                        onClick={() => void handleSlotTap(index)}
                        disabled={locked}
                        aria-label={`Beer ${index + 1}${revealed && slot.state === 'bomb-hit' ? ', bomb' : revealed ? ', drained' : ''}`}
                        className={cn(
                          'relative aspect-[0.78] overflow-hidden rounded-xl border-2 border-white/15 bg-[#1a0e08]/65 px-1 pb-2 pt-1 text-left transition-all',
                          locked ? 'cursor-default' : 'hover:-translate-y-1 hover:border-primary/60',
                          slot.state === 'draining' && 'scale-95 border-primary/80 shadow-[0_0_0_2px_rgba(255,195,84,0.25)]',
                          slot.state === 'bomb-hit' && 'border-loss/70 bg-loss/15',
                          slot.state === 'safe-empty' && 'border-win/50 bg-win/10'
                        )}
                        style={{
                          transform: `translateY(${Math.abs(index - (match.boardSize - 1) / 2) * 1.5}px)`,
                        }}
                      >
                        <div
                          className={cn(
                            'absolute inset-x-2 top-1 rounded-full transition-all duration-300',
                            slot.state === 'bomb-hit'
                              ? 'h-8 bg-loss/70 blur-[2px]'
                              : slot.state === 'safe-empty'
                              ? 'h-2.5 bg-win/35'
                              : slot.state === 'draining'
                              ? 'h-9 bg-primary/40'
                              : 'h-10 bg-white/10'
                          )}
                        />

                        <div className={cn('relative flex h-full flex-col items-center justify-end gap-1', shouldShake && 'animate-pulse')}>
                          <div
                            className={cn(
                              'flex w-full flex-1 items-center justify-center transition-all duration-300',
                              slot.state === 'draining' && 'translate-y-2 scale-90 opacity-70',
                              slot.state === 'safe-empty' && 'translate-y-1 opacity-65',
                              slot.state === 'bomb-hit' && 'scale-110'
                            )}
                          >
                            {slot.state === 'bomb-hit' ? (
                              resolvedBeerBomb ? (
                                <img src={resolvedBeerBomb} alt="" className="h-full w-full object-contain drop-shadow-[0_10px_12px_rgba(0,0,0,0.35)]" />
                              ) : (
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-loss/20 text-loss">
                                  <Bomb className="h-7 w-7" />
                                </div>
                              )
                            ) : slot.state === 'safe-empty' ? (
                              resolvedBeerDrained ? (
                                <img src={resolvedBeerDrained} alt="" className="h-full w-full object-contain opacity-75" />
                              ) : (
                                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-win/30 bg-win/10 text-win">
                                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Drained</span>
                                </div>
                              )
                            ) : resolvedBeerIdle ? (
                              <img src={resolvedBeerIdle} alt="" className="h-full w-full object-contain drop-shadow-[0_10px_12px_rgba(0,0,0,0.35)]" />
                            ) : (
                              <div className="flex h-14 w-14 flex-col items-center justify-end rounded-[1.1rem] border border-white/20 bg-[linear-gradient(180deg,#c9a46b_0%,#b17331_48%,#8a4f21_100%)] px-1 pb-2 pt-1">
                                <div className="mb-1 h-3 w-4 rounded-full bg-[#f7e6b6]" />
                                <div className="h-7 w-full rounded-b-[0.75rem] bg-[linear-gradient(180deg,#f7d06c_0%,#d89b2e_100%)]" />
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.28em] text-white/75">{index + 1}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/80">
                  {match.status === 'active'
                    ? `${getMemberLabel(match, match.currentTurnMembershipId)} is up next`
                    : match.status === 'pending'
                    ? `Challenge is waiting on ${match.opponent.name}`
                    : match.status === 'completed'
                    ? `Winner: ${getMemberLabel(match, match.winnerMembershipId)}`
                    : `Status: ${match.status}`}
                </div>

                <div className="flex items-center gap-2">
                  {canCancel && (
                    <button
                      onClick={() => void handleCancel()}
                      disabled={busyAction != null}
                      className="rounded-xl border-2 border-border bg-surface px-4 py-2 text-sm font-bold text-foreground transition-all hover:border-loss/60 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  )}

                  {match.status === 'pending' && (
                    <>
                      {isMyDecision && (
                        <>
                          <button
                            onClick={() => void handleDecline()}
                            disabled={busyAction != null}
                            className="rounded-xl border-2 border-loss/40 bg-loss/15 px-4 py-2 text-sm font-bold text-loss transition-all hover:bg-loss/25 disabled:opacity-60"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => void handleAccept()}
                            disabled={busyAction != null}
                            className="rounded-xl border-2 border-border bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-brutal-sm transition-all hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-60"
                          >
                            Accept wager
                          </button>
                        </>
                      )}
                      {!isMyDecision && (
                        <div className="rounded-xl border-2 border-border bg-surface px-4 py-2 text-sm font-semibold text-muted-foreground">
                          Waiting for {match.opponent.name}
                        </div>
                      )}
                    </>
                  )}

                  {match.status === 'completed' && (
                    <button
                      onClick={onClose}
                      className="rounded-xl border-2 border-border bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-brutal-sm transition-all hover:translate-x-[1px] hover:translate-y-[1px]"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border-2 border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
            <span>
              {match.isDevSolo
                ? 'Solo test mode keeps the turn on you so you can tap through the board without a second player.'
                : match.status === 'active'
                ? 'The bomb is hidden until someone taps it.'
                : 'When the challenge is accepted, the board becomes live and turns alternate remotely.'}
            </span>
            <Flame className="h-4 w-4 text-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}
