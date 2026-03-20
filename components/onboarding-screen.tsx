'use client'

import { useState } from 'react'
import { Beer, ArrowRight } from 'lucide-react'

interface OnboardingScreenProps {
  onComplete: (name: string) => void
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [name, setName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onComplete(name.trim())
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-2xl bg-primary border-3 border-border shadow-brutal flex items-center justify-center">
            <Beer className="w-12 h-12 text-primary-foreground" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-foreground text-center mb-2">BeerScore</h1>
        <p className="text-muted-foreground text-center text-lg mb-12 max-w-xs">
          The betting app where the stakes are real drinks.
        </p>

        {/* Name Input */}
        <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-6">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
              What should we call you?
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-xl bg-card text-card-foreground font-semibold border-3 border-border focus:border-primary focus:outline-none transition-colors text-lg"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-4 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-lg border-3 border-border shadow-brutal active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 flex items-center justify-center gap-2"
          >
            Let's Go
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
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
