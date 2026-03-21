import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BeerScoreThemeProvider } from '@/components/theme-provider'
import { CrewScreen } from '@/components/crew-screen'
import type { Crew } from '@/lib/store'

function renderCrewScreen(props: Partial<ComponentProps<typeof CrewScreen>> = {}) {
  const crew: Crew = {
    id: 'crew-1',
    name: 'The Regulars',
    inviteCode: 'PUB123',
    drinkTheme: 'beer',
    members: [
      {
        id: 'profile-1',
        membershipId: 'membership-1',
        role: 'creator',
        name: 'Alex Creator',
        avatar: '',
        initials: 'AC',
      },
      {
        id: 'profile-2',
        membershipId: 'membership-2',
        role: 'member',
        name: 'Sam Member',
        avatar: '',
        initials: 'SM',
      },
      {
        id: 'guest-1',
        membershipId: 'membership-guest',
        role: 'guest',
        name: 'Guest Pal',
        avatar: '',
        initials: 'GP',
      },
    ],
    currentNight: {
      id: 'night-1',
      name: 'Friday Tab',
      status: 'active',
      startedAt: new Date('2026-03-21T18:00:00.000Z'),
      bets: [],
      miniGameMatches: [],
      participants: [
        {
          id: 'profile-1',
          membershipId: 'membership-1',
          role: 'creator',
          name: 'Alex Creator',
          avatar: '',
          initials: 'AC',
        },
        {
          id: 'profile-2',
          membershipId: 'membership-2',
          role: 'member',
          name: 'Sam Member',
          avatar: '',
          initials: 'SM',
        },
      ],
    },
    pastNights: [],
  }

  const handlers = {
    onStartNight: vi.fn(),
    onLeaveNight: vi.fn(),
    onRejoinNight: vi.fn(),
    onRenameCrew: vi.fn(),
    onKickMember: vi.fn(),
    onDeleteCrew: vi.fn(),
    onLeaveCrew: vi.fn(),
    onChangeDrinkTheme: vi.fn(),
  }

  render(
    <BeerScoreThemeProvider>
      <CrewScreen
        crew={crew}
        currentUserId="profile-1"
        currentMembershipId="membership-1"
        {...handlers}
        {...props}
      />
    </BeerScoreThemeProvider>
  )

  return { crew, handlers }
}

describe('CrewScreen', () => {
  it('shows the leave-night action when the current member is still in the active night', () => {
    renderCrewScreen()

    expect(screen.getByRole('button', { name: "I'm Out" })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rejoin' })).not.toBeInTheDocument()
  })

  it('shows rejoin when the current membership is out, even if the viewer id is not the visible member id', () => {
    renderCrewScreen({
      currentUserId: 'auth-user-id',
      currentMembershipId: 'membership-guest',
      crew: {
        id: 'crew-1',
        name: 'The Regulars',
        inviteCode: 'PUB123',
        drinkTheme: 'beer',
        members: [
          {
            id: 'profile-1',
            membershipId: 'membership-1',
            role: 'creator',
            name: 'Alex Creator',
            avatar: '',
            initials: 'AC',
          },
          {
            id: 'guest-visible-id',
            membershipId: 'membership-guest',
            role: 'guest',
            name: 'Guest Pal',
            avatar: '',
            initials: 'GP',
          },
        ],
        currentNight: {
          id: 'night-1',
          name: 'Friday Tab',
          status: 'active',
          startedAt: new Date('2026-03-21T18:00:00.000Z'),
          bets: [],
          miniGameMatches: [],
          participants: [
            {
              id: 'profile-1',
              membershipId: 'membership-1',
              role: 'creator',
              name: 'Alex Creator',
              avatar: '',
              initials: 'AC',
            },
          ],
        },
        pastNights: [],
      },
    })

    expect(screen.getByRole('button', { name: 'Rejoin' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "I'm Out" })).not.toBeInTheDocument()
  })

  it('shows creator settings and guest markers in the member list', async () => {
    const user = userEvent.setup()
    const { handlers } = renderCrewScreen()

    expect(screen.getAllByText('~ Guest')[0]).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /open crew settings/i }))

    expect(screen.getByText('Crew Settings')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rename Crew' })).toBeInTheDocument()
    expect(screen.getByText('Drink Theme')).toBeInTheDocument()
    expect(screen.getByText('Manage Members')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /rename crew/i }))
    await user.clear(screen.getByDisplayValue('The Regulars'))
    await user.type(screen.getByRole('textbox'), 'New Crew Name')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(handlers.onRenameCrew).toHaveBeenCalledWith('New Crew Name')
  })
})
