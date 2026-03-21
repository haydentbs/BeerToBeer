import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HomeScreen } from '@/components/home-screen'
import type { Crew } from '@/lib/store'

function makeCrew(): Crew {
  return {
    id: 'crew-1',
    name: 'The Regulars',
    inviteCode: 'DEMO1234',
    drinkTheme: 'beer',
    members: [
      {
        id: 'guest-1',
        name: 'Guest Pal',
        avatar: '',
        initials: 'GP',
        role: 'guest',
      },
    ],
    pastNights: [],
  }
}

describe('HomeScreen', () => {
  it('routes guest join attempts to the finish-account prompt instead of the join modal', async () => {
    const user = userEvent.setup()
    const onFinishAccount = vi.fn()

    render(
      <HomeScreen
        user={{ id: 'guest-1', name: 'Guest Pal', avatar: '', initials: 'GP', role: 'guest' }}
        isGuest
        crews={[makeCrew()]}
        crewNetPositions={{ 'crew-1': 0 }}
        onSelectCrew={vi.fn()}
        onCreateCrew={vi.fn().mockResolvedValue(false)}
        onJoinCrew={vi.fn().mockResolvedValue(false)}
        onFinishAccount={onFinishAccount}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Join' }))

    expect(screen.getByRole('heading', { name: /finish your account to join more crews/i })).toBeInTheDocument()
    expect(screen.queryByText('Join a Crew')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Finish Account' }))

    expect(onFinishAccount).toHaveBeenCalled()
  })
})
