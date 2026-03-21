'use client'

import { use } from 'react'
import { LedgerScreen } from '@/components/ledger-screen'
import { useAppState } from '@/lib/app-state'

export default function LedgerPage({ params }: { params: Promise<{ crewId: string }> }) {
  const { crewId } = use(params)
  const { crewDataById, handleSettle } = useAppState()

  const crewData = crewDataById[crewId]

  if (!crewData) {
    return (
      <div className="pb-24 px-4">
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Loading ledger data...</p>
        </div>
      </div>
    )
  }

  return (
    <LedgerScreen
      tonightLedger={crewData.tonightLedger}
      allTimeLedger={crewData.allTimeLedger}
      onSettle={handleSettle}
    />
  )
}
