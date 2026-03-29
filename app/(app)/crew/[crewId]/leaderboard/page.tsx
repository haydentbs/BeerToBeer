'use client'

import { use } from 'react'
import { LeaderboardScreen } from '@/components/leaderboard-screen'
import { useAppState } from '@/lib/app-state'

export default function LeaderboardPage({ params }: { params: Promise<{ crewId: string }> }) {
  const { crewId } = use(params)
  const { crewDataById } = useAppState()

  const crewData = crewDataById[crewId]

  if (!crewData) {
    return (
      <div className="pb-24 px-4">
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Loading leaderboard data...</p>
        </div>
      </div>
    )
  }

  return <LeaderboardScreen leaderboard={crewData.leaderboard} />
}
