'use client'

import { useState } from 'react'
import { BetCardCompact } from './bet-card-compact'
import { BetDetailModal } from './bet-detail-modal'
import { useTheme } from './theme-provider'
import type { Bet, Night } from '@/lib/store'

interface TonightScreenProps {
  night: Night
  onWager: (betId: string, optionId: string, drinks: number) => void
}

export function TonightScreen({ night, onWager }: TonightScreenProps) {
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null)
  const { drinkEmoji } = useTheme()
  
  const activeBets = night.bets.filter(b => b.status === 'open')
  const resolvedBets = night.bets.filter(b => b.status === 'resolved')
  const totalPool = night.bets.reduce((acc, b) => acc + b.totalPool, 0)

  return (
    <>
      <div className="pb-24 px-4 space-y-5">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl border-2 border-border p-3 text-center">
            <div className="text-2xl font-bold text-primary">{activeBets.length}</div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active</div>
          </div>
          <div className="bg-card rounded-xl border-2 border-border p-3 text-center">
            <div className="text-2xl font-bold text-card-foreground">{night.participants.length}</div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Players</div>
          </div>
          <div className="bg-card rounded-xl border-2 border-border p-3 text-center">
            <div className="text-2xl font-bold text-win">{totalPool.toFixed(1)}</div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pool</div>
          </div>
        </div>

        {/* Active Bets Section */}
        {activeBets.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Active Bets</h2>
              <span className="text-xs text-muted-foreground">{activeBets.length} open</span>
            </div>
            <div className="space-y-2">
              {activeBets.map((bet) => (
                <BetCardCompact key={bet.id} bet={bet} onTap={setSelectedBet} />
              ))}
            </div>
          </section>
        )}

        {/* Resolved Bets Section */}
        {resolvedBets.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Settled</h2>
              <span className="text-xs text-muted-foreground">{resolvedBets.length} done</span>
            </div>
            <div className="space-y-2">
              {resolvedBets.map((bet) => (
                <BetCardCompact key={bet.id} bet={bet} onTap={setSelectedBet} />
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {activeBets.length === 0 && resolvedBets.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-surface border-2 border-border mx-auto flex items-center justify-center mb-4">
              <span className="text-2xl">{drinkEmoji}</span>
            </div>
            <h3 className="font-bold text-foreground mb-2">No bets yet</h3>
            <p className="text-sm text-muted-foreground">
              Create the first bet of the night!
            </p>
          </div>
        )}
      </div>

      {/* Bet Detail Modal */}
      <BetDetailModal
        bet={selectedBet}
        isOpen={!!selectedBet}
        onClose={() => setSelectedBet(null)}
        onWager={onWager}
      />
    </>
  )
}
