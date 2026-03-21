'use client'

import { useState } from 'react'
import { Copy, Check, ExternalLink, Moon, Settings, Users, Plus, Crown, X, Pencil, UserMinus, Trash2, LogOut, ChevronRight, AlertTriangle, Clock, Trophy, Swords, HelpCircle, Beer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { currentUser, type Crew, type PastNight } from '@/lib/store'

interface CrewScreenProps {
  crew: Crew
  currentUserId: string
  onStartNight: () => void
  onLeaveNight: () => void
  onRejoinNight: () => void
  onRenameCrew: (name: string) => void
  onKickMember: (memberId: string) => void
  onDeleteCrew: () => void
  onLeaveCrew: () => void
}

export function CrewScreen({ crew, currentUserId, onStartNight, onLeaveNight, onRejoinNight, onRenameCrew, onKickMember, onDeleteCrew, onLeaveCrew }: CrewScreenProps) {
  const [showInvite, setShowInvite] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showRename, setShowRename] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showKickConfirm, setShowKickConfirm] = useState<string | null>(null)
  const [selectedNight, setSelectedNight] = useState<PastNight | null>(null)
  const [renameValue, setRenameValue] = useState(crew.name)
  const [copied, setCopied] = useState(false)

  const isCreator = crew.members[0]?.id === currentUser.id

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(crew.inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="pb-24 px-4 space-y-6">
      {/* Crew Header */}
      <div className="bg-card rounded-2xl border-3 border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-card-foreground">{crew.name}</h2>
            <p className="text-sm text-muted-foreground">{crew.members.length} members</p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg border-2 border-border hover:bg-surface transition-colors"
          >
            <Settings className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Invite Code */}
        <div className="p-3 rounded-xl bg-surface border-2 border-border mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Invite Code</div>
              <span className="font-mono font-bold text-primary text-lg">{crew.inviteCode}</span>
            </div>
            <button
              onClick={handleCopyCode}
              className="p-2 rounded-lg border-2 border-border hover:bg-card transition-colors"
            >
              {copied ? (
                <Check className="h-5 w-5 text-win" />
              ) : (
                <Copy className="h-5 w-5 text-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Night Status */}
        {crew.currentNight ? (() => {
          const isIn = crew.currentNight.participants.some((p) => p.id === currentUserId)
          const count = crew.currentNight.participants.length

          if (isIn) {
            return (
              <div className="p-4 rounded-xl bg-win/10 border-2 border-win">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-win animate-pulse" />
                      <span className="font-semibold text-win">Night Active</span>
                    </div>
                    <p className="text-sm text-card-foreground mt-1">{crew.currentNight.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{count} {count === 1 ? 'person' : 'people'} still in</p>
                  </div>
                  <button
                    onClick={onLeaveNight}
                    className="px-4 py-2 rounded-lg border-2 border-border bg-card text-card-foreground font-semibold text-sm hover:bg-surface transition-colors"
                  >
                    I&apos;m Out
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div className="p-4 rounded-xl bg-surface border-2 border-border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-win animate-pulse" />
                    <span className="font-semibold text-card-foreground">{crew.currentNight.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {count} {count === 1 ? 'person' : 'people'} still going
                  </p>
                </div>
                <button
                  onClick={onRejoinNight}
                  className="px-4 py-2 rounded-lg border-2 border-primary text-primary font-semibold text-sm hover:bg-primary/10 transition-colors"
                >
                  Rejoin
                </button>
              </div>
            </div>
          )
        })() : (
          <button
            onClick={onStartNight}
            className="w-full p-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg border-3 border-border shadow-[4px_4px_0px_0px_var(--border)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
          >
            <Moon className="h-5 w-5" />
            Start a Night
          </button>
        )}
      </div>

      {/* Members */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground uppercase tracking-wide">Members</h3>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-primary text-primary text-sm font-semibold hover:bg-primary/10 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Invite
          </button>
        </div>

        <div className="bg-card rounded-xl border-2 border-border overflow-hidden">
          {crew.members.map((member, index) => {
            const isCreator = index === 0
            const isYou = member.id === currentUser.id

            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 border-b border-border last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    isYou ? 'bg-primary' : 'bg-secondary'
                  )}>
                    <span className={cn(
                      'font-bold',
                      isYou ? 'text-primary-foreground' : 'text-secondary-foreground'
                    )}>
                      {member.initials}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-card-foreground">
                        {member.name}
                        {isYou && ' (you)'}
                      </span>
                      {isCreator && (
                        <Crown className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {isCreator ? 'Crew creator' : 'Member'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowInvite(false)}
          />
          <div className="relative w-full max-w-sm bg-card rounded-2xl border-3 border-border p-6">
            <h3 className="text-lg font-bold text-card-foreground mb-4">Invite to Crew</h3>

            <div className="p-4 rounded-xl bg-surface border-2 border-border mb-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Invite Code
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xl text-primary">{crew.inviteCode}</span>
                <button
                  onClick={handleCopyCode}
                  className="p-2 rounded-lg border-2 border-border hover:bg-card transition-colors"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-win" />
                  ) : (
                    <Copy className="h-5 w-5 text-foreground" />
                  )}
                </button>
              </div>
            </div>

            <button
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold border-2 border-border flex items-center justify-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Share Link
            </button>

            <button
              onClick={() => setShowInvite(false)}
              className="w-full mt-3 py-2 text-muted-foreground font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Past Nights */}
      {crew.pastNights.length > 0 && (
        <div>
          <h3 className="font-bold text-foreground uppercase tracking-wide mb-3">Recent Nights</h3>
          <div className="space-y-3">
            {crew.pastNights.map((night) => (
              <button
                key={night.id}
                onClick={() => setSelectedNight(night)}
                className="w-full bg-card rounded-xl border-2 border-border p-4 flex items-center justify-between text-left hover:border-primary/50 transition-colors"
              >
                <div>
                  <div className="font-semibold text-card-foreground">{night.name}</div>
                  <div className="text-xs text-muted-foreground">{night.date} · {night.bets} bets · {night.duration}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Winner</div>
                    <div className={cn(
                      'font-bold',
                      night.winner === 'You' ? 'text-win' : 'text-card-foreground'
                    )}>
                      {night.winner}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => {
              setShowSettings(false)
              setShowRename(false)
              setShowDeleteConfirm(false)
              setShowKickConfirm(null)
            }}
          />
          <div className="relative w-full max-w-sm max-h-[80vh] bg-card rounded-t-2xl sm:rounded-2xl border-3 border-border overflow-hidden flex flex-col">
            {/* Settings Header */}
            <div className="flex items-center justify-between p-4 border-b-2 border-border">
              <h3 className="text-lg font-bold text-card-foreground">Crew Settings</h3>
              <button
                onClick={() => {
                  setShowSettings(false)
                  setShowRename(false)
                  setShowDeleteConfirm(false)
                  setShowKickConfirm(null)
                }}
                className="p-1.5 rounded-lg hover:bg-surface transition-colors"
              >
                <X className="h-5 w-5 text-card-foreground" />
              </button>
            </div>

            <div className="p-4 space-y-2 overflow-y-auto flex-1">
              {/* Rename Crew */}
              {isCreator && (
                showRename ? (
                  <div className="p-3 rounded-xl bg-surface border-2 border-border space-y-3">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      Crew Name
                    </label>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-card text-card-foreground font-semibold border-2 border-border focus:border-primary focus:outline-none transition-colors"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowRename(false)}
                        className="flex-1 py-2 rounded-lg border-2 border-border text-card-foreground font-semibold text-sm hover:bg-card transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          if (renameValue.trim() && renameValue.trim() !== crew.name) {
                            onRenameCrew(renameValue.trim())
                          }
                          setShowRename(false)
                        }}
                        disabled={!renameValue.trim() || renameValue.trim() === crew.name}
                        className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm border-2 border-border disabled:opacity-50 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowRename(true)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-surface transition-colors"
                  >
                    <Pencil className="h-5 w-5 text-card-foreground" />
                    <span className="flex-1 text-left font-semibold text-card-foreground">Rename Crew</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                )
              )}

              {/* Members Management (creator only) */}
              {isCreator && crew.members.length > 1 && (
                <div>
                  <div className="px-3 pt-3 pb-1">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Manage Members</span>
                  </div>
                  {crew.members.filter(m => m.id !== currentUser.id).map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-surface transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <span className="text-sm font-bold text-secondary-foreground">{member.initials}</span>
                        </div>
                        <span className="font-semibold text-card-foreground">{member.name}</span>
                      </div>
                      {showKickConfirm === member.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowKickConfirm(null)}
                            className="px-3 py-1.5 rounded-lg border-2 border-border text-card-foreground text-xs font-semibold"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              onKickMember(member.id)
                              setShowKickConfirm(null)
                            }}
                            className="px-3 py-1.5 rounded-lg bg-loss text-white text-xs font-bold border-2 border-border"
                          >
                            Kick
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowKickConfirm(member.id)}
                          className="p-2 rounded-lg hover:bg-loss/10 transition-colors"
                        >
                          <UserMinus className="h-4 w-4 text-muted-foreground hover:text-loss" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Divider */}
              <div className="h-px bg-border mx-1" />

              {/* Leave Crew (non-creators) */}
              {!isCreator && (
                <button
                  onClick={() => {
                    onLeaveCrew()
                    setShowSettings(false)
                  }}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-surface transition-colors"
                >
                  <LogOut className="h-5 w-5 text-loss" />
                  <span className="font-semibold text-loss">Leave Crew</span>
                </button>
              )}

              {/* Delete Crew (creator only) */}
              {isCreator && (
                showDeleteConfirm ? (
                  <div className="p-4 rounded-xl bg-loss/10 border-2 border-loss/40 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-loss" />
                      <span className="font-bold text-loss">Delete this crew?</span>
                    </div>
                    <p className="text-sm text-card-foreground">
                      This will permanently delete <strong>{crew.name}</strong>, all bets, and all history. This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-2.5 rounded-lg border-2 border-border text-card-foreground font-semibold text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          onDeleteCrew()
                          setShowSettings(false)
                        }}
                        className="flex-1 py-2.5 rounded-lg bg-loss text-white font-bold text-sm border-2 border-border"
                      >
                        Delete Forever
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-loss/10 transition-colors"
                  >
                    <Trash2 className="h-5 w-5 text-loss" />
                    <span className="font-semibold text-loss">Delete Crew</span>
                  </button>
                )
              )}
            </div>

            {/* Safe area padding to clear bottom nav */}
            <div className="h-20 sm:h-4 shrink-0" />
          </div>
        </div>
      )}

      {/* Past Night Detail Modal */}
      {selectedNight && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setSelectedNight(null)}
          />
          <div className="relative w-full max-w-sm max-h-[85vh] bg-card rounded-t-2xl sm:rounded-2xl border-3 border-border overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b-2 border-border">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-card-foreground">{selectedNight.name}</h3>
                <button
                  onClick={() => setSelectedNight(null)}
                  className="p-1.5 rounded-lg hover:bg-surface transition-colors"
                >
                  <X className="h-5 w-5 text-card-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">{selectedNight.date} · {selectedNight.duration}</p>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-4 space-y-5">
              {/* Stats Row */}
              <div className="flex gap-3">
                <div className="flex-1 p-3 rounded-xl bg-surface border-2 border-border text-center">
                  <div className="text-2xl font-bold text-primary">{selectedNight.bets}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Bets</div>
                </div>
                <div className="flex-1 p-3 rounded-xl bg-surface border-2 border-border text-center">
                  <div className="text-2xl font-bold text-primary">
                    {selectedNight.betDetails.reduce((sum, b) => sum + b.pool, 0).toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Pool</div>
                </div>
                <div className="flex-1 p-3 rounded-xl bg-win/10 border-2 border-win text-center">
                  <Trophy className="h-5 w-5 text-win mx-auto mb-0.5" />
                  <div className="text-sm font-bold text-win">{selectedNight.winner}</div>
                </div>
              </div>

              {/* Leaderboard */}
              {selectedNight.leaderboard.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Standings</h4>
                  <div className="bg-surface rounded-xl border-2 border-border overflow-hidden">
                    {selectedNight.leaderboard.map((entry, i) => (
                      <div
                        key={entry.user.id}
                        className="flex items-center justify-between p-3 border-b border-border last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                            i === 0 ? 'bg-primary text-primary-foreground' : 'bg-border text-foreground'
                          )}>
                            {i + 1}
                          </span>
                          <span className="font-semibold text-foreground">
                            {entry.user.id === currentUser.id ? 'You' : entry.user.name}
                          </span>
                        </div>
                        <span className={cn(
                          'font-bold font-mono',
                          entry.net > 0 ? 'text-win' : entry.net < 0 ? 'text-loss' : 'text-foreground'
                        )}>
                          {entry.net > 0 ? '+' : ''}{entry.net.toFixed(1)} 🍺
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bet Results */}
              {selectedNight.betDetails.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Bet Results</h4>
                  <div className="space-y-2">
                    {selectedNight.betDetails.map((bet, i) => (
                      <div key={i} className="bg-surface rounded-xl border-2 border-border p-3">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5">
                            {bet.type === 'h2h' ? (
                              <Swords className="h-4 w-4 text-primary" />
                            ) : (
                              <HelpCircle className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-foreground text-sm">{bet.title}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-win font-semibold">Winner: {bet.winner}</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">{bet.pool} drinks in pool</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom padding for mobile */}
            <div className="h-20 sm:h-4 shrink-0" />
          </div>
        </div>
      )}
    </div>
  )
}
