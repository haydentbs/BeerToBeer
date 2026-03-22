'use client'

import { useState, useMemo } from 'react'
import { ArrowRight, Check, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDrinks, type LedgerEntry, type User } from '@/lib/store'
import { useCurrentUser } from '@/lib/current-user'

interface LedgerScreenProps {
  tonightLedger: LedgerEntry[]
  allTimeLedger: LedgerEntry[]
  onSettle: (entry: LedgerEntry) => void
}

export function LedgerScreen({ tonightLedger, allTimeLedger, onSettle }: LedgerScreenProps) {
  const currentUser = useCurrentUser()
  const [view, setView] = useState<'tonight' | 'alltime'>('tonight')
  const ledger = view === 'tonight' ? tonightLedger : allTimeLedger

  // Calculate net position
  const calculateNet = (entries: LedgerEntry[]) => {
    let owed = 0 // drinks owed TO you
    let owing = 0 // drinks you OWE
    
    entries.forEach(entry => {
      const outstanding = entry.drinks - entry.settled
      if (entry.toUser.id === currentUser.id) {
        owed += outstanding
      }
      if (entry.fromUser.id === currentUser.id) {
        owing += outstanding
      }
    })
    
    return { owed, owing, net: owed - owing }
  }

  const { owed, owing, net } = useMemo(() => calculateNet(ledger), [ledger, currentUser.id])

  // Group by relationship
  const getRelationships = (entries: LedgerEntry[]) => {
    const relationships: Record<string, { user: User, balance: number, settled: number, direction: 'owed' | 'owing' }> = {}

    entries.forEach(entry => {
      const outstanding = entry.drinks - entry.settled
      if (entry.toUser.id === currentUser.id) {
        const key = entry.fromUser.id
        if (!relationships[key]) {
          relationships[key] = { user: entry.fromUser, balance: 0, settled: entry.settled, direction: 'owed' }
        }
        relationships[key].balance += outstanding
      }
      if (entry.fromUser.id === currentUser.id) {
        const key = entry.toUser.id
        if (!relationships[key]) {
          relationships[key] = { user: entry.toUser, balance: 0, settled: entry.settled, direction: 'owing' }
        }
        relationships[key].balance -= outstanding
      }
    })

    return Object.values(relationships).filter(r => Math.abs(r.balance) > 0.01)
  }

  const relationships = useMemo(() => getRelationships(ledger), [ledger, currentUser.id])

  return (
    <div className="pb-24 px-4 space-y-6">
      {/* Tab Switcher */}
      <div className="flex p-1 bg-surface rounded-xl border-2 border-border">
        <button
          onClick={() => setView('tonight')}
          className={cn(
            'flex-1 py-2 rounded-lg font-semibold text-sm transition-all',
            view === 'tonight'
              ? 'bg-card text-card-foreground shadow-sm'
              : 'text-muted-foreground hover:text-card-foreground'
          )}
        >
          Tonight
        </button>
        <button
          onClick={() => setView('alltime')}
          className={cn(
            'flex-1 py-2 rounded-lg font-semibold text-sm transition-all',
            view === 'alltime'
              ? 'bg-card text-card-foreground shadow-sm'
              : 'text-muted-foreground hover:text-card-foreground'
          )}
        >
          All-Time
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border-2 border-border p-3 text-center">
          <div className="text-xl font-bold text-win">+{formatDrinks(owed)}</div>
          <div className="text-xs font-semibold text-muted-foreground uppercase">Owed to you</div>
        </div>
        <div className="bg-card rounded-xl border-2 border-border p-3 text-center">
          <div className="text-xl font-bold text-loss">-{formatDrinks(owing)}</div>
          <div className="text-xs font-semibold text-muted-foreground uppercase">You owe</div>
        </div>
        <div className={cn(
          'rounded-xl border-2 p-3 text-center',
          net > 0 ? 'bg-win/10 border-win' : net < 0 ? 'bg-loss/10 border-loss' : 'bg-card border-border'
        )}>
          <div className={cn(
            'text-xl font-bold',
            net > 0 ? 'text-win' : net < 0 ? 'text-loss' : 'text-card-foreground'
          )}>
            {net > 0 ? '+' : ''}{formatDrinks(net)}
          </div>
          <div className="text-xs font-semibold text-muted-foreground uppercase">Net</div>
        </div>
      </div>

      {/* Relationships List */}
      <div>
        <h2 className="text-lg font-bold text-foreground uppercase tracking-wide mb-3">Balances</h2>
        <div className="space-y-3">
          {relationships.map((rel) => {
            const isPositive = rel.balance > 0
            return (
              <div 
                key={rel.user.id}
                className="bg-card rounded-xl border-2 border-border p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <span className="font-bold text-secondary-foreground">
                        {rel.user.initials}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-card-foreground">{rel.user.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {isPositive ? (
                          <>
                            <span>owes you</span>
                            <ArrowRight className="h-3 w-3" />
                          </>
                        ) : (
                          <>
                            <span>you owe</span>
                            <ArrowRight className="h-3 w-3" />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={cn(
                      'text-xl font-bold',
                      isPositive ? 'text-win' : 'text-loss'
                    )}>
                      {formatDrinks(Math.abs(rel.balance))}
                    </div>
                    <div className="text-xs text-muted-foreground">drinks</div>
                  </div>
                </div>

                {/* Settle Button - only show if balance >= 1 */}
                {Math.abs(rel.balance) >= 1 && (
                  <button
                    className={cn(
                      'w-full mt-3 py-2 rounded-lg border-2 font-semibold text-sm flex items-center justify-center gap-2 transition-all',
                      isPositive 
                        ? 'border-win text-win hover:bg-win/10'
                        : 'border-loss text-loss hover:bg-loss/10'
                    )}
                  >
                    <Check className="h-4 w-4" />
                    {isPositive ? 'Confirm drink received' : 'Mark as settled'}
                  </button>
                )}

                {/* Pending settlement indicator */}
                {rel.settled > 0 && (
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{rel.settled} already settled</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {relationships.length === 0 && (
          <div className="text-center py-12 bg-card rounded-xl border-2 border-border">
            <div className="text-muted-foreground">No outstanding balances</div>
          </div>
        )}
      </div>
    </div>
  )
}
