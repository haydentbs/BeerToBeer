import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SettleUpThemeProvider } from '@/components/theme-provider'
import { ProfileModal } from '@/components/profile-modal'

describe('ProfileModal', () => {
  it('renders profile stats, appearance settings, and crew list', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <SettleUpThemeProvider>
        <ProfileModal
          isOpen
          onClose={onClose}
          userName="Alex Creator"
          userEmail="alex@example.com"
          userInitials="AC"
          crews={[
            { name: 'The Regulars', netPosition: 2.5 },
            { name: 'Office Crew', netPosition: -1 },
          ]}
          stats={{
            totalBetsPlaced: 18,
            totalWins: 10,
            winRate: 0.56,
            totalDrinksWon: 8.5,
            totalDrinksLost: 3,
            bestNight: 4,
            currentStreak: 3,
          }}
          onSignOut={vi.fn()}
        />
      </SettleUpThemeProvider>
    )

    expect(screen.getByText('Alex Creator')).toBeInTheDocument()
    expect(screen.getByText('Stats')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByText('Your Crews')).toBeInTheDocument()
    expect(screen.getByText('The Regulars')).toBeInTheDocument()
    expect(screen.getByText('Office Crew')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /close profile/i }))

    expect(onClose).toHaveBeenCalled()
  })

  it('renders the guest upgrade and guest-claim actions when available', () => {
    render(
      <SettleUpThemeProvider>
        <ProfileModal
          isOpen
          onClose={vi.fn()}
          userName="Guest Pal"
          userInitials="GP"
          isGuest
          crews={[{ name: 'The Regulars', netPosition: 0 }]}
          stats={{
            totalBetsPlaced: 2,
            totalWins: 1,
            winRate: 0.5,
            totalDrinksWon: 1,
            totalDrinksLost: 1,
            bestNight: 1,
            currentStreak: 1,
          }}
          onFinishAccount={vi.fn()}
        />
      </SettleUpThemeProvider>
    )

    expect(screen.getByRole('button', { name: /create your account/i })).toBeInTheDocument()
  })

  it('renders claimable guest rows and fires the claim callback', async () => {
    const user = userEvent.setup()
    const onClaimGuest = vi.fn()

    render(
      <SettleUpThemeProvider>
        <ProfileModal
          isOpen
          onClose={vi.fn()}
          userName="Taylor Account"
          userInitials="TA"
          crews={[{ name: 'The Regulars', netPosition: 1 }]}
          stats={{
            totalBetsPlaced: 4,
            totalWins: 2,
            winRate: 0.5,
            totalDrinksWon: 3,
            totalDrinksLost: 2,
            bestNight: 2,
            currentStreak: 1,
          }}
          claimableGuests={[
            {
              guestMembershipId: 'guest-membership-1',
              guestIdentityId: 'guest-identity-1',
              guestName: 'Taylor Alias',
              crewId: 'crew-1',
              crewName: 'The Regulars',
              status: 'active',
              joinedAt: '2026-03-29T12:00:00.000Z',
            },
          ]}
          onClaimGuest={onClaimGuest}
        />
      </SettleUpThemeProvider>
    )

    expect(screen.getByText('Claim guest stats')).toBeInTheDocument()
    expect(screen.getByText('Taylor Alias')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Claim' }))

    expect(onClaimGuest).toHaveBeenCalledWith('guest-membership-1')
  })
})
