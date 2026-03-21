import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CreateBetModal } from '@/components/create-bet-modal'
import { BeerScoreThemeProvider } from '@/components/theme-provider'
import { CurrentUserProvider } from '@/lib/current-user'
import type { User } from '@/lib/store'

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

describe('CreateBetModal', () => {
  it('omits closeTime when creating an h2h challenge', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()

    render(
      <BeerScoreThemeProvider>
        <CurrentUserProvider user={currentUser}>
          <CreateBetModal
            isOpen
            onClose={vi.fn()}
            onCreate={onCreate}
            onCreateMiniGame={vi.fn()}
            members={[currentUser, opponent]}
          />
        </CurrentUserProvider>
      </BeerScoreThemeProvider>
    )

    await user.click(screen.getByRole('button', { name: /Challenge 1v1 with side bets/i }))
    await user.click(screen.getByRole('button', { name: /Riley Rival/i }))
    await user.type(screen.getByPlaceholderText(/pool, darts, flip cup/i), 'First to three cups')
    await user.click(screen.getByRole('button', { name: 'Create Bet' }))

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'h2h',
        title: 'First to three cups',
        challenger: { id: opponent.id },
      })
    )
    expect(onCreate.mock.calls[0][0]).not.toHaveProperty('closeTime')
  })
})
