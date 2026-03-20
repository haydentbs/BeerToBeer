'use client'

import { useState, useEffect } from 'react'
import { X, Clock, Users, Swords, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bet } from '@/lib/store'
import { formatDrinks, getTimeRemaining } from '@/lib/store'

interface BetDetailModalProps {
  bet: Bet | null
  isOpen: boolean
  onClose: () => void
  onWager: (betId: string, optionId: string, drinks: number) => void
}

export function BetDetailModal({ bet, isOpen, onClose, onWager }: BetDetailModalProps) {
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [wagerAmount, setWagerAmount] = useState(1)

  useEffect(() => {
    if (bet) {
      // Set initial value on client only to avoid hydration mismatch
      setTimeRemaining(getTimeRemaining(bet.closesAt))
      const interval = setInterval(() => {
        setTimeRemaining(getTimeRemaining(bet.closesAt))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [bet])

  const handleWager = () => {
    if (selectedOption && bet) {
      onWager(bet.id, selectedOption, wagerAmount)
      setSelectedOption(null)
      onClose()
    }
  }

  if (!isOpen || !bet) return null

  const isResolved = bet.status === 'resolved'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-card rounded-t-3xl border-t-3 border-x-3 border-border safe-area-bottom animate-in slide-in-from-bottom duration-300 mb-16">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-border" />
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface border-2 border-border flex items-center justify-center"
        >
          <X className="w-4 h-4 text-foreground" />
        </button>

        <div className="px-5 pb-6">
          {/* Header */}
          <div className="mb-4">
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
            <h2 className="font-bold text-card-foreground text-xl">{bet.title}</h2>
            {bet.description && (
              <p className="text-sm text-muted-foreground mt-1">{bet.description}</p>
            )}
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border-2 border-border">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold text-foreground font-mono">{timeRemaining ?? '--:--'}</span>
            </div>
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

          {/* Options */}
          <div className="space-y-2 mb-4">
            {bet.options.map((option) => {
              const percentage = bet.totalPool > 0 
                ? Math.round((option.totalDrinks / bet.totalPool) * 100) 
                : 0
              const isSelected = selectedOption === option.id
              
              return (
                <button
                  key={option.id}
                  onClick={() => !isResolved && setSelectedOption(isSelected ? null : option.id)}
                  disabled={isResolved}
                  className={cn(
                    'w-full relative overflow-hidden rounded-xl border-2 p-3 transition-all text-left',
                    isSelected 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border bg-surface',
                    !isResolved && 'hover:border-primary/50'
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

          {/* Wager Controls */}
          {!isResolved && selectedOption && (
            <div className="pt-4 border-t-2 border-border">
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
                            : 'border-border bg-surface text-foreground'
                        )}
                      >
                        {amount}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleWager}
                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold border-2 border-border shadow-brutal-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                >
                  Place Bet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
