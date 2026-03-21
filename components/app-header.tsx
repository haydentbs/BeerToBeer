'use client'

import { useState } from 'react'
import { Bell, ArrowLeft, LogOut, User, Settings, Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationPanel } from './notification-panel'
import { useTheme } from './theme-provider'
import type { AppMode } from '@/lib/themes'
import type { Notification } from '@/lib/store'

interface AppHeaderProps {
  crewName: string
  nightName?: string
  nightStatus?: 'active' | 'winding-down' | 'closed'
  netPosition: number
  userName?: string
  isGuest?: boolean
  notifications?: Notification[]
  userEmail?: string
  onBack: () => void
  onLeave?: () => void
  onSignOut?: () => void
  onOpenProfile?: () => void
  onMarkNotificationsRead?: () => void
  isSigningOut?: boolean
}

export function AppHeader({
  crewName,
  nightName,
  nightStatus,
  netPosition,
  userName,
  isGuest,
  notifications = [],
  userEmail,
  onBack,
  onLeave,
  onSignOut,
  onOpenProfile,
  onMarkNotificationsRead,
  isSigningOut = false,
}: AppHeaderProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const { mode, setMode, drinkEmoji } = useTheme()

  const unreadCount = notifications.filter(n => !n.read).length

  const modeOptions: { value: AppMode; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'classic', icon: Monitor, label: 'Classic' },
    { value: 'dark', icon: Moon, label: 'Dark' },
  ]

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
              'px-3 py-1.5 rounded-full border-2 font-bold text-sm flex items-center gap-1',
              netPosition > 0
                ? 'bg-win/20 border-win text-win'
                : netPosition < 0
                ? 'bg-loss/20 border-loss text-loss'
                : 'bg-muted border-border text-muted-foreground'
            )}
          >
            <span>{netPosition > 0 ? '+' : ''}{netPosition.toFixed(1)}</span>
            <span className="text-xs">{drinkEmoji}</span>
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-full hover:bg-surface transition-colors"
            >
              <Bell className="h-5 w-5 text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
              )}
            </button>

            <NotificationPanel
              notifications={notifications}
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
              onMarkAllRead={() => onMarkNotificationsRead?.()}
            />
          </div>

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

                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onOpenProfile?.()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-surface/50 transition-colors text-card-foreground"
                  >
                    <User className="w-4 h-4" />
                    <span className="text-sm font-semibold">Profile</span>
                  </button>

                  {/* Mode Toggle */}
                  <div className="px-3 py-2">
                    <div className="flex rounded-lg border border-border overflow-hidden">
                      {modeOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setMode(opt.value)}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold transition-colors',
                            mode === opt.value
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-transparent text-card-foreground hover:bg-surface/50'
                          )}
                        >
                          <opt.icon className="w-3 h-3" />
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {isGuest && (
                    <button
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-surface/50 transition-colors text-primary"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="text-sm font-semibold">Finish Account</span>
                    </button>
                  )}

                  {onLeave && (
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        onLeave()
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-surface/50 transition-colors text-loss"
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
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-surface/50 transition-colors text-card-foreground disabled:opacity-50"
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
