'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Beer, Bomb, CheckCircle, LogIn, Users } from 'lucide-react'
import { useAppState } from '@/lib/app-state'
import { LoadingSpinner } from '@/components/loading-spinner'
import { DEV_AUTH_IDENTITIES } from '@/lib/dev-auth'

interface AuthActionResult {
  error?: string
  message?: string
}

export default function PlayPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params)
  const searchParams = useSearchParams()
  const crewCode = (searchParams.get('crew') ?? '').toUpperCase()

  const router = useRouter()
  const {
    session,
    isAuthReady,
    isDataReady,
    isAuthSubmitting,
    authSubmittingMode,
    authNotice,
    loadingCopy,
    visibleCrews,
    handleGoogleAuth,
    handleGuestJoin,
    handleJoinCrew,
    handleClaimMiniGameInvite,
    handleDevAuth,
    devAuthEnabled,
    supabaseConfigured,
    supabaseConfigError,
  } = useAppState()

  const [name, setName] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [localNotice, setLocalNotice] = useState<string | null>(null)
  const [joinAttempted, setJoinAttempted] = useState(false)
  const [claimAttempted, setClaimAttempted] = useState(false)

  const handleJoinCrewRef = useRef(handleJoinCrew)
  handleJoinCrewRef.current = handleJoinCrew

  // Find the crew that owns this match, or match by invite code
  const normalizedCode = crewCode.replace(/[^A-Z0-9]/g, '')
  const crewByCode = normalizedCode
    ? visibleCrews.find(
        (c) => c.inviteCode.toUpperCase().replace(/[^A-Z0-9]/g, '') === normalizedCode
      )
    : null

  // Also check if any crew has this match in its current night
  const crewByMatch = visibleCrews.find((c) =>
    c.currentNight?.miniGameMatches?.some((m: any) => m.id === matchId)
  )

  const existingCrew = crewByMatch ?? crewByCode

  // Build the destination URL with the match query param
  const getDestination = (crewId: string) => `/crew/${crewId}/tonight?match=${matchId}`

  // Auto-join the crew for authenticated users who do not have access yet.
  useEffect(() => {
    if (!isAuthReady || !session || !isDataReady) return

    if (!existingCrew && crewCode && !joinAttempted) {
      setJoinAttempted(true)
      void handleJoinCrewRef.current(crewCode, { redirectToCrew: false }).then((success) => {
        if (!success) {
          setLocalError('Could not join this crew. The invite code may be invalid.')
        }
      })
    }
  }, [isAuthReady, isDataReady, session, existingCrew, crewCode, joinAttempted])

  // Once the crew is available, claim the shared invite if needed and then open the match.
  useEffect(() => {
    if (!isAuthReady || !session || !isDataReady || !existingCrew || claimAttempted) return

    setClaimAttempted(true)
    void handleClaimMiniGameInvite(matchId, existingCrew.id).then((success) => {
      if (!success) {
        setLocalError('Could not open this Beer Bomb invite.')
        setClaimAttempted(false)
        return
      }
      router.push(getDestination(existingCrew.id))
    })
  }, [claimAttempted, existingCrew, handleClaimMiniGameInvite, isAuthReady, isDataReady, matchId, router, session])

  // --- Render states ---

  if (isAuthReady && session && existingCrew) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-full bg-primary/15 border-2 border-primary flex items-center justify-center mb-4">
          <Bomb className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Opening Beer Bomb</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">Taking you to the game...</p>
      </div>
    )
  }

  if (isAuthReady && session && !isDataReady) {
    return (
      <main className="min-h-screen bg-background">
        <LoadingSpinner
          message={loadingCopy?.message ?? 'Checking your tab\u2026'}
          submessage={loadingCopy?.submessage ?? 'Loading your crews'}
          className="min-h-screen"
        />
      </main>
    )
  }

  if (isAuthReady && session) {
    return (
      <main className="min-h-screen bg-background">
        <LoadingSpinner
          message="Joining crew\u2026"
          submessage="Getting you into the game"
          className="min-h-screen"
        />
      </main>
    )
  }

  if (!isAuthReady) {
    return (
      <main className="min-h-screen bg-background">
        <LoadingSpinner
          message={loadingCopy?.message ?? 'Checking your tab\u2026'}
          submessage={loadingCopy?.submessage ?? 'Restoring your session'}
          className="min-h-screen"
        />
      </main>
    )
  }

  // --- Not authenticated: show join form ---

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
    if (!crewCode) {
      setLocalError('This invite link is missing a crew code.')
      return
    }
    // Store pending match so tonight page auto-opens it after redirect
    try { sessionStorage.setItem('pendingBeerBombMatchId', matchId) } catch {}
    handleResult(await handleGuestJoin(name.trim(), crewCode, { matchId }))
  }

  const handleGoogleSubmit = async () => {
    // Store pending match so tonight page auto-opens it after OAuth redirect
    try { sessionStorage.setItem('pendingBeerBombMatchId', matchId) } catch {}
    handleResult(await handleGoogleAuth())
  }

  const handleDevAuthSubmit = async (identityId: string) => {
    handleResult(await handleDevAuth(identityId))
  }

  const feedback = localError ?? authNotice ?? localNotice ?? supabaseConfigError
  const feedbackTone = localError || authNotice || supabaseConfigError ? 'error' : 'notice'
  const authDisabled = !supabaseConfigured || isAuthSubmitting

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-primary border-3 border-border shadow-brutal flex items-center justify-center">
            <Bomb className="w-10 h-10 text-primary-foreground" />
          </div>
        </div>

        <h1 className="text-3xl text-foreground text-center mb-1">Beer Bomb</h1>
        <p className="text-muted-foreground text-center text-base mb-4 max-w-xs">
          You&apos;ve been challenged to a game of Beer Bomb. Join to play!
        </p>

        {crewCode && (
          <div className="w-full max-w-xs mb-4 p-3 rounded-xl bg-surface border-2 border-border text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Crew Code</div>
            <span className="font-mono font-bold text-primary text-2xl tracking-widest">{crewCode}</span>
          </div>
        )}

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
            if (!name.trim()) return
            void handleGuestSubmit()
          }}
          className="w-full max-w-xs space-y-4"
        >
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
              disabled={isAuthSubmitting}
            />
          </div>

          <button
            type="submit"
            disabled={isAuthSubmitting || !name.trim()}
            className="w-full py-4 px-6 rounded-xl bg-primary text-primary-foreground font-display font-normal text-lg border-3 border-border shadow-brutal active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 flex items-center justify-center gap-2"
          >
            <Users className="w-5 h-5" />
            {authSubmittingMode === 'guest' ? 'Joining\u2026' : 'Join & Play'}
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
            {authSubmittingMode === 'google' ? 'Opening Google\u2026' : 'Continue with Google'}
          </button>

          {devAuthEnabled && (
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/10 p-4 text-left">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                Dev Quick Sign-In
              </div>
              <div className="mt-3 space-y-2">
                {DEV_AUTH_IDENTITIES.map((identity) => (
                  <button
                    key={identity.id}
                    type="button"
                    onClick={() => void handleDevAuthSubmit(identity.id)}
                    disabled={isAuthSubmitting}
                    className="w-full rounded-xl border-2 border-border bg-card px-4 py-3 text-left text-sm font-semibold text-card-foreground transition-all hover:border-primary/50 disabled:opacity-60"
                  >
                    {authSubmittingMode === 'dev' ? `Signing in as ${identity.label}\u2026` : `Continue as ${identity.label}`}
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
