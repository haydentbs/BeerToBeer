'use client'

import { useState } from 'react'
import { Beer, Users, Trophy, ArrowRight } from 'lucide-react'

interface LandingPageProps {
  onJoin: (name: string, crewCode: string) => void
  onCreate: (name: string) => void
}

export function LandingPage({ onJoin, onCreate }: LandingPageProps) {
  const [mode, setMode] = useState<'initial' | 'join' | 'create'>('initial')
  const [name, setName] = useState('')
  const [crewCode, setCrewCode] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    if (mode === 'join' && crewCode.trim()) {
      onJoin(name.trim(), crewCode.trim().toUpperCase())
    } else if (mode === 'create') {
      onCreate(name.trim())
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-2xl bg-primary border-3 border-border shadow-brutal flex items-center justify-center">
            <Beer className="w-12 h-12 text-primary-foreground" />
          </div>
        </div>

        <h1 className="text-4xl text-foreground text-center mb-2">SettleUp</h1>
        <p className="text-muted-foreground text-center text-lg mb-8 max-w-xs">
          The betting app where the stakes are real drinks.
        </p>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border-2 border-border">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-card-foreground">Crews</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border-2 border-border">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-card-foreground">Leaderboards</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border-2 border-border">
            <Beer className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-card-foreground">Real Stakes</span>
          </div>
        </div>

        {/* Action Forms */}
        {mode === 'initial' && (
          <div className="w-full max-w-xs space-y-3">
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 px-6 rounded-xl bg-primary text-primary-foreground font-display font-normal text-lg border-3 border-border shadow-brutal active:shadow-none active:translate-x-1 active:translate-y-1 transition-all flex items-center justify-center gap-2"
            >
              Join a Room
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 px-6 rounded-xl bg-card text-card-foreground font-bold text-lg border-3 border-border shadow-brutal active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
            >
              Create a Crew
            </button>
          </div>
        )}

        {mode === 'join' && (
          <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-xl bg-card text-card-foreground font-semibold border-3 border-border focus:border-primary focus:outline-none transition-colors text-lg"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                Room Code
              </label>
              <input
                type="text"
                value={crewCode}
                onChange={(e) => setCrewCode(e.target.value.toUpperCase())}
                placeholder="DEMO1234"
                maxLength={12}
                className="w-full px-4 py-3 rounded-xl bg-card text-card-foreground font-mono font-bold border-3 border-border focus:border-primary focus:outline-none transition-colors text-lg text-center tracking-widest uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={!name.trim() || !crewCode.trim()}
              className="w-full py-4 px-6 rounded-xl bg-primary text-primary-foreground font-display font-normal text-lg border-3 border-border shadow-brutal active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 flex items-center justify-center gap-2"
            >
              Join Room
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setMode('initial')}
              className="w-full py-3 text-muted-foreground font-semibold"
            >
              Back
            </button>
          </form>
        )}

        {mode === 'create' && (
          <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-xl bg-card text-card-foreground font-semibold border-3 border-border focus:border-primary focus:outline-none transition-colors text-lg"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full py-4 px-6 rounded-xl bg-primary text-primary-foreground font-display font-normal text-lg border-3 border-border shadow-brutal active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 flex items-center justify-center gap-2"
            >
              Create Crew
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setMode('initial')}
              className="w-full py-3 text-muted-foreground font-semibold"
            >
              Back
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 pb-8 text-center">
        <p className="text-xs text-muted-foreground">
          Competition is everything. We are just giving it a tab.
        </p>
      </div>
    </div>
  )
}
