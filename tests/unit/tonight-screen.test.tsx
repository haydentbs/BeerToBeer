import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BeerScoreThemeProvider } from '@/components/theme-provider'
import { TonightScreen } from '@/components/tonight-screen'
import { CurrentUserProvider } from '@/lib/current-user'
import type { Night, User } from '@/lib/store'

function renderTonightScreen() {
  const currentUser: User = {
    id: 'profile-1',
    membershipId: 'membership-1',
    role: 'creator',
    name: 'Alex Creator',
    avatar: '',
    initials: 'AC',
  }

  const night: Night = {
    id: 'night-1',
    name: 'Friday Tab',
    status: 'active',
    startedAt: new Date('2026-03-21T18:00:00.000Z'),
    bets: [],
    miniGameMatches: [],
    participants: [currentUser],
  }

  const handlers = {
    onWager: vi.fn(),
    onBeerBombAccept: vi.fn(),
    onBeerBombDecline: vi.fn(),
    onBeerBombCancel: vi.fn(),
    onBeerBombTurn: vi.fn(),
  }

  render(
    <BeerScoreThemeProvider>
      <CurrentUserProvider user={currentUser}>
        <TonightScreen night={night} {...handlers} />
      </CurrentUserProvider>
    </BeerScoreThemeProvider>
  )

  return { handlers }
}

describe('TonightScreen', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens a solo Beer Bomb dev match and resolves turns locally', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.625)
    const user = userEvent.setup()

    renderTonightScreen()

    await user.click(screen.getByRole('button', { name: /solo test/i }))

    expect(screen.getByText('Beer Bomb Solo Test')).toBeInTheDocument()
    expect(screen.getByText('Solo test mode keeps the turn on you so you can tap through the board without a second player.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Beer 1' }))

    expect(await screen.findByRole('button', { name: 'Beer 1, drained' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Beer 6/ }))

    expect(await screen.findByText('The House won the beer line')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})
