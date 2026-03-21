'use client'

import { useState } from 'react'
import { Bomb, HelpCircle, Lock, Minus, Plus, Swords, Trophy, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BetSubtype, User } from '@/lib/store'
import { useCurrentUser } from '@/lib/current-user'

interface CreateBetModalProps {
  isOpen: boolean
  onClose: () => void
  members: User[]
  onCreate: (bet: {
    type: BetType
    subtype: BetSubtype
    title: string
    options: Array<{ label: string }>
    line?: number
    challenger?: { id: string }
    wager?: number
    initialOptionIndex?: number
    closeTime: number
  }) => void
  onCreateMiniGame: (challenge: {
    title: string
    opponent: { id: string }
    wager: number
    closeTime: number
    boardSize?: number
  }) => void
}

type BetType = 'prop' | 'h2h'
type CreationMode = 'prop' | 'h2h' | 'mini-game'
type PropFormat = 'yesno' | 'overunder' | 'multi'

export function CreateBetModal({ isOpen, onClose, onCreate, onCreateMiniGame, members }: CreateBetModalProps) {
  const currentUser = useCurrentUser()
  const [step, setStep] = useState(1)
  const [mode, setMode] = useState<CreationMode | null>(null)
  const [propFormat, setPropFormat] = useState<PropFormat>('yesno')
  const [title, setTitle] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [challenger, setChallenger] = useState<string | null>(null)
  const [line, setLine] = useState(2.5)
  const [initialOptionIndex, setInitialOptionIndex] = useState(0)
  const [wager, setWager] = useState(1)
  const [closeTime, setCloseTime] = useState(2)

  const resetForm = () => {
    setStep(1)
    setMode(null)
    setPropFormat('yesno')
    setTitle('')
    setOptions(['', ''])
    setChallenger(null)
    setLine(2.5)
    setInitialOptionIndex(0)
    setWager(1)
    setCloseTime(2)
  }

  const handleCreate = () => {
    if (!mode) return

    const opponent = members.find((user) => user.id === challenger)
    const cleanOptions = options.map((option) => option.trim()).filter(Boolean)

    if (mode === 'mini-game') {
      if (!opponent) return

      onCreateMiniGame({
        title: title.trim() || `Beer Bomb vs ${opponent.name}`,
        opponent: { id: opponent.id },
        wager,
        closeTime,
        boardSize: 8,
      })
      resetForm()
      onClose()
      return
    }

    const bet = {
      type: mode as BetType,
      subtype: mode === 'h2h' ? null : propFormat,
      title: title.trim(),
      line: mode === 'prop' && propFormat === 'overunder' ? line : undefined,
      options:
        mode === 'prop'
          ? propFormat === 'yesno'
            ? [{ label: 'Yes' }, { label: 'No' }]
            : propFormat === 'overunder'
            ? [{ label: `Over ${line}` }, { label: `Under ${line}` }]
            : cleanOptions.map((label) => ({ label }))
          : [
              { label: `${currentUser.name} wins` },
              { label: `${opponent?.name ?? 'Opponent'} wins` },
            ],
      challenger: challenger ? { id: challenger } : undefined,
      wager,
      initialOptionIndex: mode === 'h2h' ? 0 : initialOptionIndex,
      closeTime,
    }

    onCreate(bet)
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  const multiOptions = options.map((option) => option.trim()).filter(Boolean)
  const selectedOpponent = challenger ? members.find((user) => user.id === challenger) : null
  const canSubmit =
    mode === 'mini-game'
      ? Boolean(selectedOpponent)
      : Boolean(
          title.trim() &&
            (mode !== 'h2h' || challenger) &&
            (mode !== 'prop' || propFormat !== 'multi' || multiOptions.length >= 3) &&
            (mode !== 'prop' || propFormat !== 'overunder' || (line > 0 && Number.isInteger(line * 2)))
        )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-x-3 border-t-3 border-border bg-card safe-area-bottom">
        <div className="sticky top-0 flex justify-center bg-card py-3">
          <div className="w-10 rounded-full bg-border" style={{ height: 4 }} />
        </div>

        <div className="flex items-center justify-between px-4 pb-4">
          <h2 className="text-xl font-bold text-card-foreground">Create Bet</h2>
          <button
            onClick={onClose}
            className="rounded-full border-2 border-border bg-surface p-2 transition-colors hover:bg-surface/70"
          >
            <X className="h-5 w-5 text-foreground" />
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-4 px-4 pb-6">
            <p className="text-sm text-muted-foreground">What kind of challenge are we starting?</p>

            <div className="space-y-3">
              {/* Tournament — coming soon */}
              <div className="w-full rounded-xl border-3 border-border/40 p-4 opacity-40 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Trophy className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground">Tournament</h3>
                    <p className="text-sm text-muted-foreground">Brackets & elimination</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] font-semibold text-muted-foreground">Soon</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setMode('prop')
                  setStep(2)
                }}
                className={cn(
                  'w-full rounded-xl border-3 p-4 text-left transition-all',
                  mode === 'prop' ? 'border-primary bg-primary/10' : 'border-border/60 bg-card hover:border-primary/50 hover:bg-surface/30'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                    <HelpCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Group Bet</h3>
                    <p className="text-sm text-muted-foreground">Ask a question everyone bets on</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setMode('h2h')
                  setStep(2)
                }}
                className={cn(
                  'w-full rounded-xl border-3 p-4 text-left transition-all',
                  mode === 'h2h' ? 'border-primary bg-primary/10' : 'border-border/60 bg-card hover:border-primary/50 hover:bg-surface/30'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                    <Swords className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Challenge</h3>
                    <p className="text-sm text-muted-foreground">1v1 with side bets</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setMode('mini-game')
                  setStep(2)
                }}
                className={cn(
                  'w-full rounded-xl border-3 p-4 text-left transition-all',
                  mode === 'mini-game' ? 'border-primary bg-primary/10' : 'border-border/60 bg-card hover:border-primary/50 hover:bg-surface/30'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                    <Bomb className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Beer Bomb</h3>
                    <p className="text-sm text-muted-foreground">Tap the wrong beer and you lose</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 px-4 pb-6">
            {mode === 'prop' && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Format</label>
                <div className="mt-2 flex gap-2">
                  {[
                    { id: 'yesno' as const, label: 'Yes/No' },
                    { id: 'overunder' as const, label: 'Over/Under' },
                    { id: 'multi' as const, label: 'Multiple' },
                  ].map((format) => (
                    <button
                      key={format.id}
                      onClick={() => setPropFormat(format.id)}
                      className={cn(
                        'flex-1 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all',
                        propFormat === format.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/60 bg-card text-foreground hover:border-primary/50'
                      )}
                    >
                      {format.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode !== 'prop' && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {mode === 'mini-game' ? 'Challenge who?' : 'Challenge who?'}
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {members
                    .filter((user) => user.id !== currentUser.id)
                    .map((user) => (
                      <button
                        key={user.id}
                        onClick={() => setChallenger(user.id)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-all',
                          challenger === user.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-surface hover:border-primary/50'
                        )}
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary">
                          <span className="text-xs font-bold text-secondary-foreground">{user.initials}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground">{user.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {mode === 'mini-game' ? 'Challenge title' : mode === 'h2h' ? "What's the challenge?" : "What's the bet?"}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  mode === 'mini-game'
                    ? 'Beer Bomb showdown'
                    : mode === 'h2h'
                    ? 'Pool, darts, flip cup...'
                    : 'Will Dave mention his ex?'
                }
                className="mt-2 w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            {mode === 'mini-game' && (
              <div className="rounded-xl border-2 border-border bg-surface/80 p-4">
                <p className="text-sm font-semibold text-card-foreground">Beer Bomb challenge</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hide the bomb, line up the beers, and let the turn order decide who taps first.
                </p>
              </div>
            )}

            {mode === 'prop' && propFormat === 'overunder' && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Line</label>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => setLine((current) => Math.max(0.5, Number((current - 0.5).toFixed(1))))}
                    className="rounded-lg border-2 border-border bg-surface p-2 text-foreground transition-colors hover:border-primary/50"
                    type="button"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="flex-1 rounded-xl border-2 border-border bg-surface px-4 py-3 text-center font-bold text-foreground">
                    {line.toFixed(1)}
                  </div>
                  <button
                    onClick={() => setLine((current) => Number((current + 0.5).toFixed(1)))}
                    className="rounded-lg border-2 border-border bg-surface p-2 text-foreground transition-colors hover:border-primary/50"
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {mode === 'prop' && propFormat === 'multi' && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Options</label>
                <div className="mt-2 space-y-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const nextOptions = [...options]
                          nextOptions[i] = e.target.value
                          setOptions(nextOptions)
                        }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 rounded-lg border-2 border-border bg-surface px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      />
                      {options.length > 2 && (
                        <button
                          onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                          className="rounded-lg border-2 border-border p-2 text-loss hover:border-loss"
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {options.length < 8 && (
                    <button
                      onClick={() => setOptions([...options, ''])}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-2 text-muted-foreground hover:border-primary hover:text-primary"
                    >
                      <Plus className="h-4 w-4" />
                      Add option
                    </button>
                  )}
                </div>
              </div>
            )}

            {mode === 'prop' && propFormat !== 'multi' && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your side</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(propFormat === 'yesno' ? ['Yes', 'No'] : [`Over ${line}`, `Under ${line}`]).map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setInitialOptionIndex(index)}
                      className={cn(
                        'rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all',
                        initialOptionIndex === index
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-surface text-foreground hover:border-primary/50'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === 'prop' && propFormat === 'multi' && multiOptions.length > 0 && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your pick</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {multiOptions.map((label, index) => (
                    <button
                      key={`${label}-${index}`}
                      type="button"
                      onClick={() => setInitialOptionIndex(index)}
                      className={cn(
                        'rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all',
                        initialOptionIndex === index
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-surface text-foreground hover:border-primary/50'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your wager</label>
              <div className="mt-2 flex items-center gap-3">
                {[0.5, 1, 2, 3].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setWager(amount)}
                    className={cn(
                      'flex-1 rounded-xl border-2 py-3 font-bold transition-all',
                      wager === amount
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-surface text-foreground hover:border-primary/50'
                    )}
                  >
                    {amount}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-center text-xs text-muted-foreground">drinks</p>
            </div>

            {mode !== 'h2h' && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {mode === 'mini-game' ? 'Responds within' : 'Wagering closes in'}
                </label>
                <div className="mt-2 flex items-center gap-2">
                  {[1, 2, 5, 15, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setCloseTime(mins)}
                      className={cn(
                        'flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition-all',
                        closeTime === mins
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/60 bg-card text-foreground hover:border-primary/50'
                      )}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border-2 border-border py-3 font-semibold text-foreground transition-colors hover:bg-surface/50"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={!canSubmit}
                className="flex-1 rounded-xl border-2 border-border bg-primary py-3 font-display font-normal text-primary-foreground shadow-[3px_3px_0px_0px_var(--border)] transition-all active:translate-x-[3px] active:translate-y-[3px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mode === 'mini-game' ? `Start ${selectedOpponent ? `vs ${selectedOpponent.name}` : 'Beer Bomb'}` : 'Create Bet'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
