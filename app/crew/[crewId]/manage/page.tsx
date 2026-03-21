'use client'

import { use } from 'react'
import { CrewScreen } from '@/components/crew-screen'
import { useAppState } from '@/lib/app-state'

export default function ManagePage({ params }: { params: Promise<{ crewId: string }> }) {
  const { crewId } = use(params)
  const {
    session,
    visibleCrews,
    handleStartNight,
    handleLeaveNight,
    handleRejoinNight,
    handleRenameCrew,
    handleKickMember,
    handleDeleteCrew,
    handleLeaveCrew,
    handleChangeDrinkTheme,
  } = useAppState()

  const activeCrew = visibleCrews.find((crew) => crew.id === crewId)

  if (!activeCrew || !session) {
    return null
  }

  return (
    <CrewScreen
      crew={activeCrew}
      currentUserId={session.user.id}
      currentMembershipId={session.user.membershipId ?? null}
      isThemeSaving={false}
      onStartNight={handleStartNight}
      onLeaveNight={handleLeaveNight}
      onRejoinNight={handleRejoinNight}
      onRenameCrew={handleRenameCrew}
      onKickMember={handleKickMember}
      onDeleteCrew={handleDeleteCrew}
      onLeaveCrew={handleLeaveCrew}
      onChangeDrinkTheme={handleChangeDrinkTheme}
    />
  )
}
