'use client'

import { useState } from 'react'
import { ArrowLeft, Bell, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  crewName: string
  nightName?: string
  nightStatus?: 'active' | 'winding-down' | 'closed'
  netPosition: number
  userName?: string
  userEmail?: string
  onBack: () => void
  onLeave?: () => void
  onSignOut?: () => void
  isSigningOut?: boolean
}

export function AppHeader({
  crewName,
  nightName,
  nightStatus,
  netPosition,
  userName,
  userEmail,
  onBack,
  onLeave,
  onSignOut,
  isSigningOut = false,
}: AppHeaderProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b-3 border-border safe-area-top">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Back + Crew Name */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-surface transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground truncate">{crewName}</h1>
        </div>

        {/* Net Position + Bell + Avatar */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className={cn(
              'px-3 py-1.5 rounded-full border-2 font-bold text-sm',
              netPosition > 0
                ? 'bg-win/20 border-win text-win'
                : netPosition < 0
                ? 'bg-loss/20 border-loss text-loss'
                : 'bg-muted border-border text-muted-foreground'
            )}
          >
            {netPosition > 0 ? '+' : ''}{netPosition.toFixed(1)}
          </div>

          <button className="relative p-2 rounded-full hover:bg-surface transition-colors">
            <Bell className="h-5 w-5 text-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-8 h-8 rounded-full bg-primary border-2 border-border flex items-center justify-center"
            >
              <span className="text-xs font-bold text-primary-foreground">
                {userName?.slice(0, 2).toUpperCase() || 'ME'}
              </span>
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-10 z-50 w-48 bg-card rounded-xl border-2 border-border shadow-brutal p-2">
                  <div className="px-3 py-2 border-b border-border mb-2">
                    <p className="text-sm font-bold text-card-foreground">{userName}</p>
                    <p className="text-xs text-muted-foreground">{userEmail || crewName}</p>
                  </div>
                  {onLeave && (
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        onLeave()
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-surface transition-colors text-loss"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm font-semibold">Leave Crew</span>
                    </button>
                  )}
                  {onSignOut && (
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        onSignOut()
                      }}
                      disabled={isSigningOut}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-surface transition-colors text-card-foreground disabled:opacity-50"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm font-semibold">{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Night Status Bar */}
      {nightName && (
        <div className="flex items-center justify-between px-4 py-2 bg-surface border-t border-border">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'w-2 h-2 rounded-full animate-pulse',
                nightStatus === 'active' ? 'bg-win' :
                nightStatus === 'winding-down' ? 'bg-primary' : 'bg-muted-foreground'
              )}
            />
            <span className="text-sm font-medium text-foreground">{nightName}</span>
          </div>
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {nightStatus === 'active' ? 'Live' : nightStatus === 'winding-down' ? 'Winding down' : 'Closed'}
          </span>
        </div>
      )}
    </header>
  )
}
