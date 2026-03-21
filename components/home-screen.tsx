'use client'

import { useState } from 'react'
import { Beer, Bell, Plus, Users, ArrowRight, ChevronRight, Trophy, Flame, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type Crew, type User, type Notification } from '@/lib/store'
import { DRINK_THEMES } from '@/lib/themes'
import { NotificationPanel } from './notification-panel'

interface HomeScreenProps {
  user: User
  userEmail?: string
  crews: Crew[]
  /** Per-crew all-time ledger data for computing net positions */
  crewNetPositions: Record<string, number>
  onSelectCrew: (crewId: string) => void
  onCreateCrew: (name: string) => void
  onJoinCrew: (code: string) => void
  notifications?: Notification[]
  onMarkRead?: () => void
  onSignOut?: () => void
  isSigningOut?: boolean
}

export function HomeScreen({
  user,
  userEmail,
  crews,
  crewNetPositions,
  onSelectCrew,
  onCreateCrew,
  onJoinCrew,
  notifications = [],
  onMarkRead,
  onSignOut,
  isSigningOut = false,
}: HomeScreenProps) {
  const [showAction, setShowAction] = useState<'none' | 'create' | 'join'>('none')
  const [newCrewName, setNewCrewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const liveCrews = crews.filter(c => c.currentNight)
  const otherCrews = crews.filter(c => !c.currentNight)

  const unreadCount = notifications.filter(n => !n.read).length

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newCrewName.trim()) {
      onCreateCrew(newCrewName.trim())
      setNewCrewName('')
      setShowAction('none')
    }
  }

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (joinCode.trim()) {
      onJoinCrew(joinCode.trim().toUpperCase())
      setJoinCode('')
      setShowAction('none')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b-3 border-border safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Beer className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">BeerScore</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Bell with Notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications)
                  setShowUserMenu(false)
                }}
                className="relative p-2 rounded-full hover:bg-surface transition-colors"
              >
                <Bell className="h-5 w-5 text-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                )}
              </button>

              {showNotifications && (
                <NotificationPanel
                  notifications={notifications}
                  isOpen={showNotifications}
                  onMarkAllRead={() => onMarkRead?.()}
                  onClose={() => setShowNotifications(false)}
                />
              )}
            </div>

            {/* User avatar with menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowUserMenu(!showUserMenu)
                  setShowNotifications(false)
                }}
                className="w-8 h-8 rounded-full bg-primary border-2 border-border flex items-center justify-center"
              >
                <span className="text-xs font-bold text-primary-foreground">
                  {user.initials}
                </span>
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 top-10 z-50 w-48 bg-card rounded-xl border-2 border-border shadow-brutal p-2">
                    <div className="px-3 py-2 border-b border-border mb-2">
                      <p className="text-sm font-bold text-card-foreground">{user.name}</p>
                      {userEmail && <p className="text-xs text-muted-foreground">{userEmail}</p>}
                    </div>
                    {onSignOut && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false)
                          onSignOut()
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-surface transition-colors text-muted-foreground"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-semibold">{isSigningOut ? 'Signing Out…' : 'Sign Out'}</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 pt-6 pb-8 space-y-6">
        {/* Empty State */}
        {crews.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-surface border-2 border-border flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">No crews yet</h2>
            <p className="text-sm text-muted-foreground text-center max-w-xs mb-8">
              Create a crew for your friend group or join one with a code.
            </p>

            <div className="w-full max-w-xs space-y-3">
              <button
                onClick={() => setShowAction('create')}
                className="w-full py-4 px-6 rounded-xl bg-primary text-primary-foreground font-display font-normal text-lg border-3 border-border shadow-brutal active:shadow-none active:translate-x-1 active:translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                Create a Crew
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowAction('join')}
                className="w-full py-4 px-6 rounded-xl bg-card text-card-foreground font-bold text-lg border-3 border-border shadow-brutal active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
              >
                Join with Code
              </button>
            </div>
          </div>
        )}

        {/* Live Now */}
        {liveCrews.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-win uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-win animate-pulse" />
              Live Now
            </h2>
            <div className="space-y-3">
              {liveCrews.map((crew) => {
                const net = crewNetPositions[crew.id] ?? 0
                const activeBets = crew.currentNight?.bets.filter(b => b.status === 'open').length ?? 0

                return (
                  <button
                    key={crew.id}
                    onClick={() => onSelectCrew(crew.id)}
                    className="w-full bg-card rounded-2xl border-3 border-primary/50 p-4 text-left active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-card-foreground text-lg truncate">{DRINK_THEMES[crew.drinkTheme ?? 'beer'].emoji} {crew.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="w-2 h-2 rounded-full bg-win animate-pulse" />
                          <span className="text-sm text-win font-semibold">{crew.currentNight?.name}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                    </div>

                    <div className="flex items-center justify-between">
                      {/* Member avatars */}
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {crew.members.slice(0, 5).map((member) => (
                            <div
                              key={member.id}
                              className={cn(
                                'w-7 h-7 rounded-full border-2 border-card flex items-center justify-center',
                                member.id === user.id ? 'bg-primary' : 'bg-secondary'
                              )}
                            >
                              <span className={cn(
                                'text-[10px] font-bold',
                                member.id === user.id ? 'text-primary-foreground' : 'text-secondary-foreground'
                              )}>
                                {member.initials}
                              </span>
                            </div>
                          ))}
                          {crew.members.length > 5 && (
                            <div className="w-7 h-7 rounded-full border-2 border-card bg-surface flex items-center justify-center">
                              <span className="text-[10px] font-bold text-muted-foreground">
                                +{crew.members.length - 5}
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{crew.members.length} members</span>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3">
                        {activeBets > 0 && (
                          <span className="text-xs font-semibold text-primary">{activeBets} active</span>
                        )}
                        <div
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-bold',
                            net > 0
                              ? 'bg-win/20 text-win'
                              : net < 0
                              ? 'bg-loss/20 text-loss'
                              : 'bg-surface text-muted-foreground'
                          )}
                        >
                          {net > 0 ? '+' : ''}{net.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Your Crews */}
        {crews.length > 0 && (
          <section>
            {liveCrews.length > 0 && otherCrews.length > 0 && (
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">Your Crews</h2>
            )}
            {liveCrews.length > 0 && otherCrews.length === 0 && null}
            {liveCrews.length === 0 && (
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">Your Crews</h2>
            )}

            <div className="space-y-3">
              {/* Show live crews in the main list too if there's no separate section */}
              {(liveCrews.length === 0 ? crews : otherCrews).map((crew) => {
                const net = crewNetPositions[crew.id] ?? 0
                const hasNight = !!crew.currentNight
                const lastNight = crew.pastNights[0]

                return (
                  <button
                    key={crew.id}
                    onClick={() => onSelectCrew(crew.id)}
                    className="w-full bg-card rounded-2xl border-2 border-border p-4 text-left active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-card-foreground text-lg truncate">{DRINK_THEMES[crew.drinkTheme ?? 'beer'].emoji} {crew.name}</h3>
                        {hasNight ? (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-win animate-pulse" />
                            <span className="text-sm text-win font-semibold">{crew.currentNight?.name}</span>
                          </div>
                        ) : lastNight ? (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Last: {lastNight.name} · {lastNight.date}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">No nights yet</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                    </div>

                    <div className="flex items-center justify-between">
                      {/* Member avatars */}
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {crew.members.slice(0, 5).map((member) => (
                            <div
                              key={member.id}
                              className={cn(
                                'w-7 h-7 rounded-full border-2 border-card flex items-center justify-center',
                                member.id === user.id ? 'bg-primary' : 'bg-secondary'
                              )}
                            >
                              <span className={cn(
                                'text-[10px] font-bold',
                                member.id === user.id ? 'text-primary-foreground' : 'text-secondary-foreground'
                              )}>
                                {member.initials}
                              </span>
                            </div>
                          ))}
                          {crew.members.length > 5 && (
                            <div className="w-7 h-7 rounded-full border-2 border-card bg-surface flex items-center justify-center">
                              <span className="text-[10px] font-bold text-muted-foreground">
                                +{crew.members.length - 5}
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{crew.members.length} members</span>
                      </div>

                      {/* Net position */}
                      <div
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-bold',
                          net > 0
                            ? 'bg-win/20 text-win'
                            : net < 0
                            ? 'bg-loss/20 text-loss'
                            : 'bg-surface text-muted-foreground'
                        )}
                      >
                        {net > 0 ? '+' : ''}{net.toFixed(1)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Action Buttons (when user has crews) */}
        {crews.length > 0 && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowAction('create')}
              className="flex-1 py-3 px-4 rounded-xl bg-card text-card-foreground font-semibold border-2 border-border active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create
            </button>
            <button
              onClick={() => setShowAction('join')}
              className="flex-1 py-3 px-4 rounded-xl bg-card text-card-foreground font-semibold border-2 border-border active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4" />
              Join
            </button>
          </div>
        )}
      </div>

      {/* Create Crew Modal */}
      {showAction === 'create' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowAction('none')}
          />
          <div className="relative w-full max-w-lg bg-card border-t-3 border-x-3 border-border rounded-t-3xl safe-area-bottom">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <form onSubmit={handleCreateSubmit} className="px-5 pb-6 space-y-5">
              <h2 className="text-xl font-bold text-card-foreground">Create a Crew</h2>
              <p className="text-sm text-muted-foreground">
                Name your crew. You'll get a code to invite friends.
              </p>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                  Crew Name
                </label>
                <input
                  type="text"
                  value={newCrewName}
                  onChange={(e) => setNewCrewName(e.target.value)}
                  placeholder="The Usual Suspects"
                  className="w-full px-4 py-3 rounded-xl bg-surface text-card-foreground font-semibold border-2 border-border focus:border-primary focus:outline-none transition-colors text-lg"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAction('none')}
                  className="flex-1 py-3 rounded-xl border-2 border-border text-card-foreground font-semibold hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newCrewName.trim()}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-display font-normal border-2 border-border shadow-brutal-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 flex items-center justify-center gap-2"
                >
                  Create
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Crew Modal */}
      {showAction === 'join' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowAction('none')}
          />
          <div className="relative w-full max-w-lg bg-card border-t-3 border-x-3 border-border rounded-t-3xl safe-area-bottom">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <form onSubmit={handleJoinSubmit} className="px-5 pb-6 space-y-5">
              <h2 className="text-xl font-bold text-card-foreground">Join a Crew</h2>
              <p className="text-sm text-muted-foreground">
                Enter the invite code from your friend.
              </p>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                  Invite Code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="DEMO1234"
                  maxLength={12}
                  className="w-full px-4 py-3 rounded-xl bg-surface text-card-foreground font-mono font-bold border-2 border-border focus:border-primary focus:outline-none transition-colors text-lg text-center tracking-widest uppercase"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAction('none')}
                  className="flex-1 py-3 rounded-xl border-2 border-border text-card-foreground font-semibold hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!joinCode.trim()}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-display font-normal border-2 border-border shadow-brutal-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 flex items-center justify-center gap-2"
                >
                  Join
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
