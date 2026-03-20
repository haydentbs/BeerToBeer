'use client'

import { useState } from 'react'
import { Beer, ArrowRight, Users, Mail, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OnboardingScreenProps {
  onGuestJoin: (name: string, crewCode?: string) => void
  onSignIn: (email: string, password: string) => void
  onSignUp: (name: string, email: string, password: string) => void
}

type Mode = 'landing' | 'signin' | 'signup'

export function OnboardingScreen({ onGuestJoin, onSignIn, onSignUp }: OnboardingScreenProps) {
  const [mode, setMode] = useState<Mode>('landing')
  const [name, setName] = useState('')
  const [crewCode, setCrewCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleGuestJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onGuestJoin(name.trim(), crewCode.trim() || undefined)
    }
  }

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim() && password) {
      onSignIn(email.trim(), password)
    }
  }

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim() && email.trim() && password) {
      onSignUp(name.trim(), email.trim(), password)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-primary border-3 border-border shadow-brutal flex items-center justify-center">
            <Beer className="w-10 h-10 text-primary-foreground" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-foreground text-center mb-1">BeerScore</h1>
        <p className="text-muted-foreground text-center text-base mb-8 max-w-xs">
          The betting app where the stakes are real drinks.
        </p>

        {/* Landing — Guest Join */}
        {mode === 'landing' && (
          <form onSubmit={handleGuestJoin} className="w-full max-w-xs space-y-4">
            {/* Crew Code (optional) */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
                Crew Code
                <span className="text-muted-foreground/60 font-normal normal-case ml-1">(optional)</span>
              </label>
              <input
                type="text"
                value={crewCode}
                onChange={(e) => setCrewCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XX"
                maxLength={8}
                className="w-full px-4 py-3 rounded-xl bg-card text-card-foreground font-mono font-bold border-3 border-border focus:border-primary focus:outline-none transition-colors text-lg text-center tracking-widest uppercase"
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
                className="w-full px-4 py-3 rounded-xl bg-card text-card-foreground font-semibold border-3 border-border focus:border-primary focus:outline-none transition-colors text-lg"
                autoFocus
              />
            </div>

            {/* Join as Guest */}
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full py-4 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-lg border-3 border-border shadow-brutal active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5" />
              {crewCode.trim() ? 'Join Crew' : 'Jump In'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Sign In / Sign Up links */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="flex-1 py-3 px-4 rounded-xl bg-card text-card-foreground font-semibold border-2 border-border active:scale-[0.98] transition-all"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="flex-1 py-3 px-4 rounded-xl bg-card text-card-foreground font-semibold border-2 border-border active:scale-[0.98] transition-all"
              >
                Sign Up
              </button>
            </div>
          </form>
        )}

        {/* Sign In Form */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="w-full max-w-xs space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full px-4 py-3 rounded-xl bg-card text-card-foreground font-semibold border-3 border-border focus:border-primary focus:outline-none transition-colors"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-card text-card-foreground font-semibold border-3 border-border focus:border-primary focus:outline-none transition-colors pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!email.trim() || !password}
              className="w-full py-4 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-lg border-3 border-border shadow-brutal active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 flex items-center justify-center gap-2"
            >
              Sign In
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setMode('landing')}
              className="w-full py-2 text-muted-foreground font-semibold text-sm"
            >
              ← Back
            </button>
          </form>
        )}

        {/* Sign Up Form */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="w-full max-w-xs space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
                className="w-full px-4 py-3 rounded-xl bg-card text-card-foreground font-semibold border-3 border-border focus:border-primary focus:outline-none transition-colors"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full px-4 py-3 rounded-xl bg-card text-card-foreground font-semibold border-3 border-border focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-card text-card-foreground font-semibold border-3 border-border focus:border-primary focus:outline-none transition-colors pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!name.trim() || !email.trim() || !password}
              className="w-full py-4 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-lg border-3 border-border shadow-brutal active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 flex items-center justify-center gap-2"
            >
              Create Account
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setMode('landing')}
              className="w-full py-2 text-muted-foreground font-semibold text-sm"
            >
              ← Back
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
