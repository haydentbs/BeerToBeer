'use client'

import { useState, useEffect } from 'react'
import { Clock, Swords, HelpCircle, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bet } from '@/lib/store'
import { formatDrinks, getTimeRemaining } from '@/lib/store'

interface BetCardCompactProps {
  bet: Bet
  onTap: (bet: Bet) => void
}

export function BetCardCompact({ bet, onTap }: BetCardCompactProps) {
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null)

  useEffect(() => {
    // Set initial value on client only to avoid hydration mismatch
    setTimeRemaining(getTimeRemaining(bet.closesAt))
    
    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining(bet.closesAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [bet.closesAt])

  const leadingOption = bet.options.reduce((a, b) => 
    a.totalDrinks > b.totalDrinks ? a : b
  )
  
  const isResolved = bet.status === 'resolved'

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
          <span className="text-xs text-muted-foreground">
            {formatDrinks(bet.totalPool)} drinks
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {bet.options.reduce((acc, opt) => acc + opt.wagers.length, 0)} bettors
          </span>
          {!isResolved && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs font-semibold text-primary">
                {leadingOption.label}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Timer / Status */}
      <div className="shrink-0 flex items-center gap-2">
        {isResolved ? (
          <span className="text-xs font-semibold text-win uppercase">Settled</span>
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
