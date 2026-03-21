'use client'

import { useState } from 'react'
import { X, Swords, HelpCircle, Clock, Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mockUsers, currentUser } from '@/lib/store'

interface CreateBetModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (bet: {
    type: BetType
    title: string
    options: Array<{ label: string }>
    challenger?: { id: string }
    closeTime: number
  }) => void
}

type BetType = 'prop' | 'h2h'
type PropFormat = 'yesno' | 'overunder' | 'multi'

export function CreateBetModal({ isOpen, onClose, onCreate }: CreateBetModalProps) {
  const [step, setStep] = useState(1)
  const [betType, setBetType] = useState<BetType | null>(null)
  const [propFormat, setPropFormat] = useState<PropFormat>('yesno')
  const [title, setTitle] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [challenger, setChallenger] = useState<string | null>(null)
  const [wager, setWager] = useState(1)
  const [closeTime, setCloseTime] = useState(5)

  const handleCreate = () => {
    const bet = {
      type: betType,
      title,
      options: betType === 'prop' 
        ? (propFormat === 'yesno' 
            ? [{ label: 'Yes' }, { label: 'No' }]
            : propFormat === 'overunder'
            ? [{ label: 'Over' }, { label: 'Under' }]
            : options.filter(o => o).map(label => ({ label })))
        : [
            { label: `${currentUser.name} wins` },
            { label: `${mockUsers.find(u => u.id === challenger)?.name} wins` }
          ],
      challenger: challenger ? mockUsers.find(u => u.id === challenger) : undefined,
      wager,
      closeTime,
    }
    onCreate(bet)
    resetForm()
    onClose()
  }

  const resetForm = () => {
    setStep(1)
    setBetType(null)
    setPropFormat('yesno')
    setTitle('')
    setOptions(['', ''])
    setChallenger(null)
    setWager(1)
    setCloseTime(5)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-card border-t-3 border-x-3 border-border rounded-t-3xl max-h-[85vh] overflow-y-auto safe-area-bottom">
        {/* Handle */}
        <div className="sticky top-0 flex justify-center py-3 bg-card">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-4">
          <h2 className="text-xl font-bold text-card-foreground">Create Bet</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full border-2 border-border bg-surface hover:bg-surface/70 transition-colors"
          >
            <X className="h-5 w-5 text-foreground" />
          </button>
        </div>

        {/* Step 1: Choose Type */}
        {step === 1 && (
          <div className="px-4 pb-6 space-y-4">
            <p className="text-sm text-muted-foreground">What kind of bet?</p>
            
            <div className="space-y-3">
              <button
                onClick={() => { setBetType('prop'); setStep(2) }}
                className={cn(
                  'w-full p-4 rounded-xl border-3 text-left transition-all',
                  betType === 'prop' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border bg-surface hover:border-primary/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <HelpCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Prop Bet</h3>
                    <p className="text-sm text-muted-foreground">Anyone can wager</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => { setBetType('h2h'); setStep(2) }}
                className={cn(
                  'w-full p-4 rounded-xl border-3 text-left transition-all',
                  betType === 'h2h' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border bg-surface hover:border-primary/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Swords className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Challenge</h3>
                    <p className="text-sm text-muted-foreground">1v1 with side bets</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="px-4 pb-6 space-y-5">
            {/* Prop Format Selector */}
            {betType === 'prop' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Format
                </label>
                <div className="flex gap-2 mt-2">
                  {[
                    { id: 'yesno' as const, label: 'Yes/No' },
                    { id: 'overunder' as const, label: 'Over/Under' },
                    { id: 'multi' as const, label: 'Multiple' },
                  ].map((format) => (
                    <button
                      key={format.id}
                      onClick={() => setPropFormat(format.id)}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-lg border-2 text-sm font-semibold transition-all',
                        propFormat === format.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-surface text-foreground hover:border-primary/50'
                      )}
                    >
                      {format.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Challenge: Select Opponent */}
            {betType === 'h2h' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Challenge who?
                </label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {mockUsers.filter(u => u.id !== currentUser.id).map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setChallenger(user.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all',
                        challenger === user.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-surface hover:border-primary/50'
                      )}
                    >
                      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                        <span className="text-xs font-bold text-secondary-foreground">
                          {user.initials}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{user.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Title Input */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {betType === 'h2h' ? "What's the challenge?" : "What's the bet?"}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={betType === 'h2h' ? 'Pool, darts, flip cup...' : 'Will Dave mention his ex?'}
                className="w-full mt-2 px-4 py-3 rounded-xl border-2 border-border bg-surface text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none text-base"
              />
            </div>

            {/* Multi-option inputs */}
            {betType === 'prop' && propFormat === 'multi' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Options
                </label>
                <div className="space-y-2 mt-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOptions = [...options]
                          newOptions[i] = e.target.value
                          setOptions(newOptions)
                        }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 px-4 py-2 rounded-lg border-2 border-border bg-surface text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      />
                      {options.length > 2 && (
                        <button
                          onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                          className="p-2 rounded-lg border-2 border-border hover:border-loss text-loss"
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {options.length < 6 && (
                    <button
                      onClick={() => setOptions([...options, ''])}
                      className="w-full py-2 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add option
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Wager Amount */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Your wager
              </label>
              <div className="flex items-center gap-3 mt-2">
                {[0.5, 1, 2, 3].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setWager(amount)}
                    className={cn(
                      'flex-1 py-3 rounded-xl border-2 font-bold transition-all',
                      wager === amount
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-surface text-foreground hover:border-primary/50'
                    )}
                  >
                    {amount}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 text-center">drinks</p>
            </div>

            {/* Close Time */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Closes in
              </label>
              <div className="flex items-center gap-2 mt-2">
                {[1, 2, 5, 15, 30].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setCloseTime(mins)}
                    className={cn(
                      'flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all',
                      closeTime === mins
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-surface text-foreground hover:border-primary/50'
                    )}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl border-2 border-border text-foreground font-semibold hover:bg-surface transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={!title || (betType === 'h2h' && !challenger)}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold border-2 border-border shadow-[3px_3px_0px_0px_var(--border)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Bet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
