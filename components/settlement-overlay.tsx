'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, Vote, CheckCircle, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BetOption {
  id: string
  label: string
}

interface Bet {
  title: string
  options: BetOption[]
}

interface SettlementOverlayProps {
  isOpen: boolean
  bet: Bet
  onVote: (optionId: string) => void
  onDefer: () => void
  onClose: () => void
}

export function SettlementOverlay({
  isOpen,
  bet,
  onVote,
  onDefer,
  onClose,
}: SettlementOverlayProps) {
  const [timeLeft, setTimeLeft] = useState(60)
  const [votedOptionId, setVotedOptionId] = useState<string | null>(null)
  const [deferred, setDeferred] = useState(false)
  const [expired, setExpired] = useState(false)

  // Reset state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setTimeLeft(60)
      setVotedOptionId(null)
      setDeferred(false)
      setExpired(false)
    }
  }, [isOpen])

  // Countdown timer
  useEffect(() => {
    if (!isOpen || expired) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setExpired(true)
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, expired])

  const handleVote = useCallback(
    (optionId: string) => {
      if (votedOptionId || deferred || expired) return
      setVotedOptionId(optionId)
      onVote(optionId)
    },
    [votedOptionId, deferred, expired, onVote]
  )

  const handleDefer = useCallback(() => {
    if (votedOptionId || deferred || expired) return
    setDeferred(true)
    onDefer()
  }, [votedOptionId, deferred, expired, onDefer])

  if (!isOpen) return null

  const hasVotedOrDeferred = votedOptionId !== null || deferred
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`
  const isUrgent = timeLeft <= 10

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/95 backdrop-blur-md" />

      {/* Content */}
      <div className="relative w-full max-w-md">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 p-2 rounded-full bg-surface border-2 border-border hover:bg-card transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="bg-card rounded-2xl border-3 border-border shadow-brutal overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b-2 border-border">
            <div className="flex items-center gap-2 mb-1">
              <Vote className="h-5 w-5 text-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                Disputed Bet
              </span>
            </div>
            <h2 className="text-xl font-bold text-card-foreground leading-tight">
              {bet.title}
            </h2>
          </div>

          {/* Timer */}
          <div
            className={cn(
              'flex items-center justify-center gap-2 py-3 border-b-2 border-border transition-colors',
              expired
                ? 'bg-loss/10'
                : isUrgent
                  ? 'bg-loss/10'
                  : 'bg-surface'
            )}
          >
            <Clock
              className={cn(
                'h-4 w-4',
                expired
                  ? 'text-loss'
                  : isUrgent
                    ? 'text-loss animate-pulse'
                    : 'text-muted-foreground'
              )}
            />
            <span
              className={cn(
                'font-mono font-bold text-lg',
                expired
                  ? 'text-loss'
                  : isUrgent
                    ? 'text-loss'
                    : 'text-card-foreground'
              )}
            >
              {expired ? 'Time\'s up!' : formattedTime}
            </span>
          </div>

          {/* Voting area */}
          <div className="p-5">
            {expired ? (
              /* Result state */
              <div className="text-center py-4">
                <CheckCircle className="h-10 w-10 text-win mx-auto mb-3" />
                <p className="text-lg font-bold text-card-foreground mb-1">
                  Voting Complete
                </p>
                <p className="text-sm text-muted-foreground">
                  Results are being tallied...
                </p>
              </div>
            ) : hasVotedOrDeferred ? (
              /* Waiting state */
              <div className="text-center py-4">
                <Loader2 className="h-10 w-10 text-primary mx-auto mb-3 animate-spin" />
                <p className="text-lg font-bold text-card-foreground mb-1">
                  {deferred ? 'Vote Deferred' : 'Vote Cast!'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Waiting for votes...
                </p>
              </div>
            ) : (
              /* Voting buttons */
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground font-medium mb-4 text-center">
                  Cast your vote
                </p>
                {bet.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleVote(option.id)}
                    className="w-full p-4 rounded-xl bg-surface border-2 border-border text-left font-bold text-foreground text-lg hover:border-primary hover:bg-primary/10 active:shadow-none active:translate-x-[2px] active:translate-y-[2px] shadow-[3px_3px_0px_0px_var(--border)] transition-all"
                  >
                    {option.label}
                  </button>
                ))}

                {/* Defer button */}
                <button
                  onClick={handleDefer}
                  className="w-full mt-2 py-3 rounded-xl border-2 border-border text-muted-foreground font-semibold hover:bg-surface transition-colors"
                >
                  Defer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
