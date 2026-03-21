'use client'

import { useState } from 'react'
import { X, Clock, Users, Swords, HelpCircle, AlertTriangle, CheckCircle, Vote } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bet } from '@/lib/store'
import {
  formatDrinks,
  getMemberOutcomeForBet,
  getUserWagerForBet,
  projectBetPayout,
} from '@/lib/store'
import { useCurrentUser } from '@/lib/current-user'
import { useTimeRemaining } from '@/hooks/use-time-remaining'

const WAGER_AMOUNTS = [0.5, 1, 2, 3]
const CONFIRM_WINDOW_MS = 60_000

interface BetDetailModalProps {
  bet: Bet | null
  isOpen: boolean
  onClose: () => void
  onWager: (betId: string, optionId: string, drinks: number) => void
  onProposeResult?: (betId: string, optionId: string) => void
  onConfirmResult?: (betId: string) => void
  onDisputeResult?: (betId: string) => void
  onCastDisputeVote?: (betId: string, optionId: string) => void
}

export function BetDetailModal({
  bet,
  isOpen,
  onClose,
  onWager,
  onProposeResult,
  onConfirmResult,
  onDisputeResult,
  onCastDisputeVote,
}: BetDetailModalProps) {
  const currentUser = useCurrentUser()
  const { label: timeLabel } = useTimeRemaining(bet?.closesAt)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [wagerAmount, setWagerAmount] = useState(1)
  const [isReportingResult, setIsReportingResult] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)

  // Pending result confirmation timer (60s from pendingResultAt)
  const confirmDeadline = bet?.pendingResultAt ? new Date(bet.pendingResultAt.getTime() + CONFIRM_WINDOW_MS) : null
  const { label: confirmLabel, secondsLeft: confirmSecondsLeft } = useTimeRemaining(confirmDeadline)

  const handleWager = () => {
    if (selectedOption && bet) {
      onWager(bet.id, selectedOption, wagerAmount)
      setSelectedOption(null)
      onClose()
    }
  }

  const handleProposeResult = (optionId: string) => {
    if (bet && onProposeResult) {
      onProposeResult(bet.id, optionId)
      setIsReportingResult(false)
    }
  }

  const handleConfirmResult = () => {
    if (bet && onConfirmResult) {
      onConfirmResult(bet.id)
    }
  }

  const handleDisputeResult = () => {
    if (bet && onDisputeResult) {
      onDisputeResult(bet.id)
    }
  }

  const handleCastVote = (optionId: string) => {
    if (bet && onCastDisputeVote) {
      onCastDisputeVote(bet.id, optionId)
      setHasVoted(true)
    }
  }

  if (!isOpen || !bet) return null

  const isResolved = bet.status === 'resolved'
  const isPendingAccept = bet.status === 'pending_accept'
  const isPendingResult = bet.status === 'pending_result'
  const isDisputed = bet.status === 'disputed'
  const isVoid = bet.status === 'void' || bet.status === 'cancelled'
  const isDeclined = bet.status === 'declined'
  const isOpen_ = bet.status === 'open'
  const userOutcome = getMemberOutcomeForBet(bet, currentUser.id)
  const userWager = getUserWagerForBet(bet, currentUser.id)
  const selectedProjection = selectedOption
    ? projectBetPayout(bet, selectedOption, wagerAmount, currentUser.id)
    : 0

  // Can this user report the result?
  const wageringClosed = isOpen_ && bet.closesAt && bet.closesAt.getTime() <= Date.now()
  const h2hInProgress = bet.type === 'h2h' && isOpen_ && !bet.closesAt
  const canReport = (wageringClosed || h2hInProgress) &&
    (bet.creator.id === currentUser.id || bet.challenger?.id === currentUser.id)

  // Can place wagers? Only on open bets with time remaining
  const canWager = isOpen_ && !wageringClosed && !h2hInProgress && !isPendingAccept && !isDeclined

  // Pending result: did current user propose it?
  const userProposedResult = isPendingResult &&
    (bet.creator.id === currentUser.id || bet.challenger?.id === currentUser.id)
  const confirmWindowExpired = confirmSecondsLeft !== null && confirmSecondsLeft <= 0

  // H2H: separate main match from side bets display
  const isH2H = bet.type === 'h2h'
  const challengeWager = bet.challengeWager ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-card rounded-t-3xl border-t-3 border-x-3 border-border safe-area-bottom animate-in slide-in-from-bottom duration-300 mb-16">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-border" />
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface border-2 border-border flex items-center justify-center"
        >
          <X className="w-4 h-4 text-foreground" />
        </button>

        <div className="px-5 pb-6 max-h-[70vh] overflow-y-auto">
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              {bet.type === 'h2h' ? (
                <Swords className="h-4 w-4 text-primary" />
              ) : (
                <HelpCircle className="h-4 w-4 text-primary" />
              )}
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {bet.type === 'h2h'
                  ? 'Head-to-Head'
                  : bet.subtype === 'overunder'
                    ? 'Over / Under'
                    : bet.subtype === 'multi'
                      ? 'Prediction'
                      : 'Group Bet'}
              </span>
            </div>
            <h2 className="font-bold text-card-foreground text-xl">{bet.title}</h2>
            {bet.description && (
              <p className="text-sm text-muted-foreground mt-1">{bet.description}</p>
            )}
            {bet.subtype === 'overunder' && bet.line != null && (
              <p className="mt-2 text-sm font-semibold text-primary">Line: {bet.line.toFixed(1)}</p>
            )}
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4 mb-4">
            {bet.closesAt && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border-2 border-border">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold text-foreground font-mono">{timeLabel}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {bet.options.reduce((acc, opt) => acc + opt.wagers.length, 0)} bettors
              </span>
            </div>
            <span className="text-sm font-semibold text-primary">
              {formatDrinks(bet.totalPool)} drinks
            </span>
          </div>

          {/* H2H Main Match Display */}
          {isH2H && challengeWager > 0 && (
            <div className="mb-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-primary mb-2">Main Match</div>
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <p className="font-bold text-card-foreground">{bet.creator.name}</p>
                  <p className="text-sm text-primary font-semibold">{formatDrinks(challengeWager)} drinks</p>
                </div>
                <div className="px-3">
                  <span className="text-xs font-bold text-muted-foreground">VS</span>
                </div>
                <div className="text-center flex-1">
                  <p className="font-bold text-card-foreground">{bet.challenger?.name ?? 'Opponent'}</p>
                  <p className="text-sm text-primary font-semibold">{formatDrinks(challengeWager)} drinks</p>
                </div>
              </div>
            </div>
          )}

          {/* Status Banners */}
          {isPendingAccept && (
            <div className="mb-4 rounded-xl border-2 border-border bg-surface p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending Invite</div>
              <div className="mt-2 text-sm text-card-foreground">
                Waiting for {bet.challenger?.name ?? 'the challenged player'} to accept {formatDrinks(challengeWager)} drinks.
              </div>
            </div>
          )}

          {isPendingResult && (
            <div className="mb-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wide text-primary">Result Proposed</span>
              </div>
              <p className="text-sm text-card-foreground">
                Proposed winner: <span className="font-bold">{bet.options.find((o) => o.id === bet.pendingResultOptionId)?.label ?? 'Unknown'}</span>
              </p>
              {confirmDeadline && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {confirmWindowExpired ? 'Confirmation window elapsed' : `Confirm window: ${confirmLabel}`}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                {!userProposedResult && onDisputeResult && (
                  <button
                    onClick={handleDisputeResult}
                    className="flex-1 rounded-lg border-2 border-loss/40 bg-loss/10 px-3 py-2 text-sm font-bold text-loss transition-colors hover:bg-loss/20"
                  >
                    Dispute
                  </button>
                )}
                {confirmWindowExpired && onConfirmResult && (
                  <button
                    onClick={handleConfirmResult}
                    className="flex-1 rounded-lg border-2 border-primary bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                  >
                    Confirm Result
                  </button>
                )}
              </div>
            </div>
          )}

          {isDisputed && (
            <div className="mb-4 rounded-xl border-2 border-loss/40 bg-loss/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-loss" />
                <span className="text-xs font-bold uppercase tracking-wide text-loss">Crew Vote</span>
              </div>
              <p className="text-sm text-card-foreground mb-3">
                The result is disputed. Vote on who won:
              </p>
              <div className="space-y-2">
                {bet.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleCastVote(option.id)}
                    disabled={hasVoted}
                    className={cn(
                      'w-full rounded-lg border-2 px-4 py-3 text-left text-sm font-semibold transition-all',
                      hasVoted
                        ? 'border-border/40 bg-surface/50 text-muted-foreground opacity-60'
                        : 'border-border bg-card text-card-foreground hover:border-primary active:scale-[0.98]'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option.label}</span>
                      <Vote className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
              {hasVoted && (
                <p className="mt-2 text-xs text-muted-foreground text-center">Vote submitted — waiting for others</p>
              )}
            </div>
          )}

          {isDeclined && (
            <div className="mb-4 rounded-xl border-2 border-border bg-surface p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Declined</div>
              <div className="mt-2 text-sm text-card-foreground">
                {bet.voidReason ?? 'This bet invite was declined.'}
              </div>
            </div>
          )}

          {/* Options — wagering or viewing */}
          {!isReportingResult && (
            <div className="space-y-2 mb-4">
              {isH2H && !isResolved && !isVoid && !isDeclined && !isPendingAccept && (
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                  {canWager ? 'Side Bets' : 'Options'}
                </div>
              )}
              {bet.options.map((option) => {
                const percentage = bet.totalPool > 0
                  ? Math.round((option.totalDrinks / bet.totalPool) * 100)
                  : 0
                const isSelected = selectedOption === option.id
                const canSelect = canWager && !isDisputed

                return (
                  <button
                    key={option.id}
                    onClick={() => canSelect && setSelectedOption(isSelected ? null : option.id)}
                    disabled={!canSelect}
                    className={cn(
                      'w-full relative overflow-hidden rounded-xl border-2 p-3 transition-all text-left',
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-surface',
                      canSelect && 'hover:border-primary/50'
                    )}
                  >
                    <div
                      className="absolute inset-0 bg-primary/10 transition-all"
                      style={{ width: `${percentage}%` }}
                    />

                    <div className="relative flex items-center justify-between">
                      <span className={cn(
                        'font-semibold',
                        isSelected ? 'text-primary' : 'text-foreground'
                      )}>
                        {option.label}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {formatDrinks(option.totalDrinks)} drinks
                        </span>
                        <span className="text-sm font-bold text-primary">
                          {percentage}%
                        </span>
                      </div>
                    </div>

                    {option.wagers.length > 0 && (
                      <div className="relative mt-2 flex items-center gap-1">
                        {option.wagers.slice(0, 4).map((wager) => (
                          <div
                            key={wager.user.id}
                            className="w-6 h-6 rounded-full bg-secondary border-2 border-card flex items-center justify-center -ml-1 first:ml-0"
                          >
                            <span className="text-[10px] font-bold text-secondary-foreground">
                              {wager.user.initials}
                            </span>
                          </div>
                        ))}
                        {option.wagers.length > 4 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            +{option.wagers.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Report Result UI */}
          {isReportingResult && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-card-foreground">Who won?</span>
              </div>
              <div className="space-y-2">
                {bet.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleProposeResult(option.id)}
                    className="w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-left font-semibold text-card-foreground transition-all hover:border-primary active:scale-[0.98]"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setIsReportingResult(false)}
                className="mt-3 w-full rounded-lg py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Settlement Info */}
          {(isResolved || isVoid) && (
            <div className="rounded-xl border-2 border-border bg-surface p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isVoid ? 'Result' : 'Settlement'}
              </div>
              {isVoid ? (
                <div className="mt-2 text-sm text-card-foreground">
                  {bet.voidReason ?? 'This bet was voided.'}
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Winning option</span>
                    <span className="font-semibold text-card-foreground">
                      {bet.options.find((option) => option.id === bet.result)?.label ?? 'Unknown'}
                    </span>
                  </div>
                  {userWager && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">You bet on</span>
                      <span className="font-semibold text-card-foreground">
                        {bet.options.find((o) => o.id === userWager.optionId)?.label ?? 'Unknown'}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Your stake</span>
                    <span className="font-semibold text-card-foreground">
                      {formatDrinks(userOutcome?.stake ?? userWager?.wager.drinks ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Your net</span>
                    <span
                      className={cn(
                        'font-bold',
                        (userOutcome?.netResult ?? 0) > 0
                          ? 'text-win'
                          : (userOutcome?.netResult ?? 0) < 0
                            ? 'text-loss'
                            : 'text-card-foreground'
                      )}
                    >
                      {(userOutcome?.netResult ?? 0) > 0 ? '+' : ''}
                      {formatDrinks(userOutcome?.netResult ?? 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Wager Controls */}
          {canWager && selectedOption && !isReportingResult && (
            <div className="pt-4 border-t-2 border-border">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Your Wager
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    {WAGER_AMOUNTS.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setWagerAmount(amount)}
                        className={cn(
                          'px-4 py-2 rounded-lg border-2 font-bold text-sm transition-all',
                          wagerAmount === amount
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-surface text-foreground'
                        )}
                      >
                        {amount}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Estimated net if this wins now:{' '}
                    <span className="font-semibold text-win">
                      +{formatDrinks(selectedProjection)}
                    </span>
                  </p>
                </div>
                <button
                  onClick={handleWager}
                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-display font-normal border-2 border-border shadow-brutal-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                >
                  Place Bet
                </button>
              </div>
            </div>
          )}

          {/* Report Result Button */}
          {canReport && !isReportingResult && onProposeResult && (
            <div className="pt-4 border-t-2 border-border">
              <button
                onClick={() => setIsReportingResult(true)}
                className="w-full rounded-xl border-2 border-primary bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-brutal-sm transition-all active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
              >
                Report Result
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
