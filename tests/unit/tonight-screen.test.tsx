import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BeerScoreThemeProvider } from '@/components/theme-provider'
import { TonightScreen } from '@/components/tonight-screen'
import { CurrentUserProvider } from '@/lib/current-user'
import type { Night, User } from '@/lib/store'

function makeCurrentUser(): User {
  return {
    id: 'profile-1',
    membershipId: 'membership-1',
    role: 'creator',
    name: 'Alex Creator',
    avatar: '',
    initials: 'AC',
  }
}

function renderTonightScreen({
  night,
  currentUser = makeCurrentUser(),
}: {
  night?: Night
  currentUser?: User
} = {}) {
  const resolvedNight: Night = night ?? {
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
    onBetOfferAccept: vi.fn(),
    onBetOfferDecline: vi.fn(),
    onBeerBombAccept: vi.fn(),
    onBeerBombDecline: vi.fn(),
    onBeerBombCancel: vi.fn(),
    onBeerBombTurn: vi.fn(),
  }

  function ControlledTonightScreen() {
    const [selectedBetId, setSelectedBetId] = useState<string | null>(null)
    const [selectedBeerBombMatchId, setSelectedBeerBombMatchId] = useState<string | null>(null)

    return (
      <TonightScreen
        night={resolvedNight}
        selectedBetId={selectedBetId}
        selectedBeerBombMatchId={selectedBeerBombMatchId}
        onSelectBet={setSelectedBetId}
        onSelectBeerBombMatch={setSelectedBeerBombMatchId}
        {...handlers}
      />
    )
  }

  render(
    <BeerScoreThemeProvider>
      <CurrentUserProvider user={currentUser}>
        <ControlledTonightScreen />
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

  it('shows actionable bet and challenge banners for the current recipient', async () => {
    const user = userEvent.setup()
    const creator = makeCurrentUser()
    const currentUser: User = {
      id: 'profile-2',
      membershipId: 'membership-2',
      role: 'member',
      name: 'Riley Rival',
      avatar: '',
      initials: 'RR',
    }

    const night: Night = {
      id: 'night-1',
      name: 'Friday Tab',
      status: 'active',
      startedAt: new Date('2026-03-21T18:00:00.000Z'),
      participants: [creator, currentUser],
      bets: [
        {
          id: 'bet-1',
          type: 'h2h',
          subtype: null,
          title: 'Darts rematch',
          creator,
          challenger: currentUser,
          status: 'pending_accept',
          createdAt: new Date('2026-03-21T18:05:00.000Z'),
          closesAt: null,
          challengeWager: 2,
          respondByAt: new Date(Date.now() + 60_000),
          options: [
            { id: 'option-1', label: 'Alex Creator wins', wagers: [], totalDrinks: 0 },
            { id: 'option-2', label: 'Riley Rival wins', wagers: [], totalDrinks: 0 },
          ],
          totalPool: 0,
        },
      ],
      miniGameMatches: [
        {
          id: 'match-1',
          gameKey: 'beer_bomb',
          title: 'Beer Bomb finals',
          status: 'pending',
          challenger: creator,
          opponent: currentUser,
          proposedWager: 1.5,
          agreedWager: undefined,
          boardSize: 8,
          revealedSlotIndices: [],
          revealedSlots: [],
          currentTurnMembershipId: null,
          winnerMembershipId: null,
          loserMembershipId: null,
          createdAt: new Date('2026-03-21T18:06:00.000Z'),
          updatedAt: new Date('2026-03-21T18:06:00.000Z'),
          respondByAt: new Date(Date.now() + 120_000),
        },
      ],
    }

    const { handlers } = renderTonightScreen({ night, currentUser })

    expect(screen.getByText('Darts rematch')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept & place 2/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept & play for 1.5/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /accept & place 2/i }))
    expect(handlers.onBetOfferAccept).toHaveBeenCalledWith('bet-1')

    await user.click(screen.getAllByRole('button', { name: /^decline$/i })[0])
    expect(handlers.onBetOfferDecline).toHaveBeenCalledWith('bet-1')

    await user.click(screen.getByRole('button', { name: /accept & play for 1.5/i }))
    expect(handlers.onBeerBombAccept).toHaveBeenCalledWith('match-1')
  })

  it('shows pending offers as waiting cards for the creator instead of actionable banners', () => {
    const currentUser = makeCurrentUser()
    const opponent: User = {
      id: 'profile-2',
      membershipId: 'membership-2',
      role: 'member',
      name: 'Riley Rival',
      avatar: '',
      initials: 'RR',
    }

    const night: Night = {
      id: 'night-1',
      name: 'Friday Tab',
      status: 'active',
      startedAt: new Date('2026-03-21T18:00:00.000Z'),
      participants: [currentUser, opponent],
      bets: [
        {
          id: 'bet-1',
          type: 'h2h',
          subtype: null,
          title: 'Pool race',
          creator: currentUser,
          challenger: opponent,
          status: 'pending_accept',
          createdAt: new Date('2026-03-21T18:05:00.000Z'),
          closesAt: null,
          challengeWager: 1,
          respondByAt: new Date(Date.now() + 60_000),
          options: [
            { id: 'option-1', label: 'Alex Creator wins', wagers: [], totalDrinks: 0 },
            { id: 'option-2', label: 'Riley Rival wins', wagers: [], totalDrinks: 0 },
          ],
          totalPool: 0,
        },
      ],
      miniGameMatches: [],
    }

    renderTonightScreen({ night, currentUser })

    expect(screen.getByText('Waiting On Response')).toBeInTheDocument()
    expect(screen.getByText(/waiting for Riley Rival to accept 1 drinks/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /accept & place/i })).not.toBeInTheDocument()
  })
})
