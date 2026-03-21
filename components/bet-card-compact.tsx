'use client'

import { Clock, Swords, HelpCircle, ChevronRight, Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bet, BetMemberOutcome } from '@/lib/store'
import { formatDrinks, getMemberOutcomeForBet } from '@/lib/store'
import { useCurrentUser } from '@/lib/current-user'
import { useTimeRemaining } from '@/hooks/use-time-remaining'

interface BetCardCompactProps {
  bet: Bet
  onTap: (bet: Bet) => void
}

/** Derive all display strings and colors from bet status, avoiding nested ternaries. */
function getBetStatusDisplay(bet: Bet, userOutcome: BetMemberOutcome | null) {
  const net = userOutcome?.netResult ?? 0
  const closedButOpen = bet.status === 'open' && bet.closesAt && bet.closesAt.getTime() <= Date.now()
  const h2hInProgress = bet.type === 'h2h' && bet.status === 'open' && !bet.closesAt

  switch (bet.status) {
    case 'resolved':
      return {
        detailLabel: `You ${net >= 0 ? 'net' : 'lost'}`,
        detailValue: net !== 0 ? `${net > 0 ? '+' : ''}${formatDrinks(net)}` : null,
        detailColor: net > 0 ? 'text-win' : net < 0 ? 'text-loss' : 'text-muted-foreground',
        badge: 'Settled',
        badgeColor: 'text-win',
      }
    case 'void':
    case 'cancelled':
      return {
        detailLabel: 'Void',
        detailValue: null,
        detailColor: 'text-muted-foreground',
        badge: 'Void',
        badgeColor: 'text-muted-foreground',
      }
    case 'declined':
      return {
        detailLabel: 'Declined',
        detailValue: null,
        detailColor: 'text-muted-foreground',
        badge: 'Declined',
        badgeColor: 'text-muted-foreground',
      }
    case 'pending_accept':
      return {
        detailLabel: 'Awaiting response',
        detailValue: null,
        detailColor: 'text-primary',
        badge: 'Invite',
        badgeColor: 'text-primary',
      }
    case 'pending_result':
      return {
        detailLabel: 'Result pending',
        detailValue: null,
        detailColor: 'text-primary',
        badge: 'Pending',
        badgeColor: 'text-primary',
      }
    case 'disputed':
      return {
        detailLabel: 'Disputed — vote now',
        detailValue: null,
        detailColor: 'text-loss',
        badge: 'Disputed',
        badgeColor: 'text-loss',
      }
    default: {
      // 'open' status
      if (closedButOpen) {
        return {
          detailLabel: 'Awaiting result',
          detailValue: null,
          detailColor: 'text-amber-400',
          badge: 'Awaiting',
          badgeColor: 'text-amber-400',
        }
      }
      if (h2hInProgress) {
        return {
          detailLabel: 'In progress',
          detailValue: null,
          detailColor: 'text-primary',
          badge: 'Live',
          badgeColor: 'text-primary',
        }
      }
      // Normal open bet with timer
      const leadingOption = bet.options.reduce((a, b) => a.totalDrinks > b.totalDrinks ? a : b)
      return {
        detailLabel: leadingOption.label,
        detailValue: null,
        detailColor: 'text-primary',
        badge: null, // timer shown instead
        badgeColor: null,
      }
    }
  }
}

export function BetCardCompact({ bet, onTap }: BetCardCompactProps) {
  const currentUser = useCurrentUser()
  const { label: timeLabel, secondsLeft } = useTimeRemaining(bet.closesAt)

  const isTerminal = ['resolved', 'void', 'cancelled', 'declined'].includes(bet.status)
  const userOutcome = getMemberOutcomeForBet(bet, currentUser.id)
  const status = getBetStatusDisplay(bet, userOutcome)
  const showTimer = !isTerminal && !status.badge

  // Timer urgency coloring
  const timerUrgent = secondsLeft !== null && secondsLeft <= 15
  const timerWarning = secondsLeft !== null && secondsLeft <= 60 && secondsLeft > 15

  return (
    <button
      onClick={() => onTap(bet)}
      className="w-full bg-card rounded-xl border-2 border-border p-3 transition-all active:scale-[0.98] text-left flex items-center gap-3"
    >
      {/* Icon */}
      <div className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
        bet.status === 'resolved' ? 'bg-win/20'
          : bet.status === 'disputed' ? 'bg-loss/15'
          : 'bg-surface'
      )}>
        {bet.status === 'resolved' ? (
          <Check className="w-5 h-5 text-win" />
        ) : bet.status === 'disputed' ? (
          <AlertTriangle className="w-5 h-5 text-loss" />
        ) : bet.type === 'h2h' ? (
          <Swords className="w-5 h-5 text-primary" />
        ) : (
          <HelpCircle className="w-5 h-5 text-primary" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-card-foreground text-sm truncate">{bet.title}</h3>
        <div className="flex items-center gap-2 mt-0.5">
          {isTerminal ? (
            <>
              <span className="text-xs text-muted-foreground">{status.detailLabel}</span>
              {status.detailValue && (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className={cn('text-xs font-semibold', status.detailColor)}>{status.detailValue}</span>
                </>
              )}
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">{formatDrinks(bet.totalPool)} drinks</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {bet.options.reduce((acc, opt) => acc + opt.wagers.length, 0)} bettors
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className={cn('text-xs font-semibold', status.detailColor)}>{status.detailLabel}</span>
            </>
          )}
        </div>
      </div>

      {/* Timer / Status Badge */}
      <div className="shrink-0 flex items-center gap-2">
        {showTimer ? (
          <div className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-full border',
            timerUrgent
              ? 'bg-amber-500/20 border-amber-500/50 animate-pulse'
              : timerWarning
              ? 'bg-amber-500/15 border-amber-500/30'
              : 'bg-surface border-border'
          )}>
            <Clock className={cn('w-3 h-3', timerUrgent || timerWarning ? 'text-amber-400' : 'text-primary')} />
            <span className={cn(
              'text-xs font-bold font-mono',
              timerUrgent || timerWarning ? 'text-amber-400' : 'text-foreground'
            )}>
              {timeLabel}
            </span>
          </div>
        ) : status.badge ? (
          <span className={cn('text-xs font-semibold uppercase', status.badgeColor)}>
            {status.badge}
          </span>
        ) : null}
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </button>
  )
}
