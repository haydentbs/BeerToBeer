'use client'

import { Beer, Trophy, Receipt, Users, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  activeTab: 'tonight' | 'ledger' | 'leaderboard' | 'crew'
  onTabChange: (tab: 'tonight' | 'ledger' | 'leaderboard' | 'crew') => void
  onCreateBet: () => void
  createBetDisabled?: boolean
}

export function BottomNav({ activeTab, onTabChange, onCreateBet, createBetDisabled = false }: BottomNavProps) {
  const tabs = [
    { id: 'tonight' as const, label: 'Tonight', icon: Beer },
    { id: 'ledger' as const, label: 'Ledger', icon: Receipt },
    { id: 'leaderboard' as const, label: 'Board', icon: Trophy },
    { id: 'crew' as const, label: 'Crew', icon: Users },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t-3 border-border safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.slice(0, 2).map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex flex-col items-center justify-center min-w-[64px] min-h-[48px] rounded-xl transition-all',
              activeTab === tab.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-card-foreground'
            )}
          >
            <tab.icon className="h-6 w-6" strokeWidth={activeTab === tab.id ? 2.5 : 2} />
            <span className="text-xs font-semibold mt-0.5 uppercase tracking-wide">{tab.label}</span>
          </button>
        ))}

        {/* Center Create Button */}
        <button
          onClick={onCreateBet}
          disabled={createBetDisabled}
          aria-label="Create bet or challenge"
          title={createBetDisabled ? 'Start a night to place bets' : undefined}
          className={cn(
            'relative -mt-6 flex h-16 w-16 items-center justify-center rounded-full border-3 transition-all',
            createBetDisabled
              ? 'cursor-not-allowed border-border/60 bg-muted text-muted-foreground opacity-60 shadow-none'
              : 'bg-primary border-border shadow-[4px_4px_0px_0px_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_var(--border)]'
          )}
        >
          <Plus
            className={cn('h-8 w-8', createBetDisabled ? 'text-muted-foreground' : 'text-primary-foreground')}
            strokeWidth={3}
          />
        </button>

        {tabs.slice(2).map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex flex-col items-center justify-center min-w-[64px] min-h-[48px] rounded-xl transition-all',
              activeTab === tab.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-card-foreground'
            )}
          >
            <tab.icon className="h-6 w-6" strokeWidth={activeTab === tab.id ? 2.5 : 2} />
            <span className="text-xs font-semibold mt-0.5 uppercase tracking-wide">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
