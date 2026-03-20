'use client'

import { useState } from 'react'
import { Copy, ExternalLink, Moon, Settings, Users, Plus, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { currentUser, type Crew } from '@/lib/store'

interface CrewScreenProps {
  crew: Crew
  onStartNight: () => void
  onEndNight: () => void
}

export function CrewScreen({ crew, onStartNight, onEndNight }: CrewScreenProps) {
  const [showInvite, setShowInvite] = useState(false)
  
  const inviteCode = 'USUAL-2024'

  return (
    <div className="pb-24 px-4 space-y-6">
      {/* Crew Header */}
      <div className="bg-card rounded-2xl border-3 border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-card-foreground">{crew.name}</h2>
            <p className="text-sm text-muted-foreground">{crew.members.length} members</p>
          </div>
          <button className="p-2 rounded-lg border-2 border-border hover:bg-surface transition-colors">
            <Settings className="h-5 w-5 text-card-foreground" />
          </button>
        </div>

        {/* Night Status */}
        {crew.currentNight ? (
          <div className="p-4 rounded-xl bg-win/10 border-2 border-win mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-win animate-pulse" />
                  <span className="font-semibold text-win">Night Active</span>
                </div>
                <p className="text-sm text-card-foreground mt-1">{crew.currentNight.name}</p>
              </div>
              <button
                onClick={onEndNight}
                className="px-4 py-2 rounded-lg border-2 border-border bg-card text-card-foreground font-semibold text-sm hover:bg-surface transition-colors"
              >
                End Night
              </button>
            </div>
          </div>
        ) : (
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
            const isCreator = index === 0 // Assume first member is creator
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
                <span className="font-mono font-bold text-xl text-primary">{inviteCode}</span>
                <button className="p-2 rounded-lg border-2 border-border hover:bg-card transition-colors">
                  <Copy className="h-5 w-5 text-card-foreground" />
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
      <div>
        <h3 className="font-bold text-foreground uppercase tracking-wide mb-3">Recent Nights</h3>
        <div className="space-y-3">
          {[
            { name: "Thursday at The Local", date: "Mar 14", bets: 8, winner: "Sarah" },
            { name: "Saturday Game Night", date: "Mar 9", bets: 12, winner: "You" },
            { name: "Jake's Birthday", date: "Mar 2", bets: 15, winner: "Jake" },
          ].map((night, i) => (
            <div 
              key={i}
              className="bg-card rounded-xl border-2 border-border p-4 flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-card-foreground">{night.name}</div>
                <div className="text-xs text-muted-foreground">{night.date} • {night.bets} bets</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Winner</div>
                <div className={cn(
                  'font-bold',
                  night.winner === 'You' ? 'text-win' : 'text-card-foreground'
                )}>
                  {night.winner}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
