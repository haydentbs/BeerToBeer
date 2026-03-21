'use client'

import { useState, useEffect } from 'react'
import { Clock, Users, Swords, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bet } from '@/lib/store'
import { formatDrinks, getTimeRemaining } from '@/lib/store'

interface BetCardProps {
  bet: Bet
  onWager: (betId: string, optionId: string, drinks: number) => void
}

export function BetCard({ bet, onWager }: BetCardProps) {
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining(bet.closesAt))
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [wagerAmount, setWagerAmount] = useState(1)

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining(bet.closesAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [bet.closesAt])

  const handleWager = () => {
    if (selectedOption) {
      onWager(bet.id, selectedOption, wagerAmount)
      setSelectedOption(null)
    }
  }

  return (
    <div className="bg-card rounded-2xl border-3 border-border shadow-[4px_4px_0px_0px_var(--border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {bet.type === 'h2h' ? (
              <Swords className="h-4 w-4 text-primary" />
            ) : (
              <HelpCircle className="h-4 w-4 text-primary" />
            )}
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {bet.type === 'h2h' ? 'Head-to-Head' : 'Prop Bet'}
            </span>
          </div>
          <h3 className="font-bold text-card-foreground text-lg leading-tight">{bet.title}</h3>
          {bet.description && (
            <p className="text-sm text-muted-foreground mt-1">{bet.description}</p>
          )}
        </div>
        
        {/* Timer Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-elevated border-2 border-border">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold text-card-foreground font-mono">{timeRemaining}</span>
        </div>
      </div>

      {/* Pool Info */}
      <div className="px-4 pb-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {bet.options.reduce((acc, opt) => acc + opt.wagers.length, 0)} bettors
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-primary">
            {formatDrinks(bet.totalPool)} drinks in pool
          </span>
        </div>
      </div>

      {/* Options */}
      <div className="px-4 pb-4 space-y-2">
        {bet.options.map((option) => {
          const percentage = bet.totalPool > 0 
            ? Math.round((option.totalDrinks / bet.totalPool) * 100) 
            : 0
          const isSelected = selectedOption === option.id
          
          return (
            <button
              key={option.id}
              onClick={() => setSelectedOption(isSelected ? null : option.id)}
              className={cn(
                'w-full relative overflow-hidden rounded-xl border-2 p-3 transition-all text-left',
                isSelected 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border bg-surface hover:border-primary/50'
              )}
            >
              {/* Progress Bar Background */}
              <div 
                className="absolute inset-0 bg-primary/10 transition-all"
                style={{ width: `${percentage}%` }}
              />
              
              <div className="relative flex items-center justify-between">
                <span className={cn(
                  'font-semibold',
                  isSelected ? 'text-primary' : 'text-card-foreground'
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

              {/* Wager Avatars */}
              {option.wagers.length > 0 && (
                <div className="relative mt-2 flex items-center gap-1">
                  {option.wagers.slice(0, 4).map((wager, i) => (
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

      {/* Wager Controls */}
      {selectedOption && (
        <div className="px-4 pb-4 pt-2 border-t-2 border-border bg-surface">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Your Wager
              </label>
              <div className="flex items-center gap-2 mt-1">
                {[0.5, 1, 2].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setWagerAmount(amount)}
                    className={cn(
                      'px-4 py-2 rounded-lg border-2 font-bold text-sm transition-all',
                      wagerAmount === amount
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-card-foreground hover:border-primary'
                    )}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleWager}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-display font-normal border-2 border-border shadow-[3px_3px_0px_0px_var(--border)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all"
            >
              Place Bet
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
