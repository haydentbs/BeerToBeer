import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NotificationPanel } from '@/components/notification-panel'
import type { Notification } from '@/lib/store'

describe('NotificationPanel', () => {
  it('opens the linked notification target when a notification row is clicked', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()
    const handleOpenNotification = vi.fn()

    const notifications: Notification[] = [
      {
        id: 'notification-1',
        crewId: 'crew-1',
        type: 'challenge',
        title: 'Beer Bomb invite',
        message: 'Riley challenged you to Beer Bomb.',
        crewName: 'Friday Crew',
        timestamp: new Date('2026-03-21T18:15:00.000Z'),
        read: false,
        payload: {
          matchId: 'match-1',
          proposedWager: 2,
        },
      },
    ]

    render(
      <NotificationPanel
        notifications={notifications}
        isOpen
        onClose={handleClose}
        onMarkAllRead={vi.fn()}
        onOpenNotification={handleOpenNotification}
      />
    )

    await user.click(screen.getByRole('button', { name: /beer bomb invite/i }))

    expect(handleOpenNotification).toHaveBeenCalledWith(notifications[0])
    expect(handleClose).toHaveBeenCalled()
    expect(screen.getByText('Open challenge')).toBeInTheDocument()
  })
})
