import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BetCardCompact } from '@/components/bet-card-compact'
import { SettleUpThemeProvider } from '@/components/theme-provider'
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

describe('BetCardCompact', () => {
  it('renders open bets with no options without crashing', async () => {
    const user = userEvent.setup()
    const onTap = vi.fn()
    const bet: Bet = {
      id: 'bet-1',
      type: 'prop',
      subtype: 'yesno',
      title: 'Late arrival prop',
      creator: currentUser,
      challenger: opponent,
      status: 'open',
      closesAt: new Date(Date.now() + 60_000),
      createdAt: new Date('2026-03-21T18:00:00.000Z'),
      options: [],
      totalPool: 0,
    }

    render(
      <SettleUpThemeProvider>
        <CurrentUserProvider user={currentUser}>
          <BetCardCompact bet={bet} onTap={onTap} />
        </CurrentUserProvider>
      </SettleUpThemeProvider>
    )

    expect(screen.getByText('Awaiting wagers')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Late arrival prop/i }))

    expect(onTap).toHaveBeenCalledWith(bet)
  })
})
