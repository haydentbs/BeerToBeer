'use client'

import { useState } from 'react'
import { Trophy, TrendingUp, Flame, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDrinks, type User } from '@/lib/store'
import { useCurrentUser } from '@/lib/current-user'

interface LeaderboardEntry {
  user: User
  totalWon: number
  winRate: number
  bestNight: number
  streak: number
}

interface LeaderboardScreenProps {
  leaderboard: LeaderboardEntry[]
}

export function LeaderboardScreen({ leaderboard }: LeaderboardScreenProps) {
  const currentUser = useCurrentUser()
  const [stat, setStat] = useState<'totalWon' | 'winRate' | 'streak'>('totalWon')

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    if (stat === 'totalWon') return b.totalWon - a.totalWon
    if (stat === 'winRate') return b.winRate - a.winRate
    return b.streak - a.streak
  })

  const topThree = sortedLeaderboard.slice(0, 3)
  const rest = sortedLeaderboard.slice(3)

  return (
    <div className="pb-24 px-4 space-y-6">
      {/* Stat Switcher */}
      <div className="flex gap-2">
        {[
          { id: 'totalWon' as const, label: 'Won', icon: Trophy },
          { id: 'winRate' as const, label: 'Win %', icon: Target },
          { id: 'streak' as const, label: 'Streak', icon: Flame },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setStat(s.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border-2 text-sm font-semibold transition-all',
              stat === s.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-surface text-foreground hover:border-primary/50'
            )}
          >
            <s.icon className="h-4 w-4" />
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Podium */}
      <div className="flex items-end justify-center gap-3 pt-4">
        {/* Second Place */}
        {topThree[1] && (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-secondary border-3 border-border flex items-center justify-center mb-2">
              <span className="font-bold text-secondary-foreground">
                {topThree[1].user.initials}
              </span>
            </div>
            <div className="w-24 h-20 bg-card rounded-t-xl border-2 border-b-0 border-border flex flex-col items-center justify-center gap-0.5">
              <span className="text-lg font-bold text-muted-foreground">2</span>
              <span className="text-xs font-semibold text-card-foreground">{topThree[1].user.name}</span>
              <span className="text-xs font-bold text-muted-foreground">
                {stat === 'totalWon' && `${formatDrinks(topThree[1].totalWon)} drinks`}
                {stat === 'winRate' && `${Math.round(topThree[1].winRate * 100)}%`}
                {stat === 'streak' && `${topThree[1].streak} nights`}
              </span>
            </div>
          </div>
        )}

        {/* First Place */}
        {topThree[0] && (
          <div className="flex flex-col items-center -mt-5">
            <Trophy className="h-6 w-6 text-primary mb-1" />
            <div className="w-16 h-16 rounded-full bg-primary border-3 border-border flex items-center justify-center mb-2">
              <span className="font-bold text-primary-foreground text-lg">
                {topThree[0].user.initials}
              </span>
            </div>
            <div className="w-28 h-24 bg-primary/20 rounded-t-xl border-2 border-b-0 border-primary flex flex-col items-center justify-center gap-0.5">
              <span className="text-2xl font-bold text-primary">1</span>
              <span className="text-xs font-semibold text-foreground">{topThree[0].user.name}</span>
              <span className="text-sm font-bold text-primary">
                {stat === 'totalWon' && `${formatDrinks(topThree[0].totalWon)} drinks`}
                {stat === 'winRate' && `${Math.round(topThree[0].winRate * 100)}%`}
                {stat === 'streak' && `${topThree[0].streak} nights`}
              </span>
            </div>
          </div>
        )}

        {/* Third Place */}
        {topThree[2] && (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-secondary border-3 border-border flex items-center justify-center mb-2">
              <span className="font-bold text-secondary-foreground text-sm">
                {topThree[2].user.initials}
              </span>
            </div>
            <div className="w-24 h-16 bg-card rounded-t-xl border-2 border-b-0 border-border flex flex-col items-center justify-center px-3 gap-0.5">
              <span className="text-md font-bold text-muted-foreground">3</span>
              <span className="text-xs font-semibold text-card-foreground">{topThree[2].user.name}</span>
              <span className="text-xs font-bold text-muted-foreground">
                {stat === 'totalWon' && `${formatDrinks(topThree[2].totalWon)} drinks`}
                {stat === 'winRate' && `${Math.round(topThree[2].winRate * 100)}%`}
                {stat === 'streak' && `${topThree[2].streak} nights`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Rest of leaderboard */}
      <div className="bg-card rounded-xl border-2 border-border overflow-hidden">
        {rest.map((entry, index) => {
          const isCurrentUser = entry.user.id === currentUser.id
          return (
            <div 
              key={entry.user.id}
              className={cn(
                'flex items-center justify-between p-4 border-b border-border last:border-b-0',
                isCurrentUser && 'bg-primary/5'
              )}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center font-bold text-muted-foreground">
                  {index + 4}
                </span>
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <span className="font-bold text-secondary-foreground">
                    {entry.user.initials}
                  </span>
                </div>
                <span className={cn(
                  'font-semibold',
                  isCurrentUser ? 'text-primary' : 'text-card-foreground'
                )}>
                  {entry.user.name}
                  {isCurrentUser && ' (you)'}
                </span>
              </div>
              
              <div className="text-right">
                <div className="font-bold text-card-foreground">
                  {stat === 'totalWon' && `${formatDrinks(entry.totalWon)} drinks`}
                  {stat === 'winRate' && `${Math.round(entry.winRate * 100)}%`}
                  {stat === 'streak' && `${entry.streak} nights`}
                </div>
                {stat === 'totalWon' && entry.streak > 0 && (
                  <div className="text-xs text-primary flex items-center justify-end gap-1">
                    <Flame className="h-3 w-3" />
                    {entry.streak} streak
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Your Stats */}
      <div className="bg-card rounded-xl border-2 border-border p-4">
        <h3 className="font-bold text-card-foreground mb-3 uppercase tracking-wide text-sm">Your Stats</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-surface border border-border">
            <div className="text-2xl font-bold text-win">
              {formatDrinks(leaderboard.find(e => e.user.id === currentUser.id)?.totalWon || 0)}
            </div>
            <div className="text-xs text-muted-foreground">Total won</div>
          </div>
          <div className="p-3 rounded-lg bg-surface border border-border">
            <div className="text-2xl font-bold text-primary">
              {Math.round((leaderboard.find(e => e.user.id === currentUser.id)?.winRate || 0) * 100)}%
            </div>
            <div className="text-xs text-muted-foreground">Win rate</div>
          </div>
          <div className="p-3 rounded-lg bg-surface border border-border">
            <div className="text-2xl font-bold text-foreground">
              {formatDrinks(leaderboard.find(e => e.user.id === currentUser.id)?.bestNight || 0)}
            </div>
            <div className="text-xs text-muted-foreground">Best night</div>
          </div>
          <div className="p-3 rounded-lg bg-surface border border-border">
            <div className="text-2xl font-bold text-primary flex items-center gap-1">
              <Flame className="h-5 w-5" />
              {leaderboard.find(e => e.user.id === currentUser.id)?.streak || 0}
            </div>
            <div className="text-xs text-muted-foreground">Current streak</div>
          </div>
        </div>
      </div>
    </div>
  )
}
