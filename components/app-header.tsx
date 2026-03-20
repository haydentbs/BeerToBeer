'use client'

import { useState } from 'react'
import { Bell, Copy, Check, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  nightName?: string
  nightStatus?: 'active' | 'winding-down' | 'closed'
  netPosition: number
  userName?: string
  crewCode?: string
  onLeave?: () => void
}

export function AppHeader({ nightName, nightStatus, netPosition, userName, crewCode, onLeave }: AppHeaderProps) {
  const [copied, setCopied] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const handleCopyCode = async () => {
    if (crewCode) {
      await navigator.clipboard.writeText(crewCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b-3 border-border safe-area-top">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo + Room Code */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">BS</span>
          </div>
          {crewCode && (
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border-2 border-border hover:border-primary transition-colors"
            >
              <span className="text-xs font-mono font-bold text-foreground tracking-wider">{crewCode}</span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-win" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          )}
        </div>

        {/* Net Position Badge + Menu */}
        <div className="flex items-center gap-2">
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
              className="w-8 h-8 rounded-full bg-secondary border-2 border-border flex items-center justify-center"
            >
              <span className="text-xs font-bold text-secondary-foreground">
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
                    <p className="text-xs text-muted-foreground">Room: {crewCode}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onLeave?.()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-surface transition-colors text-loss"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-semibold">Leave Room</span>
                  </button>
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
