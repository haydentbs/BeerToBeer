'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Beer,
  Trophy,
  Receipt,
  Users,
  Plus,
  Swords,
  Bomb,
  HelpCircle,
  Clock,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Flame,
  Target,
  TrendingUp,
  Crown,
  Copy,
  Share2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ──────────────────────────────────────────────
   Mock Data
   ────────────────────────────────────────────── */

const CREW = {
  name: 'The Usual Suspects',
  inviteCode: 'BEER42',
  members: [
    { id: '1', name: 'You', initials: 'YO', avatar: '' },
    { id: '2', name: 'Sarah', initials: 'SL', avatar: '' },
    { id: '3', name: 'Jake', initials: 'JM', avatar: '' },
    { id: '4', name: 'Mike', initials: 'MC', avatar: '' },
    { id: '5', name: 'Emma', initials: 'ER', avatar: '' },
    { id: '6', name: 'Dave', initials: 'DW', avatar: '' },
  ],
}

const TONIGHT_BETS = [
  {
    id: 'b1',
    type: 'prop' as const,
    title: 'Will Dave mention his ex?',
    status: 'open',
    pool: 4.5,
    options: [
      { label: 'Yes', odds: '65%', pool: 3 },
      { label: 'No', odds: '35%', pool: 1.5 },
    ],
    timeLeft: '4m left',
    creator: 'Sarah',
  },
  {
    id: 'b2',
    type: 'h2h' as const,
    title: 'Jake vs Mike — Darts',
    status: 'open',
    pool: 6,
    options: [
      { label: 'Jake', odds: '40%', pool: 2 },
      { label: 'Mike', odds: '60%', pool: 4 },
    ],
    timeLeft: 'In progress',
    creator: 'Jake',
  },
  {
    id: 'b3',
    type: 'prop' as const,
    title: 'O/U 2.5 songs before someone requests Mr. Brightside',
    status: 'resolved',
    pool: 3,
    options: [
      { label: 'Over', odds: '—', pool: 1 },
      { label: 'Under', odds: '—', pool: 2, winner: true },
    ],
    timeLeft: '',
    creator: 'You',
    result: '+1.5',
  },
  {
    id: 'b4',
    type: 'prop' as const,
    title: 'Who orders food first?',
    status: 'open',
    pool: 5,
    options: [
      { label: 'Dave', odds: '45%', pool: 2.25 },
      { label: 'Emma', odds: '30%', pool: 1.5 },
      { label: 'Field', odds: '25%', pool: 1.25 },
    ],
    timeLeft: '12m left',
    creator: 'Mike',
  },
]

const LEADERBOARD = [
  { name: 'You', initials: 'YO', totalWon: 12.5, winRate: 68, streak: 3 },
  { name: 'Sarah', initials: 'SL', totalWon: 10.0, winRate: 62, streak: 2 },
  { name: 'Jake', initials: 'JM', totalWon: 8.5, winRate: 55, streak: 0 },
  { name: 'Mike', initials: 'MC', totalWon: 6.0, winRate: 48, streak: 1 },
  { name: 'Emma', initials: 'ER', totalWon: 5.5, winRate: 52, streak: 0 },
  { name: 'Dave', initials: 'DW', totalWon: 3.0, winRate: 35, streak: 0 },
]

const LEDGER = [
  { name: 'Jake', initials: 'JM', balance: -2.5, direction: 'owing' as const },
  { name: 'Sarah', initials: 'SL', balance: 1.5, direction: 'owed' as const },
  { name: 'Mike', initials: 'MC', balance: -0.5, direction: 'owing' as const },
  { name: 'Emma', initials: 'ER', balance: 3.0, direction: 'owed' as const },
  { name: 'Dave', initials: 'DW', balance: 0, direction: 'owed' as const },
]

const BEER_BOMB_BOARD = [
  { revealed: true, bomb: false },
  { revealed: true, bomb: false },
  { revealed: false, bomb: false },
  { revealed: false, bomb: true },
  { revealed: false, bomb: false },
  { revealed: true, bomb: false },
  { revealed: false, bomb: false },
  { revealed: false, bomb: false },
]

/* ──────────────────────────────────────────────
   Demo Screens
   ────────────────────────────────────────────── */

const SCREENS = [
  'onboarding',
  'home',
  'tonight',
  'bet-detail',
  'create-bet',
  'beer-bomb',
  'ledger',
  'leaderboard',
  'crew',
] as const

type Screen = (typeof SCREENS)[number]

const SCREEN_LABELS: Record<Screen, string> = {
  onboarding: 'Welcome',
  home: 'My Crews',
  tonight: 'Tonight',
  'bet-detail': 'Bet Detail',
  'create-bet': 'Create Bet',
  'beer-bomb': 'Beer Bomb',
  ledger: 'Ledger',
  leaderboard: 'Leaderboard',
  crew: 'Crew',
}

/* ──────────────────────────────────────────────
   Subcomponents for each screen
   ────────────────────────────────────────────── */

function OnboardingDemo() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-6">
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-2xl bg-primary/20 border-3 border-border flex items-center justify-center">
          <Beer className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl text-foreground tracking-tight">SettleUp</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px]">
          The betting app where the stakes are real drinks.
        </p>
      </div>

      <div className="w-full space-y-3">
        <button className="w-full py-3.5 rounded-xl border-3 border-border bg-primary text-primary-foreground font-bold text-sm shadow-[4px_4px_0px_0px_var(--border)]">
          Sign in with Google
        </button>
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-border" /></div>
          <div className="relative flex justify-center"><span className="bg-background px-3 text-xs text-muted-foreground uppercase">or</span></div>
        </div>
        <div className="space-y-2">
          <input
            readOnly
            value="Your Name"
            className="w-full px-4 py-3 rounded-xl border-3 border-border bg-surface text-foreground text-sm font-medium"
          />
          <input
            readOnly
            value="BEER42"
            className="w-full px-4 py-3 rounded-xl border-3 border-border bg-surface text-foreground text-sm font-mono"
          />
          <button className="w-full py-3 rounded-xl border-3 border-border bg-card text-card-foreground font-bold text-sm shadow-[4px_4px_0px_0px_var(--border)]">
            Join as Guest
          </button>
        </div>
      </div>
    </div>
  )
}

function HomeDemo({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <h1 className="text-2xl text-foreground">SettleUp</h1>
        <div className="w-9 h-9 rounded-full bg-primary/20 border-2 border-border flex items-center justify-center">
          <span className="text-xs font-bold text-primary">YO</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4 space-y-4">
        {/* Live crew */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Tonight</span>
          </div>
          <button
            onClick={() => onNavigate('tonight')}
            className="w-full bg-card rounded-2xl border-3 border-border p-4 text-left shadow-[4px_4px_0px_0px_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_var(--border)] transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-card-foreground text-lg">{CREW.name}</h3>
                <p className="text-xs text-muted-foreground">Friday at O&apos;Malley&apos;s &middot; 6 members</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5 bg-win/15 px-2.5 py-1 rounded-lg">
                <TrendingUp className="w-3.5 h-3.5 text-win" />
                <span className="text-sm font-bold text-win">+3.5</span>
              </div>
              <span className="text-xs text-muted-foreground">4 open bets</span>
            </div>
          </button>
        </div>

        {/* Other crew */}
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Crews</span>
          <div className="mt-2 bg-card rounded-2xl border-3 border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-card-foreground">Work Crew</h3>
                <p className="text-xs text-muted-foreground">4 members &middot; No active night</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button className="flex-1 py-3 rounded-xl border-3 border-border bg-primary text-primary-foreground font-bold text-sm shadow-[4px_4px_0px_0px_var(--border)]">
            <Plus className="w-4 h-4 inline mr-1" />
            Create Crew
          </button>
          <button className="flex-1 py-3 rounded-xl border-3 border-border bg-card text-card-foreground font-bold text-sm shadow-[4px_4px_0px_0px_var(--border)]">
            <Users className="w-4 h-4 inline mr-1" />
            Join Crew
          </button>
        </div>
      </div>
    </div>
  )
}

function TonightDemo({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-lg font-bold text-foreground">{CREW.name}</h2>
            <p className="text-xs text-muted-foreground">Friday at O&apos;Malley&apos;s</p>
          </div>
          <div className="flex items-center gap-1.5 bg-win/15 px-3 py-1.5 rounded-lg border-2 border-win/30">
            <TrendingUp className="w-4 h-4 text-win" />
            <span className="text-sm font-bold text-win">+3.5</span>
          </div>
        </div>
      </div>

      {/* Bets list */}
      <div className="flex-1 overflow-auto px-4 pb-20 space-y-3">
        {TONIGHT_BETS.map((bet) => (
          <button
            key={bet.id}
            onClick={() => bet.id === 'b1' ? onNavigate('bet-detail') : undefined}
            className="w-full bg-card rounded-xl border-3 border-border p-3.5 text-left transition-all active:translate-x-[1px] active:translate-y-[1px]"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {bet.type === 'h2h' ? (
                  <Swords className="w-4 h-4 text-primary" />
                ) : (
                  <HelpCircle className="w-4 h-4 text-primary" />
                )}
                <span className="text-sm font-bold text-card-foreground leading-tight">{bet.title}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {bet.options.map((opt, i) => (
                <div
                  key={i}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold border-2',
                    opt.winner
                      ? 'bg-win/15 border-win/30 text-win'
                      : 'bg-surface border-border text-card-foreground'
                  )}
                >
                  {opt.label} {bet.status === 'open' ? <span className="text-muted-foreground ml-1">{opt.odds}</span> : null}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                🍺 {bet.pool} drinks in pool &middot; {bet.creator}
              </span>
              {bet.status === 'open' && bet.timeLeft && (
                <span className="text-xs font-semibold text-primary flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {bet.timeLeft}
                </span>
              )}
              {bet.status === 'resolved' && bet.result && (
                <span className="text-xs font-bold text-win">{bet.result} 🍺</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Bottom nav */}
      <DemoBottomNav active="tonight" onNavigate={onNavigate} />
    </div>
  )
}

function BetDetailDemo({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const bet = TONIGHT_BETS[0]
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <button onClick={() => onNavigate('tonight')} className="p-1">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="text-lg font-bold text-foreground flex-1">Bet Details</h2>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 space-y-4">
        <div className="bg-card rounded-2xl border-3 border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-card-foreground text-lg">{bet.title}</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <Clock className="w-3.5 h-3.5" />
            <span>{bet.timeLeft}</span>
            <span>&middot;</span>
            <span>Created by {bet.creator}</span>
          </div>

          {/* Options with bars */}
          <div className="space-y-3">
            {bet.options.map((opt, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-card-foreground">{opt.label}</span>
                  <span className="text-sm font-bold text-primary">{opt.odds}</span>
                </div>
                <div className="h-3 rounded-full bg-surface border-2 border-border overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full transition-all"
                    style={{ width: opt.odds }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{opt.pool} drinks wagered</span>
              </div>
            ))}
          </div>

          {/* Pool info */}
          <div className="mt-4 p-3 rounded-xl bg-surface border-2 border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Pool</span>
              <span className="text-lg font-bold text-primary">🍺 {bet.pool}</span>
            </div>
          </div>
        </div>

        {/* Wager section */}
        <div className="bg-card rounded-2xl border-3 border-border p-4">
          <h4 className="font-semibold text-card-foreground mb-3">Place Your Wager</h4>
          <div className="flex gap-2 mb-3">
            <button className="flex-1 py-2.5 rounded-lg border-3 border-primary bg-primary/15 text-primary font-bold text-sm">
              Yes
            </button>
            <button className="flex-1 py-2.5 rounded-lg border-3 border-border bg-surface text-card-foreground font-bold text-sm">
              No
            </button>
          </div>
          <div className="flex items-center justify-center gap-4 mb-3">
            <button className="w-10 h-10 rounded-xl border-3 border-border bg-surface flex items-center justify-center">
              <span className="text-card-foreground font-bold">-</span>
            </button>
            <div className="text-center">
              <span className="text-2xl font-bold text-card-foreground">1.0</span>
              <span className="text-xs text-muted-foreground block">drinks</span>
            </div>
            <button className="w-10 h-10 rounded-xl border-3 border-border bg-surface flex items-center justify-center">
              <span className="text-card-foreground font-bold">+</span>
            </button>
          </div>
          <button className="w-full py-3 rounded-xl border-3 border-border bg-primary text-primary-foreground font-bold text-sm shadow-[4px_4px_0px_0px_var(--border)]">
            Wager 1.0 Drink on Yes
          </button>
        </div>

        {/* Wagers placed */}
        <div className="bg-card rounded-2xl border-3 border-border p-4">
          <h4 className="font-semibold text-card-foreground mb-2">Wagers (3)</h4>
          {[
            { name: 'Sarah', side: 'Yes', amount: 2 },
            { name: 'Jake', side: 'Yes', amount: 1 },
            { name: 'Mike', side: 'No', amount: 1.5 },
          ].map((w, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-surface border-2 border-border flex items-center justify-center">
                  <span className="text-[10px] font-bold text-muted-foreground">{w.name[0]}{w.name[1]?.toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium text-card-foreground">{w.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-surface border border-border font-semibold text-card-foreground">{w.side}</span>
                <span className="text-sm font-bold text-primary">{w.amount} 🍺</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CreateBetDemo({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <button onClick={() => onNavigate('tonight')} className="p-1">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="text-lg font-bold text-foreground flex-1">New Bet</h2>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 space-y-4">
        {/* Mode selector */}
        <div className="flex gap-2">
          {[
            { label: 'Prop Bet', icon: HelpCircle, active: true },
            { label: '1v1', icon: Swords, active: false },
            { label: 'Beer Bomb', icon: Bomb, active: false },
          ].map((m) => (
            <button
              key={m.label}
              className={cn(
                'flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-3 transition-all',
                m.active
                  ? 'border-primary bg-primary/15 text-primary shadow-[3px_3px_0px_0px_var(--border)]'
                  : 'border-border bg-card text-card-foreground'
              )}
            >
              <m.icon className="w-5 h-5" />
              <span className="text-xs font-bold">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Format */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Format</label>
          <div className="flex gap-2">
            {['Yes / No', 'Over / Under', 'Multi'].map((f, i) => (
              <button
                key={f}
                className={cn(
                  'flex-1 py-2 rounded-lg border-2 text-xs font-semibold',
                  i === 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-card-foreground'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">What&apos;s the bet?</label>
          <input
            readOnly
            value="Will the bouncer check our IDs?"
            className="w-full px-4 py-3 rounded-xl border-3 border-border bg-card text-card-foreground text-sm font-medium"
          />
        </div>

        {/* Wager */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Your Wager</label>
          <div className="flex items-center justify-center gap-4 py-2">
            <button className="w-10 h-10 rounded-xl border-3 border-border bg-card flex items-center justify-center">
              <span className="text-card-foreground font-bold text-lg">-</span>
            </button>
            <div className="text-center">
              <span className="text-3xl font-bold text-foreground">1.0</span>
              <span className="text-xs text-muted-foreground block">🍺 drinks</span>
            </div>
            <button className="w-10 h-10 rounded-xl border-3 border-border bg-card flex items-center justify-center">
              <span className="text-card-foreground font-bold text-lg">+</span>
            </button>
          </div>
        </div>

        {/* Close time */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Closes in</label>
          <div className="flex gap-2">
            {['1 min', '2 min', '5 min', '15 min'].map((t, i) => (
              <button
                key={t}
                className={cn(
                  'flex-1 py-2 rounded-lg border-2 text-xs font-semibold',
                  i === 1 ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-card-foreground'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <button className="w-full py-3.5 rounded-xl border-3 border-border bg-primary text-primary-foreground font-bold text-sm shadow-[4px_4px_0px_0px_var(--border)]">
          Create Bet &amp; Wager 1.0 on Yes
        </button>
      </div>
    </div>
  )
}

function BeerBombDemo({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [revealedSlots, setRevealedSlots] = useState<Set<number>>(new Set([0, 1, 5]))
  const [gameOver, setGameOver] = useState(false)

  const handleReveal = (idx: number) => {
    if (revealedSlots.has(idx) || gameOver) return
    const newRevealed = new Set(revealedSlots)
    newRevealed.add(idx)
    setRevealedSlots(newRevealed)
    if (BEER_BOMB_BOARD[idx].bomb) {
      setGameOver(true)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <button onClick={() => onNavigate('tonight')} className="p-1">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="text-lg font-bold text-foreground flex-1">Beer Bomb</h2>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 flex flex-col items-center justify-center gap-6">
        {/* Match info */}
        <div className="w-full bg-card rounded-2xl border-3 border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary/20 border-3 border-border flex items-center justify-center">
                <span className="text-sm font-bold text-primary">YO</span>
              </div>
              <div>
                <span className="text-sm font-bold text-card-foreground">You</span>
                <span className="text-xs text-muted-foreground block">Challenger</span>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-primary/15 border-2 border-primary/30">
              <span className="text-sm font-bold text-primary">1.0 🍺</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-sm font-bold text-card-foreground">Jake</span>
                <span className="text-xs text-muted-foreground block">Opponent</span>
              </div>
              <div className="w-11 h-11 rounded-full bg-secondary/30 border-3 border-border flex items-center justify-center">
                <span className="text-sm font-bold text-secondary">JM</span>
              </div>
            </div>
          </div>
          <div className="text-center">
            <span className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              gameOver ? "text-loss" : "text-primary"
            )}>
              {gameOver ? '💥 BOOM! You hit the bomb!' : 'Your turn — tap a slot'}
            </span>
          </div>
        </div>

        {/* Board */}
        <div className="grid grid-cols-4 gap-3 w-full max-w-[280px]">
          {BEER_BOMB_BOARD.map((slot, i) => {
            const isRevealed = revealedSlots.has(i)
            const isBomb = slot.bomb && isRevealed
            return (
              <button
                key={i}
                onClick={() => handleReveal(i)}
                className={cn(
                  'aspect-square rounded-xl border-3 flex items-center justify-center text-2xl font-bold transition-all',
                  isBomb
                    ? 'bg-loss/20 border-loss text-loss animate-pulse'
                    : isRevealed
                    ? 'bg-win/15 border-win/40 text-win'
                    : 'bg-card border-border text-card-foreground hover:border-primary/60 shadow-[3px_3px_0px_0px_var(--border)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--border)]'
                )}
              >
                {isBomb ? <Bomb className="w-7 h-7" /> : isRevealed ? <Check className="w-6 h-6" /> : '?'}
              </button>
            )
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center max-w-[240px]">
          Take turns revealing slots. Hit the bomb and you owe the drinks! Tap a &ldquo;?&rdquo; slot to reveal it.
        </p>
      </div>
    </div>
  )
}

function LedgerDemo({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [view, setView] = useState<'tonight' | 'alltime'>('tonight')
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-3 pb-2">
        <h2 className="text-lg font-bold text-foreground mb-2">Ledger</h2>
        <div className="flex gap-2">
          {(['tonight', 'alltime'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'flex-1 py-2 rounded-lg border-2 text-xs font-semibold transition-all',
                view === v
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface text-foreground'
              )}
            >
              {v === 'tonight' ? 'Tonight' : 'All-Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Net position */}
      <div className="px-4 py-3">
        <div className="bg-card rounded-2xl border-3 border-border p-4 text-center">
          <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Your Net Position</span>
          <span className="text-3xl font-bold text-win">+1.5</span>
          <span className="text-sm text-muted-foreground ml-1">🍺</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-20 space-y-2">
        {LEDGER.map((entry) => (
          <div
            key={entry.name}
            className="bg-card rounded-xl border-3 border-border p-3.5 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface border-2 border-border flex items-center justify-center">
                <span className="text-xs font-bold text-muted-foreground">{entry.initials}</span>
              </div>
              <div>
                <span className="text-sm font-bold text-card-foreground">{entry.name}</span>
                <span className="text-xs text-muted-foreground block">
                  {entry.balance === 0
                    ? 'Settled up'
                    : entry.direction === 'owed'
                    ? 'Owes you'
                    : 'You owe'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {entry.balance !== 0 && (
                <>
                  <span
                    className={cn(
                      'text-lg font-bold',
                      entry.direction === 'owed' ? 'text-win' : 'text-loss'
                    )}
                  >
                    {entry.direction === 'owed' ? '+' : '-'}{Math.abs(entry.balance).toFixed(1)}
                  </span>
                  <span className="text-sm">🍺</span>
                </>
              )}
              {entry.balance !== 0 && Math.abs(entry.balance) >= 1 && (
                <button className="ml-2 px-2.5 py-1.5 rounded-lg border-2 border-primary bg-primary/15 text-xs font-bold text-primary">
                  Settle
                </button>
              )}
              {entry.balance === 0 && (
                <Check className="w-5 h-5 text-win" />
              )}
            </div>
          </div>
        ))}
      </div>

      <DemoBottomNav active="ledger" onNavigate={onNavigate} />
    </div>
  )
}

function LeaderboardDemo({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [stat, setStat] = useState<'totalWon' | 'winRate' | 'streak'>('totalWon')
  const sorted = [...LEADERBOARD].sort((a, b) => {
    if (stat === 'totalWon') return b.totalWon - a.totalWon
    if (stat === 'winRate') return b.winRate - a.winRate
    return b.streak - a.streak
  })

  const topThree = sorted.slice(0, 3)
  const rest = sorted.slice(3)

  const statValue = (entry: typeof LEADERBOARD[0]) => {
    if (stat === 'totalWon') return `${entry.totalWon} 🍺`
    if (stat === 'winRate') return `${entry.winRate}%`
    return `${entry.streak} nights`
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-3 pb-2">
        <h2 className="text-lg font-bold text-foreground mb-2">Leaderboard</h2>
        <div className="flex gap-2">
          {([
            { id: 'totalWon' as const, label: 'Won', icon: Trophy },
            { id: 'winRate' as const, label: 'Win %', icon: Target },
            { id: 'streak' as const, label: 'Streak', icon: Flame },
          ]).map((s) => (
            <button
              key={s.id}
              onClick={() => setStat(s.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 text-xs font-semibold transition-all',
                stat === s.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface text-foreground'
              )}
            >
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-20">
        {/* Podium */}
        <div className="flex items-end justify-center gap-3 pt-4 mb-6">
          {/* 2nd */}
          <div className="flex flex-col items-center flex-1">
            <div className="w-12 h-12 rounded-full bg-secondary/30 border-3 border-border flex items-center justify-center mb-2">
              <span className="font-bold text-sm text-secondary">{topThree[1]?.initials}</span>
            </div>
            <div className="w-full h-16 bg-card rounded-t-xl border-2 border-b-0 border-border flex flex-col items-center justify-center">
              <span className="text-base font-bold text-muted-foreground">2</span>
              <span className="text-[10px] font-semibold text-card-foreground">{topThree[1]?.name}</span>
              <span className="text-[10px] font-bold text-muted-foreground">{topThree[1] && statValue(topThree[1])}</span>
            </div>
          </div>

          {/* 1st */}
          <div className="flex flex-col items-center flex-1">
            <Crown className="w-5 h-5 text-primary mb-1" />
            <div className="w-14 h-14 rounded-full bg-primary/20 border-3 border-primary flex items-center justify-center mb-2">
              <span className="font-bold text-sm text-primary">{topThree[0]?.initials}</span>
            </div>
            <div className="w-full h-24 bg-card rounded-t-xl border-2 border-b-0 border-primary/40 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-primary">1</span>
              <span className="text-xs font-bold text-card-foreground">{topThree[0]?.name}</span>
              <span className="text-xs font-bold text-primary">{topThree[0] && statValue(topThree[0])}</span>
            </div>
          </div>

          {/* 3rd */}
          <div className="flex flex-col items-center flex-1">
            <div className="w-12 h-12 rounded-full bg-surface border-3 border-border flex items-center justify-center mb-2">
              <span className="font-bold text-sm text-muted-foreground">{topThree[2]?.initials}</span>
            </div>
            <div className="w-full h-12 bg-card rounded-t-xl border-2 border-b-0 border-border flex flex-col items-center justify-center">
              <span className="text-base font-bold text-muted-foreground">3</span>
              <span className="text-[10px] font-semibold text-card-foreground">{topThree[2]?.name}</span>
            </div>
          </div>
        </div>

        {/* Rest */}
        <div className="space-y-2">
          {rest.map((entry, i) => (
            <div
              key={entry.name}
              className={cn(
                'bg-card rounded-xl border-3 border-border p-3 flex items-center justify-between',
                entry.name === 'You' && 'border-primary/40'
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted-foreground w-5">{i + 4}</span>
                <div className="w-9 h-9 rounded-full bg-surface border-2 border-border flex items-center justify-center">
                  <span className="text-xs font-bold text-muted-foreground">{entry.initials}</span>
                </div>
                <span className="text-sm font-bold text-card-foreground">{entry.name}</span>
              </div>
              <span className="text-sm font-bold text-primary">{statValue(entry)}</span>
            </div>
          ))}
        </div>
      </div>

      <DemoBottomNav active="leaderboard" onNavigate={onNavigate} />
    </div>
  )
}

function CrewDemo({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-3 pb-2">
        <h2 className="text-lg font-bold text-foreground">Crew</h2>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-20 space-y-4">
        {/* Crew card */}
        <div className="bg-card rounded-2xl border-3 border-border p-4">
          <h3 className="font-bold text-card-foreground text-lg mb-1">{CREW.name}</h3>
          <p className="text-sm text-muted-foreground mb-3">{CREW.members.length} members</p>

          <div className="p-3 rounded-xl bg-surface border-2 border-border mb-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-0.5">Invite Code</span>
                <span className="font-mono font-bold text-primary text-lg">{CREW.inviteCode}</span>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded-lg border-2 border-border hover:bg-card transition-colors">
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-2 rounded-lg border-2 border-border hover:bg-card transition-colors">
                  <Share2 className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          {/* Members */}
          <div className="space-y-2">
            {CREW.members.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 py-1.5">
                <div className={cn(
                  "w-9 h-9 rounded-full border-2 flex items-center justify-center",
                  i === 0 ? "bg-primary/20 border-primary" : "bg-surface border-border"
                )}>
                  <span className={cn("text-xs font-bold", i === 0 ? "text-primary" : "text-muted-foreground")}>{m.initials}</span>
                </div>
                <span className="text-sm font-semibold text-card-foreground flex-1">{m.name}</span>
                {i === 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">Creator</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Night control */}
        <div className="bg-card rounded-2xl border-3 border-border p-4">
          <h4 className="font-semibold text-card-foreground mb-3">Tonight</h4>
          <div className="p-3 rounded-xl bg-win/10 border-2 border-win/30 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold text-card-foreground">Friday at O&apos;Malley&apos;s</span>
            </div>
            <span className="text-xs text-muted-foreground">Started 2 hours ago &middot; 4 bets placed</span>
          </div>
          <button className="w-full py-2.5 rounded-xl border-3 border-loss/50 text-loss font-bold text-sm">
            End Night
          </button>
        </div>
      </div>

      <DemoBottomNav active="crew" onNavigate={onNavigate} />
    </div>
  )
}

function DemoBottomNav({ active, onNavigate }: { active: string; onNavigate: (s: Screen) => void }) {
  const tabs = [
    { id: 'tonight' as Screen, label: 'Tonight', icon: Beer },
    { id: 'ledger' as Screen, label: 'Ledger', icon: Receipt },
    { id: 'leaderboard' as Screen, label: 'Board', icon: Trophy },
    { id: 'crew' as Screen, label: 'Crew', icon: Users },
  ]
  return (
    <nav className="absolute bottom-0 left-0 right-0 bg-card border-t-3 border-border z-10">
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.slice(0, 2).map((tab) => (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={cn(
              'flex flex-col items-center justify-center min-w-[48px] min-h-[40px] rounded-xl transition-all',
              active === tab.id ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <tab.icon className="h-5 w-5" strokeWidth={active === tab.id ? 2.5 : 2} />
            <span className="text-[10px] font-semibold mt-0.5 uppercase tracking-wide">{tab.label}</span>
          </button>
        ))}

        <button
          onClick={() => onNavigate('create-bet')}
          className="relative -mt-5 flex h-14 w-14 items-center justify-center rounded-full border-3 bg-primary border-border shadow-[4px_4px_0px_0px_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_var(--border)] transition-all"
        >
          <Plus className="h-7 w-7 text-primary-foreground" strokeWidth={3} />
        </button>

        {tabs.slice(2).map((tab) => (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={cn(
              'flex flex-col items-center justify-center min-w-[48px] min-h-[40px] rounded-xl transition-all',
              active === tab.id ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <tab.icon className="h-5 w-5" strokeWidth={active === tab.id ? 2.5 : 2} />
            <span className="text-[10px] font-semibold mt-0.5 uppercase tracking-wide">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

/* ──────────────────────────────────────────────
   Main Demo Page
   ────────────────────────────────────────────── */

export default function DemoPage() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('onboarding')
  const [isAnimating, setIsAnimating] = useState(false)

  const currentIdx = SCREENS.indexOf(currentScreen)

  const navigateTo = useCallback((screen: Screen) => {
    setIsAnimating(true)
    setTimeout(() => {
      setCurrentScreen(screen)
      setIsAnimating(false)
    }, 150)
  }, [])

  const goPrev = () => {
    if (currentIdx > 0) navigateTo(SCREENS[currentIdx - 1])
  }
  const goNext = () => {
    if (currentIdx < SCREENS.length - 1) navigateTo(SCREENS[currentIdx + 1])
  }

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const renderScreen = () => {
    switch (currentScreen) {
      case 'onboarding': return <OnboardingDemo />
      case 'home': return <HomeDemo onNavigate={navigateTo} />
      case 'tonight': return <TonightDemo onNavigate={navigateTo} />
      case 'bet-detail': return <BetDetailDemo onNavigate={navigateTo} />
      case 'create-bet': return <CreateBetDemo onNavigate={navigateTo} />
      case 'beer-bomb': return <BeerBombDemo onNavigate={navigateTo} />
      case 'ledger': return <LedgerDemo onNavigate={navigateTo} />
      case 'leaderboard': return <LeaderboardDemo onNavigate={navigateTo} />
      case 'crew': return <CrewDemo onNavigate={navigateTo} />
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center py-8 px-4 gap-6">
      {/* Title */}
      <div className="text-center">
        <h1 className="text-4xl text-white tracking-tight mb-2" style={{ fontFamily: 'var(--font-bungee)' }}>
          SettleUp
        </h1>
        <p className="text-white/50 text-sm max-w-md">
          The betting app where the stakes are real drinks. Swipe through the demo or use arrow keys.
        </p>
      </div>

      {/* Phone frame */}
      <div className="relative">
        {/* Phone bezel */}
        <div className="relative w-[375px] h-[812px] rounded-[3rem] border-[8px] border-[#2a2a2a] bg-[#1a1a1a] shadow-2xl shadow-black/50 overflow-hidden">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150px] h-[34px] bg-[#2a2a2a] rounded-b-[1.2rem] z-20" />

          {/* Status bar */}
          <div className="absolute top-0 left-0 right-0 h-[50px] z-10 flex items-end justify-between px-8 pb-1">
            <span className="text-white/70 text-[11px] font-semibold">9:41</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-2.5 rounded-[2px] border border-white/50 relative">
                <div className="absolute inset-[1px] right-[2px] bg-white/70 rounded-[1px]" />
              </div>
            </div>
          </div>

          {/* Screen content */}
          <div
            className={cn(
              'absolute inset-0 pt-[50px] overflow-hidden transition-opacity duration-150',
              isAnimating ? 'opacity-0' : 'opacity-100'
            )}
            style={{
              // Apply theme vars inline for the demo frame
              ...Object.entries({
                '--background': 'oklch(0.12 0.01 60)',
                '--foreground': 'oklch(0.95 0.01 90)',
                '--card': 'oklch(0.96 0.02 85)',
                '--card-foreground': 'oklch(0.15 0.01 60)',
                '--primary': 'oklch(0.75 0.15 75)',
                '--primary-foreground': 'oklch(0.15 0.01 60)',
                '--secondary': 'oklch(0.35 0.08 160)',
                '--secondary-foreground': 'oklch(0.95 0.01 90)',
                '--muted': 'oklch(0.20 0.01 60)',
                '--muted-foreground': 'oklch(0.65 0.02 85)',
                '--accent': 'oklch(0.85 0.12 80)',
                '--accent-foreground': 'oklch(0.15 0.01 60)',
                '--border': 'oklch(0.25 0.02 60)',
                '--input': 'oklch(0.20 0.01 60)',
                '--ring': 'oklch(0.75 0.15 75)',
                '--win': 'oklch(0.75 0.15 75)',
                '--loss': 'oklch(0.55 0.18 25)',
                '--surface': 'oklch(0.18 0.01 60)',
                '--surface-elevated': 'oklch(0.22 0.01 60)',
              } as Record<string, string>).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {} as Record<string, string>),
              backgroundColor: 'oklch(0.12 0.01 60)',
              color: 'oklch(0.95 0.01 90)',
            }}
          >
            {renderScreen()}
          </div>
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-[12px] left-1/2 -translate-x-1/2 w-[134px] h-[5px] bg-white/30 rounded-full z-20" />
      </div>

      {/* Navigation controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className={cn(
            'w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all',
            currentIdx === 0
              ? 'border-white/10 text-white/20 cursor-not-allowed'
              : 'border-white/30 text-white/70 hover:border-white/60 hover:text-white'
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Screen dots + label */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-white/80 text-sm font-semibold min-w-[120px] text-center">
            {SCREEN_LABELS[currentScreen]}
          </span>
          <div className="flex gap-1.5">
            {SCREENS.map((s, i) => (
              <button
                key={s}
                onClick={() => navigateTo(s)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  i === currentIdx
                    ? 'bg-amber-400 w-6'
                    : 'bg-white/20 hover:bg-white/40'
                )}
              />
            ))}
          </div>
        </div>

        <button
          onClick={goNext}
          disabled={currentIdx === SCREENS.length - 1}
          className={cn(
            'w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all',
            currentIdx === SCREENS.length - 1
              ? 'border-white/10 text-white/20 cursor-not-allowed'
              : 'border-white/30 text-white/70 hover:border-white/60 hover:text-white'
          )}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-3 gap-3 max-w-lg w-full">
        {[
          { icon: Beer, label: 'Pari-Mutuel Betting', desc: 'Real drink stakes' },
          { icon: Bomb, label: 'Beer Bomb', desc: 'Interactive mini-game' },
          { icon: Trophy, label: 'Leaderboards', desc: 'Track every rivalry' },
        ].map((f) => (
          <div key={f.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <f.icon className="w-5 h-5 text-amber-400 mx-auto mb-1.5" />
            <span className="text-white/80 text-xs font-semibold block">{f.label}</span>
            <span className="text-white/40 text-[10px]">{f.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
