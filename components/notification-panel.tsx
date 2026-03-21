'use client'

import { Trophy, Swords, Moon, HelpCircle, Users, Bell, Shield, CheckCircle2, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/store'
import type { Notification } from '@/lib/store'

interface NotificationPanelProps {
  notifications: Notification[]
  isOpen: boolean
  onClose: () => void
  onMarkAllRead: () => void
}

const notificationIcons: Record<Notification['type'], React.ElementType> = {
  bet_resolved: Trophy,
  challenge: Swords,
  night_started: Moon,
  night_closed: Moon,
  bet_created: HelpCircle,
  crew_invite: Users,
  settlement_requested: Bell,
  settlement_confirmed: CheckCircle2,
  role_updated: Shield,
  guest_joined: UserPlus,
  member_joined: UserPlus,
}

export function NotificationPanel({
  notifications,
  isOpen,
  onClose,
  onMarkAllRead,
}: NotificationPanelProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop overlay */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Dropdown panel */}
      <div className="absolute right-0 top-12 w-80 z-50 bg-card text-card-foreground border-2 border-border rounded-2xl shadow-brutal overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-border">
          <h3 className="font-bold text-lg">Notifications</h3>
          <button
            onClick={onMarkAllRead}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Mark all read
          </button>
        </div>

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = notificationIcons[notification.type] ?? HelpCircle
              return (
                <div
                  key={notification.id}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 transition-colors',
                    !notification.read && 'bg-card/80 bg-[oklch(0.92_0.02_80)]'
                  )}
                >
                  {/* Icon */}
                  <div className="mt-0.5 shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">
                        {notification.title}
                      </span>
                      {!notification.read && (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {notification.crewName && (
                        <>
                          <span>{notification.crewName}</span>
                          <span>·</span>
                        </>
                      )}
                      <span>{formatRelativeTime(notification.timestamp)}</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
