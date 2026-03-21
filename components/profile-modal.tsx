'use client'

import { X, Trophy, Target, Flame, TrendingUp, Beer, Users, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfileCrew {
  name: string
  netPosition: number
}

interface ProfileStats {
  totalBetsPlaced: number
  totalWins: number
  winRate: number
  totalDrinksWon: number
  totalDrinksLost: number
  bestNight: number
  currentStreak: number
}

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  userName: string
  userEmail?: string
  userInitials: string
  isGuest?: boolean
  crews: ProfileCrew[]
  stats: ProfileStats
  onSignOut?: () => void
  onFinishAccount?: () => void
  isSigningOut?: boolean
}

export function ProfileModal({
  isOpen,
  onClose,
  userName,
  userEmail,
  userInitials,
  isGuest,
  crews,
  stats,
  onSignOut,
  onFinishAccount,
  isSigningOut = false,
}: ProfileModalProps) {
  if (!isOpen) return null

  const netTotal = stats.totalDrinksWon - stats.totalDrinksLost

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm max-h-[90vh] bg-card rounded-t-2xl sm:rounded-2xl border-3 border-border overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b-2 border-border">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary border-3 border-border shadow-brutal flex items-center justify-center">
                <span className="text-xl font-bold text-primary-foreground">{userInitials}</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-card-foreground">{userName}</h2>
                {userEmail && (
                  <p className="text-sm text-muted-foreground">{userEmail}</p>
                )}
                <span className={cn(
                  'inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide',
                  isGuest
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-win/20 text-win border border-win/30'
                )}>
                  {isGuest ? 'Guest' : 'Member'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface transition-colors"
            >
              <X className="h-5 w-5 text-card-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4 space-y-5">
          {/* Guest Banner */}
          {isGuest && onFinishAccount && (
            <button
              onClick={() => {
                onClose()
                onFinishAccount()
              }}
              className="w-full p-4 rounded-xl bg-primary/10 border-2 border-primary/30 flex items-center gap-3 text-left hover:bg-primary/20 transition-colors"
            >
              <LogIn className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="font-bold text-card-foreground text-sm">Finish your account</p>
                <p className="text-xs text-muted-foreground">Sign in with Google to save your data</p>
              </div>
            </button>
          )}

          {/* Overall Net */}
          <div className="p-4 rounded-xl bg-surface border-2 border-border text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">All-Time Net</div>
            <div className={cn(
              'text-3xl font-bold font-mono',
              netTotal > 0 ? 'text-win' : netTotal < 0 ? 'text-loss' : 'text-foreground'
            )}>
              {netTotal > 0 ? '+' : ''}{netTotal.toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground">drinks</div>
          </div>

          {/* Stats Grid */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Stats</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-surface border-2 border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Bets Placed</span>
                </div>
                <div className="text-xl font-bold text-foreground">{stats.totalBetsPlaced}</div>
              </div>
              <div className="p-3 rounded-xl bg-surface border-2 border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="h-4 w-4 text-win" />
                  <span className="text-xs text-muted-foreground">Win Rate</span>
                </div>
                <div className="text-xl font-bold text-foreground">{(stats.winRate * 100).toFixed(0)}%</div>
              </div>
              <div className="p-3 rounded-xl bg-surface border-2 border-border">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-win" />
                  <span className="text-xs text-muted-foreground">Won</span>
                </div>
                <div className="text-xl font-bold text-win">+{stats.totalDrinksWon.toFixed(1)}</div>
              </div>
              <div className="p-3 rounded-xl bg-surface border-2 border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Beer className="h-4 w-4 text-loss" />
                  <span className="text-xs text-muted-foreground">Lost</span>
                </div>
                <div className="text-xl font-bold text-loss">-{stats.totalDrinksLost.toFixed(1)}</div>
              </div>
              <div className="p-3 rounded-xl bg-surface border-2 border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Best Night</span>
                </div>
                <div className="text-xl font-bold text-foreground">+{stats.bestNight.toFixed(1)}</div>
              </div>
              <div className="p-3 rounded-xl bg-surface border-2 border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Streak</span>
                </div>
                <div className="text-xl font-bold text-foreground">{stats.currentStreak}</div>
              </div>
            </div>
          </div>

          {/* Crews */}
          {crews.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Your Crews</h3>
              <div className="bg-surface rounded-xl border-2 border-border overflow-hidden">
                {crews.map((crew, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 border-b border-border last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground text-sm">{crew.name}</span>
                    </div>
                    <span className={cn(
                      'font-bold font-mono text-sm',
                      crew.netPosition > 0 ? 'text-win' : crew.netPosition < 0 ? 'text-loss' : 'text-foreground'
                    )}>
                      {crew.netPosition > 0 ? '+' : ''}{crew.netPosition.toFixed(1)} 🍺
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sign Out */}
          {onSignOut && (
            <button
              onClick={() => {
                onClose()
                onSignOut()
              }}
              disabled={isSigningOut}
              className="w-full py-3 rounded-xl border-2 border-border text-card-foreground font-semibold hover:bg-surface transition-colors disabled:opacity-50"
            >
              {isSigningOut ? 'Signing out…' : 'Sign Out'}
            </button>
          )}
        </div>

        {/* Bottom padding for mobile */}
        <div className="h-8 sm:h-2 shrink-0" />
      </div>
    </div>
  )
}
