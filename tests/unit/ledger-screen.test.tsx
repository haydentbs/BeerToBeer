import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LedgerScreen } from '@/components/ledger-screen'
import { CurrentUserProvider } from '@/lib/current-user'
import type { LedgerEntry, User } from '@/lib/store'

function makeCurrentUser(): User {
  return {
    id: 'me',
    membershipId: 'membership-me',
    name: 'You',
    avatar: '',
    initials: 'ME',
  }
}

function makeFriend(): User {
  return {
    id: 'friend',
    membershipId: 'membership-friend',
    name: 'Sam Friend',
    avatar: '',
    initials: 'SF',
  }
}

function makeUser(id: string, name: string, initials: string): User {
  return {
    id,
    membershipId: `membership-${id}`,
    name,
    avatar: '',
    initials,
  }
}

function renderLedgerScreen({
  tonightLedger,
  allTimeLedger,
  currentUser = makeCurrentUser(),
  onSettle = vi.fn(),
}: {
  tonightLedger: LedgerEntry[]
  allTimeLedger: LedgerEntry[]
  currentUser?: User
  onSettle?: ReturnType<typeof vi.fn>
}) {
  render(
    <CurrentUserProvider user={currentUser}>
      <LedgerScreen tonightLedger={tonightLedger} allTimeLedger={allTimeLedger} onSettle={onSettle} />
    </CurrentUserProvider>
  )

  return { onSettle }
}

describe('LedgerScreen', () => {
  it('opens a settlement dialog and records the selected amount for the aggregate pair', async () => {
    const user = userEvent.setup()
    const currentUser = makeCurrentUser()
    const friend = makeFriend()
    const onSettle = vi.fn()

    renderLedgerScreen({
      currentUser,
      onSettle,
      tonightLedger: [
        { fromUser: friend, toUser: currentUser, drinks: 1.5, settled: 0.5 },
        { fromUser: friend, toUser: currentUser, drinks: 1, settled: 0.5 },
      ],
      allTimeLedger: [],
    })

    await user.click(screen.getByRole('button', { name: /record settlement/i }))

    expect(screen.getByText('Settle tab')).toBeInTheDocument()
    expect(screen.getByLabelText('Settlement amount')).toHaveValue(1.5)

    await user.click(screen.getByRole('button', { name: /decrease settlement amount/i }))
    await user.click(screen.getByRole('button', { name: /confirm settlement/i }))

    expect(onSettle).toHaveBeenCalledWith(
      {
        fromUser: friend,
        toUser: currentUser,
        drinks: 1.5,
        settled: 0,
      },
      1
    )
  })

  it('shows the simplified repayment path instead of intermediate debt chains', () => {
    const currentUser = makeUser('player-3', 'Player 3', 'P3')
    const playerOne = makeUser('player-1', 'Player 1', 'P1')
    const playerTwo = makeUser('player-2', 'Player 2', 'P2')

    renderLedgerScreen({
      currentUser,
      tonightLedger: [
        { fromUser: playerOne, toUser: playerTwo, drinks: 2, settled: 0 },
        { fromUser: playerTwo, toUser: currentUser, drinks: 2, settled: 0 },
      ],
      allTimeLedger: [],
    })

    expect(screen.getByText('Player 1')).toBeInTheDocument()
    expect(screen.queryByText('Player 2')).not.toBeInTheDocument()
    expect(screen.getByText(/repayments are simplified across the crew/i)).toBeInTheDocument()
  })
})
