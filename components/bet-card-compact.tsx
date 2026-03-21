'use client'

import { useState, useEffect } from 'react'
import { Clock, Swords, HelpCircle, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bet } from '@/lib/store'
import { formatDrinks, getMemberOutcomeForBet, getTimeRemainingOrLabel } from '@/lib/store'
import { useCurrentUser } from '@/lib/current-user'

interface BetCardCompactProps {
  bet: Bet
  onTap: (bet: Bet) => void
}

export function BetCardCompact({ bet, onTap }: BetCardCompactProps) {
  const currentUser = useCurrentUser()
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null)

  useEffect(() => {
    // Set initial value on client only to avoid hydration mismatch
    setTimeRemaining(getTimeRemainingOrLabel(bet.closesAt))
    
    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemainingOrLabel(bet.closesAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [bet.closesAt])

  const leadingOption = bet.options.reduce((a, b) => 
    a.totalDrinks > b.totalDrinks ? a : b
  )
  
  const isResolved = bet.status === 'resolved'
  const isPendingAccept = bet.status === 'pending_accept'
  const isPendingResult = bet.status === 'pending_result'
  const isDisputed = bet.status === 'disputed'
  const isVoid = bet.status === 'void' || bet.status === 'cancelled'
  const isDeclined = bet.status === 'declined'
  const userOutcome = getMemberOutcomeForBet(bet, currentUser.id)

  return (
    <button
      onClick={() => onTap(bet)}
      className="w-full bg-card rounded-xl border-2 border-border p-3 transition-all active:scale-[0.98] text-left flex items-center gap-3"
    >
      {/* Icon */}
      <div className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
        isResolved ? 'bg-win/20' : 'bg-surface'
      )}>
        {isResolved ? (
          <Check className="w-5 h-5 text-win" />
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
          {(isResolved || isVoid || isDeclined) ? (
            <>
              <span className="text-xs text-muted-foreground">
                {isDeclined
                  ? 'Declined'
                  : isVoid
                  ? 'Void'
                  : `You ${((userOutcome?.netResult ?? 0) >= 0) ? 'net' : 'lost'}`}
              </span>
              {!isVoid && !isDeclined && (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className={cn(
                    'text-xs font-semibold',
                    (userOutcome?.netResult ?? 0) > 0 ? 'text-win' : (userOutcome?.netResult ?? 0) < 0 ? 'text-loss' : 'text-muted-foreground'
                  )}>
                    {(userOutcome?.netResult ?? 0) > 0 ? '+' : ''}
                    {formatDrinks(userOutcome?.netResult ?? 0)}
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">
                {formatDrinks(bet.totalPool)} drinks
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {bet.options.reduce((acc, opt) => acc + opt.wagers.length, 0)} bettors
              </span>
            </>
          )}
          {!isResolved && !isVoid && !isDeclined && !isPendingAccept && !isPendingResult && !isDisputed && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs font-semibold text-primary">
                {leadingOption.label}
              </span>
            </>
          )}
          {isPendingResult && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs font-semibold text-primary">Result pending</span>
            </>
          )}
          {isDisputed && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs font-semibold text-loss">Under dispute</span>
            </>
          )}
          {isPendingAccept && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs font-semibold text-primary">Awaiting response</span>
            </>
          )}
        </div>
      </div>

      {/* Timer / Status */}
      <div className="shrink-0 flex items-center gap-2">
        {isResolved || isVoid || isDeclined ? (
          <span className={cn('text-xs font-semibold uppercase', isVoid || isDeclined ? 'text-muted-foreground' : 'text-win')}>
            {isDeclined ? 'Declined' : isVoid ? 'Void' : 'Settled'}
          </span>
        ) : isPendingAccept ? (
          <span className="text-xs font-semibold uppercase text-primary">Invite</span>
        ) : isPendingResult ? (
          <span className="text-xs font-semibold uppercase text-primary">Pending</span>
        ) : isDisputed ? (
          <span className="text-xs font-semibold uppercase text-loss">Disputed</span>
        ) : (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-surface border border-border">
            <Clock className="w-3 h-3 text-primary" />
            <span className="text-xs font-bold text-foreground font-mono">{timeRemaining ?? '--:--'}</span>
          </div>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </button>
  )
}
