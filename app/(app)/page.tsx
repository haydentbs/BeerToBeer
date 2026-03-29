'use client'

import { useRouter } from 'next/navigation'
import { OnboardingScreen } from '@/components/onboarding-screen'
import { HomeScreen } from '@/components/home-screen'
import { LoadingSpinner } from '@/components/loading-spinner'
import { DEV_AUTH_IDENTITIES } from '@/lib/dev-auth'
import { useAppState } from '@/lib/app-state'

export default function HomePage() {
  const router = useRouter()
  const {
    session,
    isAuthReady,
    isDataReady,
    isAuthSubmitting,
    authSubmittingMode,
    isSigningOut,
    authNotice,
    loadingCopy,
    handleGoogleAuth,
    handleGuestJoin,
    handleDevAuth,
    handleSignOut,
    handleFinishAccount,
    devAuthEnabled,
    supabaseConfigured,
    supabaseConfigError,
    visibleCrews,
    crewNetPositions,
    notifications,
    handleCreateCrew,
    handleJoinCrew,
    handleMarkNotificationsRead,
    handleOpenNotification,
    isMutating,
    mutationError,
    setMutationError,
    showDevBattleSandbox,
    handleCreateDevBattleSandbox,
  } = useAppState()

  if (!isAuthReady || (session && !isDataReady)) {
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

  if (!session) {
    return (
      <>
        <OnboardingScreen
          authNotice={authNotice}
          isSubmitting={isAuthSubmitting}
          submittingMode={authSubmittingMode}
          isSupabaseConfigured={supabaseConfigured}
          configError={supabaseConfigError}
          onGuestJoin={handleGuestJoin}
          onGoogleAuth={() => handleGoogleAuth()}
          devAuthIdentities={devAuthEnabled ? DEV_AUTH_IDENTITIES : []}
          onDevAuth={devAuthEnabled ? handleDevAuth : undefined}
        />
        {isAuthSubmitting && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <LoadingSpinner
              message={
                authSubmittingMode === 'guest'
                  ? 'Joining your crew\u2026'
                  : authSubmittingMode === 'dev'
                  ? 'Signing you in\u2026'
                  : 'Opening Google\u2026'
              }
              submessage={
                authSubmittingMode === 'guest'
                  ? 'Setting up your guest tab'
                  : authSubmittingMode === 'dev'
                  ? 'Starting your local test session'
                  : 'Handing off to Google sign-in'
              }
            />
          </div>
        )}
      </>
    )
  }

  const handleSelectCrew = (crewId: string) => {
    router.push(`/crew/${crewId}/tonight`)
  }

  return (
    <HomeScreen
      user={session.user}
      userEmail={session.email}
      isGuest={session.isGuest}
      crews={visibleCrews}
      crewNetPositions={crewNetPositions}
      onSelectCrew={handleSelectCrew}
      onCreateCrew={handleCreateCrew}
      onJoinCrew={handleJoinCrew}
      notifications={notifications}
      onMarkRead={() => { void handleMarkNotificationsRead() }}
      onOpenNotification={handleOpenNotification}
      onSignOut={handleSignOut}
      showDevBattleSandbox={showDevBattleSandbox}
      onCreateDevBattleSandbox={handleCreateDevBattleSandbox}
      isSigningOut={isSigningOut}
      isMutating={isMutating}
      mutationError={mutationError}
      onDismissError={() => setMutationError(null)}
      onFinishAccount={session.isGuest ? handleFinishAccount : undefined}
    />
  )
}
