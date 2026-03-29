'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Check, Clock, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDrinks, simplifyLedgerEntries, type LedgerEntry, type User } from '@/lib/store'
import { useCurrentUser } from '@/lib/current-user'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface LedgerScreenProps {
  tonightLedger: LedgerEntry[]
  allTimeLedger: LedgerEntry[]
  onSettle: (entry: LedgerEntry, drinks: number) => void
}

interface RelationshipEntry {
  user: User
  entry: LedgerEntry
  balance: number
  settled: number
  direction: 'owed' | 'owing'
}

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2
}

export function LedgerScreen({ tonightLedger, allTimeLedger, onSettle }: LedgerScreenProps) {
  const currentUser = useCurrentUser()
  const [view, setView] = useState<'tonight' | 'alltime'>('tonight')
  const ledger = view === 'tonight' ? tonightLedger : allTimeLedger
  const [settlementTarget, setSettlementTarget] = useState<RelationshipEntry | null>(null)
  const [settlementAmount, setSettlementAmount] = useState(1)

  const relationships = useMemo(() => {
    const directBuckets = new Map<string, {
      user: User
      incomingSettled: number
      outgoingSettled: number
    }>()

    ledger.forEach((entry) => {
      if (entry.toUser.id === currentUser.id) {
        const key = entry.fromUser.id
        const bucket = directBuckets.get(key) ?? {
          user: entry.fromUser,
          incomingSettled: 0,
          outgoingSettled: 0,
        }
        bucket.incomingSettled += entry.settled
        directBuckets.set(key, bucket)
      }

      if (entry.fromUser.id === currentUser.id) {
        const key = entry.toUser.id
        const bucket = directBuckets.get(key) ?? {
          user: entry.toUser,
          incomingSettled: 0,
          outgoingSettled: 0,
        }
        bucket.outgoingSettled += entry.settled
        directBuckets.set(key, bucket)
      }
    })

    return simplifyLedgerEntries(ledger)
      .map((entry) => {
        if (entry.toUser.id === currentUser.id) {
          const bucket = directBuckets.get(entry.fromUser.id)
          return {
            user: entry.fromUser,
            entry,
            balance: entry.drinks,
            settled: bucket?.incomingSettled ?? 0,
            direction: 'owed' as const,
          }
        }

        if (entry.fromUser.id === currentUser.id) {
          const bucket = directBuckets.get(entry.toUser.id)
          return {
            user: entry.toUser,
            entry,
            balance: -entry.drinks,
            settled: bucket?.outgoingSettled ?? 0,
            direction: 'owing' as const,
          }
        }

        return null
      })
      .filter((entry): entry is RelationshipEntry => Boolean(entry))
      .sort((a, b) => {
        const balanceDiff = Math.abs(b.balance) - Math.abs(a.balance)
        if (balanceDiff !== 0) {
          return balanceDiff
        }

        return a.user.name.localeCompare(b.user.name)
      })
  }, [ledger, currentUser])

  const { owed, owing, net } = useMemo(() => {
    const owedTotal = relationships.filter((entry) => entry.balance > 0).reduce((sum, entry) => sum + entry.balance, 0)
    const owingTotal = relationships.filter((entry) => entry.balance < 0).reduce((sum, entry) => sum + Math.abs(entry.balance), 0)

    return {
      owed: owedTotal,
      owing: owingTotal,
      net: owedTotal - owingTotal,
    }
  }, [relationships])

  const openSettlementDialog = (relationship: RelationshipEntry) => {
    const outstanding = Math.max(0, relationship.balance)
    setSettlementTarget(relationship)
    setSettlementAmount(outstanding > 0 ? Math.min(roundToHalf(outstanding), outstanding) : 0.5)
  }

  const closeSettlementDialog = () => {
    setSettlementTarget(null)
    setSettlementAmount(1)
  }

  const handleSettlementAmountChange = (nextValue: number, outstanding: number) => {
    const normalized = Number.isFinite(nextValue) ? nextValue : 0.5
    const clamped = Math.min(outstanding, Math.max(0.5, roundToHalf(normalized)))
    setSettlementAmount(clamped)
  }

  const confirmSettlement = () => {
    if (!settlementTarget) return
    onSettle(settlementTarget.entry, settlementAmount)
    closeSettlementDialog()
  }

  const settlementLimit = settlementTarget ? settlementTarget.balance : 0.5

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
        <p className="mb-3 text-sm text-muted-foreground">
          Repayments are simplified across the crew so chains collapse into the shortest path to settle up.
        </p>
        <div className="space-y-3">
          {relationships.map((rel) => {
            const isPositive = rel.balance > 0
            const outstanding = Math.max(0, rel.balance)
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

                {/* Settle Button - only show for positive balances that are large enough to settle */}
                {isPositive && outstanding >= 0.5 && (
                  <button
                    onClick={() => openSettlementDialog(rel)}
                    className={cn(
                      'w-full mt-3 py-2 rounded-lg border-2 font-semibold text-sm flex items-center justify-center gap-2 transition-all',
                      'border-win text-win hover:bg-win/10'
                    )}
                  >
                    <Check className="h-4 w-4" />
                    Record settlement
                  </button>
                )}

                {/* Pending settlement indicator */}
                {rel.settled > 0 && (
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatDrinks(rel.settled)} already settled</span>
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

      <Dialog open={settlementTarget !== null} onOpenChange={(open) => !open && closeSettlementDialog()}>
        <DialogContent className="bg-card border-3 border-border rounded-2xl shadow-brutal sm:max-w-md">
          {settlementTarget && (
            <>
              <DialogHeader className="text-left">
                <DialogTitle className="text-card-foreground">Settle tab</DialogTitle>
                <DialogDescription>
                  Record how many drinks {settlementTarget.user.name} actually handed over.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-xl border-2 border-border bg-surface p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Outstanding</span>
                    <span className="font-bold text-win">{formatDrinks(Math.max(0, settlementTarget.balance))} drinks</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Already settled</span>
                    <span className="font-semibold text-card-foreground">{formatDrinks(settlementTarget.settled)} drinks</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="settlement-amount" className="text-sm font-semibold text-card-foreground">
                    Drinks settled
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleSettlementAmountChange(settlementAmount - 0.5, settlementLimit)}
                      disabled={settlementAmount <= 0.5}
                      aria-label="Decrease settlement amount"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      id="settlement-amount"
                      type="number"
                      min="0.5"
                      max={settlementLimit}
                      step="0.5"
                      value={settlementAmount}
                      onChange={(event) => handleSettlementAmountChange(Number(event.target.value), settlementLimit)}
                      className="text-center font-bold"
                      aria-label="Settlement amount"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleSettlementAmountChange(settlementAmount + 0.5, settlementLimit)}
                      disabled={settlementAmount >= settlementLimit}
                      aria-label="Increase settlement amount"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use half-drink steps so the ledger stays precise.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeSettlementDialog}>
                  Cancel
                </Button>
                <Button type="button" onClick={confirmSettlement}>
                  Confirm settlement
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
