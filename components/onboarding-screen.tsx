'use client'

import { useState } from 'react'
import { Beer, FlaskConical, LogIn, Users } from 'lucide-react'
import { DEMO_CREW_CODE } from '@/lib/demo-crew'
import type { DevAuthIdentity } from '@/lib/dev-auth'

interface AuthActionResult {
  error?: string
  message?: string
}

interface OnboardingScreenProps {
  authNotice?: string | null
  isSubmitting?: boolean
  submittingMode?: 'guest' | 'google' | 'dev' | null
  isSupabaseConfigured: boolean
  configError?: string | null
  onGuestJoin: (name: string, crewCode: string) => Promise<AuthActionResult>
  onGoogleAuth: () => Promise<AuthActionResult>
  devAuthIdentities?: DevAuthIdentity[]
  onDevAuth?: (identityId: string) => Promise<AuthActionResult>
}

export function OnboardingScreen({
  authNotice,
  isSubmitting = false,
  submittingMode = null,
  isSupabaseConfigured,
  configError,
  onGuestJoin,
  onGoogleAuth,
  devAuthIdentities = [],
  onDevAuth,
}: OnboardingScreenProps) {
  const [name, setName] = useState('')
  const [crewCode, setCrewCode] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [localNotice, setLocalNotice] = useState<string | null>(null)

  const handleResult = (result: AuthActionResult) => {
    if (result.error) {
      setLocalError(result.error)
      setLocalNotice(null)
      return
    }

    setLocalError(null)
    setLocalNotice(result.message ?? null)
  }

  const handleGuestSubmit = async () => {
    handleResult(await onGuestJoin(name.trim(), crewCode.trim()))
  }

  const handleGoogleSubmit = async () => {
    handleResult(await onGoogleAuth())
  }

  const handleDevAuth = async (identityId: string) => {
    if (!onDevAuth) {
      return
    }

    handleResult(await onDevAuth(identityId))
  }

  const feedback = localError ?? authNotice ?? localNotice ?? configError
  const feedbackTone = localError || authNotice || configError ? 'error' : 'notice'
  const authDisabled = !isSupabaseConfigured || isSubmitting

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-primary border-3 border-border shadow-brutal flex items-center justify-center">
            <Beer className="w-10 h-10 text-primary-foreground" />
          </div>
        </div>

        <h1 className="text-3xl text-foreground text-center mb-1">SettleUp</h1>
        <p className="text-muted-foreground text-center text-base mb-8 max-w-xs">
          Jump in as a guest with a cookie-backed session, or continue with Google for a saved account.
        </p>

        {feedback && (
          <div
            className={`w-full max-w-xs rounded-2xl border-2 px-4 py-3 mb-5 text-sm ${
              feedbackTone === 'error'
                ? 'border-loss/40 bg-loss/10 text-loss'
                : 'border-primary/30 bg-primary/10 text-foreground'
            }`}
          >
            {feedback}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim() || !crewCode.trim()) {
              return
            }

            void handleGuestSubmit()
          }}
          className="w-full max-w-xs space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
              Crew Code
            </label>
            <input
              type="text"
              value={crewCode}
              onChange={(e) => setCrewCode(e.target.value.toUpperCase())}
              placeholder="DEMO1234"
              maxLength={12}
              className="w-full px-4 py-3 rounded-xl bg-card text-card-foreground font-mono font-bold border-3 border-border focus:border-primary focus:outline-none transition-colors text-lg text-center tracking-widest uppercase"
              disabled={isSubmitting}
            />
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Permanent test crew: <span className="font-mono font-semibold text-foreground">{DEMO_CREW_CODE}</span>. Dashes and spaces are ignored.
            </p>
          </div>

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
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || !crewCode.trim()}
            className="w-full py-4 px-6 rounded-xl bg-primary text-primary-foreground font-display font-normal text-lg border-3 border-border shadow-brutal active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 flex items-center justify-center gap-2"
          >
            <Users className="w-5 h-5" />
            {submittingMode === 'guest' ? 'Joining as Guest…' : 'Join as Guest'}
          </button>

          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            type="button"
            onClick={() => void handleGoogleSubmit()}
            disabled={authDisabled}
            className="w-full py-4 px-6 rounded-xl bg-card text-card-foreground font-sans font-semibold text-lg border-3 border-border shadow-brutal active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" />
            {submittingMode === 'google' ? 'Opening Google…' : 'Continue with Google'}
          </button>

          {devAuthIdentities.length > 0 && onDevAuth && (
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/10 p-4 text-left">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                <FlaskConical className="h-4 w-4" />
                Dev Quick Sign-In
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Pick a local authenticated tester without going through Google.
              </p>
              <div className="mt-3 space-y-2">
                {devAuthIdentities.map((identity) => (
                  <button
                    key={identity.id}
                    type="button"
                    onClick={() => void handleDevAuth(identity.id)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border-2 border-border bg-card px-4 py-3 text-left text-sm font-semibold text-card-foreground transition-all hover:border-primary/50 disabled:opacity-60"
                  >
                    {submittingMode === 'dev' ? `Signing in as ${identity.label}…` : `Continue as ${identity.label}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>

      <div className="px-6 pb-8 text-center">
        <p className="text-xs text-muted-foreground">
          Competition is everything. We are just giving it a tab.
        </p>
      </div>
    </div>
  )
}
