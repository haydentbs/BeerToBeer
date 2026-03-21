import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BetDetailModal } from '@/components/bet-detail-modal'
import { BeerScoreThemeProvider } from '@/components/theme-provider'
import { CurrentUserProvider } from '@/lib/current-user'
import type { Bet, User } from '@/lib/store'

const currentUser: User = {
  id: 'user-1',
  membershipId: 'membership-1',
  role: 'creator',
  name: 'Alex Creator',
  avatar: '',
  initials: 'AC',
}

const opponent: User = {
  id: 'user-2',
  membershipId: 'membership-2',
  role: 'member',
  name: 'Riley Rival',
  avatar: '',
  initials: 'RR',
}

function renderModal(bet: Bet) {
  return render(
    <BeerScoreThemeProvider>
      <CurrentUserProvider user={currentUser}>
        <BetDetailModal
          bet={bet}
          isOpen
          onClose={vi.fn()}
          onWager={vi.fn()}
          onProposeResult={vi.fn()}
          onConfirmResult={vi.fn()}
          onDisputeResult={vi.fn()}
          onCastDisputeVote={vi.fn()}
        />
      </CurrentUserProvider>
    </BeerScoreThemeProvider>
  )
}

function makeDisputedBet(id: string, title: string): Bet {
  return {
    id,
    type: 'h2h',
    subtype: null,
    title,
    creator: currentUser,
    challenger: opponent,
    status: 'disputed',
    createdAt: new Date('2026-03-21T18:00:00.000Z'),
    closesAt: null,
    challengeWager: 1,
    options: [
      { id: `${id}-opt-1`, label: 'Alex Creator wins', wagers: [], totalDrinks: 1 },
      { id: `${id}-opt-2`, label: 'Riley Rival wins', wagers: [], totalDrinks: 1 },
    ],
    totalPool: 2,
  }
}

function makeOpenH2HBet(id: string, title: string): Bet {
  return {
    id,
    type: 'h2h',
    subtype: null,
    title,
    creator: currentUser,
    challenger: opponent,
    status: 'open',
    createdAt: new Date('2026-03-21T18:00:00.000Z'),
    closesAt: null,
    challengeWager: 1,
    options: [
      { id: `${id}-opt-1`, label: 'Alex Creator wins', wagers: [], totalDrinks: 1 },
      { id: `${id}-opt-2`, label: 'Riley Rival wins', wagers: [], totalDrinks: 1 },
    ],
    totalPool: 2,
  }
}

describe('BetDetailModal', () => {
  it('resets the dispute vote state when the selected bet changes', async () => {
    const user = userEvent.setup()
    const onCastDisputeVote = vi.fn()
    const firstBet = makeDisputedBet('bet-1', 'Pool race')
    const secondBet = makeDisputedBet('bet-2', 'Darts rematch')

    const { rerender } = render(
      <BeerScoreThemeProvider>
        <CurrentUserProvider user={currentUser}>
          <BetDetailModal
            bet={firstBet}
            isOpen
            onClose={vi.fn()}
            onWager={vi.fn()}
            onProposeResult={vi.fn()}
            onConfirmResult={vi.fn()}
            onDisputeResult={vi.fn()}
            onCastDisputeVote={onCastDisputeVote}
          />
        </CurrentUserProvider>
      </BeerScoreThemeProvider>
    )

    await user.click(screen.getAllByRole('button', { name: /Alex Creator wins/i })[0])

    expect(onCastDisputeVote).toHaveBeenCalledWith(firstBet.id, firstBet.options[0].id)
    expect(screen.getByText(/vote submitted/i)).toBeInTheDocument()

    rerender(
      <BeerScoreThemeProvider>
        <CurrentUserProvider user={currentUser}>
          <BetDetailModal
            bet={secondBet}
            isOpen
            onClose={vi.fn()}
            onWager={vi.fn()}
            onProposeResult={vi.fn()}
            onConfirmResult={vi.fn()}
            onDisputeResult={vi.fn()}
            onCastDisputeVote={onCastDisputeVote}
          />
        </CurrentUserProvider>
      </BeerScoreThemeProvider>
    )

    expect(screen.queryByText(/vote submitted/i)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Alex Creator wins/i })[0]).toBeEnabled()
  })

  it('leaves report-result mode when a different bet is opened', async () => {
    const user = userEvent.setup()
    const firstBet = makeOpenH2HBet('bet-1', 'Pool race')
    const secondBet = makeOpenH2HBet('bet-2', 'Darts rematch')

    const { rerender } = renderModal(firstBet)

    await user.click(screen.getByRole('button', { name: 'Report Result' }))

    expect(screen.getByText('Who won?')).toBeInTheDocument()

    rerender(
      <BeerScoreThemeProvider>
        <CurrentUserProvider user={currentUser}>
          <BetDetailModal
            bet={secondBet}
            isOpen
            onClose={vi.fn()}
            onWager={vi.fn()}
            onProposeResult={vi.fn()}
            onConfirmResult={vi.fn()}
            onDisputeResult={vi.fn()}
            onCastDisputeVote={vi.fn()}
          />
        </CurrentUserProvider>
      </BeerScoreThemeProvider>
    )

    expect(screen.queryByText('Who won?')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Report Result' })).toBeVisible()
  })
})
